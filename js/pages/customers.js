/* Customer / wholesale party master: summary, cash vs due parties, date-wise due list. */
(function (OPF) {
  "use strict";

  const H = OPF.html, F = OPF.forms, R = OPF.records, K = OPF.calc, L = OPF.ledger, S = OPF.store;
  const { esc, num, r2, sum, money, dueText, today, monthStart } = OPF.util;

  const openLink = (c) => H.link(esc(c.name), "customer.open", { id: c.id });

  function render() {
    F.page({
      title: "Customer / Wholesale Party", coll: "customers", submit: "customers.save",
      fields: [
        H.field("name", "Shop / Customer Name", { required: true }), H.field("mobile", "Mobile"), H.field("address", "Address"), H.field("district", "District"),
        H.field("credit", "Credit Limit", { type: "number", value: 0 }), H.field("previousDue", "Previous Due", { type: "number", value: 0 })
      ]
    });

    const bm = L.balances("Customer"), due = [], cash = [];
    S.db.customers.forEach((c) => (bm[c.id].bal > 0.004 ? due : cash).push(c));
    due.sort((a, b) => bm[b.id].bal - bm[a.id].bal);
    cash.sort((a, b) => (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1));
    const totalDue = sum(due, (c) => bm[c.id].bal);
    const advance = sum(cash, (c) => Math.max(-bm[c.id].bal, 0));

    const row = (c) => {
      const bal = bm[c.id].bal, overLimit = num(c.credit) && bal > num(c.credit);
      return H.tr([
        H.td(openLink(c)), H.td(esc(c.mobile)), H.td(esc(c.district)), H.tdn(dueText(bal), bal > 0 ? "red" : "green"),
        H.td(overLimit ? H.pill("Over limit", "due") : ""), R.rowActions("customers", c.id, H.button("View", "customer.open", { id: c.id }, "sm light"))
      ]);
    };

    H.append(
      H.cards([
        H.card("Total Parties", S.db.customers.length), H.card("Due Parties", due.length, "hl"), H.card("Total Due Amount", money(totalDue), "hl"),
        H.card("Cash Parties (no due)", cash.length, "ok"), H.card("Customer Advance", money(advance)),
        H.card("Highest Due", due.length ? `${esc(due[0].name)}<div class="muted">${money(bm[due[0].id].bal)}</div>` : "-")
      ]) +
      '<div class="cols2"><div><h2 class="green">Cash Parties (no due)</h2>' + H.table(["Customer", "Mobile", "District", "#Balance", "", ""], cash.map(row), { tight: true }) + "</div>" +
      '<div><h2 class="red">Due Parties</h2>' + H.table(["Customer", "Mobile", "District", "#Due", "", ""], due.map(row), { tight: true, foot: H.tr([H.td("Total"), H.tdEmpty(2), H.tdn(money(totalDue)), H.tdEmpty(2)]) }) + "</div></div>" +
      '<div class="box"><h2>Date-wise Due List</h2><div class="inline no-print">' +
      `<div class="field"><label>From</label><input type="date" id="dueFrom" value="${monthStart()}"></div><div class="field"><label>To</label><input type="date" id="dueTo" value="${today()}"></div>` +
      H.button("Show", "customers.dueReport") + H.button("Print", "print.page", null, "light") + '</div><div id="dueOut"></div></div>'
    );
    dueReport();
  }

  function dueReport() {
    const from = H.$("dueFrom").value || "0000", to = H.$("dueTo").value || "9999";
    const byDate = {};
    S.db.sales.filter((s) => s.date >= from && s.date <= to && K.saleDue(s) > 0).forEach((s) => { (byDate[s.date] = byDate[s.date] || []).push(s); });

    const rows = [];
    let grand = 0;
    Object.keys(byDate).sort().forEach((date) => {
      const list = byDate[date], subtotal = sum(list, K.saleDue);
      grand = r2(grand + subtotal);
      list.forEach((s) => {
        const c = S.byId("customers", s.customer) || {};
        rows.push(H.tr([H.td(date), H.td(esc(s.invoice)), H.td(esc(c.name || s.customer)), H.td(esc(c.mobile)), H.tdn(money(K.saleTotal(s))), H.tdn(money(s.paid)), H.tdn(money(K.saleDue(s)), "red")]));
      });
      rows.push(H.tr([H.td(date + " subtotal"), H.tdEmpty(5), H.tdn(money(subtotal))], "sub"));
    });

    const asOn = L.balances("Customer", to);
    const partyRows = S.db.customers.filter((c) => asOn[c.id].bal > 0.004).sort((a, b) => asOn[b.id].bal - asOn[a.id].bal)
      .map((c) => H.tr([H.td(openLink(c)), H.td(esc(c.mobile)), H.tdn(money(asOn[c.id].bal), "red")]));

    H.$("dueOut").innerHTML =
      `<h2>Invoices with due, ${esc(from)} to ${esc(to)}</h2><p class="muted">Due at the time of each invoice (Total − Paid on the invoice).</p>` +
      H.table(["Date", "Invoice", "Customer", "Mobile", "#Total", "#Paid", "#Due"], rows, { foot: H.tr([H.td("Grand Total"), H.tdEmpty(5), H.tdn(money(grand))]) }) +
      `<h2>Party due as on ${esc(to)}</h2><p class="muted">Full ledger balance on that date, after all payments and returns.</p>` +
      H.table(["Customer", "Mobile", "#Due as on " + esc(to)], partyRows, { tight: true, foot: H.tr([H.td("Total"), H.tdEmpty(), H.tdn(money(sum(S.db.customers, (c) => Math.max(asOn[c.id].bal, 0))))]) });
  }

  function save(form) {
    const d = F.numify(F.data(form), ["credit", "previousDue"]);
    R.save("customers", d, "Customer", d.name);
    render();
  }

  OPF.pages.customers = { render };
  OPF.actions.register({ "customers.save": save, "customers.dueReport": dueReport });
})(window.OPF = window.OPF || {});
