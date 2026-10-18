/* Every register, ledger and stock report as tabular sheets, for the Excel backup and CSV exports. */
(function (OPF) {
  "use strict";

  const C = OPF.config, K = OPF.calc, L = OPF.ledger, S = OPF.stock;
  const { num, r2, sum } = OPF.util;
  const txt = (v) => v || "";
  const orNull = (v) => (v == null ? "" : v);

  function all() {
    const db = OPF.store.db, st = OPF.store;
    const cb = L.balances("Customer"), sb = L.balances("Supplier"), fb = L.balances("Factory");
    const styles = S.byStyle(), finished = S.finished(), raw = S.raw(), courier = K.courierSummary(db.courier);
    const orderNo = (id) => { const o = st.byId("productionOrders", id); return o ? o.no : ""; };

    const salesTotal = sum(db.sales, K.saleTotal), returns = sum(db.returns, (r) => r.amount), purchases = sum(db.purchases, (r) => K.purchase(r).total);
    const expenses = sum(db.expenses, (x) => x.amount), factoryBill = sum(db.production, K.productionBill);

    const ledgerRows = [];
    C.PARTY_TYPES.forEach((type) => {
      const statements = L.allEntries(type);
      db[C.PARTY_COLL[type]].forEach((p) =>
        (statements[p.id] || []).forEach((x) => ledgerRows.push([type, p.name, x.date || "Opening", x.kind, x.ref, x.dr, x.cr, x.bal])));
    });

    return [
      { name: "Summary", head: ["Item", "Value"], rows: [
        ["Company", db.company.name], ["Backup Date", new Date().toLocaleString()],
        ["Total Sales", salesTotal], ["Sales Returns", returns], ["Total Purchases", purchases], ["Factory Bill", factoryBill], ["Expenses", expenses],
        ["P/L View", r2(salesTotal - returns - purchases - factoryBill - expenses)],
        ["Customer Due (Balance)", L.totalDue("Customer")], ["Supplier Payable (Balance)", L.totalDue("Supplier")], ["Factory Payable (Balance)", L.totalDue("Factory")],
        ["Godown PCS", sum(styles, (x) => x.godown)], ["Showroom PCS", sum(styles, (x) => x.shop)], ["Finished Stock Value", sum(styles, (x) => x.value)],
        ["Raw Fabric Yard", sum(raw, (x) => x.yards)], ["Pending Parcels", courier.pending], ["Receivable from Courier", r2(courier.pendingAmt + courier.receivable)]
      ] },
      { name: "Customers", head: ["Name", "Mobile", "Address", "District", "Credit Limit", "Previous Due", "Sales Total", "Received / Returned", "Current Due"],
        rows: db.customers.map((c) => [c.name, txt(c.mobile), txt(c.address), txt(c.district), num(c.credit), num(c.previousDue), cb[c.id].dr, cb[c.id].cr, cb[c.id].bal]) },
      { name: "Suppliers", head: ["Name", "Company", "Mobile", "Address", "Terms", "Previous Due", "Purchases Total", "Paid", "Current Payable"],
        rows: db.suppliers.map((s) => [s.name, txt(s.company), txt(s.mobile), txt(s.address), txt(s.terms), num(s.previousDue), sb[s.id].dr, sb[s.id].cr, sb[s.id].bal]) },
      { name: "Factories", head: ["Name", "Mobile", "Address", "Default Rate", "Previous Due", "Production Bill", "Paid", "Current Payable"],
        rows: db.factories.map((f) => [f.name, txt(f.mobile), txt(f.address), num(f.rate), num(f.previousDue), fb[f.id].dr, fb[f.id].cr, fb[f.id].bal]) },
      { name: "Products", head: ["Style", "Product", "Fabric", "Color", "Size", "Barcode", "Cost / PC", "Wholesale Price", "Retail Price"],
        rows: db.products.map((p) => [p.style, p.name, txt(p.fabric), txt(p.color), txt(p.size), txt(p.barcode), num(p.cost), num(p.price), num(p.retail)]) },
      { name: "Purchases", head: ["Date", "Supplier", "Invoice", "Material", "Type", "Color", "GSM", "Width", "Qty", "Unit", "Rate", "Subtotal", "Transport", "Loading", "Other Cost", "Discount", "Total", "Paid", "Due", "Method", "Remarks"],
        rows: db.purchases.map((r) => { const c = K.purchase(r); return [r.date, st.partyName("Supplier", r.supplier), txt(r.invoice), r.material, txt(r.type), txt(r.color), txt(r.gsm), txt(r.width), num(r.qty), txt(r.unit), num(r.rate), c.sub, num(r.transport), num(r.loading), num(r.other), c.discount, c.total, c.paid, c.due, txt(r.method), txt(r.remarks)]; }) },
      { name: "Raw Stock", head: ["Material", "Color", "Purchased Yd", "Issued Yd", "Returned Yd", "Yard", "Avg Cost / Yd", "Stock Value", "Other Units"],
        rows: raw.map((x) => [x.material, x.color, x.inYd, x.outYd, x.retYd, x.yards, x.avg, x.value, Object.keys(x.other).map((u) => x.other[u] + " " + u).join(", ")]) },
      { name: "Production Orders", head: ["Order No", "Date", "Style", "Color", "Size", "Factory", "Planned PCS", "Actual PCS", "Difference PCS", "Status"],
        rows: db.productionOrders.map((o) => { const a = K.orderActual(o); return [o.no, o.date, o.style, txt(o.color), txt(o.size), st.factoryName(o.factory), num(o.planned), a, r2(num(o.planned) - a), K.orderStatus(o, a)]; }) },
      { name: "Material Issues", head: ["Date", "Slip", "Order", "Style", "Material", "Color", "Qty", "Unit", "Remarks"],
        rows: db.issues.map((r) => [r.date, txt(r.slip), orderNo(r.order), r.style, r.material, txt(r.color), num(r.qty), txt(r.unit), txt(r.remarks)]) },
      { name: "Production", head: ["Date", "Order", "Style", "Color", "Size", "Factory", "Issued Yd", "Accepted PCS", "Rejected PCS", "Wastage", "Returned Yd", "Returned Material", "Rate", "Factory Bill", "Remarks"],
        rows: db.production.map((r) => [r.date, orderNo(r.order), r.style, txt(r.color), txt(r.size), st.factoryName(r.factory), num(r.issued), num(r.accepted), num(r.rejected), num(r.wastage), num(r.returned), txt(r.material), num(r.rate), K.productionBill(r), txt(r.remarks)]) },
      { name: "Transfers", head: ["Date", "Transfer No", "From Factory", "To", "Style", "Color", "Size", "Dispatched PCS", "Received PCS", "Shortage PCS", "Remarks"],
        rows: db.transfers.map((r) => [r.date, txt(r.reference), st.factoryName(r.from), r.to, r.style, txt(r.color), txt(r.size), num(r.dispatched), num(r.received), r2(num(r.dispatched) - num(r.received)), txt(r.remarks)]) },
      { name: "Sales Invoices", head: ["Date", "Invoice", "Customer", "Mobile", "Location", "PCS", "Subtotal", "Discount", "Total", "Paid", "Due", "Type", "Method", "Remarks"],
        rows: db.sales.map((s) => { const c = st.byId("customers", s.customer) || {}; return [s.date, s.invoice, c.name || s.customer, txt(c.mobile), s.location, K.salePcs(s), K.saleSubtotal(s), num(s.discount), K.saleTotal(s), num(s.paid), K.saleDue(s), K.saleDue(s) > 0 ? "Due" : "Cash", txt(s.method), txt(s.remarks)]; }) },
      { name: "Sales Items", head: ["Date", "Invoice", "Customer", "Style", "Color", "Size", "Qty", "Rate", "Amount"],
        rows: [].concat(...db.sales.map((s) => s.items.map((i) => [s.date, s.invoice, st.partyName("Customer", s.customer), i.style, txt(i.color), txt(i.size), num(i.qty), num(i.rate), K.itemAmount(i)]))) },
      { name: "Sales Returns", head: ["Date", "Invoice", "Customer", "Location", "Style", "Color", "Size", "Qty", "Amount", "Reason"],
        rows: db.returns.map((r) => [r.date, txt(r.invoice), st.partyName("Customer", r.customer), r.location, r.style, txt(r.color), txt(r.size), num(r.qty), num(r.amount), txt(r.reason)]) },
      { name: "Payments", head: ["Receipt No", "Date", "Party Type", "Party", "Amount", "Method", "Reference", "Previous Due", "Today Bill", "Total Due", "Remaining Due", "Remarks"],
        rows: db.payments.map((p) => { const s = p.snap || {}; return [txt(p.no), p.date, p.type, st.partyName(p.type, p.party), num(p.amount), txt(p.method), txt(p.reference), orNull(s.prev), orNull(s.bill), orNull(s.total), orNull(s.remaining), txt(p.remarks)]; }) },
      { name: "Expenses", head: ["Date", "Category", "Amount", "Method", "Location", "Remarks"],
        rows: db.expenses.map((e) => [e.date, e.category, num(e.amount), txt(e.method), txt(e.location), txt(e.remarks)]) },
      { name: "Courier", head: ["Date", "Invoice", "Customer", "Destination", "Courier", "Tracking", "COD", "Advance", "Net COD", "Charge", "Status", "Settled", "Remarks"],
        rows: db.courier.map((c) => [c.date, txt(c.invoice), st.partyName("Customer", c.customer), txt(c.destination), txt(c.courier), txt(c.tracking), num(c.cod), num(c.advance), K.courierNet(c), num(c.charge), c.status, c.settled, txt(c.remarks)]) },
      { name: "Party Ledger", head: ["Party Type", "Party", "Date", "Type", "Reference", "Debit (+)", "Credit (-)", "Balance"], rows: ledgerRows },
      { name: "Stock Summary", head: ["Style", "Product", "Godown PCS", "Showroom PCS", "Total PCS", "Cost / PC", "Stock Value"],
        rows: styles.map((x) => [x.style, x.name, x.godown, x.shop, x.total, x.cost, x.value]) },
      { name: "Showroom Stock", head: ["Location", "Style", "Color", "Size", "Qty"],
        rows: Object.keys(finished.shop).sort().map((k) => finished.names[k].concat(finished.shop[k])) },
      { name: "Activity Log", head: ["Timestamp", "Action", "Reference"], rows: db.logs.map((l) => [l.date, l.action, l.ref]) }
    ];
  }

  OPF.sheets = { all, byName: (name) => all().find((s) => s.name == name) };
})(window.OPF = window.OPF || {});
