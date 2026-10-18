/* Supplier / fabric party master with current payable. */
(function (OPF) {
  "use strict";

  const H = OPF.html, F = OPF.forms, R = OPF.records, L = OPF.ledger;
  const { esc, money, dueText } = OPF.util;

  function render() {
    F.page({
      title: "Supplier / Fabric Party", coll: "suppliers", submit: "suppliers.save",
      fields: [
        H.field("name", "Party Name", { required: true }), H.field("company", "Company"), H.field("mobile", "Mobile"), H.field("address", "Address / District"),
        H.field("credit", "Credit Limit", { type: "number", value: 0 }), H.field("terms", "Payment Terms"), H.field("previousDue", "Previous Due (we owe)", { type: "number", value: 0 })
      ]
    });
    const bm = L.balances("Supplier");
    const rows = OPF.store.db.suppliers.map((r) => {
      const statement = { type: "Supplier", id: r.id }, bal = bm[r.id].bal;
      return H.tr([
        H.td(H.link(esc(r.name), "party.statement", statement)), H.td(esc(r.company)), H.td(esc(r.mobile)), H.td(esc(r.address)),
        H.tdn(money(r.previousDue)), H.tdn(dueText(bal), bal > 0 ? "red" : ""),
        R.rowActions("suppliers", r.id, H.button("Statement", "party.statement", statement, "sm light"))
      ]);
    });
    H.append("<h2>Supplier Register</h2>" + H.table(["Party", "Company", "Mobile", "Address", "#Previous Due", "#Current Payable", ""], rows));
  }

  function save(form) {
    const d = F.numify(F.data(form), ["credit", "previousDue"]);
    R.save("suppliers", d, "Supplier", d.name);
    render();
  }

  OPF.pages.suppliers = { render };
  OPF.actions.register({ "suppliers.save": save });
})(window.OPF = window.OPF || {});
