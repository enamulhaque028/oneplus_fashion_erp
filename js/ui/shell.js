/* Application frame: grouped sidebar with icons and expandable sections, header title,
   light / dark theme, collapsible and mobile sidebar. Presentation only - navigation itself
   still goes through the "nav.go" action and OPF.router.

   UI preferences (theme, collapsed sidebar) live under their own localStorage key, never in the
   ERP data. Only init() touches it, and the self-test page never calls init(). */
(function (OPF) {
  "use strict";

  const C = OPF.config;
  const { esc, lc } = OPF.util;
  const UI_KEY = "opf_erp_ui";
  const LABELS = {};
  C.MENU.forEach(([id, label]) => { LABELS[id] = label; });

  let prefs = { theme: "light", collapsed: false };
  const open = {}; // group index -> expanded (user's choice); the active page's group always opens
  let filter = "";

  const $ = (id) => document.getElementById(id);
  const groupOf = (page) => C.NAV_GROUPS.findIndex((g) => g[3].indexOf(page) >= 0);

  function item(id, current, sub) {
    return `<button type="button" class="${current == id ? "on" : ""}" data-act="nav.go" data-page="${id}" title="${esc(LABELS[id])}">` +
      `${OPF.icon(C.PAGE_ICONS[id])}<span class="lb">${esc(LABELS[id])}</span></button>`;
  }

  function menuHtml(current) {
    const active = groupOf(current), q = lc(filter);
    return C.NAV_GROUPS.map(([label, icon, tone, pages], gi) => {
      const shown = q ? pages.filter((id) => lc(LABELS[id]).indexOf(q) >= 0 || lc(label).indexOf(q) >= 0) : pages;
      if (!shown.length) return "";
      if (pages.length == 1) return `<div class="one" data-tone="${tone}">${item(pages[0], current)}</div>`;
      const isOpen = q || gi == active || open[gi];
      return `<div class="grp${isOpen ? " open" : ""}${gi == active ? " has-on" : ""}" data-tone="${tone}">` +
        `<button type="button" data-act="nav.group" data-group="${gi}" title="${esc(label)}">${OPF.icon(icon)}<span class="lb">${esc(label)}</span>${OPF.icon("chevron").replace('class="i"', 'class="i chev"')}</button>` +
        `<div class="sub">${shown.map((id) => item(id, current, true)).join("")}</div></div>`;
    }).join("");
  }

  function brandHtml() {
    const co = OPF.store.db.company;
    const mark = co.logo ? `<img src="${co.logo}" alt="">` : (OPF.print && OPF.print.brandMark ? OPF.print.brandMark(true) : "");
    return `<div class="brand"><div class="mk">${mark}</div><div class="tx"><b>${esc(co.name || "One Plus Fashion")}</b><small>Smart ERP</small></div></div>`;
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
  }

  function init() {
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

  OPF.shell = { render, init };
  OPF.actions.register({
    "nav.group": (el) => { const gi = el.dataset.group; open[gi] = !el.parentNode.classList.contains("open"); el.parentNode.classList.toggle("open", open[gi]); },
    "shell.theme": (el) => { prefs.theme = el.getAttribute("data-theme-set"); applyPrefs(); savePrefs(); },
    "shell.menu": () => {
      // Narrow screens: slide the sidebar in; wide screens: collapse to icons.
      if (window.matchMedia("(max-width: 860px)").matches) document.body.classList.toggle("nav-open");
      else { prefs.collapsed = !prefs.collapsed; applyPrefs(); savePrefs(); }
    },
    "shell.closeMenu": () => document.body.classList.remove("nav-open")
  });
})(window.OPF = window.OPF || {});
