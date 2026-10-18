/* Reconciliation checks shown on the Ledgers page. Returns data only; the page renders it. */
(function (OPF) {
  "use strict";

  const C = OPF.config, K = OPF.calc, L = OPF.ledger, S = OPF.stock;
  const { num, lc, sum, fmtQty, uniq } = OPF.util;

  function run() {
    const db = OPF.store.db;
    const checks = [], issues = [];

    // 1. Every transaction must belong to an existing party, so the sum of all
    //    transactions equals the sum of all party balances.
    C.PARTY_TYPES.forEach((type) => {
      const bm = L.balances(type), post = L.postings(type);
      const orphans = post.filter((x) => !bm[x.pid]);
      const all = sum(post, (x) => x.dr - x.cr);
      const listed = sum(Object.keys(bm), (k) => bm[k].bal);
      checks.push({ type, all, listed, ok: all == listed });
      if (orphans.length) {
        const t = type.toLowerCase();
        issues.push(`${orphans.length} ${t} transaction(s) are not linked to any ${t} (${uniq(orphans.map((x) => x.kind + " " + x.ref)).slice(0, 6).join(", ")}). Edit them and pick the correct party.`);
      }
    });

    // 2. Data quality warnings.
    const count = {};
    db.sales.forEach((s) => { const k = lc(s.invoice); if (k) count[k] = (count[k] || 0) + 1; });
    const dup = Object.keys(count).filter((k) => count[k] > 1);
    if (dup.length) issues.push("Duplicate invoice numbers: " + dup.join(", ").toUpperCase());

    const overpaid = db.sales.filter((s) => K.saleDue(s) < 0);
    if (overpaid.length) issues.push(`${overpaid.length} invoice(s) have Paid more than Total (kept as customer advance): ${overpaid.map((s) => s.invoice).slice(0, 6).join(", ")}`);

    const st = S.finished();
    const negative = Object.keys(st.godown).filter((k) => st.godown[k] < 0).length + Object.keys(st.shop).filter((k) => st.shop[k] < 0).length;
    if (negative) issues.push(`${negative} finished stock line(s) are negative (sold/transferred more than available).`);

    const rawNegative = S.raw().filter((x) => x.yards < 0).length;
    if (rawNegative) issues.push(`${rawNegative} raw material line(s) are negative (issued more than purchased).`);

    const short = db.transfers.filter((t) => num(t.dispatched) > num(t.received));
    if (short.length) issues.push(`${short.length} transfer(s) have short delivery totalling ${fmtQty(sum(short, (t) => num(t.dispatched) - num(t.received)))} PCS.`);

    return { checks, issues };
  }

  OPF.audit = { run };
})(window.OPF = window.OPF || {});
