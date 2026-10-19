/* Regression: an independent "oracle" (written here from the raw records, sharing no code with the
   ERP) recomputes every money, due, stock and date figure on the full demo data set and compares it
   with what the ERP shows. Then risky transactions are driven through the UI.
   Needs tests/fixtures/OnePlusFashion_Demo_Data.json (node fixtures/make-demo-data.js).
   Run:  node regression.test.js   (options: see lib.js) */
const path = require("path");
const fs = require("fs");
const { start, sleep } = require("./lib");

const DEMO = path.join(__dirname, "fixtures", "OnePlusFashion_Demo_Data.json");

/* ---------- oracle (deliberately independent of js/) ---------- */
const R = (v) => Math.round((v + (v < 0 ? -1e-9 : 1e-9)) * 100) / 100;
const n = (v) => Number(v) || 0;
const near = (a, b) => Math.abs(a - b) < 0.011;
const subtotal = (s) => R(s.items.reduce((t, i) => t + R(n(i.qty) * n(i.rate)), 0));
const total = (s) => R(subtotal(s) - n(s.discount));
const due = (s) => R(total(s) - n(s.paid));
const pTotal = (p) => R(R(n(p.qty) * n(p.rate)) + n(p.transport) + n(p.loading) + n(p.other) - n(p.discount));
const yards = (q, u) => { u = String(u || "").toLowerCase(); return !u || u[0] == "y" ? n(q) : u[0] == "m" ? R(n(q) * 1.0936133) : null; };

function lines(db, type, pid) {
  const out = [], P = { Customer: "customers", Supplier: "suppliers", Factory: "factories" }[type];
  const party = db[P].find((x) => x.id == pid);
  const add = (date, dr, cr, src) => { if (dr || cr) out.push({ date: date || "", dr: R(dr), cr: R(cr), src: src ? src.id : "", ts: src ? src.created || "" : "" }); };
  if (party && n(party.previousDue)) add("", Math.max(n(party.previousDue), 0), Math.max(-n(party.previousDue), 0));
  if (type == "Customer") {
    db.sales.filter((s) => s.customer == pid).forEach((s) => { add(s.date, total(s), 0, s); add(s.date, 0, n(s.paid), s); });
    db.returns.filter((r) => r.customer == pid).forEach((r) => add(r.date, 0, n(r.amount), r));
  } else if (type == "Supplier") {
    db.purchases.filter((p) => p.supplier == pid).forEach((p) => { add(p.date, pTotal(p), 0, p); add(p.date, 0, n(p.paid), p); });
  } else {
    db.production.filter((p) => p.factory == pid).forEach((p) => add(p.date, R(n(p.accepted) * n(p.rate)), 0, p));
  }
  db.payments.filter((p) => p.type == type && p.party == pid).forEach((p) => add(p.date, 0, n(p.amount), p));
  return out;
}
const balance = (db, type, pid, upto) => R(lines(db, type, pid).filter((x) => !upto || x.date <= upto).reduce((t, x) => t + x.dr - x.cr, 0));
function breakdown(db, type, pid, date, exclude) {
  let prev = 0, bill = 0, less = 0;
  lines(db, type, pid).forEach((x) => { if (exclude && x.src == exclude) return; if (x.date < date) prev += x.dr - x.cr; else if (x.date == date) { bill += x.dr; less += x.cr; } });
  return { prev: R(prev), bill: R(bill), less: R(less), total: R(prev + bill), due: R(prev + bill - less) };
}
function stock(db) {
  const shop = {}, godown = {}, raw = {}, k = (...a) => a.map((v) => String(v || "").trim().toLowerCase()).join("|");
  const addTo = (m, key, q) => { m[key] = R((m[key] || 0) + q); };
  db.production.forEach((p) => addTo(godown, k(p.style, p.color, p.size), n(p.accepted)));
  db.transfers.forEach((t) => { addTo(godown, k(t.style, t.color, t.size), -n(t.dispatched)); addTo(shop, k(t.to, t.style, t.color, t.size), n(t.received)); });
  db.sales.forEach((s) => s.items.forEach((i) => addTo(shop, k(s.location, i.style, i.color, i.size), -n(i.qty))));
  db.returns.forEach((r) => addTo(shop, k(r.location, r.style, r.color, r.size), n(r.qty)));
  db.purchases.forEach((p) => { const y = yards(p.qty, p.unit); if (y != null) addTo(raw, k(p.material, p.color), y); });
  db.issues.forEach((i) => { const y = yards(i.qty, i.unit); if (y != null) addTo(raw, k(i.material, i.color), -y); });
  db.production.forEach((p) => { if (p.material && n(p.returned)) addTo(raw, k(p.material, p.color), n(p.returned)); });
  return { shop, godown, raw };
}
function localISO(d) { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); }
function dayShift(days) { const d = new Date(); d.setDate(d.getDate() + days); return localISO(d); }
const money = (s) => n(String(s).replace(/[^\d.-]/g, "")) * (/Advance/.test(s) ? -1 : 1);

