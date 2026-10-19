/* Application frame: grouped sidebar with icons and expandable sections, header title,
   light / dark theme, collapsible and mobile sidebar. Presentation only - sidebar items are
   real links to the page routes (#/page), so they open in a new tab and work with Back.

   UI preferences (theme, collapsed sidebar) live under their own localStorage key, never in the
   ERP data. Only init() touches it, and the self-test page never calls init(). */
(function (OPF) {
  "use strict";

  const C = OPF.config;
  const { esc, lc } = OPF.util;
  const UI_KEY = "opf_erp_ui";
  const LABELS = {};
  C.MENU.forEach(([id, label]) => { LABELS[id] = label; });

  let prefs = { theme: "light", collapsed: false, lang: "en" };
  const open = {}; // group index -> expanded (user's choice); the active page's group always opens
  let filter = "";

  const $ = (id) => document.getElementById(id);
  const groupOf = (page) => C.NAV_GROUPS.findIndex((g) => g[3].indexOf(page) >= 0);

  function item(id, current, sub) {
    return `<a class="item${current == id ? " on" : ""}" href="${OPF.router.routes.page(id)}" data-page="${id}" title="${esc(LABELS[id])}">` +
      `${OPF.icon(C.PAGE_ICONS[id])}<span class="lb">${esc(LABELS[id])}</span></a>`;
  }

  function menuHtml(current) {
    const active = groupOf(current), q = lc(filter);
    return C.NAV_GROUPS.map(([label, icon, tone, pages], gi) => {
      const shown = q ? pages.filter((id) => lc(LABELS[id]).indexOf(q) >= 0 || lc(label).indexOf(q) >= 0) : pages;
      if (!shown.length) return "";
      if (pages.length == 1) return `<div class="one" data-tone="${tone}">${item(pages[0], current)}</div>`;
      const isOpen = q || gi == active || open[gi];
      return `<div class="grp${isOpen ? " open" : ""}${gi == active ? " has-on" : ""}" data-tone="${tone}">` +
        `<button type="button" class="item" data-act="nav.group" data-group="${gi}" title="${esc(label)}">${OPF.icon(icon)}<span class="lb">${esc(label)}</span>${OPF.icon("chevron").replace('class="i"', 'class="i chev"')}</button>` +
        `<div class="sub">${shown.map((id) => item(id, current, true)).join("")}</div></div>`;
    }).join("");
  }

  function brandHtml() {
    const co = OPF.store.db.company;
    const mark = co.logo ? `<img src="${co.logo}" alt="">` : (OPF.print && OPF.print.brandMark ? OPF.print.brandMark(true) : "");
    return `<div class="brand"><div class="mk">${mark}</div><div class="tx"><b>${esc(co.name || "One Plus Fashion")}</b><small>Smart ERP</small></div></div>`;
  }

  /* ---------- desktop app: install the hosted ERP as an app (Chrome / Edge "install", iPhone "Add to
     Home Screen"). Not shown in the double-click (file://) version - it is a desktop version already -
     nor inside the installed app. */
  let installPrompt = null, justInstalled = false, foundInstalled = false;
  const hosted = () => /^https?:$/.test(location.protocol);
  const standalone = () => (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
  // Chrome / Edge offer installing (beforeinstallprompt) about a second after the page loads - unless
  // the app is already installed. No offer within OFFER_MS therefore means "installed" (Chrome on a Mac
  // cannot tell the page so directly).
  const chromium = "onbeforeinstallprompt" in window, OFFER_MS = 4000;
  let offerWaitOver = false;
  window.addEventListener("load", () => setTimeout(() => { offerWaitOver = true; refreshInstall(); }, OFFER_MS));
  function appState() {
    if (!hosted()) return "file";
    if (standalone() || justInstalled || foundInstalled) return "installed";
    if (installPrompt) return "ready";
    return chromium && offerWaitOver ? "installed" : "manual";
  }
  // Chrome / Edge offer installing through this event (so the app is not installed); keep it for our button.
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installPrompt = e; justInstalled = foundInstalled = false; refreshInstall(); });
  window.addEventListener("appinstalled", () => { installPrompt = null; justInstalled = true; refreshInstall(); });
  // In a normal tab, Chrome (Windows / Android) can say whether the app is installed (manifest
  // related_applications names the app itself).
  if (hosted() && navigator.getInstalledRelatedApps) {
    navigator.getInstalledRelatedApps().then((apps) => { if (apps && apps.length) { foundInstalled = true; refreshInstall(); } }, () => {});
  }

  /* A web page cannot uninstall an app (browsers do not allow it), so "Uninstall" shows the browser's
     own steps for this window / device. */
  // The Settings / Backup section.
  function installBox() {
    const st = appState();
    if (st == "file") return "";
    const body = st == "installed"
      ? `<p class="app-ok">${OPF.icon("check")}<span>The desktop app is installed on this computer.</span></p>` +
        `<div class="actions">${OPF.html.button("Uninstall desktop app", "app.uninstall", null, "light")}</div>`
      : '<p class="muted">Install the ERP as an app: it gets its own window and a Start menu / Dock icon (home screen on a phone), opens without internet and updates by itself. The data stays the same as in the browser.</p>' +
        `<div class="actions">${OPF.html.button(OPF.icon("download") + "Install desktop app", "app.install", null, "good")}</div>`;
    return `<div class="box" id="appBox"><h2 style="margin-top:0">Desktop app</h2>${body}</div>`;
  }

  function refreshInstall() {
    const box = document.getElementById("appBox");
    if (box) box.outerHTML = installBox() || "";
  }

  function openPrompt() {
    const p = installPrompt;
    installPrompt = null;
    p.prompt();
    p.userChoice.then((c) => { if (c && c.outcome == "accepted") justInstalled = true; refreshInstall(); }, () => refreshInstall());
  }

  function install() {
    if (installPrompt) { openPrompt(); return; }
    if (!chromium) { howTo(); return; }
    // Clicked before Chrome made its offer: wait for it (up to 3 s, still within the click's grace time).
    const started = Date.now();
    (function wait() {
      if (installPrompt) { openPrompt(); return; }
      if (offerWaitOver || Date.now() - started > 3000) { alreadyInstalled(); return; }
      setTimeout(wait, 150);
    })();
  }

  // Chrome / Edge make no install offer when the app is already installed.
  function alreadyInstalled() {
    offerWaitOver = true;
    refreshInstall();
    stepsDialog("Already installed", "check", [
      "To open it, click Open in app at the right end of the address bar, or use its icon (Start menu / Dock / Launchpad).",
      "To install it again, uninstall it first (Uninstall desktop app in Settings / Backup), then reload this page."
    ]);
  }

  // When the browser gives no install prompt: say where its own install option is.
  function howTo() {
    const ua = navigator.userAgent;
    let steps;
    if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform == "MacIntel" && navigator.maxTouchPoints > 1)) steps = ["Tap the Share button (the square with an arrow).", "Choose Add to Home Screen, then Add."];
    else if (/Firefox\//.test(ua)) steps = ["Firefox cannot install apps.", "Open this page in Google Chrome or Microsoft Edge and click Install desktop app there."];
    else if (/Android/.test(ua)) steps = ["Open the browser menu (⋮).", "Choose Install app or Add to Home screen."];
    else if (/Edg\//.test(ua)) steps = ["Open the menu (...) at the top right.", "Choose Apps, then Install this site as an app."];
    else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) steps = ["In the menu bar, choose File.", "Choose Add to Dock."];
    else steps = ["Click the install icon at the right end of the address bar,", "or open the menu (⋮) and choose Cast, save and share, then Install page as app."];
    stepsDialog("Install the desktop app", "download", steps);
  }

  function uninstallHowTo() {
    const ua = navigator.userAgent, edge = /Edg\//.test(ua);
    let steps;
    if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform == "MacIntel" && navigator.maxTouchPoints > 1)) steps = ["Go to the Home Screen and press and hold the One Plus Fashion ERP icon.", "Choose Remove App, then Delete from Home Screen."];
    else if (/Android/.test(ua)) steps = ["Press and hold the One Plus Fashion ERP icon.", "Choose Uninstall (or App info, then Uninstall)."];
    else if (standalone()) steps = ["Click the menu (" + (edge ? "..." : "⋮") + ") at the top right of this app window.", "Choose Uninstall One Plus Fashion ERP, then Remove."];
    else steps = ["Open " + (edge ? "edge://apps" : "chrome://apps") + " in a new tab (type it in the address bar).", "Right-click One Plus Fashion ERP and choose " + (edge ? "Uninstall" : "Remove from Chrome") + ", then Remove."];
    stepsDialog("Uninstall the desktop app", "trash", steps, "Your ERP data is not deleted (unless you also tick \"clear data\"). The ERP still works in the browser.");
  }

  function stepsDialog(title, icon, steps, note) {
    const d = document.createElement("div");
    d.id = "appDialog";
    d.innerHTML = `<div class="cd-card" role="dialog" aria-modal="true"><div class="dlg-ic">${OPF.icon(icon)}</div><h2>${OPF.util.esc(title)}</h2>` +
      `<ol class="app-steps">${steps.map((s) => `<li>${OPF.util.esc(s)}</li>`).join("")}</ol>` +
      (note ? `<p class="muted app-note">${OPF.util.esc(note)}</p>` : "") +
      `<div class="actions" style="justify-content:center">${OPF.html.button("OK", "app.closeHow")}</div></div>`;
    d.addEventListener("mousedown", (e) => { if (e.target == d) d.remove(); });
    document.body.appendChild(d);
  }

  // Phones: the header has no room for the theme switch, Lock and Backup, so the menu carries them.
  function phoneTools() {
    const admin = OPF.auth && OPF.auth.isAdmin();
    return '<div class="phone-tools">' +
      `<div class="pt-row"><span>${OPF.icon(prefs.theme == "dark" ? "moon" : "sun")}Theme</span><div class="theme-switch">` +
      `<button data-act="shell.theme" data-theme-set="light" title="Light" aria-label="Light theme"${prefs.theme != "dark" ? ' class="on"' : ""}>${OPF.icon("sun")}</button>` +
      `<button data-act="shell.theme" data-theme-set="dark" title="Dark" aria-label="Dark theme"${prefs.theme == "dark" ? ' class="on"' : ""}>${OPF.icon("moon")}</button></div></div>` +
      (C.ENABLE_BENGALI === true ? `<div class="pt-row"><span>${OPF.icon("list")}Language</span><div class="lang-switch" data-no-i18n>` +
        `<button data-act="shell.lang" data-lang="en"${prefs.lang != "bn" ? ' class="on"' : ""}>EN</button><button data-act="shell.lang" data-lang="bn"${prefs.lang == "bn" ? ' class="on"' : ""}>বাং</button></div></div>` : "") +
      `<div class="pt-btns"><button type="button" id="lockBtnSide" class="${admin ? "warn" : "light"}" data-act="auth.toggle">${OPF.icon("lock")}${admin ? "Lock admin" : "Admin login"}</button>` +
      `<button type="button" class="light" data-act="backup.excel">${OPF.icon("download")}Backup</button></div>` +
      "</div>";
  }

  // Redraw the sidebar and the header title for the current page.
  function render(current) {
    const nav = $("nav");
    if (!nav) return;
    const co = OPF.store.db.company;
    const hadFocus = document.activeElement && document.activeElement.id == "navSearch";
    nav.innerHTML = brandHtml() +
      `<div class="navsearch">${OPF.icon("search")}<input id="navSearch" placeholder="Search menu..." autocomplete="off" value="${esc(filter)}"></div>` +
      `<div class="menu">${menuHtml(current)}</div>` +
      phoneTools() +
      (co.hotline ? `<div class="support" title="Hotline"><span class="ph">${OPF.icon("phone")}</span><span class="tx"><small>Hotline</small><b>${esc(co.hotline)}</b></span></div>` : "");
    if (hadFocus) { const s = $("navSearch"); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }

    const title = $("pageTitle");
    if (title) {
      const g = C.NAV_GROUPS[groupOf(current)];
      // "Home › Group" above the page name; each piece is its own element (translated separately).
      const trail = g && g[3].length > 1 ? `<span>Home</span>${OPF.icon("chevron")}<span>${esc(g[0])}</span>` : "<span>Home</span>";
      title.innerHTML = `<span class="tx"><small>${trail}</small><b>${esc(LABELS[current] || "")}</b></span>`;
    }
    document.body.classList.remove("nav-open");
  }

  /* ---- preferences ---- */
  function savePrefs() { try { localStorage.setItem(UI_KEY, JSON.stringify(prefs)); } catch (e) { /* preferences are optional */ } }
  function applyPrefs() {
    document.documentElement.setAttribute("data-theme", prefs.theme == "dark" ? "dark" : "light");
    document.body.classList.toggle("nav-collapsed", !!prefs.collapsed);
    Array.prototype.forEach.call(document.querySelectorAll("[data-theme-set]"), (b) => b.classList.toggle("on", b.getAttribute("data-theme-set") == prefs.theme));
    Array.prototype.forEach.call(document.querySelectorAll("[data-lang]"), (b) => b.classList.toggle("on", b.getAttribute("data-lang") == (prefs.lang == "bn" ? "bn" : "en")));
  }

  /* ---------- phones: wide tables become cards ----------
     On a narrow screen a table that does not fit shows each row as a card: every cell gets its
     column name (data-label) and CSS (.table.stack) lays the cells out as "Name ... value" lines.
     Only at phone width, so computers (and the 3,000-invoice speed check) are not affected. */
  const phone = window.matchMedia ? window.matchMedia("(max-width: 640px)") : { matches: false };

  function stackTables(root) {
    if (!phone.matches) return;
    Array.prototype.forEach.call((root || document).querySelectorAll(".table"), (wrap) => {
      const table = wrap.querySelector("table");
      if (!table) return;
      // Rows can be added later (e.g. "+ Add Item"), so label every row not labelled yet.
      const heads = Array.prototype.map.call(table.querySelectorAll("thead th"), (th) => th.textContent.trim());
      Array.prototype.forEach.call(table.querySelectorAll("tbody tr, tfoot tr"), (tr) => {
        if (tr.hasAttribute("data-labelled")) return;
        let col = 0;
        Array.prototype.forEach.call(tr.children, (td) => {
          td.setAttribute("data-label", tr.children.length == 1 ? "" : heads[col] || "");
          col += td.colSpan || 1;
        });
        tr.setAttribute("data-labelled", "");
      });
      wrap.classList.remove("stack");
      if (table.offsetWidth > wrap.clientWidth + 1) wrap.classList.add("stack");
    });
  }

  function init() {
    // Feature flag ENABLE_BENGALI off: no language switch in the header.
    if (C.ENABLE_BENGALI !== true) { const ls = document.querySelector(".top .lang-switch"); if (ls) ls.remove(); }
    // Phones: re-check tables whenever a page draws, and when the screen turns.
    let pending = false;
    const later = () => { if (!pending) { pending = true; requestAnimationFrame(() => { pending = false; stackTables($("app")); }); } };
    if (window.MutationObserver) new MutationObserver(later).observe($("app"), { childList: true, subtree: true });
    if (phone.addListener) phone.addListener(() => { if (phone.matches) later(); else Array.prototype.forEach.call(document.querySelectorAll(".table.stack"), (w) => w.classList.remove("stack")); });
    window.addEventListener("resize", later);
    // Static header markup marks icon spots with data-icon="name".
    Array.prototype.forEach.call(document.querySelectorAll("[data-icon]"), (el) => { el.outerHTML = OPF.icon(el.getAttribute("data-icon")); });
    try { prefs = Object.assign(prefs, JSON.parse(localStorage.getItem(UI_KEY) || "{}")); } catch (e) { /* use defaults */ }
    applyPrefs();
    // Menu search filters the sidebar as you type (delegated: the sidebar is redrawn often).
    $("nav").addEventListener("input", (e) => {
      if (e.target.id != "navSearch") return;
      filter = e.target.value;
      render(OPF.router.current);
    });
  }

  OPF.shell = { render, init, stackTables, installBox };
  OPF.actions.register({
    "nav.group": (el) => { const gi = el.dataset.group; open[gi] = !el.parentNode.classList.contains("open"); el.parentNode.classList.toggle("open", open[gi]); },
    // The whole screen is redrawn in the other language (see js/ui/i18n.js).
    "shell.lang": (el) => {
      if (el.getAttribute("data-lang") == (prefs.lang == "bn" ? "bn" : "en")) return;
      prefs.lang = el.getAttribute("data-lang");
      savePrefs();
      location.reload();
    },
    "app.install": install,
    "app.uninstall": uninstallHowTo,
    "app.closeHow": () => { const d = document.getElementById("appDialog"); if (d) d.remove(); },
    "shell.theme": (el) => {
      prefs.theme = el.getAttribute("data-theme-set");
      applyPrefs();
      savePrefs();
      const pt = document.querySelector(".phone-tools"); // menu stays open on phones
      if (pt) pt.outerHTML = phoneTools();
    },
    "shell.menu": () => {
      // Narrow screens: slide the sidebar in; wide screens: collapse to icons.
      if (window.matchMedia("(max-width: 860px)").matches) document.body.classList.toggle("nav-open");
      else { prefs.collapsed = !prefs.collapsed; applyPrefs(); savePrefs(); }
    },
    "shell.closeMenu": () => document.body.classList.remove("nav-open")
  });
})(window.OPF = window.OPF || {});
