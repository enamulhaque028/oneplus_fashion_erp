/* Sales returns: stock back to the shop, amount credited to the customer. */
(function (OPF) {
  "use strict";

  const C = OPF.config, H = OPF.html, F = OPF.forms, R = OPF.records, S = OPF.store;
  const { esc, num, r2, lc, money, fmtQty, today, byDateDesc } = OPF.util;

  function render() {
    F.page({
      title: "Sales Return", coll: "returns", submit: "returns.save", calc: "returns.calc", after: F.calcBox(),
      fields: [
        H.field("date", "Date", { type: "date", value: today(), required: true }), H.field("invoice", "Original Invoice", { list: "dl-inv", change: "returns.invoice" }),
        H.select("customer", "Customer", OPF.lists.customers(), { required: true }), H.field("location", "Return to Location", { value: C.MAIN_SHOP, required: true, list: "dl-shop" }),
        H.field("style", "Style", { required: true, list: "dl-style" }), H.field("color", "Color"), H.field("size", "Size"),
        H.field("qty", "Return Quantity", { type: "number", required: true }), H.field("amount", "Return Amount", { type: "number", value: 0 }), H.field("reason", "Reason")
      ]
    });
    const rows = byDateDesc(S.db.returns).map((r) => H.tr([
      H.td(r.date), H.td(esc(r.invoice)), H.td(esc(S.partyName("Customer", r.customer))), H.td(esc(r.style)), H.td(esc([r.color, r.size].filter(Boolean).join(" / "))),
      H.tdn(fmtQty(r.qty)), H.tdn(money(r.amount)), H.td(esc(r.reason)), R.rowActions("returns", r.id)
    ]));
    H.append(H.table(["Date", "Invoice", "Customer", "Style", "Color / Size", "#Qty", "#Amount", "Reason", ""], rows));
  }

  // Choosing the original invoice fills customer, location and (single-item invoices) the item.
  function fromInvoice(el) {
    const s = S.saleByInvoice(el.value), form = el.form;
    if (!s) return;
    F.set(form, "customer", s.customer);
    F.set(form, "location", s.location);
    if (s.items.length == 1) ["style", "color", "size"].forEach((k) => F.set(form, k, s.items[0][k]));
  }

  // Suggests Return Amount = Qty x sold rate, unless the user is typing the amount.
  function calc(form, ev) {
    const d = F.data(form), s = S.saleByInvoice(d.invoice);
    if (!s) { F.showCalc('<span class="muted">Enter the original invoice number to get the sold rate automatically.</span>'); return; }
    const item = s.items.find((i) => lc(i.style) == lc(d.style) && lc(i.color) == lc(d.color) && lc(i.size) == lc(d.size)) || s.items.find((i) => lc(i.style) == lc(d.style));
    if (!item) { F.showCalc(`<span class="amber">Style ${esc(d.style)} is not on invoice ${esc(s.invoice)}.</span>`); return; }
    const suggested = r2(num(d.qty) * num(item.rate));
    if (ev && ev.target && ev.target.name != "amount") F.set(form, "amount", suggested);
    F.showCalc(H.calcTable([[`Sold on ${esc(s.invoice)}`, `${fmtQty(item.qty)} PCS x ${money(item.rate)}`], [`Return amount (${fmtQty(d.qty)} x ${money(item.rate)})`, money(suggested), true]]) +
      (num(d.qty) > num(item.qty) ? '<div class="red">Return qty is more than the sold qty.</div>' : ""));
  }

  function save(form) {
    const d = F.numify(F.data(form), ["qty", "amount"]);
    S.addShowroom(d.location);
    R.save("returns", d, "Sales Return", d.invoice);
    render();
  }

  OPF.pages.returns = { render };
  OPF.actions.register({ "returns.calc": calc, "returns.save": save, "returns.invoice": fromInvoice });
})(window.OPF = window.OPF || {});
