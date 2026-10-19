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
      title.innerHTML = `<span class="ic">${OPF.icon(C.PAGE_ICONS[current])}</span><span class="tx"><small>${esc(g && g[3].length > 1 ? g[0] : "Home")}</small><b>${esc(LABELS[current] || "")}</b></span>`;
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

  OPF.shell = { render, init, stackTables };
  OPF.actions.register({
    "nav.group": (el) => { const gi = el.dataset.group; open[gi] = !el.parentNode.classList.contains("open"); el.parentNode.classList.toggle("open", open[gi]); },
    // The whole screen is redrawn in the other language (see js/ui/i18n.js).
    "shell.lang": (el) => {
      if (el.getAttribute("data-lang") == (prefs.lang == "bn" ? "bn" : "en")) return;
      prefs.lang = el.getAttribute("data-lang");
      savePrefs();
      location.reload();
    },
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
