/* Party views (OPF.views) opened from search, lists and ledgers - not sidebar pages:
   - customer profile: details, ledger statement, invoices, payments, returns, parcels
   - supplier / factory statement */
(function (OPF) {
  "use strict";

  const C = OPF.config, H = OPF.html, K = OPF.calc, L = OPF.ledger, S = OPF.store;
  const { esc, num, r2, sum, money, fmtQty, dueText, byDateDesc } = OPF.util;

  const ledgerRow = (x) => H.tr([H.td(x.date || "Opening"), H.td(esc(x.kind)), H.td(esc(x.ref)), H.tdn(x.dr ? money(x.dr) : ""), H.tdn(x.cr ? money(x.cr) : ""), H.tdn(dueText(x.bal))]);
  const lastBalance = (entries) => (entries.length ? entries[entries.length - 1].bal : 0);

  function customer(id) {
    const c = S.byId("customers", id);
    if (!c) { OPF.router.go("customers"); return; }
    OPF.router.show("customers", () => renderCustomer(id));
  }

  function renderCustomer(id) {
    const c = S.byId("customers", id), db = S.db;
    const entries = L.entries("Customer", id), bal = lastBalance(entries);
    const sales = byDateDesc(db.sales.filter((s) => s.customer == id));
    const payments = byDateDesc(db.payments.filter((p) => p.type == "Customer" && p.party == id));
    const returns = byDateDesc(db.returns.filter((r) => r.customer == id));
    const parcels = byDateDesc(db.courier.filter((x) => x.customer == id));
    const received = r2(sum(sales, (s) => s.paid) + sum(payments, (p) => p.amount));
    const overLimit = num(c.credit) && bal > num(c.credit);

    H.mount(
      `<h1>${esc(c.name)}</h1><div class="actions no-print" style="margin-top:-6px;margin-bottom:12px">` +
      H.button("Collect Payment", "payments.collect", { type: "Customer", id }) + H.button("Edit Profile", "record.edit", { coll: "customers", id }, "light") +
      H.button("Print Statement", "print.page", null, "light") + H.button("Back to Customers", "nav.go", { page: "customers" }, "light") + "</div>" +
      H.cards([
        H.card("Previous Due (opening)", money(c.previousDue)), H.card("Total Sales", money(sum(sales, K.saleTotal))), H.card("Returns", money(sum(returns, (r) => r.amount))),
        H.card("Total Received", money(received), "ok"), H.card("Current Due", dueText(bal), bal > 0 ? "hl" : "ok"), H.card("Invoices", sales.length)
      ]) +
      `<div class="box"><b>Mobile:</b> ${esc(c.mobile || "-")} &nbsp; <b>Address:</b> ${esc(c.address || "-")} &nbsp; <b>District:</b> ${esc(c.district || "-")} &nbsp; <b>Credit Limit:</b> ${money(c.credit)}${overLimit ? " " + H.pill("Credit limit exceeded", "due") : ""}</div>` +
      "<h2>Ledger Statement</h2>" +
      H.table(["Date", "Type", "Reference", "#Debit (Sale)", "#Credit (Received / Return)", "#Balance"], entries.map(ledgerRow), {
        foot: H.tr([H.td("Total"), H.tdEmpty(2), H.tdn(money(sum(entries, (x) => x.dr))), H.tdn(money(sum(entries, (x) => x.cr))), H.tdn(dueText(bal))])
      }) +
      "<h2>Invoices</h2>" +
      H.table(["Date", "Invoice", "Items", "#PCS", "#Total", "#Paid", "#Due", ""], sales.map((s) => H.tr([
        H.td(s.date), H.td(esc(s.invoice)), H.td(esc(s.items.map((i) => i.style).join(", "))), H.tdn(fmtQty(K.salePcs(s))), H.tdn(money(K.saleTotal(s))),
        H.tdn(money(s.paid)), H.tdn(money(K.saleDue(s)), K.saleDue(s) > 0 ? "red" : ""), H.td(H.button("Invoice", "print.invoice", { id: s.id }, "sm"), "act no-print")
      ]))) +
      "<h2>Payments / Collections</h2>" +
      H.table(["Date", "Receipt No.", "#Amount", "Method", "Reference", ""], payments.map((p) => H.tr([
        H.td(p.date), H.td(esc(p.no)), H.tdn(money(p.amount)), H.td(esc(p.method)), H.td(esc(p.reference)), H.td(H.button("Receipt", "print.receipt", { id: p.id }, "sm"), "act no-print")
      ]))) +
      (returns.length ? "<h2>Sales Returns</h2>" + H.table(["Date", "Invoice", "Style", "#Qty", "#Amount", "Reason"], returns.map((r) => H.tr([H.td(r.date), H.td(esc(r.invoice)), H.td(esc(r.style)), H.tdn(fmtQty(r.qty)), H.tdn(money(r.amount)), H.td(esc(r.reason))]))) : "") +
      (parcels.length ? "<h2>Courier Parcels</h2>" + H.table(["Date", "Invoice", "Courier", "Tracking", "#Net COD", "Status"], parcels.map((x) => H.tr([H.td(x.date), H.td(esc(x.invoice)), H.td(esc(x.courier)), H.td(esc(x.tracking)), H.tdn(money(K.courierNet(x))), H.td(H.pill(x.status))]))) : "")
    );
  }

  function statement(type, id) {
    if (type == "Customer") { customer(id); return; }
    const menu = type == "Supplier" ? "suppliers" : "factories";
    if (!S.byId(C.PARTY_COLL[type], id)) { OPF.router.go(menu); return; }
    OPF.router.show(menu, () => renderStatement(type, id, menu));
  }

  function renderStatement(type, id, menu) {
    const p = S.byId(C.PARTY_COLL[type], id), entries = L.entries(type, id), bal = lastBalance(entries);
    H.mount(
      `<h1>${esc(p.name)} <span class="muted">${type} statement</span></h1><div class="actions no-print" style="margin-bottom:12px">` +
      H.button("Make Payment", "payments.collect", { type, id }) + H.button("Print Statement", "print.page", null, "light") + H.button("Back", "nav.go", { page: menu }, "light") + "</div>" +
      H.cards([
        H.card("Opening", money(p.previousDue)),
        H.card(type == "Supplier" ? "Total Purchases" : "Production Bill", money(sum(entries.filter((x) => x.kind != "Opening"), (x) => x.dr))),
        H.card("Total Paid", money(sum(entries, (x) => x.cr)), "ok"),
        H.card("Current Payable", dueText(bal), bal > 0 ? "hl" : "ok")
      ]) +
      H.table(["Date", "Type", "Reference", "#Bill (+)", "#Paid (−)", "#Balance"], entries.map(ledgerRow))
    );
  }

  OPF.views = { customer, statement };
  OPF.actions.register({
    "customer.open": (el) => customer(el.dataset.id),
    "party.statement": (el) => statement(el.dataset.type, el.dataset.id)
  });
})(window.OPF = window.OPF || {});
