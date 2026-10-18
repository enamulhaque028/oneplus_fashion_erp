/* Courier / delivery / COD: Net COD = COD - Advance, parcel dashboard, status updates. */
(function (OPF) {
  "use strict";

  const C = OPF.config, H = OPF.html, F = OPF.forms, R = OPF.records, K = OPF.calc, S = OPF.store;
  const { esc, num, money, today, byDateDesc } = OPF.util;

  function render() {
    const form = F.page({
      title: "Courier / Delivery / COD", coll: "courier", submit: "courier.save", calc: "courier.calc", after: F.calcBox(),
      fields: [
        H.field("date", "Date", { type: "date", value: today(), required: true }), H.field("invoice", "Invoice No.", { list: "dl-inv", change: "courier.invoice" }),
        H.select("customer", "Customer", OPF.lists.customers()), H.field("destination", "Destination / Address"),
        H.field("courier", "Courier Company", { list: "dl-courier" }), H.field("tracking", "Tracking No."),
        H.field("cod", "COD Amount (parcel value)", { type: "number", value: 0 }), H.field("advance", "Advance Paid by Customer", { type: "number", value: 0 }),
        H.field("netCod", "Net COD to Collect (auto)", { type: "number", value: 0, readonly: true, attrs: { tabindex: "-1" } }),
        H.field("charge", "Courier Charge", { type: "number", value: 0 }), H.select("status", "Status", H.optionList(C.COURIER_STATUS)),
        H.select("settled", "COD Settled by Courier?", H.optionList(["No", "Yes"])), H.field("remarks", "Remarks")
      ]
    });
    form.insertAdjacentHTML("beforebegin", dashboard());
    H.append(register());
  }

  function dashboard() {
    const s = K.courierSummary(S.db.courier);
    return '<div class="box"><h2 style="margin-top:0">Parcel Tracking Dashboard</h2>' +
      `<p>Out of <b>${s.sent}</b> parcels sent: <b class="green">${s.delivered} delivered</b>, <b class="amber">${s.pending} pending</b>${s.returned ? `, <b class="red">${s.returned} returned</b>` : ""}.</p>` +
      '<div class="cards" style="margin-bottom:0">' +
      H.card("Parcels Sent", s.sent) + H.card("Delivered", s.delivered, "ok") + H.card("Pending Parcels", s.pending, "hl") +
      H.card("Pending COD (in transit)", money(s.pendingAmt)) + H.card("Due from Courier (delivered, not settled)", money(s.receivable), "hl") +
      H.card("Total Receivable from Courier", money(s.pendingAmt + s.receivable)) +
      '</div><p class="muted">Amounts are Net COD (COD − Advance) minus courier charge.</p></div>';
  }

  function register() {
    const rows = byDateDesc(S.db.courier).map((c) => {
      const status = `<select data-change="courier.status" data-id="${c.id}">${H.optionList(C.COURIER_STATUS, c.status)}</select>`;
      const settled = c.status == "Delivered" ? H.button(c.settled == "Yes" ? "Settled" : "Not settled", "courier.settle", { id: c.id }, "sm " + (c.settled == "Yes" ? "good" : "warn")) : "";
      return H.tr([
        H.td(c.date), H.td(esc(c.invoice)), H.td(esc(S.partyName("Customer", c.customer))), H.td(esc(c.destination)), H.td(esc(c.courier)), H.td(esc(c.tracking)),
        H.tdn(money(c.cod)), H.tdn(money(c.advance)), H.tdn("<b>" + money(K.courierNet(c)) + "</b>"), H.tdn(money(c.charge)), H.td(status), H.td(settled), R.rowActions("courier", c.id)
      ]);
    });
    return H.table(["Date", "Invoice", "Customer", "Destination", "Courier", "Tracking", "#COD", "#Advance", "#Net COD", "#Charge", "Status", "COD Settled", ""], rows);
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

  function calc(form) {
    const d = F.data(form), net = K.courierNet(d);
    F.set(form, "netCod", net);
    F.showCalc(H.calcTable([
      ["COD Amount", money(d.cod)], ["- Advance Paid by Customer", money(d.advance)], ["= Net COD to be Collected by Courier", money(net), true],
      ["- Courier Charge", money(d.charge)], ["= Net Receivable from Courier", money(net - num(d.charge)), true]
    ]) + (net < 0 ? '<div class="red">Advance is more than the COD amount.</div>' : ""));
  }

  function save(form) {
    const d = F.numify(F.data(form), ["cod", "advance", "charge"]);
    if (d.advance > d.cod) { alert("Advance cannot be more than the COD amount."); return; }
    d.netCod = K.courierNet(d);
    R.save("courier", d, "Courier", d.tracking || d.invoice);
    render();
  }

  // Status and settlement changes are edits, so they need admin; a cancelled prompt restores the list.
  function setStatus(el) {
    const id = el.dataset.id, value = el.value;
    OPF.auth.require(() => {
      const c = S.byId("courier", id);
      c.status = value;
      S.log("Courier Status: " + value, c.tracking || c.invoice);
      render();
    }, render);
  }

  function toggleSettled(el) {
    OPF.auth.require(() => {
      const c = S.byId("courier", el.dataset.id);
      c.settled = c.settled == "Yes" ? "No" : "Yes";
      S.log("Courier COD Settled: " + c.settled, c.tracking || c.invoice);
      render();
    });
  }

  OPF.pages.courier = { render };
  OPF.actions.register({ "courier.calc": calc, "courier.save": save, "courier.invoice": fromInvoice, "courier.status": setStatus, "courier.settle": toggleSettled });
})(window.OPF = window.OPF || {});
