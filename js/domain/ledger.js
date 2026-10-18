/* Party ledgers - the single source of truth for every due / payable figure.

   postings(type) turns transactions into ledger lines for Customers, Suppliers or Factories:
     dr = increases the balance (customer owes us / we owe the supplier or factory)
     cr = reduces it (payments received or made, returns)
   Every screen, print-out and export derives balances from these lines. */
(function (OPF) {
  "use strict";

  const C = OPF.config, K = OPF.calc;
  const { num, r2, sum } = OPF.util;

  function postings(type) {
    const db = OPF.store.db;
    const out = [];
    const push = (pid, date, kind, ref, dr, cr, src) => {
      dr = r2(dr);
      cr = r2(cr);
      if (dr || cr) out.push({ pid, date: date || "", kind, ref: ref || "", dr, cr, src: src ? src.id : "", ts: src ? src.created || "" : "" });
    };

    db[C.PARTY_COLL[type]].forEach((p) => {
      const opening = num(p.previousDue);
      if (opening) push(p.id, "", "Opening", "Previous Due", Math.max(opening, 0), Math.max(-opening, 0));
    });

    if (type == "Customer") {
      db.sales.forEach((s) => {
        push(s.customer, s.date, "Sale", s.invoice, K.saleTotal(s), 0, s);
        push(s.customer, s.date, "Paid on Invoice", s.invoice, 0, s.paid, s);
      });
      db.returns.forEach((r) => push(r.customer, r.date, "Sales Return", r.invoice, 0, r.amount, r));
    } else if (type == "Supplier") {
      db.purchases.forEach((r) => {
        const c = K.purchase(r);
        push(r.supplier, r.date, "Purchase", r.invoice || r.material, c.total, 0, r);
        push(r.supplier, r.date, "Paid on Purchase", r.invoice || r.material, 0, c.paid, r);
      });
    } else {
      db.production.forEach((r) => push(r.factory, r.date, "Production Bill", `${r.style} x ${OPF.util.fmtQty(r.accepted)}`, K.productionBill(r), 0, r));
    }

    db.payments.forEach((r) => {
      if (r.type == type) push(r.party, r.date, type == "Customer" ? "Collection" : "Payment", r.no || r.reference, 0, r.amount, r);
    });
    return out;
  }

  // { partyId: [lines] } - build postings once when working with many parties.
  function groupByParty(type) {
    const map = {};
    postings(type).forEach((x) => { (map[x.pid] = map[x.pid] || []).push(x); });
    return map;
  }

  // Sort lines by date and add a running balance.
  function withBalance(list) {
    list.sort((a, b) => (a.date != b.date ? (a.date < b.date ? -1 : 1) : a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
    let bal = 0;
    list.forEach((x) => { bal = r2(bal + x.dr - x.cr); x.bal = bal; });
    return list;
  }

  // One party's statement in date order with a running balance.
  const entries = (type, pid) => withBalance(postings(type).filter((x) => x.pid == pid));

  // Statements for every party of the type: { partyId: [lines with bal] }.
  function allEntries(type) {
    const map = groupByParty(type);
    Object.keys(map).forEach((pid) => withBalance(map[pid]));
    return map;
  }

  // { partyId: { opening, dr, cr, bal } } for every party of the type, optionally as on a date.
  function balances(type, uptoDate) {
    const map = {};
    OPF.store.db[C.PARTY_COLL[type]].forEach((p) => { map[p.id] = { opening: 0, dr: 0, cr: 0, bal: 0 }; });
    postings(type).forEach((x) => {
      const b = map[x.pid];
      if (!b || (uptoDate && x.date > uptoDate)) return;
      if (x.kind == "Opening") b.opening = r2(b.opening + x.dr - x.cr);
      else { b.dr = r2(b.dr + x.dr); b.cr = r2(b.cr + x.cr); }
      b.bal = r2(b.bal + x.dr - x.cr);
    });
    return map;
  }

  const balance = (type, pid) => { const b = balances(type)[pid]; return b ? b.bal : 0; };
  const totalDue = (type) => { const m = balances(type); return sum(Object.keys(m), (k) => Math.max(m[k].bal, 0)); };
  const balanceExcluding = (type, pid, srcId) => sum(postings(type).filter((x) => x.pid == pid && (!srcId || x.src != srcId)), (x) => x.dr - x.cr);

  // Previous due (before date) + today's bill = total; less paid / returned today = due before a new payment.
  function breakdownOf(lines, date, excludeSrcId) {
    const b = { prev: 0, bill: 0, less: 0 };
    lines.forEach((x) => {
      if (excludeSrcId && x.src == excludeSrcId) return;
      if (x.date < date) b.prev = r2(b.prev + x.dr - x.cr);
      else if (x.date == date) { b.bill = r2(b.bill + x.dr); b.less = r2(b.less + x.cr); }
    });
    b.total = r2(b.prev + b.bill);
    b.due = r2(b.total - b.less);
    return b;
  }
  const breakdown = (type, pid, date, excludeSrcId) => breakdownOf(postings(type).filter((x) => x.pid == pid), date, excludeSrcId);

  // Breakdown for every party on a date: { partyId: breakdown }.
  function breakdowns(type, date) {
    const map = groupByParty(type), out = {};
    Object.keys(map).forEach((pid) => { out[pid] = breakdownOf(map[pid], date); });
    return out;
  }

  // Figures frozen onto a payment when it is saved, for its receipt.
  function paymentSnapshot(p, excludeSrcId) {
    const b = breakdown(p.type, p.party, p.date, excludeSrcId);
    return { prev: b.prev, bill: b.bill, total: b.total, less: b.less, paid: r2(p.amount), remaining: r2(b.due - num(p.amount)) };
  }

  // Customer balance before this invoice (earlier dates, or earlier the same day).
  function invoicePreviousDue(s) {
    return sum(
      postings("Customer").filter((x) => x.pid == s.customer && x.src != s.id && (x.date < s.date || (x.date == s.date && x.ts < (s.created || "")))),
      (x) => x.dr - x.cr
    );
  }

  OPF.ledger = { postings, entries, allEntries, balances, balance, totalDue, balanceExcluding, breakdown, breakdowns, paymentSnapshot, invoicePreviousDue };
})(window.OPF = window.OPF || {});
