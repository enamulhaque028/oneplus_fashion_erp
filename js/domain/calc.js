/* Business formulas for single records. Pure functions of the record passed in
   (orderActual is the only one that reads the store). */
(function (OPF) {
  "use strict";

  const { num, r2, lc, sum } = OPF.util;
  const YARDS_PER_METER = 1.0936133;

  // Quantity in yards, or null for units that are not a length (kg, pcs).
  function yardsOf(qty, unit) {
    const u = lc(unit);
    if (!u || u.startsWith("y")) return num(qty);
    if (u.startsWith("m") && !u.startsWith("mm")) return r2(num(qty) * YARDS_PER_METER);
    return null;
  }

  // Total = Qty x Rate + Transport + Loading + Other - Discount;  Due = Total - Paid
  function purchase(r) {
    const qty = num(r.qty);
    const sub = r2(qty * num(r.rate));
    const extra = r2(num(r.transport) + num(r.loading) + num(r.other));
    const total = r2(sub + extra - num(r.discount));
    return {
      sub, extra, total,
      discount: r2(r.discount),
      paid: r2(r.paid),
      due: r2(total - num(r.paid)),
      unitCost: qty ? r2(total / qty) : 0,
      yards: yardsOf(qty, r.unit)
    };
  }

  const itemAmount = (i) => r2(num(i.qty) * num(i.rate));
  const saleSubtotal = (s) => sum(s.items || [], itemAmount);
  const saleTotal = (s) => r2(saleSubtotal(s) - num(s.discount));
  const saleDue = (s) => r2(saleTotal(s) - num(s.paid));
  const salePcs = (s) => sum(s.items || [], (i) => i.qty);

  const productionBill = (p) => r2(num(p.accepted) * num(p.rate));

  const orderActual = (o) => sum(OPF.store.db.production.filter((p) => p.order == o.id), (p) => p.accepted);

  function orderStatus(o, actual) {
    if (o.status == "Cancelled") return "Cancelled";
    if (num(o.planned) && actual >= num(o.planned)) return "Completed";
    if (actual > 0) return "In Progress";
    return o.status || "Open";
  }

  // Cost / PC = fabric (yards x rate) + accessories + factory + packaging + transport + other;
  // Selling price = cost + margin %.
  function costing(d) {
    const fabric = r2(num(d.fabricYd) * num(d.fabricRate));
    const total = r2(fabric + num(d.accessories) + num(d.factory) + num(d.packaging) + num(d.transport) + num(d.other));
    const profit = r2((total * num(d.margin)) / 100);
    const price = r2(total + profit);
    const qty = num(d.qty);
    return { fabric, total, profit, price, qty, totalCost: r2(total * qty), totalSales: r2(price * qty), totalProfit: r2(profit * qty) };
  }

  // Parcel counts only. Courier records are notes: money moves only through Sales and Payment entries.
  function courierSummary(list) {
    const s = { sent: 0, delivered: 0, pending: 0, returned: 0, cancelled: 0 };
    list.forEach((c) => {
      if (c.status == "Cancelled") { s.cancelled++; return; }
      s.sent++;
      if (c.status == "Delivered") s.delivered++;
      else if (c.status == "Returned") s.returned++;
      else s.pending++;
    });
    return s;
  }

  OPF.calc = { yardsOf, purchase, itemAmount, saleSubtotal, saleTotal, saleDue, salePcs, productionBill, orderActual, orderStatus, costing, courierSummary };
})(window.OPF = window.OPF || {});
