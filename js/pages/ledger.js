/* Ledgers / due for customers, suppliers and factories, plus the reconciliation check. */
(function (OPF) {
  "use strict";

  const C = OPF.config, H = OPF.html, L = OPF.ledger;
  const { esc, sum, money, dueText } = OPF.util;

  const LABELS = {
    Customer: { dr: "#Sales (+)", cr: "#Received / Returned (−)", bal: "#Current Due", formula: "Customer formula: Previous Due + Sales − Paid on Invoice − Returns − Collections = Current Due." },
    Supplier: { dr: "#Purchases (+)", cr: "#Paid (−)", bal: "#Current Payable", formula: "Supplier formula: Previous Due + Purchases − Paid on Purchase − Payments = Current Payable." },
    Factory: { dr: "#Production Bill (+)", cr: "#Paid (−)", bal: "#Current Payable", formula: "Factory formula: Previous Due + Production Bill (Accepted PCS x Rate) − Payments = Current Payable." }
  };
  let tab = "Customer";

  function render() {
    const bm = L.balances(tab), parties = OPF.store.db[C.PARTY_COLL[tab]], label = LABELS[tab];
    const total = (k) => H.tdn(money(sum(parties, (p) => bm[p.id][k])));
    const rows = parties.map((p) => {
      const b = bm[p.id];
      return H.tr([H.td(H.link(esc(p.name), "party.statement", { type: tab, id: p.id })), H.td(esc(p.mobile)), H.tdn(money(b.opening)), H.tdn(money(b.dr)), H.tdn(money(b.cr)), H.tdn("<b>" + dueText(b.bal) + "</b>", b.bal > 0 ? "red" : "")]);
    });
    H.mount(
      '<h1>Ledgers / Due</h1><div class="tabs">' + C.PARTY_TYPES.map((t) => H.button(t + "s", "ledger.tab", { tab: t }, tab == t ? "on" : "")).join("") + "</div>" +
      `<p class="muted">${label.formula}</p>` +
      H.table(["Party", "Mobile", "#Opening", label.dr, label.cr, label.bal], rows, { foot: H.tr([H.td("Total"), H.tdEmpty(), total("opening"), total("dr"), total("cr"), total("bal")]) }) +
      reconciliation()
    );
  }

  function reconciliation() {
    const result = OPF.audit.run();
    const rows = result.checks.map((c) => H.tr([H.td(c.type + "s"), H.tdn(money(c.all)), H.tdn(money(c.listed)), H.td(c.ok ? H.pill("Reconciled", "cash") : H.pill("Difference " + money(c.all - c.listed), "due"))]));
    return '<div class="box"><h2 style="margin-top:0">Reconciliation Check</h2><p class="muted">Every due figure in the ERP (dashboard, customers, payments, invoices, receipts, statements) comes from the same ledger. This check compares the total of all transactions with the total of all party balances.</p>' +
      H.table(["Ledger", "#All Transactions", "#Sum of Party Balances", "Status"], rows, { tight: true }) +
      (result.issues.length
        ? `<div class="alert"><b>Items to review:</b><ul>${result.issues.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`
        : '<p class="green"><b>All checks passed.</b></p>') + "</div>";
  }

  OPF.pages.ledger = { render };
  OPF.actions.register({ "ledger.tab": (el) => { tab = el.dataset.tab; render(); } });
})(window.OPF = window.OPF || {});
