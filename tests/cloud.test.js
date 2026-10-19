/* Google sign-in + Google Drive sync, end to end with fakes at the network boundary:
   - window.google.accounts.oauth2 (Google sign-in) is replaced by a fake that hands out tokens;
   - fetch() calls to googleapis.com go to FakeDrive below (one Drive shared by all "computers");
   - each computer is a separate browser profile with its own saved data.
   The ERP's real sync code (js/services/drive.js, cloud.js) runs unchanged.
   Run:  node cloud.test.js   (needs fixtures/OnePlusFashion_Demo_Data.json; options: see lib.js) */
const path = require("path");
const fs = require("fs");
const { start, sleep } = require("./lib");

const DEMO = path.join(__dirname, "fixtures", "OnePlusFashion_Demo_Data.json");

/* ---------- fake Google Drive (v3 REST subset used by the ERP) ---------- */
class FakeDrive {
  constructor() { this.files = {}; this.seq = 0; this.clock = Date.parse("2026-01-01T00:00:00Z"); this.rejectAuth = false; this.log = []; }
  stamp() { this.clock += 1000; return new Date(this.clock).toISOString(); }
  meta(f) { return { id: f.id, name: f.name, version: String(f.version), modifiedTime: f.modifiedTime, appProperties: f.appProperties, mimeType: f.mimeType, parents: f.parents }; }
  add(m, content) {
    const f = Object.assign({ id: "f" + ++this.seq, version: 1, modifiedTime: this.stamp(), appProperties: {}, parents: [] }, m, { content });
    this.files[f.id] = f;
    return f;
  }
  kind(kind) { return Object.values(this.files).filter((f) => (f.appProperties || {}).opfErp == kind).sort((a, b) => (a.modifiedTime < b.modifiedTime ? 1 : -1)); }
  data() { const f = this.kind("data")[0]; return f && JSON.parse(f.content); }
  json(status, body) { return { status, type: "application/json", body: body == null ? null : JSON.stringify(body) }; }
  parseMultipart(contentType, body) {
    const b = /boundary=([^;]+)/.exec(contentType)[1];
    const parts = body.split("--" + b).slice(1, -1).map((p) => p.slice(p.indexOf("\r\n\r\n") + 4).replace(/\r\n$/, ""));
    return { meta: JSON.parse(parts[0]), content: parts[1] };
  }
  // Real Drive raises `version` for changes made on its side too (processing, copies...), so the
  // number returned by an upload is soon out of date. Mimic that after every write.
  drift(f) { if (f) f.version++; }
  handle(req) {
    const r = this.route(req);
    const m = /\/files\/(\w+)(\/copy)?$/.exec(new URL(req.url).pathname);
    if (req.method != "GET" && r.status == 200) {
      if (m) this.drift(this.files[m[1]]);
      else if (r.body) this.drift(this.files[JSON.parse(r.body).id]);
    }
    return r;
  }
  route(req) {
    const u = new URL(req.url), p = u.pathname, auth = (req.headers || {}).Authorization || "";
    this.log.push(req.method + " " + p + (u.searchParams.get("alt") ? "?alt=media" : ""));
    if (this.rejectAuth || !/^Bearer tok/.test(auth)) return this.json(401, { error: "unauthorized" });
    let m;
    if (p == "/drive/v3/about") return this.json(200, { user: { emailAddress: "shop@gmail.com", displayName: "One Plus Fashion" } });
    if (p == "/drive/v3/files" && req.method == "GET") {
      const kind = /value='(\w+)'/.exec(u.searchParams.get("q"))[1];
      return this.json(200, { files: this.kind(kind).map((f) => this.meta(f)) });
    }
    if (p == "/drive/v3/files" && req.method == "POST") return this.json(200, this.meta(this.add(JSON.parse(req.body), null)));
    if ((m = /^\/drive\/v3\/files\/(\w+)\/copy$/.exec(p))) {
      const src = this.files[m[1]];
      if (!src) return this.json(404, {});
      const over = JSON.parse(req.body);
      return this.json(200, this.meta(this.add({ name: over.name, parents: over.parents, mimeType: src.mimeType, appProperties: Object.assign({}, src.appProperties, over.appProperties) }, src.content)));
    }
    if ((m = /^\/drive\/v3\/files\/(\w+)$/.exec(p))) {
      const f = this.files[m[1]];
      if (!f) return this.json(404, {});
      if (req.method == "DELETE") { delete this.files[f.id]; return { status: 204, body: null }; }
      if (u.searchParams.get("alt") == "media") return { status: 200, type: "application/json", body: f.content };
      return this.json(200, this.meta(f));
    }
    if (p == "/upload/drive/v3/files" && req.method == "POST") {
      const mp = this.parseMultipart(req.headers["Content-Type"], req.body);
      return this.json(200, this.meta(this.add(mp.meta, mp.content)));
    }
    if ((m = /^\/upload\/drive\/v3\/files\/(\w+)$/.exec(p)) && req.method == "PATCH") {
      const f = this.files[m[1]];
      if (!f) return this.json(404, {});
      const mp = this.parseMultipart(req.headers["Content-Type"], req.body);
      f.content = mp.content;
      f.appProperties = Object.assign({}, f.appProperties, mp.meta.appProperties);
      f.version++;
      f.modifiedTime = this.stamp();
      return this.json(200, this.meta(f));
    }
    return this.json(400, { error: "unsupported " + req.method + " " + p });
  }
}