(async () => {
  if (!fs.existsSync(DEMO)) { console.error("Run: node fixtures/make-demo-data.js"); process.exit(1); }
  const T = await start("regression");
  const { page, check, section, go, db, text, fill, submit, act, password, printed, setItems, alerts, confirms } = T;
  await T.open();
  await page.evaluate((d) => localStorage.setItem("opf_erp_smart_v3", d), fs.readFileSync(DEMO, "utf8"));
  await page.reload();
  const data = await page.evaluate(() => OPF.store.db);
  const today = localISO(new Date());

  /* ================================================================ */
  section(`Oracle vs ERP on the demo data (${data.sales.length} invoices, ${data.payments.length} payments, ${data.customers.length} customers)`);
  const erp = await page.evaluate(() => ({
    sale: OPF.store.db.sales.map((s) => [OPF.calc.saleTotal(s), OPF.calc.saleDue(s), OPF.calc.salePcs(s)]),
    purchase: OPF.store.db.purchases.map((p) => OPF.calc.purchase(p).total),
    bal: { Customer: OPF.ledger.balances("Customer"), Supplier: OPF.ledger.balances("Supplier"), Factory: OPF.ledger.balances("Factory") },
    prevDue: OPF.store.db.sales.map((s) => OPF.ledger.invoicePreviousDue(s)),
    entriesEnd: OPF.store.db.customers.map((c) => { const e = OPF.ledger.entries("Customer", c.id); return e.length ? e[e.length - 1].bal : 0; }),
    sorted: OPF.store.db.customers.every((c) => OPF.ledger.entries("Customer", c.id).every((x, i, a) => !i || a[i - 1].date <= x.date))
  }));
  const badSales = data.sales.filter((s, i) => !near(erp.sale[i][0], total(s)) || !near(erp.sale[i][1], due(s)));
  check("every invoice total and due matches the oracle", badSales.map((s) => s.invoice), []);
  check("every purchase total matches the oracle", data.purchases.filter((p, i) => !near(erp.purchase[i], pTotal(p))).map((p) => p.invoice), []);
  for (const [type, coll] of [["Customer", "customers"], ["Supplier", "suppliers"], ["Factory", "factories"]]) {
    const wrong = data[coll].filter((p) => !near(erp.bal[type][p.id].bal, balance(data, type, p.id))).map((p) => p.name);
    check(`every ${type.toLowerCase()} balance matches the oracle`, wrong, []);
  }
  check("each customer statement ends on its balance, in date order", [data.customers.every((c, i) => near(erp.entriesEnd[i], balance(data, "Customer", c.id))), erp.sorted], [true, true]);
  // invoice "previous due": everything before this invoice (earlier days, or earlier the same day)
  const prevOracle = data.sales.map((s) => R(lines(data, "Customer", s.customer).filter((x) => x.src != s.id && (x.date < s.date || (x.date == s.date && x.ts < (s.created || "")))).reduce((t, x) => t + x.dr - x.cr, 0)));
  check("every invoice's printed Previous Due matches the oracle", data.sales.filter((s, i) => !near(erp.prevDue[i], prevOracle[i])).map((s) => s.invoice), []);
  // receipts: the frozen breakdown must equal the ledger as of that payment
  const badSnaps = data.payments.filter((p) => {
    const b = breakdown(data, p.type, p.party, p.date, p.id), s = p.snap || {};
    return !(near(s.prev, b.prev) && near(s.bill, b.bill) && near(s.less, b.less) && near(s.remaining, R(b.due - n(p.amount))));
  });
  check("every money receipt's breakdown matches the oracle", badSnaps.map((p) => p.no), []);
  // live payment form for every customer who owes, for today
  const live = await page.evaluate((t) => OPF.store.db.customers.map((c) => OPF.ledger.breakdown("Customer", c.id, t)), today);
  check("today's payment breakdown matches the oracle for every customer", data.customers.filter((c, i) => { const b = breakdown(data, "Customer", c.id, today); return !near(live[i].prev, b.prev) || !near(live[i].bill, b.bill) || !near(live[i].due, b.due); }).map((c) => c.name), []);

  section("Stock");
  const st = stock(data);
  const erpStock = await page.evaluate(() => { const f = OPF.stock.finished(); return { shop: f.shop, godown: f.godown, raw: OPF.stock.raw().map((x) => [x.material, x.color, x.yards]) }; });
  const diff = (a, b) => Object.keys(Object.assign({}, a, b)).filter((k) => !near(a[k] || 0, b[k] || 0));
  check("showroom stock per location / style / colour / size matches", diff(erpStock.shop, st.shop), []);
  check("godown stock matches", diff(erpStock.godown, st.godown), []);
  const rawErp = {}; erpStock.raw.forEach(([m, c, y]) => { rawErp[[m, c].join("|").toLowerCase()] = y; });
  check("raw fabric yards match", diff(rawErp, st.raw), []);
  check("no stock line is negative", Object.keys(st.shop).concat(Object.keys(st.godown)).filter((k) => (st.shop[k] || st.godown[k] || 0) < 0), []);

  section("Dashboard figures for every period");
  const periods = { today: [today, today], "7d": [dayShift(-6), today], month: [today.slice(0, 8) + "01", today], year: [today.slice(0, 4) + "-01-01", today], all: ["", "9999-12-31"] };
  await go("dashboard");
  for (const [p, [from, to]] of Object.entries(periods)) {
    await page.click(`[data-act="dashboard.period"][data-period="${p}"]`);
    const inR = (d) => d >= from && d <= to;
    const sl = data.sales.filter((s) => inR(s.date)), pu = data.purchases.filter((x) => inR(x.date)), py = data.payments.filter((x) => inR(x.date));
    const exp = data.expenses.filter((e) => inR(e.date)).reduce((t, e) => t + n(e.amount), 0);
    const sTot = R(sl.reduce((t, s) => t + total(s), 0)), sPaid = R(sl.reduce((t, s) => t + n(s.paid), 0));
    const pTot = R(pu.reduce((t, x) => t + pTotal(x), 0)), pPaid = R(pu.reduce((t, x) => t + n(x.paid), 0));
    const recv = R(sPaid + py.filter((x) => x.type == "Customer").reduce((t, x) => t + n(x.amount), 0));
    const out = R(pPaid + py.filter((x) => x.type != "Customer").reduce((t, x) => t + n(x.amount), 0) + exp);
    const shown = await page.$$eval(".stat", (els) => els.map((e) => [e.querySelector(".cnt").textContent, e.querySelector(".amt").textContent].concat(Array.from(e.querySelectorAll(".kv .v")).map((v) => v.textContent))));
    check(`${p}: sales count / total / paid / due`, [+shown[0][0], money(shown[0][1]), money(shown[0][2]), money(shown[0][3])], [sl.length, sTot, sPaid, R(sTot - sPaid)]);
    check(`${p}: purchase count / total / paid / due`, [+shown[1][0], money(shown[1][1]), money(shown[1][2]), money(shown[1][3])], [pu.length, pTot, pPaid, R(pTot - pPaid)]);
    check(`${p}: cash received / paid out / net`, [money(shown[2][2]), money(shown[2][3]), money(shown[2][1])], [recv, out, R(recv - out)]);
  }
  const custDueAll = R(data.customers.reduce((t, c) => t + Math.max(balance(data, "Customer", c.id), 0), 0));
  const payable = R(["Supplier", "Factory"].reduce((t, type) => t + data[type == "Supplier" ? "suppliers" : "factories"].reduce((u, p) => u + Math.max(balance(data, type, p.id), 0), 0), 0));
  const todaySales = data.sales.filter((s) => s.date == today);
  const cards = await page.$$eval(".cards .card .big", (b) => b.map((x) => x.textContent));
  check("today's cards: sales / collection / customer due / payable", [money(cards[0]), money(cards[1]), money(cards[2]), money(cards[3])],
    [R(todaySales.reduce((t, s) => t + total(s), 0)), R(todaySales.reduce((t, s) => t + n(s.paid), 0) + data.payments.filter((p) => p.date == today && p.type == "Customer").reduce((t, p) => t + n(p.amount), 0)), custDueAll, payable]);
  check("finished stock card = godown + showroom pieces", money(cards[4]), R(Object.values(st.shop).reduce((a, b) => a + b, 0) + Object.values(st.godown).reduce((a, b) => a + b, 0)));

  section("Customers page, date-wise due list, ledgers, Excel");
  await go("customers");
  const ccards = await page.$$eval(".cards .card .big", (b) => b.map((x) => x.textContent));
  const dueParties = data.customers.filter((c) => balance(data, "Customer", c.id) > 0.004);
  check("due parties count and total due", [+ccards[1], money(ccards[2])], [dueParties.length, custDueAll]);
  const from = dayShift(-45), to = dayShift(-10);
  await page.$eval("#dueFrom", (e, v) => (e.value = v), from); await page.$eval("#dueTo", (e, v) => (e.value = v), to); await act("customers.dueReport");
  const grand = await page.$$eval("#dueOut .table", (t) => [t[0].querySelector("tfoot").textContent, t[1].querySelector("tfoot").textContent]);
  const dl = data.sales.filter((s) => s.date >= from && s.date <= to && due(s) > 0);
  check("date-wise due list: invoices with due in the range", money(grand[0]), R(dl.reduce((t, s) => t + due(s), 0)));
  check("party due 'as on' the To date (later transactions ignored)", money(grand[1]), R(data.customers.reduce((t, c) => t + Math.max(balance(data, "Customer", c.id, to), 0), 0)));
  await go("ledger");
  check("all ledgers reconciled, nothing to review except shortages", await page.evaluate(() => { const a = OPF.audit.run(); return [a.checks.map((c) => c.ok), a.issues.filter((x) => !/short delivery/.test(x))]; }), [[true, true, true], []]);
  const sheet = await page.evaluate(() => OPF.sheets.byName("Customers").rows.map((r) => r[8]));
  check("Excel 'Customers' Current Due column matches the oracle", data.customers.filter((c, i) => !near(sheet[i], balance(data, "Customer", c.id))).map((c) => c.name), []);

  /* ================================================================ */
  section("Sales transactions through the UI: decimals, rounding, overpayment");
  const cust = data.customers.find((c) => c.name == "Mirpur Traders");
  const stockLine = Object.keys(st.shop).find((k) => k.startsWith("owner permanent shop|") && st.shop[k] >= 10).split("|");
  const style = data.products.find((p) => p.style.toLowerCase() == stockLine[1]).style;
  const startBal = balance(data, "Customer", cust.id);
  await go("sales");
  await fill({ customer: cust.id, discount: 0.01, paid: 0 });
  await setItems([{ style, color: stockLine[2], size: stockLine[3], qty: 2.5, rate: 333.33 }]);
  check("live calc: 2.5 x 333.33 = 833.33 (rounded), - 0.01 discount = 833.32", /Total Amount\s*833\.32/.test(await text("#calc")), true);
  await submit();
  const s1 = await db((d) => d.sales[d.sales.length - 1]);
  check("saved invoice total / due", await page.evaluate((id) => [OPF.calc.saleTotal(OPF.store.byId("sales", id)), OPF.calc.saleDue(OPF.store.byId("sales", id))], s1.id), [833.32, 833.32]);
  check("customer balance rises by exactly the invoice due", await page.evaluate((id) => OPF.ledger.balance("Customer", id), cust.id), R(startBal + 833.32));
  await go("sales"); await fill({ customer: cust.id, paid: 5000 });
  await setItems([{ style, color: stockLine[2], size: stockLine[3], qty: 1, rate: 1000 }]);
  check("overpayment shows as advance in the live calc", /Due Amount\s*4,000\.00 \(Advance\)/.test(await text("#calc")), true);
  await submit();
  check("overpayment asks first, then is kept as advance (balance falls by 4,000)", [confirms.pop().startsWith("Paid amount is more"), await page.evaluate((id) => OPF.ledger.balance("Customer", id), cust.id)], [true, R(startBal + 833.32 - 4000)]);

  section("Payments: backdated, same-day, edit, delete");
  const c2 = data.customers.find((c) => c.name == "Karim Store");
  const yesterday = dayShift(-1);
  const b0 = breakdown(data, "Customer", c2.id, yesterday);
  await go("payments"); await act("payments.collect", { type: "Customer", id: c2.id }).catch(() => page.evaluate((id) => OPF.pages.payments.collect("Customer", id), c2.id));
  await page.$eval('[name="print"]', (e) => (e.checked = false));
  await fill({ date: yesterday, amount: 1234.56 });
  const bd = await text("#calc");
  check("backdated payment: Previous Due on screen is the balance before that day", money((bd.match(/Previous Due\s+([\d,.]+(?: \(Advance\))?)/) || [])[1] || ""), b0.prev);
  await submit();
  const pay = await db((d) => d.payments[d.payments.length - 1]);
  check("receipt snapshot: remaining = due that day - 1,234.56", [pay.snap.prev, pay.snap.remaining], [b0.prev, R(b0.due - 1234.56)]);
  const afterPay = await page.evaluate((id) => OPF.ledger.balance("Customer", id), c2.id);
  check("customer balance falls by exactly the payment", afterPay, R(balance(data, "Customer", c2.id) - 1234.56));
  await act("record.edit", { coll: "payments", id: pay.id });
  await password("regress1", "regress1");
  await page.$eval('[name="print"]', (e) => (e.checked = false));
  await fill({ amount: 1000 });
  await submit();
  check("editing the amount re-computes balance and receipt (no double count)", [await page.evaluate((id) => OPF.ledger.balance("Customer", id), c2.id), await page.evaluate((id) => OPF.store.byId("payments", id).snap.remaining, pay.id)],
    [R(balance(data, "Customer", c2.id) - 1000), R(b0.due - 1000)]);
  await act("record.delete", { coll: "payments", id: pay.id });
  check("deleting the payment restores the balance exactly", await page.evaluate((id) => OPF.ledger.balance("Customer", id), c2.id), balance(data, "Customer", c2.id));

  section("Dates: future-dated entries, moving a sale between months, time zones");
  const future = dayShift(3);
  await go("sales"); await fill({ customer: c2.id, date: future }); await setItems([{ style, color: stockLine[2], size: stockLine[3], qty: 1, rate: 500 }]); await submit();
  await go("dashboard"); await page.click('[data-act="dashboard.period"][data-period="today"]');
  const todayCount = await page.$eval(".stat .cnt", (e) => +e.textContent);
  check("a future-dated sale is not counted in Today", todayCount, data.sales.filter((s) => s.date == today).length + 2);
  await page.click('[data-act="dashboard.period"][data-period="all"]');
  check("but All Time includes it", await page.$eval(".stat .cnt", (e) => +e.textContent), data.sales.length + 3);
  const futureSale = await db((d) => d.sales[d.sales.length - 1].id);
  await go("sales"); await act("record.edit", { coll: "sales", id: futureSale });
  const lastMonth = dayShift(-40);
  await fill({ date: lastMonth }); await submit();
  check("editing a sale's date moves it in the ledger and the date-wise list", await page.evaluate(([id, d]) => { const s = OPF.store.byId("sales", id); return [s.date == d, OPF.ledger.entries("Customer", s.customer).some((x) => x.src == id && x.date == d)]; }, [futureSale, lastMonth]), [true, true]);
  for (const tz of ["Asia/Dhaka", "Pacific/Kiritimati", "Pacific/Pago_Pago", "UTC"]) {
    await page.emulateTimezone(tz);
    check(`'today' is the local calendar date in ${tz}`, await page.evaluate(() => { const d = new Date(); return OPF.util.today() == [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-"); }), true);
  }
  await page.emulateTimezone("Asia/Dhaka");

  section("Invoice references: returns and courier parcels point at invoice numbers");
  const ref = await db((d) => { const r = d.returns[0]; const s = d.sales.find((x) => x.invoice == r.invoice); return { sale: s.id, invoice: s.invoice }; });
  await go("sales"); await act("record.delete", { coll: "sales", id: ref.sale });
  check("a sale with a return against it cannot be deleted", [await page.evaluate((id) => !!OPF.store.byId("sales", id), ref.sale), (alerts[alerts.length - 1] || "").indexOf("linked") >= 0], [true, true]);
  await act("record.edit", { coll: "sales", id: ref.sale });
  await fill({ invoice: "RENAMED-1" }); await submit();
  check("an invoice number used by a return / parcel cannot be changed", [await page.evaluate((id) => OPF.store.byId("sales", id).invoice, ref.sale), (alerts[alerts.length - 1] || "").indexOf("used by") >= 0], [ref.invoice, true]);
  const parcelSale = await db((d) => { const c = d.courier.find((x) => !d.returns.some((r) => r.invoice == x.invoice)); return d.sales.find((s) => s.invoice == c.invoice).id; });
  await go("sales"); await act("record.delete", { coll: "sales", id: parcelSale });
  check("a sale with a courier parcel cannot be deleted", await page.evaluate((id) => !!OPF.store.byId("sales", id), parcelSale), true);

  section("More oracle checks: sales register tabs, courier dashboard, production orders");
  const cur = await page.evaluate(() => OPF.store.db);
  await go("sales");
  const tabCount = async (t) => { await act("sales.tab", { tab: t }); return page.$$eval("#app .table:last-of-type tbody tr", (r) => r.length); };
  check("Sales register: All / Cash / Due tab counts", [await tabCount("All"), await tabCount("Cash"), await tabCount("Due")],
    [cur.sales.length, cur.sales.filter((s) => due(s) <= 0).length, cur.sales.filter((s) => due(s) > 0).length]);
  await act("sales.tab", { tab: "All" });
  const open = ["Pending", "Sent", "In Transit"], live2 = cur.courier.filter((c) => c.status != "Cancelled");
  check("courier dashboard: sent / delivered / pending / returned", await page.evaluate(() => { const s = OPF.calc.courierSummary(OPF.store.db.courier); return [s.sent, s.delivered, s.pending, s.returned]; }),
    [live2.length, live2.filter((c) => c.status == "Delivered").length, live2.filter((c) => open.indexOf(c.status) >= 0).length, live2.filter((c) => c.status == "Returned").length]);
  const orders = await page.evaluate(() => OPF.store.db.productionOrders.map((o) => OPF.calc.orderActual(o)));
  check("production order Actual = accepted PCS of linked production", cur.productionOrders.filter((o, i) => orders[i] != cur.production.filter((p) => p.order == o.id).reduce((t, p) => t + n(p.accepted), 0)).map((o) => o.no), []);

  section("Midnight while the ERP is open");
  await go("sales");
  await page.$eval('#mainForm [name="date"]', (e) => { e.value = "2000-01-01"; });
  await page.evaluate((t) => OPF.app.rollover("2000-01-01", t), today);
  check("an open sales form moves its date to the new day", await page.$eval('#mainForm [name="date"]', (e) => e.value), today);
  await page.$eval('#mainForm [name="date"]', (e) => { e.value = "2000-01-02"; });
  await page.evaluate((t) => OPF.app.rollover("2000-01-01", t), today);
  check("a date the user picked is left alone", await page.$eval('#mainForm [name="date"]', (e) => e.value), "2000-01-02");

  section("Search");
  await page.type("#gsearch", "+880" + cust.mobile.slice(1));
  check("search by mobile with +880 country code finds the customer", await page.$$eval("#gresults a b", (b) => b.map((x) => x.textContent)), [cust.name]);

  await T.finish();
})().catch((e) => { console.error(e); process.exit(1); });
