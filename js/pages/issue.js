/* Raw material issue to production, with a stock check in yards. */
(function (OPF) {
  "use strict";

  const C = OPF.config, H = OPF.html, F = OPF.forms, R = OPF.records, K = OPF.calc, S = OPF.store;
  const { esc, fmtQty, today, byDateDesc } = OPF.util;

  function render() {
    const editing = F.isEditing("issues");
    F.page({
      title: "Raw Material / Fabric Issue to Production", coll: "issues", submit: "issue.save", calc: "issue.calc", after: F.calcBox(),
      fields: [
        H.field("date", "Issue Date", { type: "date", value: today(), required: true }),
        H.field("slip", "Issue Slip No.", { value: editing ? "" : S.nextNo("issues", "slip", "IS-", 4) }),
        H.select("order", "Production Order", OPF.lists.orders(), { change: "order.fill" }),
        H.field("style", "Style", { required: true, list: "dl-style" }), H.field("material", "Material / Fabric", { required: true, list: "dl-mat" }),
        H.field("color", "Fabric Color"), H.field("qty", "Issued Quantity", { type: "number", required: true }),
        H.select("unit", "Unit", H.optionList(C.UNITS)), H.field("remarks", "Remarks")
      ]
    });
    const rows = byDateDesc(S.db.issues).map((r) => {
      const o = S.byId("productionOrders", r.order);
      return H.tr([H.td(r.date), H.td(esc(r.slip)), H.td(esc(o ? o.no : "")), H.td(esc(r.style)), H.td(esc(r.material)), H.td(esc(r.color)), H.tdn(fmtQty(r.qty) + " " + esc(r.unit)), R.rowActions("issues", r.id)]);
    });
    H.append(H.table(["Date", "Slip", "Order", "Style", "Material", "Color", "#Issued", ""], rows));
  }

  // Yards available, not counting the issue being edited.
  function available(d) {
    const line = OPF.stock.rawLine(d.material, d.color, F.editingId("issues"));
    return line ? line.yards : 0;
  }

  function calc(form) {
    const d = F.data(form);
    if (!d.material) { F.showCalc('<span class="muted">Select a material to see available stock.</span>'); return; }
    const have = available(d), y = K.yardsOf(d.qty, d.unit);
    F.showCalc(y == null
      ? '<span class="muted">Stock check is available for Yard / Meter only.</span>'
      : H.calcTable([["Available in stock", fmtQty(have) + " yd"], ["This issue", fmtQty(y) + " yd"], ["Balance after issue", `<span class="${have - y < 0 ? "red" : ""}">${fmtQty(have - y)} yd</span>`, true]]));
  }

  function save(form) {
    const d = F.numify(F.data(form), ["qty"]);
    const y = K.yardsOf(d.qty, d.unit), have = available(d);
    if (y != null && y > have + 0.001 && !confirm(`Only ${fmtQty(have)} yd of ${d.material}${d.color ? " / " + d.color : ""} is in stock. Issue ${fmtQty(y)} yd anyway?`)) return;
    R.save("issues", d, "Material Issue", d.slip);
    render();
  }

  OPF.pages.issue = { render };
  OPF.actions.register({ "issue.calc": calc, "issue.save": save });
})(window.OPF = window.OPF || {});
