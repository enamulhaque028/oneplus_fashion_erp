/* Google Drive sync: login screen, keeping this computer and Google Drive in step, header badge,
   Settings section. Design: docs/superpowers/specs/2026-10-18-google-drive-sync-design.md

   Rules
   - Off unless OPF.drive.enabled() (Client ID set + opened from a web address): then nothing here runs.
   - Sign in once per computer; afterwards the ERP opens straight away, even offline.
   - Every save is kept locally first, then uploaded a few seconds later. The upload replaces
     "OnePlusFashion ERP Data.json" in Drive (a normal ERP restore file); once a day the previous
     version is kept as a dated backup copy (last 30 kept).
   - Every upload stamps the file with a new `syncId` (appProperties). A different syncId in Drive
     means another computer saved since our last sync. (Drive's own `version` is not used: Google
     raises it for its own background changes too, which looked like edits from elsewhere.)
       changed there, nothing new here  -> take the Drive copy;
       changed here, not there          -> upload;
       changed in both                  -> ask which to keep; the other is saved as a "Conflict copy".
   - Sync state lives under its own localStorage key (opf_erp_cloud), never inside the ERP data. */
(function (OPF) {
  "use strict";

  const D = OPF.drive;
  const { esc, uid, today } = OPF.util;
  const META_KEY = "opf_erp_cloud";
  const $ = (id) => document.getElementById(id);
  const S = () => D.settings();

  let meta = {};
  let applying = false;     // replacing local data with the Drive copy: not a local change
  let running = false, again = false, requesting = false;
  let needsCheck = true;    // look for changes from other computers at the next chance
  let timer = null, status = "off", statusDetail = "";
  let gateDone = null, choose = null;

  /* ---------- sync state ---------- */
  function loadMeta() {
    try { meta = JSON.parse(localStorage.getItem(META_KEY) || "{}") || {}; } catch (e) { meta = {}; }
    if (!meta.deviceId) meta.deviceId = uid();
    meta.rev = meta.rev || 0;           // local change counter
    meta.syncedRev = meta.syncedRev || 0; // counter value last uploaded / downloaded
    saveMeta();
  }
  function saveMeta() { try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (e) { /* storage full: sync state only */ } }
  const dirty = () => meta.rev != meta.syncedRev;
  const online = () => navigator.onLine !== false;

  const DATA_COLLECTIONS = ["sales", "customers", "suppliers", "purchases", "payments", "products", "expenses", "production", "transfers", "factories"];
  const hasData = (db) => DATA_COLLECTIONS.some((k) => (db[k] || []).length);
  const counts = (db) => ({ invoices: db.sales.length, customers: db.customers.length, suppliers: db.suppliers.length, payments: db.payments.length, purchases: db.purchases.length });
  const countText = (c) => (c ? `${c.invoices || 0} invoices · ${c.customers || 0} customers` + (c.suppliers == null ? "" : ` · ${c.suppliers} suppliers`) + ` · ${c.payments || 0} payments` : "");
  const syncIdOf = (file) => (file.appProperties || {}).syncId || "";
  const when = (iso) => (iso ? new Date(iso).toLocaleString() : "unknown");

  /* ---------- header badge and status ---------- */
  const LABELS = {
    synced: "Synced", saving: "Saving…", checking: "Checking…", pending: "Changes waiting", offline: "Offline – will sync later",
    reconnect: "Click to sync", error: "Sync problem", signedout: "Not signed in", conflict: "Choose a copy"
  };
  function setStatus(s, detail) {
    status = s;
    statusDetail = detail || "";
    const b = $("syncBadge");
    if (b) {
      b.hidden = false;
      b.className = "chip sync s-" + s;
      b.innerHTML = OPF.icon(s == "offline" ? "cloudoff" : "cloud") + `<span class="lb">${LABELS[s]}</span>`;
      b.title = detail || (meta.lastSync ? "Last synced " + when(meta.lastSync) : "Google Drive backup");
    }
    const box = $("cloudBox");
    if (box) box.outerHTML = settingsHtml();
  }

  function toast(text) {
    let t = $("cloudToast");
    if (!t) { t = document.createElement("div"); t.id = "cloudToast"; document.body.appendChild(t); }
    t.textContent = text;
    t.className = "show";
    clearTimeout(t._h);
    t._h = setTimeout(() => { t.className = ""; }, 4000);
  }

  /* ---------- the sync cycle ---------- */
  function onLocalSave() {
    if (applying || !meta.account) return;
    meta.rev++;
    meta.localChangedAt = new Date().toISOString();
    saveMeta();
    setStatus(!online() ? "offline" : D.hasToken() ? "pending" : "reconnect");
    clearTimeout(timer);
    timer = setTimeout(sync, S().UPLOAD_DELAY_MS);
  }

  // One sync at a time; a request during a sync runs once more afterwards.
  function sync() {
    if (!meta.account || status == "conflict") return Promise.resolve();
    if (running) { again = true; return Promise.resolve(); }
    if (!online()) { setStatus("offline"); return Promise.resolve(); }
    if (!D.hasToken()) { setStatus("reconnect"); return Promise.resolve(); }
    running = true;
    setStatus(dirty() ? "saving" : "checking");
    return run()
      .then(() => { needsCheck = false; setStatus(dirty() ? "pending" : "synced"); }, onError)
      .then(() => {
        running = false;
        if (again) { again = false; return sync(); }
        if (dirty() && status == "pending") { clearTimeout(timer); timer = setTimeout(sync, S().UPLOAD_DELAY_MS); }
      });
  }

  function onError(e) {
    if (e.code == "auth") setStatus("reconnect", e.message);
    else if (e.code == "offline") setStatus("offline", e.message);
    else setStatus("error", e.message);
  }

  function run() {
    return currentFile().then((file) => {
      if (!file) return uploadNew();
      const changedThere = syncIdOf(file) != (meta.syncId || "");
      if (changedThere && !dirty()) return applyRemote(file);
      if (changedThere) return conflict(file);
      if (dirty()) return upload(file);
    });
  }

  // The Drive data file: by remembered id, else by searching (new computer, or file re-created).
  function currentFile() {
    const known = meta.fileId
      ? D.meta(meta.fileId).catch((e) => { if (e.code == "missing") { meta.fileId = null; meta.syncId = null; return null; } throw e; })
      : Promise.resolve(null);
    return known.then((f) => f || D.find("data").then((list) => {
      const found = list[0] || null;
      if (found) { meta.fileId = found.id; saveMeta(); }
      return found;
    }));
  }

  function folderId() {
    if (meta.folderId) return Promise.resolve(meta.folderId);
    return D.find("folder").then((l) => l[0] || D.createFolder(S().FOLDER)).then((f) => { meta.folderId = f.id; saveMeta(); return f.id; });
  }

  function payload() {
    const db = OPF.store.db;
    return { text: JSON.stringify(db), props: { opfErp: "data", savedAt: new Date().toISOString(), savedBy: meta.deviceId, syncId: uid(), counts: JSON.stringify(counts(db)) } };
  }

  // syncId: the stamp of the copy both sides now hold.
  function synced(file, rev, syncId) {
    meta.fileId = file.id;
    meta.syncId = syncId;
    delete meta.version; // older builds compared Drive's version
    meta.syncedRev = rev;
    meta.lastSync = new Date().toISOString();
    saveMeta();
  }

  function uploadNew() {
    const rev = meta.rev, p = payload();
    return folderId()
      .then((fid) => D.create({ name: S().DATA_FILE, parents: [fid], mimeType: "application/json", appProperties: p.props }, p.text))
      .then((f) => { meta.lastBackupDay = today(); synced(f, rev, p.props.syncId); });
  }

  function upload(file) {
    const rev = meta.rev;
    const p = payload();
    return dailyBackup(file).then(() => D.update(file.id, { appProperties: p.props }, p.text)).then((f) => synced(f, rev, p.props.syncId));
  }

  // Before the first upload of the day, keep the previous version as a dated copy (last N kept).
  function dailyBackup(file) {
    const day = today();
    if (meta.lastBackupDay == day) return Promise.resolve();
    return folderId()
      .then((fid) => D.copy(file.id, { name: `OnePlusFashion ERP Backup ${day}.json`, parents: [fid], appProperties: { opfErp: "backup", day } }))
      .then(() => D.find("backup"))
      .then((list) => Promise.all(list.slice(S().KEEP_DAILY_BACKUPS).map((f) => D.remove(f.id))))
      .then(() => { meta.lastBackupDay = day; saveMeta(); });
  }

  function applyRemote(file, quiet) {
    return D.download(file.id).then((data) => {
      if (!data || typeof data != "object" || !Array.isArray(data.sales)) throw Object.assign(new Error("The Drive file is not ERP data."), { code: "bad" });
      applying = true;
      try { OPF.store.replace(OPF.migrate.normalize(data)); } finally { applying = false; }
      synced(file, meta.rev, syncIdOf(file));
      if (!quiet) {
        OPF.router.reload();
        toast("Updated with the latest data from Google Drive.");
      }
    });
  }

  /* ---------- both changed: ask which copy to keep ---------- */
  function readCounts(file) { try { return JSON.parse((file.appProperties || {}).counts || "null"); } catch (e) { return null; } }

  function conflict(file) {
    setStatus("conflict");
    const local = counts(OPF.store.db), remote = readCounts(file), remoteAt = (file.appProperties || {}).savedAt || file.modifiedTime;
    const stamp = new Date().toISOString().slice(0, 16).replace("T", " ").replace(":", ".");
    return askWhich(local, remote, remoteAt).then((pick) => folderId().then((fid) => {
      setStatus("saving");
      if (pick == "drive") {
        const p = payload();
        return D.create({ name: `OnePlusFashion ERP Conflict copy ${stamp} (this computer).json`, parents: [fid], mimeType: "application/json", appProperties: { opfErp: "conflict" } }, p.text)
          .then(() => applyRemote(file, !!gateDone));
      }
      return D.copy(file.id, { name: `OnePlusFashion ERP Conflict copy ${stamp} (Google Drive).json`, parents: [fid], appProperties: { opfErp: "conflict" } })
        .then(() => upload(file));
    }));
  }

  function askWhich(local, remote, remoteAt) {
    return new Promise((resolve) => {
      choose = (pick) => { choose = null; $("cloudDialog").remove(); resolve(pick); };
      const d = document.createElement("div");
      d.id = "cloudDialog";
      d.innerHTML = `<div class="cd-card"><div class="dlg-ic">${OPF.icon("cloud")}</div><h2>Which data should be kept?</h2>` +
        "<p class=\"muted\">This computer and Google Drive both have changes. Choose the copy to keep - the other one is saved in Drive as a \"Conflict copy\", so nothing is lost.</p>" +
        `<div class="cd-opts"><button type="button" class="cd-opt" data-act="cloud.choose" data-pick="drive"><b>Google Drive copy</b><span>${esc(countText(remote))}</span><small>Saved ${esc(when(remoteAt))}</small></button>` +
        `<button type="button" class="cd-opt" data-act="cloud.choose" data-pick="local"><b>This computer's copy</b><span>${esc(countText(local))}</span><small>Last change ${esc(when(meta.localChangedAt))}</small></button></div></div>`;
      document.body.appendChild(d);
    });
  }

  /* ---------- login screen (first sign-in on this computer) ---------- */
  const BLOBS = '<div class="gb gb1"></div><div class="gb gb2"></div><div class="gb gb3"></div><div class="gb gb4"></div>';
  const G_LOGO = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

  function gate(inner) {
    let g = $("cloudGate");
    if (!g) { g = document.createElement("div"); g.id = "cloudGate"; document.body.appendChild(g); }
    g.innerHTML = BLOBS + `<div class="gate-card">${inner}</div><div class="gate-foot">Your data is saved only in your own Google Drive · <a href="privacy.html" target="_blank" rel="noopener">Privacy</a> · <a href="terms.html" target="_blank" rel="noopener">Terms</a></div>`;
  }
  const logoTile = () => { const co = OPF.store.db.company; return `<div class="gate-logo">${co.logo ? `<img src="${co.logo}" alt="">` : OPF.print.brandMark(true)}</div>`; };

  function gateSignIn(message) {
    gate(logoTile() + `<h1>${esc(OPF.store.db.company.name || "One Plus Fashion")} ERP</h1><p>Sign in to keep your data safe in Google Drive</p>` +
      `<button type="button" class="gbtn" data-act="cloud.signin">${G_LOGO}Sign in with Google</button>` +
      `<div class="gate-msg" id="gateMsg">${esc(message || "")}</div>` +
      `<div class="gate-chips"><span>${OPF.icon("cloud")}Auto backup</span><span>${OPF.icon("grid")}Any computer</span><span>${OPF.icon("cloudoff")}Works offline</span></div>`);
  }

  function gateOffline(message) {
    gate(logoTile() + `<h1>No internet connection</h1><p>${esc(message || "Connect to the internet to sign in with Google the first time.")}</p>` +
      '<button type="button" class="gbtn" data-act="cloud.retry">Try again</button>' +
      '<button type="button" class="gate-link" data-act="cloud.skip">Continue offline for now (sign in later)</button>');
  }

  function gateWorking(title, detail) {
    gate(`<div class="gate-who">${esc(meta.account ? meta.account.email : "")}</div><div class="gate-ring"></div><b class="gate-title">${esc(title)}</b>` +
      `<div class="gate-bar"><i></i></div><div class="gate-detail">${esc(detail || "")}</div>`);
  }

  function gateFinish() {
    gate('<div class="gate-tick"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div><b class="gate-title">All set!</b>' +
      "<div class=\"gate-detail\">Your data is up to date. Every save now backs up to Google Drive automatically.</div>");
    setTimeout(closeGate, 1400);
  }

  function closeGate() {
    const g = $("cloudGate");
    if (g) g.remove();
    const done = gateDone;
    gateDone = null;
    if (done) done();
    setStatus(dirty() ? "pending" : "synced");
  }

  function showGate(onDone) {
    gateDone = onDone || (() => OPF.router.reload());
    gateSignIn();
    D.preload().catch((e) => gateOffline(e.message));
  }

  function signIn() {
    const msg = $("gateMsg");
    if (msg) msg.textContent = "";
    D.getToken(null, true)
      .then(() => { gateWorking("Connecting to Google Drive…"); return D.whoAmI(); })
      .then((user) => { meta.account = { email: user.emailAddress, name: user.displayName || "" }; saveMeta(); return firstLink(); })
      .then(gateFinish, (e) => {
        if (e.code == "offline") gateOffline(e.message);
        else gateSignIn(e.code == "closed" ? "" : e.message);
      });
  }

  // First sign-in on this computer: upload, download, or ask when both have data.
  function firstLink() {
    return D.find("data").then((list) => {
      const file = list[0];
      if (!file) {
        gateWorking("Saving this computer's data to Google Drive…", countText(counts(OPF.store.db)));
        return uploadNew();
      }
      meta.fileId = file.id;
      saveMeta();
      if (!hasData(OPF.store.db)) {
        gateWorking("Restoring your data…", countText(readCounts(file)));
        return applyRemote(file, true);
      }
      return conflict(file);
    });
  }

  /* ---------- the next click renews the hourly Google access when a sync needs it ---------- */
  function onGesture(e) {
    if (!meta.account || D.hasToken() || requesting || !online() || $("cloudGate") || $("cloudDialog")) return;
    if (!dirty() && !needsCheck) return;
    if (e.target && e.target.closest && e.target.closest("#syncBadge")) return; // the badge does it itself
    reconnect();
  }

  function reconnect() {
    requesting = true;
    return D.getToken(meta.account.email, false)
      .then(() => { requesting = false; return sync(); }, (err) => { requesting = false; setStatus(err.code == "offline" ? "offline" : "reconnect", err.message); });
  }

  /* ---------- Settings section ---------- */
  function settingsHtml() {
    const H = OPF.html;
    if (!D.enabled()) {
      return '<div class="box" id="cloudBox"><h2 style="margin-top:0">Google Drive backup</h2><p class="muted">Off. Automatic backup to Google Drive works when the ERP is opened from its web link and a Google sign-in key is set up (see docs/CLOUD_SETUP.md). Until then, use the backup buttons below.</p></div>';
    }
    if (!meta.account) {
      return '<div class="box" id="cloudBox"><h2 style="margin-top:0">Google Drive backup</h2><p>Not signed in on this computer - changes are saved here only.</p>' + H.button("Sign in with Google", "cloud.badge") + "</div>";
    }
    const folder = meta.folderId ? ` · <a href="https://drive.google.com/drive/folders/${esc(meta.folderId)}" target="_blank" rel="noopener">Open the Drive folder</a>` : "";
    return '<div class="box" id="cloudBox"><h2 style="margin-top:0">Google Drive backup</h2>' +
      `<p><b>${esc(meta.account.name || meta.account.email)}</b> <span class="muted">${esc(meta.account.email)}</span><br>` +
      `Status: <b>${esc(LABELS[status] || status)}</b>${statusDetail ? ` <span class="muted">(${esc(statusDetail)})</span>` : ""} · Last synced: ${esc(when(meta.lastSync))}${folder}</p>` +
      `<div class="actions">${H.button("Sync now", "cloud.syncNow")}${H.button("Sign out", "cloud.signout", null, "light")}</div>` +
      '<p class="muted">Every save is backed up automatically. A dated copy is kept for each day (last 30). Signing out keeps the data on this computer; the sign-in screen appears the next time the ERP opens.</p></div>';
  }

  function signOut() {
    if (dirty() && !confirm("Some changes are not in Google Drive yet. Sign out anyway? They stay on this computer only.")) return;
    if (!dirty() && !confirm("Sign out of Google Drive backup on this computer?")) return;
    D.forgetToken();
    ["account", "fileId", "folderId", "syncId", "version", "lastSync", "lastBackupDay"].forEach((k) => { delete meta[k]; });
    meta.syncedRev = meta.rev;
    saveMeta();
    location.reload();
  }

  /* ---------- start-up ---------- */
  function start(done) {
    if (!D.enabled()) { done(); return; }
    loadMeta();
    D.restoreToken();
    OPF.store.onSave(onLocalSave);
    document.addEventListener("pointerdown", onGesture, true);
    document.addEventListener("keydown", onGesture, true);
    window.addEventListener("online", () => sync());
    window.addEventListener("offline", () => { if (meta.account) setStatus("offline"); });
    document.addEventListener("visibilitychange", () => { if (!document.hidden && meta.account) { needsCheck = true; sync(); } });
    D.preload().catch(() => { /* offline: the badge shows it */ });
    if (!meta.account) { setStatus("signedout"); showGate(done); return; }
    done();
    sync(); // checks Drive now if this tab still has Google access, else the next click does
  }

  OPF.cloud = { start, settingsHtml, sync, toast, get status() { return status; }, get meta() { return meta; } };
  OPF.actions.register({
    "cloud.signin": signIn,
    "cloud.retry": () => showGate(gateDone),
    "cloud.skip": () => { const g = $("cloudGate"); if (g) g.remove(); const done = gateDone; gateDone = null; if (done) done(); setStatus("signedout"); },
    "cloud.choose": (el) => { if (choose) choose(el.dataset.pick); },
    "cloud.badge": () => {
      if (!meta.account) { showGate(null); return; }
      if (!D.hasToken()) { reconnect(); return; }
      needsCheck = true;
      sync();
    },
    "cloud.syncNow": () => { needsCheck = true; if (D.hasToken()) sync(); else reconnect(); },
    "cloud.signout": signOut
  });
})(window.OPF = window.OPF || {});
