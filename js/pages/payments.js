/* Payment / collection with a per-party due breakdown and automatic receipt printing. */
(function (OPF) {
  "use strict";

  const C = OPF.config, H = OPF.html, F = OPF.forms, R = OPF.records, L = OPF.ledger, S = OPF.store;
  const { esc, num, money, dueText, today, byDateDesc } = OPF.util;

  function render() {
    const rec = F.editingRecord("payments");
    const form = F.page({
      title: "Payment / Collection", coll: "payments", submit: "payments.save", calc: "payments.calc", after: F.calcBox(),
      fields: [
        H.field("no", "Receipt No.", { value: rec ? "" : S.nextNo("payments", "no", "MR-", 5), required: true }),
        H.field("date", "Date", { type: "date", value: today(), required: true }),
        H.select("type", "Party Type", H.optionList(C.PARTY_TYPES), { required: true, change: "payments.partyType" }),
        H.select("party", "Party", OPF.lists.parties("Customer"), { required: true }),
        H.field("amount", "Amount Paid Now", { type: "number", required: true }),
        H.select("method", "Cash / Bank / bKash / Nagad", H.optionList(C.METHODS)), H.field("reference", "Reference / Transaction No."), H.field("remarks", "Remarks"),
        H.cell("", '<label style="font-size:13px;color:#1e293b"><input type="checkbox" name="print" checked style="width:auto"> Print receipt after saving</label>')
      ]
    });
    if (rec) selectParty(form, rec.type, rec.party);
    H.append(dueParties() + payables() + register());
  }

  function selectParty(form, type, id) {
    F.set(form, "type", type);
    F.el(form, "party").innerHTML = OPF.lists.parties(type);
    F.set(form, "party", id);
    calc(form);
  }

  function dueParties() {
    const bm = L.balances("Customer"), todays = L.breakdowns("Customer", today());
    const rows = S.db.customers.filter((c) => bm[c.id].bal > 0.004).sort((a, b) => bm[b.id].bal - bm[a.id].bal).map((c) => {
      const b = todays[c.id];
      return H.tr([
        H.td(H.customerLink(esc(c.name), c.id)), H.td(esc(c.mobile)), H.tdn(money(b.prev)), H.tdn(money(b.bill)), H.tdn(money(b.total)), H.tdn(money(b.less)),
        H.tdn("<b>" + money(bm[c.id].bal) + "</b>", "red"), H.td(H.button("Collect", "payments.collect", { type: "Customer", id: c.id }, "sm"), "act no-print")
      ]);
    });
    return "<h2>Due Parties - Detailed (as of today)</h2>" + H.table(["Customer", "Mobile", "#Previous Due", "#Today's Purchase", "#Total", "#Paid / Returned Today", "#Current Due", ""], rows, {
      foot: H.tr([H.td("Total"), H.tdEmpty(5), H.tdn(money(L.totalDue("Customer"))), H.tdEmpty()])
    });
  }

  function payables() {
    const rows = [];
    ["Supplier", "Factory"].forEach((type) => {
      const bm = L.balances(type);
      S.db[C.PARTY_COLL[type]].filter((p) => bm[p.id].bal > 0.004).forEach((p) => rows.push(H.tr([
        H.td(type), H.td(H.statementLink(esc(p.name), type, p.id)), H.td(esc(p.mobile)), H.tdn(money(bm[p.id].bal), "red"),
        H.td(H.button("Pay", "payments.collect", { type, id: p.id }, "sm"), "act no-print")
      ])));
    });
    return rows.length ? "<h2>Payable to Suppliers / Factories</h2>" + H.table(["Type", "Party", "Mobile", "#Payable", ""], rows, { tight: true }) : "";
  }

  function register() {
    const rows = byDateDesc(S.db.payments).map((p) => H.tr([
      H.td(esc(p.no)), H.td(p.date), H.td(esc(p.type)), H.td(esc(S.partyName(p.type, p.party))), H.tdn(money(p.amount)), H.td(esc(p.method)), H.td(esc(p.reference)),
      H.tdn(p.snap ? dueText(p.snap.remaining) : ""), R.rowActions("payments", p.id, H.button("Receipt", "print.receipt", { id: p.id }, "sm"))
    ]));
    return "<h2>Payment Register</h2>" + H.table(["Receipt No.", "Date", "Type", "Party", "#Amount", "Method", "Reference", "#Remaining Due", ""], rows);
  }

  function calc(form) {
    const d = F.data(form);
    if (!d.party) { F.showCalc("<span class=\"muted\">Select a party to see Previous Due, Today's Purchase, Total Due and Remaining Balance.</span>"); return; }
    const snap = L.paymentSnapshot(d, F.editingId("payments"));
    F.showCalc(`<b>${esc(S.partyName(d.type, d.party))}</b> - breakdown for ${esc(d.date)}` + H.calcTable(OPF.print.snapshotRows(snap, d.type)));
  }

  function save(form) {
    const d = F.data(form), printReceipt = !!d.print;
    delete d.print;
    d.amount = num(d.amount);
    if (d.amount <= 0) { alert("Enter the amount paid."); return; }
    d.snap = L.paymentSnapshot(d, F.editingId("payments"));
    const rec = R.save("payments", d, "Payment", d.no);
    OPF.router.go("payments");
    if (printReceipt) OPF.print.receipt(rec.id);
  }

  // Open the form with a party pre-selected (from due lists, profiles and statements).
  function collect(type, id) {
    OPF.router.go("payments");
    const form = H.$("mainForm");
    selectParty(form, type, id);
    F.el(form, "amount").focus();
    window.scrollTo(0, 0);
  }

  OPF.pages.payments = { render, collect };
  OPF.actions.register({
    "payments.calc": calc,
    "payments.save": save,
    "payments.partyType": (el) => { F.el(el.form, "party").innerHTML = OPF.lists.parties(el.value); },
    "payments.collect": (el) => collect(el.dataset.type, el.dataset.id)
  });
})(window.OPF = window.OPF || {});
