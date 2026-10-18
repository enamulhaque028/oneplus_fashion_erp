/* Factory / worker master with production bill and payable. */
(function (OPF) {
  "use strict";

  const H = OPF.html, F = OPF.forms, R = OPF.records, L = OPF.ledger;
  const { esc, money, dueText } = OPF.util;

  function render() {
    F.page({
      title: "Factory / Worker", coll: "factories", submit: "factories.save",
      fields: [
        H.field("name", "Factory / Worker Name", { required: true }), H.field("mobile", "Mobile"), H.field("address", "Address"),
        H.field("rate", "Default Rate / PCS", { type: "number", value: 0 }), H.field("previousDue", "Previous Due (we owe)", { type: "number", value: 0 })
      ]
    });
    const bm = L.balances("Factory");
    const rows = OPF.store.db.factories.map((r) => {
      const b = bm[r.id];
      return H.tr([
        H.td(H.statementLink(esc(r.name), "Factory", r.id)), H.td(esc(r.mobile)), H.td(esc(r.address)), H.tdn(money(r.rate)),
        H.tdn(money(b.dr)), H.tdn(money(b.cr)), H.tdn(dueText(b.bal), b.bal > 0 ? "red" : ""),
        R.rowActions("factories", r.id, H.statementLink("Statement", "Factory", r.id, "btn sm light"))
      ]);
    });
    H.append(H.table(["Factory/Worker", "Mobile", "Address", "#Rate/PCS", "#Production Bill", "#Paid", "#Current Payable", ""], rows));
  }

  function save(form) {
    const d = F.numify(F.data(form), ["rate", "previousDue"]);
    R.save("factories", d, "Factory", d.name);
    render();
  }

  OPF.pages.factories = { render };
  OPF.actions.register({ "factories.save": save });
})(window.OPF = window.OPF || {});
