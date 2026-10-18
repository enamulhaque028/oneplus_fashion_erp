/* Navigation between pages, the sidebar, and the "record being edited" state.
   Pages register themselves as OPF.pages[id] = { render() }. */
(function (OPF) {
  "use strict";

  const C = OPF.config;
  OPF.pages = OPF.pages || {};

  const router = {
    current: "dashboard",
    editing: null, // { coll, id } while an admin edits an existing record
    refresh: () => {},

    renderNav() {
      OPF.html.$("nav").innerHTML = C.MENU.map(([id, label]) => OPF.html.button(label, "nav.go", { page: id }, router.current == id ? "on" : "")).join("");
    },

    go(page, keepEditing) {
      if (!OPF.pages[page] || !OPF.pages[page].render) page = "dashboard";
      if (!keepEditing) router.editing = null;
      router.show(page, () => OPF.pages[page].render(), true);
    },

    // Show a view that is not a menu page (e.g. customer profile) while highlighting `menuId`.
    show(menuId, renderFn, keepEditing) {
      if (!keepEditing) router.editing = null;
      router.current = menuId;
      router.refresh = renderFn;
      router.renderNav();
      window.scrollTo(0, 0);
      renderFn();
    },

    reload: () => router.go(router.current),
    cancelEdit() { router.editing = null; router.reload(); }
  };

  OPF.router = router;
  OPF.actions.register({
    "nav.go": (el) => router.go(el.dataset.page),
    "nav.reload": () => router.reload(),
    "edit.cancel": () => router.cancelEdit(),
    "print.page": () => window.print()
  });
})(window.OPF = window.OPF || {});
