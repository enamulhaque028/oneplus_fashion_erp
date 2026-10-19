/* Dashboard: quick actions, period summary panels, today's cards, cost breakdown and
   30-day trend charts, latest invoices. Every figure comes from OPF.calc / OPF.ledger /
   OPF.stock; this file only groups and draws them. */
(function (OPF) {
  "use strict";

  const H = OPF.html, K = OPF.calc, L = OPF.ledger, S = OPF.store;
  const { esc, r2, sum, money, fmtQty, today, monthStart, byDateDesc } = OPF.util;

  const QUICK = [["products", "tag", "Product List"], ["customers", "user", "Customer"], ["suppliers", "users", "Supplier"], ["sales", "receipt", "Sales List"],
    ["purchase", "bag", "Purchase List"], ["payments", "wallet", "Payment"], ["courier", "truck", "Courier"], ["reports", "bars", "Reports"]];
  const PERIODS = [["today", "Today"], ["7d", "Last 7 Days"], ["month", "This Month"], ["year", "This Year"], ["all", "All Time"]];
  const SERIES = [["Sales", "var(--series-1)"], ["Purchases", "var(--series-2)"], ["Expenses", "var(--series-3)"]];
  // "2026-10-19" -> "19 Oct 2026" (read by people; the stored dates stay ISO).
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const niceDate = (iso) => { const p = String(iso).split("-"); return p.length == 3 ? `${Number(p[2])} ${MONTHS[Number(p[1]) - 1]} ${p[0]}` : iso; };
  let period = "today", chartType = "line";

  // Local calendar date `days` from today (negative = past).
  function shift(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }
  function range() {
    const t = today();
    const from = { today: t, "7d": shift(-6), month: monthStart(), year: t.slice(0, 4) + "-01-01", all: "" }[period];
    return { from, to: period == "all" ? "9999-12-31" : t };
  }

  function stat(tone, icon, title, count, amount, rows, pct, foot) {
    return `<div class="stat s-${tone}"><div class="hd"><span class="sic">${OPF.icon(icon)}</span><span class="cnt">${count}</span></div>` +
      `<div class="ttl">${title}</div><div class="amt">${amount}</div>` +
      rows.map(([k, v, cls]) => `<div class="kv"><span class="k ${cls || ""}">${k}</span><span class="v">${v}</span></div>`).join("") +
      (pct == null ? "" : `<div class="bar"><span style="width:${Math.max(0, Math.min(100, pct))}%"></span></div><div class="foot">${foot}</div>`) + "</div>";
  }

  function render() {
    const db = S.db, t = today(), { from, to } = range();
    const inR = (d) => d >= from && d <= to;

    // ---- period panels ----
    const sales = db.sales.filter((s) => inR(s.date));
    const sTotal = sum(sales, K.saleTotal), sPaid = sum(sales, (s) => s.paid), sDue = sum(sales, K.saleDue);
    const purchases = db.purchases.filter((p) => inR(p.date)).map(K.purchase);
    const pTotal = sum(purchases, (c) => c.total), pPaid = sum(purchases, (c) => c.paid), pDue = sum(purchases, (c) => c.due);
    const pays = db.payments.filter((p) => inR(p.date));
    const expenses = sum(db.expenses.filter((e) => inR(e.date)), (e) => e.amount);
    const factoryBill = sum(db.production.filter((p) => inR(p.date)), K.productionBill);
    const received = r2(sPaid + sum(pays.filter((p) => p.type == "Customer"), (p) => p.amount));
    const paidOut = r2(pPaid + sum(pays.filter((p) => p.type != "Customer"), (p) => p.amount) + expenses);
    const custDue = L.totalDue("Customer"), payable = r2(L.totalDue("Supplier") + L.totalDue("Factory"));
    const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

    // ---- today's cards (unchanged figures) ----
    const todaySales = db.sales.filter((s) => s.date == t);
    const collected = r2(sum(todaySales, (s) => s.paid) + sum(db.payments.filter((p) => p.date == t && p.type == "Customer"), (p) => p.amount));
    const courier = K.courierSummary(db.courier);

    // ---- 30-day trend ----
    const days = [];
    for (let i = 29; i >= 0; i--) days.push(shift(-i));
    const idx = {};
    days.forEach((d, i) => { idx[d] = i; });
    const vals = SERIES.map(() => days.map(() => 0));
    db.sales.forEach((s) => { if (idx[s.date] != null) vals[0][idx[s.date]] += K.saleTotal(s); });
    db.purchases.forEach((p) => { if (idx[p.date] != null) vals[1][idx[p.date]] += K.purchase(p).total; });
    db.expenses.forEach((e) => { if (idx[e.date] != null) vals[2][idx[e.date]] += Number(e.amount) || 0; });
    const series = SERIES.map(([name, color], i) => ({ name, color, values: vals[i].map(r2) }));
    const totals = series.map((s) => sum(s.values, (v) => v));

    const latest = byDateDesc(db.sales).slice(0, 6).map((s) => {
      const c = S.byId("customers", s.customer), due = K.saleDue(s);
      return H.tr([H.td(c ? H.customerLink(esc(c.name), c.id) : esc(s.customer)), H.td(s.date), H.td(esc(s.invoice)), H.tdn(money(K.saleTotal(s))),
        H.tdn(money(s.paid), "green"), H.tdn(money(due), due > 0 ? "red" : ""), H.td(H.button(OPF.icon("printer") + "Memo", "print.invoice", { id: s.id }, "sm"), "act no-print")]);
    });
    const periodLabel = (PERIODS.find((p) => p[0] == period) || PERIODS[0])[1];

    H.mount(
      "<h1>Dashboard</h1>" +
      `<div class="quick no-print">${QUICK.map(([page, icon, label]) => H.pageLink(OPF.icon(icon) + label, page, "btn")).join("")}</div>` +
      // Period: all five choices visible as one row of segment buttons (one click, like the Ledger tabs).
      `<div class="filterbar no-print"><span class="ic">${OPF.icon("calendar")}</span>` +
      `<div class="tabs period">${PERIODS.map(([v, l]) => H.button(l, "dashboard.period", { period: v }, v == period ? "on" : "")).join("")}</div>` +
      `<span class="grow"></span><span class="range">${period == "all" ? "<span>All records</span>" : `<span>${esc(niceDate(from))}</span>` + (from == to ? "" : `<i>–</i><span>${esc(niceDate(to))}</span>`)}</span></div>` +
      '<div class="stats">' +
      stat("green", "cart", "Sales", sales.length, money(sTotal), [["Paid", money(sPaid), "g"], ["Due", money(sDue), "r"]], pct(sPaid, sTotal), pct(sPaid, sTotal) + "% collected") +
      stat("blue", "bag", "Purchase", purchases.length, money(pTotal), [["Paid", money(pPaid), "g"], ["Due", money(pDue), "r"]], pct(pPaid, pTotal), pct(pPaid, pTotal) + "% paid") +
      stat("amber", "money", "Cash Flow", "", money(r2(received - paidOut)), [["Received", money(received), "g"], ["Paid Out", money(paidOut), "r"]], pct(received, received + paidOut), "Net = received − paid out") +
      stat("violet", "wallet", "Outstanding", "", money(custDue), [["Customer Due", money(custDue), "r"], ["Supplier / Factory Payable", money(payable)]], null) +
      "</div>" +
      H.cards([
        H.card("Today Sales", money(sum(todaySales, K.saleTotal))),
        H.card("Today Collection", money(collected), "ok"),
        H.card("Customer Due", money(custDue), "hl"),
        H.card("Supplier / Factory Payable", money(payable)),
        H.card("Finished Stock PCS", fmtQty(sum(OPF.stock.byStyle(), (x) => x.total))),
        H.card("Pending Parcels", `${courier.pending} / ${courier.sent}`)
      ]) +
      '<div class="dash2">' +
      `<div class="box"><div class="panel-title"><span class="ic" style="background:linear-gradient(135deg,#22c55e,#0d9488)">${OPF.icon("pie")}</span><span class="grow"><b>Cost Breakdown</b><small>Where the money went - ${esc(periodLabel)}</small></span></div>` +
      OPF.charts.donut({ centerTop: "Total cost", segments: [{ label: "Purchases", value: pTotal, color: "var(--series-1)" }, { label: "Factory Bill", value: factoryBill, color: "var(--series-2)" }, { label: "Expenses", value: expenses, color: "var(--series-3)" }] }) +
      "</div>" +
      `<div class="box"><div class="panel-title"><span class="ic" style="background:linear-gradient(135deg,#3b82f6,#06b6d4)">${OPF.icon("trend")}</span><span class="grow"><b>Last 30 Days Trend</b><small>Daily sales, purchases and expenses</small></span>` +
      `<span class="seg-toggle no-print">${[["line", "Line"], ["bar", "Bar"], ["table", "Table"]].map(([v, l]) => H.button(l, "dashboard.chart", { type: v }, chartType == v ? "on" : "")).join("")}</span></div>` +
      `<div class="sumchips"><div>Total Sales<b>${money(totals[0])}</b></div><div>Total Purchases<b>${money(totals[1])}</b></div><div>Total Expenses<b>${money(totals[2])}</b></div><div>Avg. Daily Sales<b>${money(totals[0] / 30)}</b></div></div>` +
      OPF.charts.trend({ labels: days, series, type: chartType }) +
      "</div></div>" +
      `<div class="box"><div class="panel-title"><span class="ic" style="background:linear-gradient(135deg,#8b5cf6,#6366f1)">${OPF.icon("receipt")}</span><span class="grow"><b>Latest Invoices</b><small>Newest six sales</small></span>${H.pageLink("View All", "sales", "btn light sm")}</div>` +
      H.table(["Customer", "Date", "Invoice", "#Amount", "#Paid", "#Due", ""], latest, { tight: true }) + "</div>" +
      '<div class="box flow"><b>End-to-End Workflow</b><div class="muted" style="margin-top:4px">Supplier → Purchase → Raw Stock → Material Issue → Production → Finished Goods → Factory/Shop Transfer → Showroom → Sales → Customer Ledger → Payment → Courier → Invoice → P/L</div>' +
      "<div class=\"alert\" style=\"margin-bottom:0\">This edition is optimized for your Windows 7 / 4 GB RAM laptop. It is offline and requires no Python, MySQL, Node.js or VPS for single-computer use. Use the search bar at the top to open any customer's full history.</div></div>"
    );
    OPF.charts.bind(H.$("app"));
  }

  OPF.pages.dashboard = { render };
  OPF.actions.register({
    "dashboard.period": (el) => { period = el.getAttribute("data-period") || el.value; render(); },
    "dashboard.chart": (el) => { chartType = el.dataset.type; render(); }
  });
})(window.OPF = window.OPF || {});
