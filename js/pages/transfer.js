/* Factory → showroom transfer with dispatched / received / shortage tracking. */
(function (OPF) {
  "use strict";

  const C = OPF.config, H = OPF.html, F = OPF.forms, R = OPF.records, S = OPF.store;
  const { esc, num, r2, sum, fmtQty, today, byDateDesc, skey } = OPF.util;

  const shortage = (t) => r2(num(t.dispatched) - num(t.received));

  function render() {
    const editing = F.isEditing("transfers");
    const form = F.page({
      title: "Factory → Showroom / Shop Transfer", coll: "transfers", submit: "transfer.save", calc: "transfer.calc", after: F.calcBox(),
      fields: [
        H.field("date", "Date", { type: "date", value: today(), required: true }),
        H.field("reference", "Transfer No.", { value: editing ? "" : S.nextNo("transfers", "reference", "TR-", 4) }),
        H.select("from", "From (Factory Name)", OPF.lists.factories(), { required: true }), H.field("to", "To Showroom / Shop", { value: C.MAIN_SHOP, required: true, list: "dl-shop" }),
        H.field("style", "Style", { required: true, list: "dl-style" }), H.field("color", "Color"), H.field("size", "Size"),
        H.field("dispatched", "Dispatched Qty (PCS)", { type: "number", required: true }), H.field("received", "Received Qty (PCS)", { type: "number", required: true }),
        H.field("remarks", "Remarks")
      ]
    });

    const list = S.db.transfers;
    const dispatched = sum(list, (t) => t.dispatched), received = sum(list, (t) => t.received);
    const rows = byDateDesc(list).map((t) => {
      const sh = shortage(t);
      return H.tr([
        H.td(t.date), H.td(esc(t.reference)), H.td(esc(S.factoryName(t.from))), H.td(esc(t.to)), H.td(esc(t.style)), H.td(esc(t.color)), H.td(esc(t.size)),
        H.tdn(fmtQty(t.dispatched)), H.tdn(fmtQty(t.received)), H.tdn(sh ? "<b>" + fmtQty(sh) + "</b>" : "0", sh > 0 ? "red" : ""), R.rowActions("transfers", t.id)
      ]);
    });

    form.insertAdjacentHTML("afterend", H.cards([
      H.card("Transfers", list.length), H.card("Dispatched PCS", fmtQty(dispatched)), H.card("Received PCS", fmtQty(received), "ok"),
      H.card("Due / Shortage PCS", fmtQty(dispatched - received), "hl"), H.card("Transfers with Shortage", list.filter((t) => shortage(t) > 0).length)
    ]));
    H.append(H.table(["Date", "Transfer No.", "From (Factory)", "To", "Style", "Color", "Size", "#Dispatched", "#Received", "#Due / Shortage", ""], rows, {
      foot: H.tr([H.td("Total"), H.tdEmpty(6), H.tdn(fmtQty(dispatched)), H.tdn(fmtQty(received)), H.tdn(fmtQty(dispatched - received)), H.tdEmpty()])
    }));
  }

  // Godown stock for the style / color / size, not counting the transfer being edited.
  function godownStock(d) {
    const editId = F.editingId("transfers");
    return OPF.stock.finished(editId ? { coll: "transfers", id: editId } : null).godown[skey(d.style, d.color, d.size)] || 0;
  }

  function calc(form) {
    const d = F.data(form), sh = shortage(d);
    F.showCalc(H.calcTable([
      ["Dispatched", fmtQty(d.dispatched) + " PCS"],
      ["Received", fmtQty(d.received) + " PCS"],
      ["Due / Shortage", `<span class="${sh > 0 ? "red" : ""}">${fmtQty(sh)} PCS</span>`, true]
    ]) + (d.style ? `<div class="muted">Godown stock for this style/color/size before transfer: ${fmtQty(godownStock(d))} PCS</div>` : ""));
  }

  function save(form) {
    const d = F.numify(F.data(form), ["dispatched", "received"]);
    if (d.received > d.dispatched) { alert("Received quantity cannot be more than dispatched quantity."); return; }
    const have = godownStock(d);
    if (d.dispatched > have && !confirm(`Godown stock for ${d.style} is only ${fmtQty(have)} PCS. Save anyway?`)) return;
    S.addShowroom(d.to);
    R.save("transfers", d, "Stock Transfer", d.reference);
    render();
  }

  OPF.pages.transfer = { render };
  OPF.actions.register({ "transfer.calc": calc, "transfer.save": save });
})(window.OPF = window.OPF || {});
