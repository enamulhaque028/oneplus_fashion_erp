/* Reports: headline totals, simple P/L, exports. */
(function (OPF) {
  "use strict";

  const H = OPF.html, K = OPF.calc;
  const { r2, sum, money } = OPF.util;

  const CSV_SHEETS = ["Sales Invoices", "Sales Items", "Purchases", "Production", "Expenses", "Payments", "Party Ledger"];

  function render() {
    const db = OPF.store.db;
    const sales = sum(db.sales, K.saleTotal), returns = sum(db.returns, (r) => r.amount), purchases = sum(db.purchases, (r) => K.purchase(r).total);
    const expenses = sum(db.expenses, (x) => x.amount), factory = sum(db.production, K.productionBill);
    const pl = r2(sales - returns - purchases - expenses - factory);
    H.mount(
      "<h1>Reports</h1>" +
      H.cards([H.card("Sales", money(sales)), H.card("Sales Return", money(returns)), H.card("Purchase", money(purchases)), H.card("Factory Bill", money(factory)), H.card("Expense", money(expenses)), H.card("P/L View", money(pl), pl < 0 ? "hl" : "ok")]) +
      '<p class="muted">P/L View = Sales − Returns − Purchases − Factory Bill − Expenses (simple cash-basis view).</p>' +
      '<div class="box"><div class="actions" style="margin-top:0">' +
      H.button("Export Everything to Excel (.xlsx)", "backup.excel", null, "good") +
      CSV_SHEETS.map((name) => H.button(name + " CSV", "backup.csv", { sheet: name }, "light")).join("") +
      H.button("Print / Save PDF", "print.page", null, "light") + "</div></div>"
    );
  }

  OPF.pages.reports = { render };
})(window.OPF = window.OPF || {});
