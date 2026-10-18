/* Courier / delivery: a simple parcel record (note) with status. It never changes any due:
   customer dues change only through Sales and Payment / Collection entries (business decision 2026-10-18). */
(function (OPF) {
  "use strict";

  const C = OPF.config, H = OPF.html, F = OPF.forms, R = OPF.records, K = OPF.calc, S = OPF.store;
  const { esc, num, money, today, byDateDesc } = OPF.util;

  function render() {
    const form = F.page({
      title: "Courier / Delivery", coll: "courier", submit: "courier.save",
      fields: [
        H.field("date", "Date", { type: "date", value: today(), required: true }), H.field("invoice", "Invoice No.", { list: "dl-inv", change: "courier.invoice" }),
        H.select("customer", "Customer", OPF.lists.customers()), H.field("destination", "Destination / Address"),
        H.field("courier", "Courier Company", { list: "dl-courier" }), H.field("tracking", "Tracking No."),
        H.field("cod", "COD Amount (note only)", { type: "number", value: 0 }), H.select("status", "Status", H.optionList(C.COURIER_STATUS)),
        H.field("remarks", "Note", { wide: true })
      ],
      after: '<p class="muted">For your record only - it does not change any due. When the courier pays, enter the money on <b>Payment / Collection</b>.</p>'
    });
    form.insertAdjacentHTML("beforebegin", dashboard());
    H.append(register());
  }

  function dashboard() {
    const s = K.courierSummary(S.db.courier);
    return '<div class="box"><h2 style="margin-top:0">Parcels</h2><div class="cards" style="margin-bottom:0">' +
      H.card("Parcels Sent", s.sent) + H.card("Delivered", s.delivered, "ok") + H.card("Pending Parcels", s.pending, "hl") + H.card("Returned", s.returned) +
      "</div></div>";
  }

  function register() {
    const rows = byDateDesc(S.db.courier).map((c) => {
      const status = `<select data-change="courier.status" data-id="${c.id}">${H.optionList(C.COURIER_STATUS, c.status)}</select>`;
      return H.tr([
        H.td(c.date), H.td(esc(c.invoice)), H.td(esc(S.partyName("Customer", c.customer))), H.td(esc(c.destination)), H.td(esc(c.courier)), H.td(esc(c.tracking)),
        H.tdn(money(c.cod)), H.td(status), H.td(esc(c.remarks)), R.rowActions("courier", c.id)
      ]);
    });
    return H.table(["Date", "Invoice", "Customer", "Destination", "Courier", "Tracking", "#COD", "Status", "Note", ""], rows);
  }

  // Choosing an invoice fills customer, address and COD (= invoice due).
  function fromInvoice(el) {
    const s = S.saleByInvoice(el.value), form = el.form;
    if (!s) return;
    const c = S.byId("customers", s.customer);
    F.set(form, "customer", s.customer);
    if (c && !F.get(form, "destination")) F.set(form, "destination", [c.address, c.district].filter(Boolean).join(", "));
    if (!num(F.get(form, "cod"))) F.set(form, "cod", Math.max(K.saleDue(s), 0));
  }

  function save(form) {
    const d = F.numify(F.data(form), ["cod"]);
    R.save("courier", d, "Courier", d.tracking || d.invoice);
    render();
  }

  // A status change is an edit, so it needs admin; a cancelled prompt restores the list.
  function setStatus(el) {
    const id = el.dataset.id, value = el.value;
    OPF.auth.require(() => {
      const c = S.byId("courier", id);
      c.status = value;
      S.log("Courier Status: " + value, c.tracking || c.invoice);
      render();
    }, render);
  }

  OPF.pages.courier = { render };
  OPF.actions.register({ "courier.save": save, "courier.invoice": fromInvoice, "courier.status": setStatus });
})(window.OPF = window.OPF || {});
