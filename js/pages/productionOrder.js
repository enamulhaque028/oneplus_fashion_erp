/* Production orders: planned vs actual quantity per factory.
   Also owns the shared "order.fill" / "factory.fillRate" helpers used by issue and production forms. */
(function (OPF) {
  "use strict";

  const C = OPF.config, H = OPF.html, F = OPF.forms, R = OPF.records, K = OPF.calc, S = OPF.store;
  const { esc, num, r2, fmtQty, today, byDateDesc } = OPF.util;

  function render() {
    const editing = F.isEditing("productionOrders");
    F.page({
      title: "Production Order", coll: "productionOrders", submit: "productionOrder.save",
      fields: [
        H.field("no", "Order No.", { value: editing ? "" : S.nextNo("productionOrders", "no", "PO-", 4), required: true, readonly: true }),
        H.field("date", "Order Date", { type: "date", value: today(), required: true }), H.field("style", "Style Code", { required: true, list: "dl-style" }),
        H.field("color", "Color"), H.field("size", "Size"), H.field("planned", "Planned Quantity (PCS)", { type: "number", required: true }),
        H.select("factory", "Factory Name", OPF.lists.factories(), { required: true }), H.select("status", "Status", H.optionList(C.PO_STATUS)), H.field("remarks", "Remarks")
      ]
    });

    let planned = 0, actual = 0;
    const rows = byDateDesc(S.db.productionOrders).map((o) => {
      const a = K.orderActual(o), diff = r2(num(o.planned) - a), status = K.orderStatus(o, a);
      planned += num(o.planned);
      actual += a;
      return H.tr([
        H.td(esc(o.no)), H.td(o.date), H.td(esc(o.style)), H.td(esc(o.color)), H.td(esc(o.size)), H.td(esc(S.factoryName(o.factory))),
        H.tdn(fmtQty(o.planned)), H.tdn(fmtQty(a)), H.tdn("<b>" + fmtQty(diff) + "</b>", diff > 0 ? "amber" : diff < 0 ? "red" : "green"),
        H.td(H.pill(status, status == "Completed" ? "cash" : status == "Cancelled" ? "due" : "wait")), R.rowActions("productionOrders", o.id)
      ]);
    });

    H.append(
      H.cards([H.card("Planned PCS", fmtQty(planned)), H.card("Actual PCS", fmtQty(actual), "ok"), H.card("Difference", fmtQty(planned - actual), "hl")]) +
      '<p class="muted">Actual = accepted PCS from Production entries linked to the order. Difference = Planned − Actual (positive = still to produce, negative = produced more than planned).</p>' +
      H.table(["Order No.", "Date", "Style", "Color", "Size", "Factory Name", "#Planned", "#Actual", "#Difference", "Status", ""], rows)
    );
  }

  function save(form) {
    const d = F.numify(F.data(form), ["planned"]);
    R.save("productionOrders", d, "Production Order", d.no);
    render();
  }

  // <select name="order" data-change="order.fill">: copy style / color / size / factory from the order.
  function fillFromOrder(select) {
    const o = S.byId("productionOrders", select.value), form = select.form;
    if (!o) return;
    F.set(form, "style", o.style);
    ["color", "size"].forEach((k) => F.set(form, k, o[k] || ""));
    if (F.el(form, "factory") && o.factory) {
      F.set(form, "factory", o.factory);
      fillRate(F.el(form, "factory"));
    }
  }

  // <select name="factory" data-change="factory.fillRate">: default rate when none entered.
  function fillRate(select) {
    const factory = S.byId("factories", select.value), form = select.form;
    if (factory && num(factory.rate) && F.el(form, "rate") && !num(F.get(form, "rate"))) F.set(form, "rate", factory.rate);
  }

  OPF.pages.productionOrder = { render };
  OPF.actions.register({ "productionOrder.save": save, "order.fill": fillFromOrder, "factory.fillRate": fillRate });
})(window.OPF = window.OPF || {});
