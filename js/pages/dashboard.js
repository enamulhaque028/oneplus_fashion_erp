/* Dashboard: today's figures and quick links. */
(function (OPF) {
  "use strict";

  const H = OPF.html, K = OPF.calc, L = OPF.ledger;
  const { r2, sum, money, fmtQty, today } = OPF.util;

  const QUICK = [["purchase", "+ Purchase"], ["issue", "+ Material Issue"], ["production", "+ Production"], ["sales", "+ Sale"], ["payments", "+ Collection"], ["courier", "+ Courier"]];

  function render() {
    const db = OPF.store.db, t = today();
    const todaySales = db.sales.filter((s) => s.date == t);
    const collected = r2(sum(todaySales, (s) => s.paid) + sum(db.payments.filter((p) => p.date == t && p.type == "Customer"), (p) => p.amount));
    const payable = r2(L.totalDue("Supplier") + L.totalDue("Factory"));
    const courier = K.courierSummary(db.courier);

    H.mount(
      "<h1>Dashboard</h1>" +
      H.cards([
        H.card("Today Sales", money(sum(todaySales, K.saleTotal))),
        H.card("Today Collection", money(collected), "ok"),
        H.card("Customer Due", money(L.totalDue("Customer")), "hl"),
        H.card("Supplier / Factory Payable", money(payable)),
        H.card("Finished Stock PCS", fmtQty(sum(OPF.stock.byStyle(), (x) => x.total))),
        H.card("Pending Parcels", `${courier.pending} / ${courier.sent}`)
      ]) +
      '<div class="box"><h2>End-to-End Workflow</h2><div class="muted">Supplier → Purchase → Raw Stock → Material Issue → Production → Finished Goods → Factory/Shop Transfer → Showroom → Sales → Customer Ledger → Payment → Courier → Invoice → P/L</div>' +
      `<div class="actions">${QUICK.map(([page, label]) => H.button(label, "nav.go", { page })).join("")}</div></div>` +
      "<div class=\"alert\">This edition is optimized for your Windows 7 / 4 GB RAM laptop. It is offline and requires no Python, MySQL, Node.js or VPS for single-computer use. Use the search bar at the top to open any customer's full history.</div>"
    );
  }

  OPF.pages.dashboard = { render };
})(window.OPF = window.OPF || {});
