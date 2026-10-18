/* Users and the activity log. */
(function (OPF) {
  "use strict";

  const H = OPF.html;
  const { esc } = OPF.util;

  function render() {
    const db = OPF.store.db;
    H.mount(
      '<h1>Users / Activity</h1><div class="box"><div class="muted">Roles from proposal: Admin, Manager, Accountant, Salesman, Factory Manager. Editing and deleting any record needs the Admin password (set it in Settings / Backup). Every change is recorded below.</div></div>' +
      H.table(["Name", "Username", "Role"], db.users.map((u) => H.tr([H.td(esc(u.name)), H.td(esc(u.username)), H.td(esc(u.role))])), { tight: true }) +
      "<h2>Recent Activity</h2>" +
      H.table(["Timestamp", "Action", "Reference"], db.logs.slice(-200).reverse().map((x) => H.tr([H.td(esc(new Date(x.date).toLocaleString())), H.td(esc(x.action)), H.td(esc(x.ref))])))
    );
  }

  OPF.pages.users = { render };
})(window.OPF = window.OPF || {});
