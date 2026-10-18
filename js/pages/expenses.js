/* Expense register. */
(function (OPF) {
  "use strict";

  const C = OPF.config, H = OPF.html, F = OPF.forms, R = OPF.records;
  const { esc, sum, money, today, byDateDesc } = OPF.util;

  function render() {
    F.page({
      title: "Expense Management", coll: "expenses", submit: "expenses.save",
      fields: [
        H.field("date", "Date", { type: "date", value: today(), required: true }),
        H.field("category", "Category (Salary / Rent / Electricity / Transport / Other)", { required: true, list: "dl-exp" }),
        H.field("amount", "Amount", { type: "number", required: true }), H.select("method", "Payment Method", H.optionList(C.METHODS)),
        H.field("location", "Factory / Office / Shop"), H.field("remarks", "Remarks")
      ]
    });
    const list = OPF.store.db.expenses;
    const rows = byDateDesc(list).map((e) => H.tr([H.td(e.date), H.td(esc(e.category)), H.tdn(money(e.amount)), H.td(esc(e.method)), H.td(esc(e.location)), H.td(esc(e.remarks)), R.rowActions("expenses", e.id)]));
    H.append(H.table(["Date", "Category", "#Amount", "Method", "Location", "Remarks", ""], rows, {
      foot: H.tr([H.td("Total"), H.tdEmpty(), H.tdn(money(sum(list, (e) => e.amount))), H.tdEmpty(4)])
    }));
  }

  function save(form) {
    const d = F.numify(F.data(form), ["amount"]);
    R.save("expenses", d, "Expense", d.category);
    render();
  }

  OPF.pages.expenses = { render };
  OPF.actions.register({ "expenses.save": save });
})(window.OPF = window.OPF || {});