(async () => {
  const T = await start("cloud");
  const { browser, check, section, APP, OUT } = T;
  const drive = new FakeDrive();
  const newContext = () => (browser.createBrowserContext || browser.createIncognitoBrowserContext).call(browser);

  // A "computer": its own browser profile, the fake Google sign-in and the fake Drive.
  async function computer(name, opts = {}) {
    const ctx = await newContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 1366, height: 860 });
    page.on("dialog", (d) => d.accept());
    page.on("pageerror", (e) => T.errors.push(name + ": " + e.message));
    await page.exposeFunction("__drive", (req) => drive.handle(req));
    await page.evaluateOnNewDocument((withGoogle, flags) => {
      window.OPF_CLOUD_TEST = Object.assign({ ENABLE_GOOGLE_LOGIN: true, GOOGLE_CLIENT_ID: "test-client.apps.googleusercontent.com", UPLOAD_DELAY_MS: 300 }, flags);
      window.__gis = { calls: 0, opts: [], fail: null };
      if (withGoogle) {
        window.google = { accounts: { oauth2: { initTokenClient: (cfg) => ({ requestAccessToken: (o) => {
          window.__gis.calls++; window.__gis.opts.push(o);
          setTimeout(() => (window.__gis.fail ? cfg.error_callback({ type: window.__gis.fail }) : cfg.callback({ access_token: "tok-" + Date.now(), expires_in: 3600 })), 40);
        } }) } } };
      }
      const realFetch = window.fetch;
      window.fetch = (url, o) => {
        if (!/googleapis\.com/.test(url)) return realFetch(url, o);
        if (window.__offline) return Promise.reject(new TypeError("Failed to fetch"));
        return window.__drive({ url: String(url), method: (o && o.method) || "GET", headers: (o && o.headers) || {}, body: (o && o.body) || null })
          .then((r) => new Response(r.body, { status: r.status, headers: { "content-type": r.type || "application/json" } }));
      };
    }, opts.withGoogle !== false, opts.flags || {});
    if (opts.blockGoogleScript) {
      await page.setRequestInterception(true);
      page.on("request", (r) => (/accounts\.google\.com/.test(r.url()) ? r.abort() : r.continue()));
    }
    await page.goto(APP);
    if (opts.data) {
      await page.evaluate((d) => localStorage.setItem("opf_erp_smart_v3", d), opts.data);
      await page.reload();
    }
    await sleep(300);
    return { name, ctx, page };
  }
  const statusOf = (pc) => pc.page.evaluate(() => OPF.cloud.status);
  async function waitStatus(pc, want, ms = 6000) {
    for (let t = 0; t < ms; t += 100) { if ((await statusOf(pc)) == want) return want; await sleep(100); }
    return statusOf(pc);
  }
  const count = (pc, coll) => pc.page.evaluate((c) => OPF.store.db[c].length, coll);
  async function sell(pc, qty) {
    await pc.page.evaluate((qty) => {
      const db = OPF.store.db, k = Object.keys(OPF.stock.finished().shop).find((x) => OPF.stock.finished().shop[x] >= qty);
      const [loc, style, color, size] = OPF.stock.finished().names[k];
      OPF.router.go("sales");
      const f = document.getElementById("mainForm");
      f.elements.namedItem("customer").value = db.customers[0].id;
      f.elements.namedItem("location").value = loc;
      const row = document.querySelector("#items tr.item");
      [["style", style], ["color", color], ["size", size], ["qty", qty], ["rate", 100]].forEach(([n, v]) => { const el = row.querySelector(`[data-k="${n}"]`); el.value = v; el.dispatchEvent(new Event("change", { bubbles: true })); });
      f.requestSubmit();
    }, qty);
    await sleep(200);
  }

  /* ================================================================ */
  section("Sync is off without a Google sign-in key (the normal file version)");
  await T.open();
  check("no login screen and no sync badge", await T.page.evaluate(() => [!!document.getElementById("cloudGate"), document.getElementById("syncBadge").hidden]), [false, true]);

  section("Computer A (has data): first sign-in uploads it");
  const demo = fs.readFileSync(DEMO, "utf8"), demoSales = JSON.parse(demo).sales.length;
  const A = await computer("A", { data: demo });
  check("login screen shows the Option A design", await A.page.evaluate(() => {
    const g = document.getElementById("cloudGate");
    return g && [!!g.querySelector(".gate-logo svg"), g.querySelector("h1").textContent, g.querySelector(".gbtn").textContent.trim(), g.querySelectorAll(".gate-chips span").length];
  }), [true, "One Plus Fashion ERP", "Sign in with Google", 3]);
  await sleep(1300);
  await A.page.screenshot({ path: path.join(OUT, "1_login.png") });
  await A.page.click("#cloudGate .gbtn");
  await sleep(250);
  await A.page.screenshot({ path: path.join(OUT, "2_working.png") });
  await A.page.waitForFunction(() => !document.getElementById("cloudGate"), { timeout: 8000 });
  check("account chooser was shown for the first sign-in", await A.page.evaluate(() => window.__gis.opts[0].prompt), "select_account");
  check("Drive now has the folder and the data file with all of A's data", [drive.kind("folder").length, drive.kind("data").length, drive.data().sales.length], [1, 1, demoSales]);
  check("the ERP opens on the dashboard and the badge says Synced", [await A.page.evaluate(() => document.querySelector("#app h1").textContent), await statusOf(A)], ["Dashboard", "synced"]);

  section("Every save is uploaded a moment later");
  await sell(A, 2);
  check("badge shows the change is waiting / saving", ["pending", "saving", "reconnect"].indexOf(await statusOf(A)) >= 0, true);
  check("then Synced", await waitStatus(A, "synced"), "synced");
  check("Drive has A's new sale", drive.data().sales.length, demoSales + 1);
  check("no 'Which data should be kept?' question for a save on the same computer", await A.page.evaluate(() => !!document.getElementById("cloudDialog")), false);
  await A.page.evaluate(() => { const db = OPF.store.db; db.suppliers.push({ id: "supA1", name: "Test Supplier", created: new Date().toISOString() }); OPF.store.save(); });
  check("adding a supplier syncs without a question either", [await waitStatus(A, "synced"), await A.page.evaluate(() => !!document.getElementById("cloudDialog"))], ["synced", false]);

  section("A computer set up before the sync-stamp fix carries on without a question");
  await A.page.evaluate(() => { const m = OPF.cloud.meta; delete m.syncId; m.version = "3"; localStorage.setItem("opf_erp_cloud", JSON.stringify(m)); });
  delete drive.kind("data")[0].appProperties.syncId;
  await sell(A, 1);
  check("its next save uploads normally", [await waitStatus(A, "synced"), await A.page.evaluate(() => !!document.getElementById("cloudDialog")), drive.data().sales.length], ["synced", false, demoSales + 2]);

  section("Computer B (empty): signing in with the same account restores everything");
  const B = await computer("B");
  await B.page.click("#cloudGate .gbtn");
  await B.page.waitForFunction(() => !document.getElementById("cloudGate"), { timeout: 8000 });
  check("B now has exactly A's data", [await count(B, "sales"), await count(B, "customers"), await count(B, "payments")], [demoSales + 2, JSON.parse(demo).customers.length, JSON.parse(demo).payments.length]);
  check("customer dues match on both computers", await B.page.evaluate(() => OPF.ledger.totalDue("Customer")), await A.page.evaluate(() => OPF.ledger.totalDue("Customer")));

  section("A change on B reaches A");
  await B.page.evaluate(() => { const db = OPF.store.db; db.payments.push({ id: "pB1", no: "MR-B1", date: OPF.util.today(), type: "Customer", party: db.customers[1].id, amount: 777, created: new Date().toISOString() }); OPF.store.save(); });
  check("B uploads it", await waitStatus(B, "synced"), "synced");
  await A.page.evaluate(() => OPF.cloud.sync());
  await sleep(500);
  check("A picks up B's payment (A had no unsynced changes)", await A.page.evaluate(() => OPF.store.db.payments.some((p) => p.id == "pB1")), true);
  check("A shows a notice that it was updated", await A.page.evaluate(() => (document.getElementById("cloudToast") || {}).textContent), "Updated with the latest data from Google Drive.");

  section("Both changed while A was offline: A is asked which copy to keep");
  await A.page.setOfflineMode(true);
  await A.page.evaluate(() => { window.__offline = true; });
  await sell(A, 1);
  check("offline: badge says it will sync later", await waitStatus(A, "offline"), "offline");
  await B.page.evaluate(() => { OPF.store.db.expenses.push({ id: "eB1", date: OPF.util.today(), category: "Rent", amount: 5000, created: new Date().toISOString() }); OPF.store.save(); });
  await waitStatus(B, "synced");
  await A.page.setOfflineMode(false);
  await A.page.evaluate(() => { window.__offline = false; window.dispatchEvent(new Event("online")); });
  await A.page.waitForSelector("#cloudDialog", { timeout: 6000 });
  await A.page.screenshot({ path: path.join(OUT, "3_conflict.png") });
  check("the question shows both copies", await A.page.$$eval("#cloudDialog .cd-opt b", (b) => b.map((x) => x.textContent)), ["Google Drive copy", "This computer's copy"]);
  check("each copy lists its suppliers too", await A.page.$$eval("#cloudDialog .cd-opt span", (s) => s.map((x) => /\d+ suppliers/.test(x.textContent))), [true, true]);
  await A.page.click('#cloudDialog [data-pick="local"]');
  check("keeping this computer's copy uploads it", await waitStatus(A, "synced"), "synced");
  check("Drive now has A's offline sale but not B's expense", [drive.data().sales.length, drive.data().expenses.some((e) => e.id == "eB1")], [demoSales + 3, false]);
  check("B's version was kept as a Conflict copy (nothing lost)", drive.kind("conflict").map((f) => [/Conflict copy .* \(Google Drive\)\.json$/.test(f.name), JSON.parse(f.content).expenses.some((e) => e.id == "eB1")]), [[true, true]]);

  section("Daily safety copies: one per day, last 30 kept");
  for (let i = 0; i < 32; i++) drive.add({ name: `OnePlusFashion ERP Backup 2025-01-${String(i + 1).padStart(2, "0")}.json`, appProperties: { opfErp: "backup" } }, "{}");
  await A.page.evaluate(() => { const m = JSON.parse(localStorage.getItem("opf_erp_cloud")); m.lastBackupDay = "2000-01-01"; localStorage.setItem("opf_erp_cloud", JSON.stringify(m)); OPF.cloud.meta.lastBackupDay = "2000-01-01"; });
  await sell(A, 1);
  await waitStatus(A, "synced");
  const today = await A.page.evaluate(() => OPF.util.today());
  check("the first upload of the day keeps a dated copy", drive.kind("backup").some((f) => f.name == `OnePlusFashion ERP Backup ${today}.json`), true);
  check("only the newest 30 copies are kept", drive.kind("backup").length, 30);

  section("Google access expires after an hour: the next click renews it");
  await A.page.evaluate(() => { OPF.drive.forgetToken(); window.__gis.calls = 0; });
  await sell(A, 1);
  check("badge asks for a click", await waitStatus(A, "reconnect"), "reconnect");
  await A.page.mouse.click(600, 300);
  check("a normal click renews access silently for the same account and syncs", [await waitStatus(A, "synced"), await A.page.evaluate(() => [window.__gis.calls, window.__gis.opts[window.__gis.opts.length - 1].prompt, window.__gis.opts[window.__gis.opts.length - 1].login_hint])], ["synced", [1, "", "shop@gmail.com"]]);
  drive.rejectAuth = true;
  await sell(A, 1);
  check("if Google refuses the old access, the badge asks for a click again", await waitStatus(A, "reconnect"), "reconnect");
  drive.rejectAuth = false;
  await A.page.mouse.click(600, 300);
  check("one click reconnects and the waiting sale is uploaded", await waitStatus(A, "synced"), "synced");

  section("Reloading the tab keeps the Google access (no extra sign-in window)");
  await A.page.evaluate(() => { window.__gis.calls = 0; });
  await A.page.reload();
  await sleep(600);
  check("after reload A syncs straight away without a sign-in window", [await waitStatus(A, "synced"), await A.page.evaluate(() => window.__gis.calls)], ["synced", 0]);

  section("Feature flag ENABLE_GOOGLE_LOGIN = false switches Google off without losing anything");
  const setFlag = (pc, on) => pc.page.evaluateOnNewDocument((on) => { window.OPF_CLOUD_TEST.ENABLE_GOOGLE_LOGIN = on; }, on);
  await B.page.evaluate(() => OPF.cloud.sync()); await waitStatus(B, "synced"); // B catches up with A first
  await setFlag(B, false);
  await B.page.reload(); await sleep(400);
  const calls = drive.log.length, salesB = await count(B, "sales"), salesDrive = drive.data().sales.length;
  check("flag off: no login screen, no sync badge, ERP opens", await B.page.evaluate(() => [!!document.getElementById("cloudGate"), document.getElementById("syncBadge").hidden, document.querySelector("#app h1").textContent]), [false, true, "Dashboard"]);
  await sell(B, 1); await sleep(800);
  check("flag off: saving works locally and nothing is sent to Google", [await count(B, "sales"), drive.log.length - calls, drive.data().sales.length], [salesB + 1, 0, salesDrive]);
  await B.page.evaluate(() => OPF.router.go("settings"));
  check("flag off: Settings says Google Drive backup is switched off", await B.page.$eval("#cloudBox", (b) => /Switched off/.test(b.textContent)), true);
  check("flag off: the sign-in on this computer is kept (not signed out)", await B.page.evaluate(() => JSON.parse(localStorage.getItem("opf_erp_cloud")).account.email), "shop@gmail.com");
  await setFlag(B, true);
  await B.page.reload(); await sleep(400);
  await B.page.mouse.click(600, 300);
  check("flag back on: the change made while off is uploaded", [await waitStatus(B, "synced"), salesB == salesDrive, drive.data().sales.length], ["synced", true, salesB + 1]);
  await A.page.evaluate(() => OPF.cloud.sync()); await waitStatus(A, "synced");
  await setFlag(B, false); await B.page.reload(); await sleep(400);
  await sell(B, 1);
  await sell(A, 1); await waitStatus(A, "synced");
  await setFlag(B, true); await B.page.reload(); await sleep(400);
  await B.page.mouse.click(600, 300);
  await B.page.waitForSelector("#cloudDialog", { timeout: 6000 }).catch(() => null);
  check("flag back on after both computers changed: it asks which copy to keep (nothing overwritten)", !!(await B.page.$("#cloudDialog")), true);
  if (await B.page.$("#cloudDialog")) { await B.page.click('#cloudDialog [data-pick="drive"]'); await waitStatus(B, "synced"); }

  section("Settings and sign-out");
  await A.page.evaluate(() => OPF.router.go("settings"));
  check("Settings shows the account and Sync now / Sign out", await A.page.evaluate(() => { const b = document.getElementById("cloudBox"); return [/shop@gmail\.com/.test(b.textContent), Array.from(b.querySelectorAll("button")).map((x) => x.textContent)]; }), [true, ["Sync now", "Sign out"]]);
  const before = await count(A, "sales");
  await A.page.evaluate(() => document.querySelector('[data-act="cloud.signout"]').click());
  await A.page.waitForSelector("#cloudGate", { timeout: 6000 });
  check("after sign-out the login screen shows again and the data stays on the computer", await count(A, "sales"), before);

  section("First visit with no internet");
  const C = await computer("C", { withGoogle: false, blockGoogleScript: true });
  await sleep(800);
  check("the login screen explains there is no internet", await C.page.evaluate(() => document.querySelector("#cloudGate h1").textContent), "No internet connection");
  await C.page.evaluate(() => document.querySelector('[data-act="cloud.skip"]').click());
  check("'Continue offline' opens the ERP, badge says Not signed in", [await C.page.evaluate(() => [!!document.getElementById("cloudGate"), document.querySelector("#app h1").textContent]), await statusOf(C)], [[false, "Dashboard"], "signedout"]);

  for (const pc of [A, B, C]) await pc.ctx.close();
  await T.finish();
})().catch((e) => { console.error(e); process.exit(1); });
