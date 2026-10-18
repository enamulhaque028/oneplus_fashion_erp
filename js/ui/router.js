/* Navigation between pages, the address (URL) of each view, and the "record being edited" state.
   Pages register themselves as OPF.pages[id] = { render() }.

   Every view has a hash route, so links can be opened in a new tab, bookmarked, and the browser's
   Back / Forward buttons work (only the part after "#" can change for pages opened from file://):
     #/<page>                    a sidebar page, e.g. #/suppliers
     #/customer/<id>             customer profile
     #/statement/<type>/<id>     supplier / factory statement
   Navigation links are real <a href="#/..."> elements; the browser changes the hash and the
   hashchange listener draws the view. Code that navigates calls go() / show(), which draw at once
   and record the route with history.pushState (no second draw). */
(function (OPF) {
  "use strict";

  const C = OPF.config;
  OPF.pages = OPF.pages || {};
  const LABELS = {};
  C.MENU.forEach(([id, label]) => { LABELS[id] = label; });

  const enc = encodeURIComponent;
  const routes = {
    page: (id) => "#/" + id,
    customer: (id) => "#/customer/" + enc(id),
    statement: (type, id) => "#/statement/" + enc(type) + "/" + enc(id)
  };

  const router = {
    current: "dashboard",
    route: "",
    editing: null, // { coll, id } while an admin edits an existing record
    refresh: () => {},
    routes,

    // Sidebar and header title are drawn by ui/shell.js.
    renderNav() { OPF.shell.render(router.current); },

    go(page, keepEditing, fromHistory) {
      if (!OPF.pages[page] || !OPF.pages[page].render) page = "dashboard";
      if (!keepEditing) router.editing = null;
      router.show(page, () => OPF.pages[page].render(), true, { route: routes.page(page), title: LABELS[page], fromHistory });
    },

    /* Show a view while highlighting sidebar item `menuId`.
       nav: { route, title, fromHistory } - fromHistory means the address already shows this route
       (link click, Back / Forward, opened in a new tab), so nothing is added to the history. */
    show(menuId, renderFn, keepEditing, nav) {
      if (!keepEditing) router.editing = null;
      router.current = menuId;
      router.refresh = renderFn;
      if (nav && nav.route) setRoute(nav.route, nav.title, nav.fromHistory);
      router.renderNav();
      window.scrollTo(0, 0);
      renderFn();
    },

    reload: () => router.go(router.current),
    cancelEdit() { router.editing = null; router.reload(); },

    // Called once at start-up: draw the view in the address (or the dashboard) and follow later changes.
    start() {
      window.addEventListener("hashchange", () => { if (location.hash != router.route) open(location.hash); });
      // A plain click on the link of the page already shown redraws it (the hash does not change,
      // so no hashchange). Ctrl / Cmd / Shift / middle clicks are left to the browser (new tab).
      document.addEventListener("click", (e) => {
        const a = e.target.closest && e.target.closest('a[href^="#/"]');
        if (!a || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || a.getAttribute("href") != location.hash) return;
        e.preventDefault();
        open(location.hash);
      });
      open(location.hash || routes.page("dashboard"));
    }
  };

  function setRoute(route, title, fromHistory) {
    router.route = route;
    if (location.hash != route) {
      // Redirects while following the address (e.g. an unknown page) replace it instead of adding a step.
      if (fromHistory) history.replaceState(null, "", route);
      else history.pushState(null, "", route);
    }
    document.title = (title ? title + " · " : "") + "One Plus Fashion ERP";
  }

  // Draw the view for a route that is already in the address bar.
  function open(hash) {
    const parts = String(hash).replace(/^#\/?/, "").split("/").map((p) => { try { return decodeURIComponent(p); } catch (e) { return p; } });
    if (parts[0] == "customer" && parts[1]) OPF.views.customer(parts[1], true);
    else if (parts[0] == "statement" && parts[2]) OPF.views.statement(parts[1], parts[2], true);
    else router.go(parts[0] || "dashboard", false, true);
  }

  OPF.router = router;
  OPF.actions.register({
    "nav.go": (el) => router.go(el.dataset.page),
    "nav.reload": () => router.reload(),
    "edit.cancel": () => router.cancelEdit(),
    "print.page": () => window.print()
  });
})(window.OPF = window.OPF || {});
