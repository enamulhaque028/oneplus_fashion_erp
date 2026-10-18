/* Fabric / raw material purchase with live cost calculation. */
(function (OPF) {
  "use strict";

  const C = OPF.config, H = OPF.html, F = OPF.forms, R = OPF.records, K = OPF.calc;
  const { esc, lc, sum, money, fmtQty, dueText, today, byDateDesc } = OPF.util;

  function render() {
    const db = OPF.store.db;
    F.page({
      title: "Fabric / Raw Material Purchase", coll: "purchases", submit: "purchase.save", calc: "purchase.calc", after: F.calcBox(),
      fields: [
        H.select("supplier", "Supplier", OPF.lists.suppliers(), { required: true }), H.field("date", "Date", { type: "date", value: today(), required: true }),
        H.field("invoice", "Challan / Invoice No."), H.field("material", "Material / Fabric", { required: true, list: "dl-mat" }),
        H.field("type", "Material Type"), H.field("color", "Color"), H.field("gsm", "GSM"), H.field("width", "Width"),
        H.field("qty", "Quantity", { type: "number", required: true }), H.select("unit", "Unit", H.optionList(C.UNITS)),
        H.field("rate", "Rate per Unit", { type: "number", required: true }), H.field("transport", "Transport Cost", { type: "number", value: 0 }),
        H.field("loading", "Loading / Unloading", { type: "number", value: 0 }), H.field("other", "Other Cost", { type: "number", value: 0 }),
        H.field("discount", "Discount / Less", { type: "number", value: 0 }), H.field("paid", "Paid Now", { type: "number", value: 0 }),
        H.select("method", "Payment Method", H.optionList(C.METHODS)), H.field("remarks", "Remarks")
      ]
    });

    const totals = db.purchases.map(K.purchase);
    const total = (k) => H.tdn(money(sum(totals, (c) => c[k])));
    const rows = byDateDesc(db.purchases).map((r) => {
      const c = K.purchase(r);
      return H.tr([
        H.td(r.date), H.td(esc(OPF.store.partyName("Supplier", r.supplier))), H.td(esc(r.invoice)), H.td(esc(r.material) + (r.color ? " / " + esc(r.color) : "")),
        H.tdn(fmtQty(r.qty) + " " + esc(r.unit)), H.tdn(money(r.rate)), H.tdn(money(c.sub)), H.tdn(money(c.extra)), H.tdn(money(c.discount)),
        H.tdn("<b>" + money(c.total) + "</b>"), H.tdn(money(c.paid)), H.tdn(dueText(c.due), c.due > 0 ? "red" : ""), R.rowActions("purchases", r.id)
      ]);
    });
    H.append("<h2>Purchase Register</h2>" + H.table(
      ["Date", "Supplier", "Invoice", "Material", "#Qty", "#Rate", "#Subtotal", "#Extra Cost", "#Discount", "#Total", "#Paid", "#Due", ""], rows,
      { foot: H.tr([H.td("Total"), H.tdEmpty(5), total("sub"), total("extra"), total("discount"), total("total"), total("paid"), total("due"), H.tdEmpty()]) }
    ));
  }

  function calc(form) {
    const d = F.data(form), c = K.purchase(d), unit = esc(d.unit || "Unit");
    F.showCalc(H.calcTable([
      [`Subtotal (${fmtQty(d.qty)} ${unit} x ${money(d.rate)})`, money(c.sub)],
      ["+ Transport + Loading + Other", money(c.extra)],
      ["- Discount / Less", money(c.discount)],
      ["= Total Purchase Cost", money(c.total), true],
      ["- Paid Now", money(c.paid)],
      ["= Due to Supplier", dueText(c.due), true],
      ["Landed cost per " + unit, money(c.unitCost)]
    ]) + (c.yards != null && lc(d.unit) != "yard" ? `<div class="muted">= ${fmtQty(c.yards)} yards in stock</div>` : ""));
  }

  function save(form) {
    const d = F.numify(F.data(form), ["qty", "rate", "transport", "loading", "other", "discount", "paid"]);
    if (K.purchase(d).total < 0) { alert("Discount cannot be more than the purchase amount."); return; }
    R.save("purchases", d, "Purchase", d.invoice || d.material);
    render();
  }

  OPF.pages.purchase = { render };
  OPF.actions.register({ "purchase.calc": calc, "purchase.save": save });
})(window.OPF = window.OPF || {});
