/* Simplified production entry: accepted PCS go to godown stock and the factory bill. */
(function (OPF) {
  "use strict";

  const H = OPF.html, F = OPF.forms, R = OPF.records, K = OPF.calc, S = OPF.store;
  const { esc, num, r2, money, fmtQty, today, byDateDesc } = OPF.util;

  function render() {
    F.page({
      title: "Simplified Production Entry", coll: "production", submit: "production.save", calc: "production.calc", after: F.calcBox(),
      fields: [
        H.field("date", "Date", { type: "date", value: today(), required: true }), H.select("order", "Production Order", OPF.lists.orders(), { change: "order.fill" }),
        H.field("style", "Style", { required: true, list: "dl-style" }), H.field("color", "Color"), H.field("size", "Size"),
        H.select("factory", "Factory / Worker", OPF.lists.factories(), { change: "factory.fillRate" }),
        H.field("issued", "Material Issued (Yd)", { type: "number", value: 0 }), H.field("accepted", "Produced / Accepted PCS", { type: "number", required: true }),
        H.field("rejected", "Rejected / Damaged PCS", { type: "number", value: 0 }), H.field("wastage", "Wastage / Adjustment", { type: "number", value: 0 }),
        H.field("returned", "Remaining Material Returned (Yd)", { type: "number", value: 0 }), H.field("material", "Returned Material / Fabric", { list: "dl-mat" }),
        H.field("rate", "Factory Rate / PCS", { type: "number", value: 0 }), H.field("remarks", "Remarks")
      ]
    });
    const rows = byDateDesc(S.db.production).map((r) => {
      const o = S.byId("productionOrders", r.order);
      return H.tr([
        H.td(r.date), H.td(esc(o ? o.no : "")), H.td(esc(r.style)), H.td(esc([r.color, r.size].filter(Boolean).join(" / "))), H.td(esc(S.factoryName(r.factory))),
        H.tdn(fmtQty(r.issued)), H.tdn(fmtQty(r.accepted)), H.tdn(fmtQty(r.rejected)), H.tdn(fmtQty(r.wastage)), H.tdn(fmtQty(r.returned)),
        H.tdn(money(r.rate)), H.tdn(money(K.productionBill(r))), R.rowActions("production", r.id)
      ]);
    });
    H.append(
      '<div class="alert">Production is intentionally simplified: Material Issue → Single Production Entry → Finished Goods. Accepted PCS go to godown (factory) stock. Returned material goes back to raw stock when a material name is given.</div>' +
      H.table(["Date", "Order", "Style", "Color / Size", "Factory", "#Issued", "#Accepted", "#Rejected", "#Wastage", "#Returned", "#Rate", "#Factory Bill", ""], rows)
    );
  }

  function calc(form) {
    const d = F.data(form), o = S.byId("productionOrders", d.order);
    const rows = [[`Factory Bill (${fmtQty(d.accepted)} PCS x ${money(d.rate)})`, money(K.productionBill(d)), true]];
    if (o) {
      const editing = F.editingRecord("production");
      const done = r2(K.orderActual(o) - (editing ? num(editing.accepted) : 0) + num(d.accepted));
      rows.push([`Order ${esc(o.no)}: Planned ${fmtQty(o.planned)}, Actual after this entry`, fmtQty(done)], ["Difference (Planned − Actual)", fmtQty(num(o.planned) - done), true]);
    }
    F.showCalc(H.calcTable(rows));
  }

  function save(form) {
    const d = F.numify(F.data(form), ["issued", "accepted", "rejected", "wastage", "returned", "rate"]);
    R.save("production", d, "Production Entry", d.style);
    render();
  }

  OPF.pages.production = { render };
  OPF.actions.register({ "production.calc": calc, "production.save": save });
})(window.OPF = window.OPF || {});
