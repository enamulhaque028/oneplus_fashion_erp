/* End-to-end tests: drives the real ERP in Chrome from file:// (the same way START_ERP.bat
   opens it) and checks every business rule through the UI.
   Run:  cd tests && npm install && npm test        (options: see lib.js) */
const path = require("path");
const fs = require("fs");
const { start, sleep, ROOT } = require("./lib");

(async () => {
  const T = await start("e2e");
  const { browser, page, errors, alerts, OUT, APP, check, section, go, db, text, fill, submit, act, modalOpen, password, printed, setItems } = T;

  // The Bengali screen language is tested whatever its flag in config.js says: switch it on for these pages.
  const bengaliOn = (pg) => pg.evaluateOnNewDocument(() => {
    let cfg = null;
    window.OPF = window.OPF || {};
    Object.defineProperty(window.OPF, "config", { configurable: true, get: () => cfg, set: (v) => { cfg = Object.freeze(Object.assign({}, v, { ENABLE_BENGALI: true })); } });
  });
  await bengaliOn(page);
  await T.open();
  check("app booted from file:// without special flags", await page.evaluate(() => !!(window.OPF && OPF.store.db)), true);

  /* ================================================================ */
  section("Data upgrade from v3");
  const legacy = { company: { name: "One Plus Fashion", phone: "01814109285", address: "" }, suppliers: [{ id: "s1", name: "Rahim Fabrics", previousDue: 0 }], materials: [], purchases: [{ id: "p1", supplier: "s1", date: "2026-09-01", material: "Cotton", color: "Black", qty: 100, unit: "yard", rate: 120, transport: 500, loading: 0, other: 0, paid: 5000 }], issues: [], products: [], productionOrders: [{ id: "o1", date: "2026-09-01", style: "A1", planned: 100, factory: "", status: "" }], production: [], factories: [], transfers: [{ id: "t1", date: "2026-09-02", from: "F", to: "Owner Permanent Shop", style: "A1", qty: 50 }], customers: [{ id: "c1", name: "Karim Store", mobile: "01711111111", previousDue: 1000 }], sales: [{ id: "x1", date: "2026-09-03", invoice: "1", customer: "c1", style: "A1", qty: 10, rate: 300, discount: 100, paid: 1000 }], returns: [{ id: "r1", date: "2026-09-04", customer: "Karim Store", style: "A1", qty: 1, amount: 300 }], payments: [{ id: "y1", date: "2026-09-05", type: "Customer", party: "Karim Store", amount: 500 }], expenses: [], courier: [{ id: "k1", cod: 2000, advance: 500, payable: 100, status: "Sent" }], showrooms: [{ id: "main", name: "Owner Permanent Shop" }], logs: [], users: [] };
  await page.evaluate((d) => localStorage.setItem("opf_erp_smart_v3", JSON.stringify(d)), legacy);
  await page.reload();
  const mig = await page.evaluate(() => { const d = OPF.store.db; return { items: d.sales[0].items, ret: d.returns[0].customer, pay: d.payments[0].party, tr: [d.transfers[0].dispatched, d.transfers[0].received], po: d.productionOrders[0].no, net: d.courier[0].netCod, bal: OPF.ledger.balance("Customer", "c1"), v: d.version }; });
  check("sale converted to item list", mig.items, [{ style: "A1", color: "", size: "", qty: 10, rate: 300 }]);
  check("return customer name -> id", mig.ret, "c1");
  check("payment party name -> id", mig.pay, "c1");
  check("transfer qty -> dispatched/received", mig.tr, [50, 50]);
  check("production order numbered", mig.po, "PO-0001");
  check("courier net COD", mig.net, 1500);
  check("balance 1000 + 2900 - 1000 - 300 - 500", mig.bal, 2100);
  check("schema version", mig.v, 6);
  check("upgraded data gets an empty Rough Notes list", await page.evaluate(() => OPF.store.db.notes), []);
  check("a plain note from before rich text keeps its line breaks", await page.evaluate(() => OPF.migrate.normalize({ notes: [{ id: "n1", date: "2026-10-18", subject: "", text: "a < b\nline 2" }] }).notes[0]), { id: "n1", date: "2026-10-18", subject: "", text: "a < b\nline 2", html: "a &lt; b<br>line 2", sketch: null, color: "", pinned: false });
  check("old default branding replaced by the memo-book details", await db((d) => [d.company.phone, d.company.address, d.company.tagline, d.company.hotline, d.company.motto, d.company.memoNote]),
    ["01619-741055, 01621-346375", "Shop # 99 (1st Floor), Ashraf Setu Shopping Complex, Tongi, Gazipur.", "Manufacturer and Wholesaler of Readymade Garments.", "01878638475", "QUALITY OUR VISION", "Allah has Made Business Lawful, Usury is Forbidden."]);
  await page.evaluate(() => { OPF.store.db.company.address = ""; OPF.store.db.company.phone = "01999999999"; OPF.store.save(); });
  await page.reload();
  check("branding upgrade runs once: a cleared address and own phone stay as saved", await db((d) => [d.company.address, d.company.phone]), ["", "01999999999"]);
  await page.evaluate(() => localStorage.setItem("opf_erp_smart_v3", "{broken"));
  await page.reload();
  check("unreadable storage is kept aside, not lost", await page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith("opf_erp_smart_v3_unreadable_"))), true);

  await page.evaluate(() => localStorage.clear());
  await page.reload();

  /* ================================================================ */
  section("Issue 1 - Purchase costing");
  await go("suppliers"); await fill({ name: "Rahim Fabrics" }); await submit();
  const sid = await db((d) => d.suppliers[0].id);
  await go("purchase");
  await fill({ supplier: sid, material: "Cotton Twill", color: "Black", qty: 1000, unit: "Yard", rate: 12.5, transport: 500, loading: 250, other: 100, discount: 350, paid: 10000 });
  const pc = await text("#calc");
  check("live total 13,000", /Total Purchase Cost\s+13,000\.00/.test(pc), true);
  check("live due 3,000", /Due to Supplier\s+3,000\.00/.test(pc), true);
  check("decimal rate accepted by the form", await page.$eval("#mainForm", (f) => f.checkValidity()), true);
  await submit();
  check("saved purchase breakdown", await page.evaluate(() => OPF.calc.purchase(OPF.store.db.purchases[0])), { sub: 12500, extra: 850, total: 13000, discount: 350, paid: 10000, due: 3000, unitCost: 13, yards: 1000 });
  await fill({ supplier: sid, material: "Cotton Twill", color: "Black", qty: 100, unit: "Meter", rate: 10 }); await submit();

  section("Issue 2 - Raw stock in yards");
  await go("issue"); await fill({ style: "OPF-101", material: "Cotton Twill", color: "Black", qty: 300, unit: "Yard" }); await submit();
  await go("materials");
  const heads = await page.$$eval(".table th", (t) => t.map((x) => x.textContent.trim())); // textContent: headings are upper-cased by CSS
  check("Yard column present, Current Qty removed", heads.includes("Yard") && !heads.includes("Current Qty"), true);
  check("1000 yd + 100 m - 300 yd = 809.36 yd", await page.evaluate(() => OPF.stock.raw()[0].yards), 809.36);

  section("Issue 3 - Production order");
  await go("factories"); await fill({ name: "Star Garments", rate: 25 }); await submit();
  const fid = await db((d) => d.factories[0].id);
  await go("productionOrder"); await fill({ style: "OPF-101", color: "Black", size: "M", planned: 1500, factory: fid }); await submit();
  const oid = await db((d) => d.productionOrders[0].id);
  await go("production"); await fill({ order: oid }); await fill({ accepted: 1210 }); await submit();
  check("production filled from order (style/color/size/factory/rate)", await db((d) => { const p = d.production[0]; return [p.style, p.color, p.size, p.factory == d.factories[0].id, p.rate]; }), ["OPF-101", "Black", "M", true, 25]);
  await go("productionOrder");
  const po = await page.$$eval(".table tbody tr", (r) => Array.from(r[0].cells).map((c) => c.innerText));
  check("factory name / planned / actual / difference", [po[5], po[6], po[7], po[8]], ["Star Garments", "1,500", "1,210", "290"]);

  section("Issue 4 - Transfer shortage");
  await go("transfer"); await fill({ from: fid, style: "OPF-101", color: "Black", size: "M", dispatched: 1210, received: 1205 }); await submit();
  const tr = await page.$$eval(".table tbody tr", (r) => Array.from(r[0].cells).map((c) => c.innerText));
  check("from / dispatched / received / shortage", [tr[2], tr[7], tr[8], tr[9]], ["Star Garments", "1,210", "1,205", "5"]);

  await go("products"); await fill({ style: "OPF-101", name: "Men Polo", cost: 220, price: 300 }); await submit();
  await go("products"); await fill({ style: "opf-101", name: "Duplicate" }); await submit();
  check("duplicate style code rejected", [alerts.pop(), await db((d) => d.products.length)], ["Style code opf-101 already exists.", 1]);

  section("Issue 6 - Sales invoice calculator");
  await go("customers"); await fill({ name: "Karim Store", mobile: "01711-111111", address: "Bongo Bazar", district: "Dhaka", previousDue: 50000 }); await submit();
  await go("customers"); await fill({ name: "Cash Buyer", mobile: "01822222222" }); await submit();
  const [c1, c2] = await db((d) => d.customers.map((c) => c.id));
  await go("sales"); await fill({ customer: c1, discount: 500 });
  await setItems([{ style: "OPF-101", color: "Black", size: "M", qty: 20, rate: 300 }, { style: "OPF-101", color: "Black", size: "M", qty: 15, rate: 300 }]);
  const sc = await text("#calc");
  check("total 10,000 after 500 discount", /Total Amount\s+10,000\.00/.test(sc), true);
  check("due = total - paid = 10,000", /= Due Amount\s+10,000\.00/.test(sc), true);
  check("previous 50,000 / after invoice 60,000", /Previous Balance\s+50,000\.00/.test(sc) && /After This Invoice\s+60,000\.00/.test(sc), true);
  await submit();
  check("invoice saved with auto number", await page.evaluate(() => { const s = OPF.store.db.sales[0]; return [OPF.store.db.sales.length, OPF.calc.saleTotal(s), OPF.calc.saleDue(s), s.invoice]; }), [1, 10000, 10000, "INV-00001"]);
  await go("sales"); await fill({ customer: c2 });
  await setItems([{ style: "OPF-101" }]);
  check("style fills rate/color/size from product", await page.evaluate(() => { const r = document.querySelector("#items tr.item"); return ["rate", "color", "size"].map((k) => r.querySelector(`[data-k="${k}"]`).value); }), ["300", "", ""]);
  await setItems([{ color: "Black", size: "M", qty: 5, rate: 320 }]);
  await act("sales.payFull"); await submit();
  check("'Paid in Full' leaves due 0", await page.evaluate(() => OPF.calc.saleDue(OPF.store.db.sales[1])), 0);
  await go("sales"); await fill({ customer: c2, invoice: "INV-00001" }); await setItems([{ style: "OPF-101", qty: 1, rate: 1 }]); await submit();
  check("duplicate invoice number rejected", alerts.pop(), "Invoice No. INV-00001 already exists.");

  section("Issue 7 - Payment breakdown and automatic receipt");
  await go("payments");
  await act("payments.collect", { id: c1 });
  await fill({ amount: 20000 });
  const bd = await text("#calc");
  check("breakdown 50,000 + 10,000 = 60,000 - 20,000 = 40,000", [/Previous Due\s+50,000\.00/, /Today's Purchase\s+10,000\.00/, /Total Due\s+60,000\.00/, /Paid Today \(this receipt\)\s+20,000\.00/, /Remaining Due\s+40,000\.00/].map((r) => r.test(bd)), [true, true, true, true, true]);
  // Printing must stay in this tab: count tabs and watch the print call.
  await page.evaluate(() => { window.__printCalls = []; const real = OPF.print.output; OPF.print.output = (w) => { window.__printCalls.push([w.document.title, !!w.document.querySelector(".memo"), w.getComputedStyle(w.document.querySelector(".pill")).backgroundColor]); real(w); }; });
  const tabsBefore = (await browser.pages()).length;
  await submit(); await sleep(800);
  check("printing opens no new tab or window", (await browser.pages()).length, tabsBefore);
  check("the print dialog is called for the receipt, after its stylesheet loaded", await page.evaluate(() => window.__printCalls), [["Money Receipt MR-00001", true, "rgb(45, 52, 128)"]]);
  await go("payments");
  const firstPayment = await db((d) => d.payments[0].id);
  const rp = printed(); await act("print.receipt", { id: firstPayment }); const receipt = await rp;
  const rt = await receipt.evaluate(() => document.body.innerText);
  check("receipt opens automatically with the same figures", /Money Receipt/.test(rt) && /Remaining Due\s+40,000\.00/.test(rt) && /Twenty Thousand Taka Only/.test(rt), true);
  check("print stylesheet loads in the print window", await receipt.evaluate(() => getComputedStyle(document.querySelector(".pill")).backgroundColor), "rgb(45, 52, 128)");
  await receipt.screenshot({ path: path.join(OUT, "receipt.png"), fullPage: true }); await receipt.close();
  check("snapshot stored on payment", await db((d) => d.payments[0].snap), { prev: 50000, bill: 10000, total: 60000, less: 0, paid: 20000, remaining: 40000 });
  await fill({ type: "Supplier" });
  check("party list switches with party type", await page.$$eval('#mainForm [name="party"] option', (o) => o.map((x) => x.textContent)), ["Select Supplier", "Rahim Fabrics"]);

  section("Issue 5 - Customers summary, cash/due split, date-wise due");
  await go("customers");
  const cards = await page.$$eval(".cards .card", (c) => c.map((x) => x.innerText.replace(/\n/g, " ")));
  check("due parties / total due", [cards[1], cards[2]], ["Due Parties 1", "Total Due Amount 40,000.00"]);
  check("cash and due sections side by side", await page.$$eval(".cols2 h2", (h) => h.map((x) => x.innerText)), ["Cash Parties (no due)", "Due Parties"]);
  const due = await text("#dueOut");
  check("date-wise due list shows invoice and as-on balance", /INV-00001/.test(due) && /40,000\.00/.test(due), true);
  await page.screenshot({ path: path.join(OUT, "customers.png"), fullPage: true });
  const ip = printed(); await page.evaluate(() => OPF.print.invoice(OPF.store.db.sales[0].id)); const inv = await ip;
  const it = await inv.evaluate(() => document.body.innerText);
  check("cash memo: DUE stamp, Total / Advance / Due, previous 50,000, total due 60,000, words", /Cash Memo/.test(it) && /DUE/.test(it) && /Total\s+10,000\.00/.test(it) && /Advance\s+0\.00/.test(it) && /Due\s+10,000\.00/.test(it) && /Previous Due: 50,000\.00/.test(it) && /Total Due Now: 60,000\.00/.test(it) && /Ten Thousand Taka Only/.test(it), true);
  await inv.screenshot({ path: path.join(OUT, "invoice.png"), fullPage: true }); await inv.close();

  section("Courier / Delivery is a record only (never changes dues)");
  const dueBeforeCourier = await page.evaluate(() => OPF.ledger.totalDue("Customer"));
  await go("courier"); await fill({ invoice: "INV-00001" });
  check("invoice fills customer, address and COD (= due)", await page.evaluate(() => { const f = document.getElementById("mainForm"); return ["customer", "destination", "cod"].map((k) => f.elements.namedItem(k).value); }), [c1, "Bongo Bazar, Dhaka", "10000"]);
  check("no Advance, Charge, Net COD or Settled fields", await page.evaluate(() => ["advance", "charge", "netCod", "settled"].filter((k) => document.getElementById("mainForm").elements.namedItem(k))), []);
  await fill({ courier: "Pathao", tracking: "PT1", cod: 15000, status: "Sent", remarks: "Call before delivery" });
  await submit();
  await fill({ customer: c2, courier: "RedX", tracking: "RX1", cod: 3000, status: "Delivered" }); await submit();
  check("parcel saved with COD as a note", await db((d) => { const c = d.courier.find((x) => x.tracking == "PT1"); return [c.cod, c.remarks]; }), [15000, "Call before delivery"]);
  check("parcel counts", await page.evaluate(() => OPF.calc.courierSummary(OPF.store.db.courier)), { sent: 2, delivered: 1, pending: 1, returned: 0, cancelled: 0 });
  check("parcel cards: Sent 2, Delivered 1, Pending 1", await page.$$eval("#app .card", (c) => c.slice(0, 3).map((x) => x.textContent.replace(/\s+/g, ""))), ["ParcelsSent2", "Delivered1", "PendingParcels1"]);
  check("saving parcels does not change customer dues", await page.evaluate(() => OPF.ledger.totalDue("Customer")), dueBeforeCourier);

  section("Issue 9 - Costing and stock summary");
  await go("costing");
  await fill({ fabricYd: 1.5, fabricRate: 100, accessories: 20, factory: 25, packaging: 5, transport: 3, other: 2, margin: 20, qty: 100 }, "costForm");
  const cost = await text("#costout");
  check("cost 205 / selling price 246 / batch profit 4,100", /Total Cost \/ PC\s+205\.00/.test(cost) && /Selling Price \/ PC\s+246\.00/.test(cost) && /Total Profit\s+4,100\.00/.test(cost), true);
  check("stock per style: godown 0, shop 1205-35-5 = 1165, value 1165 x 220", await page.evaluate(() => OPF.stock.byStyle().map((x) => [x.style, x.godown, x.shop, x.total, x.value])), [["OPF-101", 0, 1165, 1165, 256300]]);

  section("Issue 10 - Reconciliation");
  await go("ledger");
  check("all ledgers reconciled", await page.$$eval(".pill", (p) => p.map((x) => x.innerText)), ["Reconciled", "Reconciled", "Reconciled"]);
  await act("ledger.tab", { tab: "Supplier" });
  check("supplier ledger payable 3,000 + 1,000 = 4,000", /4,000\.00/.test(await text(".table tfoot")), true);

  section("Issue 12 - Admin password, edit, delete, search");
  await go("customers"); await act("record.edit", { coll: "customers", id: c1 });
  check("first edit asks to create a password", /Create Admin Password/.test(await text("#modal")), true);
  await password("abc", "abc");
  check("short password rejected", await text("#modalMsg"), "Password must be at least 4 characters.");
  await page.$eval("#pw1", (e) => (e.value = "")); await page.$eval("#pw2", (e) => (e.value = ""));
  await password("secret1", "secret1");
  check("edit form opens prefilled", await page.$eval("#mainForm", (f) => [f.classList.contains("editing"), f.elements.namedItem("name").value]), [true, "Karim Store"]);
  await fill({ mobile: "01799999999" }); await submit();
  check("customer updated in place", await db((d) => [d.customers.length, d.customers[0].mobile, !!d.auth.hash]), [2, "01799999999", true]);
  await act("auth.toggle");
  check("lock button locks admin (the header chip says Locked)", await page.evaluate(() => [OPF.auth.isAdmin(), document.getElementById("lockBtn").textContent, document.getElementById("lockBtn").className]), [false, "AAdminLocked", "user off"]);
  await go("sales"); await act("record.edit", { coll: "sales", id: await db((d) => d.sales[0].id) });
  await password("wrong");
  check("wrong password rejected", await text("#modalMsg"), "Wrong password.");
  await page.$eval("#pw1", (e) => (e.value = "")); await password("secret1");
  check("sale edit restores item rows", await page.$$eval("#items tr.item", (r) => r.length), 2);
  await fill({ discount: 0 }); await submit();
  check("edited sale flows into the ledger", await page.evaluate(() => [OPF.store.db.sales.length, OPF.calc.saleTotal(OPF.store.db.sales[0]), OPF.ledger.balance("Customer", OPF.store.db.customers[0].id)]), [2, 10500, 40500]);
  await go("customers"); await act("record.delete", { coll: "customers", id: c1 });
  check("customer with transactions cannot be deleted", [alerts.pop().startsWith("This record is linked"), await db((d) => d.customers.length)], [true, 2]);
  await page.type("#gsearch", "0179");
  check("search by mobile", await page.$$eval("#gresults a", (a) => a.map((x) => x.innerText)), ["Karim Store 01799999999 | Due 40,500.00"]);
  await page.keyboard.press("Enter");
  const prof = await text("#app");
  check("Enter opens profile with ledger, invoices and receipts", /Karim Store/.test(prof) && /Ledger Statement/.test(prof) && /INV-00001/.test(prof) && /MR-00001/.test(prof), true);
  await page.screenshot({ path: path.join(OUT, "profile.png"), fullPage: true });

  /* ================================================================ */
  section("Previously untested - Sales return");
  await go("returns"); await fill({ invoice: "INV-00001" });
  check("invoice fills customer and location", await page.evaluate(() => { const f = document.getElementById("mainForm"); return [f.elements.namedItem("customer").value, f.elements.namedItem("location").value]; }), [c1, "Owner Permanent Shop"]);
  await fill({ style: "OPF-101", color: "Black", size: "M", qty: 2 });
  check("return amount auto = 2 x 300", await page.$eval('[name="amount"]', (e) => e.value), "600");
  await submit();
  check("return credits customer and restocks shop", await page.evaluate(() => [OPF.ledger.balance("Customer", OPF.store.db.customers[0].id), OPF.stock.byStyle()[0].shop]), [39900, 1167]);

  section("Previously untested - Expenses edit / delete");
  await go("expenses"); await fill({ category: "Rent", amount: 1500 }); await submit();
  const eid = await db((d) => d.expenses[0].id);
  await act("record.edit", { coll: "expenses", id: eid }); await fill({ amount: 2000 }); await submit();
  check("expense edited", await db((d) => [d.expenses.length, d.expenses[0].amount]), [1, 2000]);
  await act("record.delete", { coll: "expenses", id: eid });
  check("expense deleted", await db((d) => d.expenses.length), 0);

  section("Previously untested - Edit purchase / production / transfer / payment");
  await go("purchase"); await act("record.edit", { coll: "purchases", id: await db((d) => d.purchases[0].id) });
  await fill({ qty: 1200 }); await submit();
  check("edited purchase recalculates supplier payable", await page.evaluate(() => [OPF.calc.purchase(OPF.store.db.purchases[0]).total, OPF.ledger.balance("Supplier", OPF.store.db.suppliers[0].id)]), [15500, 6500]);
  await go("transfer"); await act("record.edit", { coll: "transfers", id: await db((d) => d.transfers[0].id) });
  await fill({ received: 1210 }); await submit();
  check("shortage cleared after receiving the rest", await db((d) => d.transfers[0].dispatched - d.transfers[0].received), 0);
  await go("payments"); await act("record.edit", { coll: "payments", id: await db((d) => d.payments[0].id) });
  check("payment edit keeps party selected", await page.$eval('[name="party"]', (e) => e.value), c1);
  await page.$eval('[name="print"]', (e) => (e.checked = false));
  await fill({ amount: 25000 }); await submit();
  check("edited payment snapshot recomputed", await db((d) => [d.payments.length, d.payments[0].snap.remaining]), [1, 34900]);
  await go("issue"); await act("record.delete", { coll: "issues", id: await db((d) => d.issues[0].id) });
  check("deleted issue returns fabric to stock", await page.evaluate(() => OPF.stock.raw()[0].yards), 1309.36);

  section("Courier status change");
  const dueBeforeStatus = await page.evaluate(() => OPF.ledger.totalDue("Customer"));
  await go("courier");
  await page.evaluate((id) => { const s = document.querySelector(`select[data-change="courier.status"][data-id="${id}"]`); s.value = "Delivered"; s.dispatchEvent(new Event("change", { bubbles: true })); }, await db((d) => d.courier.find((c) => c.tracking == "PT1").id));
  check("status change saved", await db((d) => d.courier.map((c) => c.status).sort()), ["Delivered", "Delivered"]);
  check("status change does not change customer dues", await page.evaluate(() => OPF.ledger.totalDue("Customer")), dueBeforeStatus);

  section("Rough Notes: writing window, rich text and sketch");
  await go("notes");
  const drawLine = async (pts) => {
    await page.$eval("#skCanvas", (c) => c.scrollIntoView({ block: "center" }));
    const bb = await (await page.$("#skCanvas")).boundingBox();
    await page.mouse.move(bb.x + pts[0][0] * bb.width, bb.y + pts[0][1] * bb.height); await page.mouse.down();
    for (const q of pts.slice(1)) await page.mouse.move(bb.x + q[0] * bb.width, bb.y + q[1] * bb.height, { steps: 6 });
    await page.mouse.up();
  };
  // The window opens with a short zoom: wait for it, so clicks land where the buttons end up.
  const newNote = async () => { await page.click(".notes-new"); await sleep(250); };
  // Toolbar buttons are pressed directly (no screen position), like a person clicking the button.
  const tap = (sel) => page.$eval(sel, (b) => b.click());
  const noteIds = () => page.$$eval("#noteGrid .n-card", (c) => c.map((x) => x.dataset.id));
  check("an empty board invites the first note", /No notes yet/.test(await text("#noteGrid")), true);
  await newNote();
  check("New note opens the writing window; the title has the cursor", await page.evaluate(() => [!!document.querySelector("#noteDlg #mainForm"), document.activeElement.name]), [true, "subject"]);
  check("a new note starts yellow, and the window shows the colour", await page.evaluate(() => [document.querySelector('#mainForm [name="color"]').value, document.querySelector("#ncPick .on").dataset.color, document.querySelector("#mainForm .rt").classList.contains("nc-yellow"), document.getElementById("ndTop").classList.contains("nc-yellow")]), ["yellow", "yellow", true, true]);
  await tap('[data-act="notes.color"][data-color="green"]');
  // Read the colour the editor fades to (not the in-between colour while it fades).
  check("choosing green marks it and tints the editor", await page.evaluate(() => [document.querySelector("#ncPick .on").dataset.color, getComputedStyle(document.querySelector("#mainForm .rt")).getPropertyValue("--nc-bg").trim()]), ["green", "#e6f7ea"]);
  await fill({ subject: "Next idea" });
  await page.click("#rtBox"); await page.keyboard.type("Try a new ");
  await tap('[data-cmd="bold"]'); await page.keyboard.type("blue denim");
  const boldOn = await page.$eval('[data-cmd="bold"]', (b) => b.classList.contains("on"));
  await tap('[data-cmd="bold"]');
  check("the Bold button lights up while bold is on, and goes off", [boldOn, await page.$eval('[data-cmd="bold"]', (b) => b.classList.contains("on"))], [true, false]);
  await page.keyboard.press("Enter"); await tap('[data-cmd="insertUnorderedList"]'); await page.keyboard.type("Ask Rahim for price");
  await tap('[data-act="rt.palette"]');
  check("the A button opens the text colour palette", await page.$eval("#rtPal", (p) => p.hidden), false);
  await tap('[data-act="rt.color"][data-val="#2563eb"]'); await page.keyboard.type(" now");
  check("picking blue colours the text, closes the palette and shows blue under the A", await page.evaluate(() => [/#2563eb|rgb\(37, 99, 235\)/.test(document.getElementById("rtBox").innerHTML), document.getElementById("rtPal").hidden, getComputedStyle(document.getElementById("rtColorBar")).backgroundColor]), [true, true, "rgb(37, 99, 235)"]);
  check("Add sketch opens the pad", [await page.$("#skCanvas") == null, (await tap('[data-act="notes.addSketch"]'), await page.$("#skCanvas") != null)], [true, true]);
  await drawLine([[0.2, 0.2], [0.5, 0.6], [0.8, 0.2]]);
  await tap('[data-ink="#dc2626"]'); await tap('[data-size="14"]'); await drawLine([[0.1, 0.9], [0.9, 0.9]]);
  await drawLine([[0.3, 0.5], [0.4, 0.5]]); await tap('[data-act="sk.undo"]');
  await page.click("#rtBox"); await page.keyboard.down("Control"); await page.keyboard.press("Enter"); await page.keyboard.up("Control");
  await sleep(100);
  const n1 = await db((d) => d.notes.find((n) => n.subject == "Next idea"));
  check("Ctrl+Enter saves and closes the window", [!!n1, !!(await page.$("#noteDlg"))], [true, false]);
  check("formatted text saved as clean HTML", [/<b>blue denim<\/b>/.test(n1.html), /<ul><li>Ask Rahim for price<span style="color:#2563eb">\s*now<\/span><\/li><\/ul>/.test(n1.html.replace(/&nbsp;/g, " "))], [true, true]);
  check("the colour is saved, the card is green and flashes once", [n1.color, await page.evaluate((id) => document.querySelector(`.n-card[data-id="${id}"]`).className, n1.id)], ["green", "n-card nc-green has-sketch flash"]);
  check("a plain copy is kept for search and Excel", n1.text.replace(/\u00a0/g, " "), "Try a new blue denim\n• Ask Rahim for price now");
  check("sketch saved as strokes (Undo removed the last one): ink, red thick line", n1.sketch.strokes.map((s) => [s.c, s.s]), [["#1f2937", 3], ["#dc2626", 14]]);
  check("a sketch is small (under 2 KB)", JSON.stringify(n1.sketch).length < 2000, true);
  check("the card shows the formatting and draws the sketch", await page.evaluate(() => {
    const c = document.querySelector(".n-card"), cv = c.querySelector(".n-thumb canvas");
    const px = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    let ink = 0; for (let i = 3; i < px.length; i += 4) if (px[i] > 0) ink++;
    return [!!c.querySelector(".n-text b"), !!c.querySelector(".n-text li"), ink > 50];
  }), [true, true, true]);
  await newNote();
  check("the next new note starts empty (no text, no sketch)", await page.evaluate(() => [document.getElementById("rtBox").textContent, !!document.getElementById("skCanvas"), document.querySelector('#mainForm [name="subject"]').value]), ["", false, ""]);
  await page.click("#rtBox"); await page.keyboard.type("Call the courier on Monday"); await submit();
  check("a note without a sketch has none; its card title is the first line", [await db((d) => d.notes.find((n) => n.text == "Call the courier on Monday").sketch), await page.evaluate(() => Array.from(document.querySelectorAll(".n-top b")).map((b) => b.textContent))], [null, ["Call the courier on Monday", "Next idea"]]);
  await newNote(); await submit();
  check("an empty note is not saved (the window stays open)", [await db((d) => d.notes.length), alerts.pop(), !!(await page.$("#noteDlg"))], [2, "Write the note or draw a sketch first.", true]);
  await page.keyboard.press("Escape");
  check("Esc closes the window", !!(await page.$("#noteDlg")), false);
  await newNote(); await page.goBack(); await sleep(200);
  check("Back to another page closes an open window", [!!(await page.$("#noteDlg")), await page.evaluate(() => location.hash)], [false, "#/courier"]);
  await page.goForward(); await sleep(200);

  section("Rough Notes: highlight turns on and off");
  const selectAll = () => page.evaluate(() => { const box = document.getElementById("rtBox"), r = document.createRange(); r.selectNodeContents(box); const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.dispatchEvent(new Event("selectionchange")); });
  const hlState = () => page.evaluate(() => [/background-color|<mark>/.test(document.getElementById("rtBox").innerHTML), document.querySelector('[data-cmd="hiliteColor"]').classList.contains("on")]);
  await newNote(); await page.click("#rtBox"); await page.keyboard.type("Pay the dyeing bill");
  await selectAll(); await tap('[data-cmd="hiliteColor"]'); await sleep(50);
  check("Highlight marks the text and the button lights up", await hlState(), [true, true]);
  await selectAll(); await tap('[data-cmd="hiliteColor"]'); await sleep(50);
  check("clicking Highlight again takes the highlight off", await hlState(), [false, false]);
  await selectAll(); await tap('[data-cmd="hiliteColor"]'); await submit();
  const hl = await db((d) => d.notes.find((n) => n.text == "Pay the dyeing bill"));
  check("a highlight is saved as <mark>", hl.html, "<mark>Pay the dyeing bill</mark>");
  await act("record.edit", { coll: "notes", id: hl.id });
  await selectAll(); await tap('[data-cmd="hiliteColor"]'); await submit();
  check("a saved highlight can be taken off when editing", await db((d) => d.notes.find((n) => n.text == "Pay the dyeing bill").html), "Pay the dyeing bill");
  await act("record.delete", { coll: "notes", id: hl.id });
  await newNote(); await page.click("#rtBox");
  await tap('[data-cmd="hiliteColor"]'); await page.keyboard.type("yellow part");
  await sleep(100); // the button follows the cursor after the browser's selection event
  const onWhileTyping = await page.$eval('[data-cmd="hiliteColor"]', (b) => b.classList.contains("on"));
  await tap('[data-cmd="hiliteColor"]');
  const offAfterClick = await page.$eval('[data-cmd="hiliteColor"]', (b) => b.classList.contains("on"));
  await page.keyboard.type(" plain part"); await page.keyboard.press("Enter"); await page.keyboard.type("next line");
  check("no selection: turning Highlight off makes the next typing plain (also on the next line)", [onWhileTyping, offAfterClick, await page.evaluate(() => OPF.richtext.clean(document.getElementById("rtBox").innerHTML))],
    [true, false, "<mark>yellow part</mark> plain part<div>next line</div>"]);
  await page.evaluate(() => { const box = document.getElementById("rtBox"); box.innerHTML = '<span style="background-color:#fde68a">yellow</span>'; const t = box.firstChild.firstChild, r = document.createRange(); r.setStart(t, 3); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
  await tap('[data-cmd="hiliteColor"]'); await page.keyboard.type("-");
  check("turning it off in the middle of a highlight splits it there", await page.evaluate(() => OPF.richtext.clean(document.getElementById("rtBox").innerHTML)), "<mark>yel</mark>-<mark>low</mark>");
  await submit();
  check("the hidden cursor marker is not saved", await db((d) => d.notes.find((n) => /yel/.test(n.text)).text), "yel-low");
  await act("record.delete", { coll: "notes", id: await db((d) => d.notes.find((n) => /yel/.test(n.text)).id) });

  section("Rough Notes: links");
  check("only safe link addresses are kept; www. gets https://", await page.evaluate(() => ["https://a.com/x?y=1", "www.rahim.com", "rahim.com/p", "mailto:shop@gmail.com", "tel:01711111111", "javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,x", "file:///C:/x", "not a link", "http://a b"].map(OPF.richtext.safeUrl)),
    ["https://a.com/x?y=1", "https://www.rahim.com", "https://rahim.com/p", "mailto:shop@gmail.com", "tel:01711111111", "", "", "", "", "", ""]);
  check("links from a backup keep only a safe address and get a new tab + noopener", await page.evaluate(() => OPF.richtext.clean('<a href="JaVaScRiPt:alert(1)">x</a><a href="https://ok.com" onclick="steal()" style="color:red" target="_self">y</a>')),
    'x<a href="https://ok.com" target="_blank" rel="noopener noreferrer">y</a>');
  await newNote(); await page.click("#rtBox"); await page.keyboard.type("Fabric supplier site");
  await page.keyboard.down("Shift"); for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowLeft"); await page.keyboard.up("Shift");
  await page.keyboard.down("Control"); await page.keyboard.press("k"); await page.keyboard.up("Control"); await sleep(50);
  check("Ctrl+K opens the link box with the cursor in it (no Remove for new links)", await page.evaluate(() => [document.getElementById("rtLinkBox").hidden, document.activeElement.id, getComputedStyle(document.getElementById("rtUnlink")).display]), [false, "rtLinkUrl", "none"]);
  await page.keyboard.type("javascript:alert(1)"); await page.keyboard.press("Enter");
  check("an unsafe address is refused with a message", await page.evaluate(() => [document.getElementById("rtLinkMsg").textContent != "", document.querySelectorAll("#rtBox a").length]), [true, 0]);
  await page.$eval("#rtLinkUrl", (e) => e.select()); await page.keyboard.type("www.rahimfabrics.com"); await page.keyboard.press("Enter");
  check("the selected word becomes the link and the box closes", await page.evaluate(() => [document.getElementById("rtBox").innerHTML, document.getElementById("rtLinkBox").hidden]), ['Fabric supplier <a href="https://www.rahimfabrics.com">site</a>', true]);
  await page.evaluate(() => { const t = document.querySelector("#rtBox a").firstChild, r = document.createRange(); r.setStart(t, 2); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.dispatchEvent(new Event("selectionchange")); });
  await sleep(50);
  check("the link button lights up inside a link", await page.$eval('[data-cmd="link"]', (b) => b.classList.contains("on")), true);
  await page.keyboard.press("End"); await page.keyboard.press("Enter");
  await tap('[data-act="rt.link"]'); await page.keyboard.type("https://example.com/order"); await page.keyboard.press("Enter");
  await submit();
  const ln = await db((d) => d.notes.find((n) => /Fabric supplier/.test(n.text)));
  check("links are saved safely; the plain copy keeps the addresses", [ln.html.replace(/&nbsp;|\s/g, ""), ln.text.replace(/\u00a0/g, "").trim()],
    ['Fabric supplier <a href="https://www.rahimfabrics.com" target="_blank" rel="noopener noreferrer">site</a><div><a href="https://example.com/order" target="_blank" rel="noopener noreferrer">https://example.com/order</a></div>'.replace(/ /g, ""), "Fabric supplier site (https://www.rahimfabrics.com)\nhttps://example.com/order"]);
  check("the card title leaves out the address", await page.$eval(`.n-card[data-id="${ln.id}"] .n-top b`, (b) => b.textContent), "Fabric supplier site");
  const tab = new Promise((res) => browser.once("targetcreated", res));
  await page.click(`.n-card[data-id="${ln.id}"] .n-text a`);
  const opened = await Promise.race([tab, sleep(3000).then(() => null)]);
  check("clicking a link on a card opens it in a new tab, not the preview", [!!opened && /rahimfabrics/.test(opened.url()), !!(await page.$("#noteDlg"))], [true, false]);
  if (opened) { const pg = await opened.page(); if (pg) await pg.close(); }
  await act("record.edit", { coll: "notes", id: ln.id }); await sleep(250);
  await page.evaluate(() => { const t = document.querySelector("#rtBox a").firstChild, r = document.createRange(); r.setStart(t, 1); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
  await tap('[data-act="rt.link"]');
  check("opening the box on a link shows its address and Remove link", await page.evaluate(() => [document.getElementById("rtLinkUrl").value, getComputedStyle(document.getElementById("rtUnlink")).display != "none"]), ["https://www.rahimfabrics.com", true]);
  await tap('[data-act="rt.unlink"]'); await submit();
  check("Remove link keeps the text and drops the link", await db((d) => /Fabric supplier site<div>/.test(d.notes.find((n) => /Fabric supplier/.test(n.text)).html)), true);
  await act("record.delete", { coll: "notes", id: ln.id });

  section("Rough Notes: board, preview, pin, filter");
  check("all cards are the same height", await page.$$eval(".n-card", (c) => [...new Set(c.map((x) => x.getBoundingClientRect().height))].length), 1);
  await page.click(`.n-card[data-id="${n1.id}"] .n-text`);
  check("clicking a card opens the preview with the full note and the sketch", await page.evaluate(() => {
    const d = document.getElementById("noteDlg");
    return [d.querySelector("h2").textContent, !!d.querySelector(".nd-text li"), !!d.querySelector(".nd-sketch canvas"), Array.from(d.querySelectorAll(".nd-foot button")).map((b) => b.textContent)];
  }), ["Next idea", true, true, ["Copy text", "Delete", "Edit note"]]);
  check("sketches sit on light paper (dark ink shows in dark mode too)", await page.evaluate(() => ["#noteDlg .nd-sketch canvas", ".n-thumb canvas"].map((q) => getComputedStyle(document.querySelector(q)).backgroundColor)), ["rgb(255, 253, 246)", "rgb(255, 253, 246)"]);
  await page.click("#noteDlg .nd-x");
  const n2 = await db((d) => d.notes.find((n) => n.text == "Call the courier on Monday").id);
  check("same day: the newest note comes first", await noteIds(), [n2, n1.id]);
  await act("notes.pin", { id: n1.id });
  check("pinning moves the older note to the top and is saved", [await noteIds(), await db((d) => d.notes.find((n) => n.pinned).subject)], [[n1.id, n2], "Next idea"]);
  check("the pin shows as on", await page.$eval(`.n-card[data-id="${n1.id}"] .n-pin`, (b) => b.classList.contains("on")), true);
  await page.focus(`.n-card[data-id="${n1.id}"]`); await page.keyboard.press("Enter");
  check("Enter on a focused card opens its preview", await page.$eval("#noteDlg h2", (h) => h.textContent), "Next idea");
  await act("notes.pin", { id: n1.id });
  check("unpinning from the preview keeps it open and reorders the board", [!!(await page.$("#noteDlg .nd-text")), await noteIds()], [true, [n2, n1.id]]);
  await page.keyboard.press("Escape");
  check("colour chips appear when notes have different colours", await page.$$eval("#noteChips .nchip", (b) => b.map((x) => x.textContent)), ["All", "Yellow", "Green"]);
  await act("notes.filter", { color: "green" });
  check("a colour chip shows only that colour", await noteIds(), [n1.id]);
  await act("notes.filter", {});
  await page.type("#noteSearch", "COURIER"); await sleep(250);
  check("search filters as you type (any case)", await noteIds(), [n2]);
  await page.$eval("#noteSearch", (s) => { s.value = ""; s.dispatchEvent(new Event("input")); }); await sleep(250);

  section("Rough Notes: only safe formatting is kept (notes also arrive from backups and Google Drive)");
  await page.evaluate(() => {
    window.__xss = 0;
    OPF.store.db.notes.push({ id: "nX", date: "2026-01-01", subject: "<img src=x onerror=window.__xss=1>", text: "x",
      html: '<img src=x onerror="window.__xss=1"><script>window.__xss=1<\/script><a href="javascript:window.__xss=1" onclick="window.__xss=1">link</a><b onmouseover="window.__xss=1" style="color:#dc2626">ok</b><span style="color:#123456;background:url(x)">odd</span><iframe src="javascript:window.__xss=1"></iframe>',
      sketch: { strokes: [{ c: "javascript:alert(1)", s: 9999, p: ["1", "x", 3, 4] }, { bad: true }] } });
    OPF.store.save();
  });
  await go("notes"); await sleep(200);
  await page.click('.n-card[data-id="nX"] .n-text'); await sleep(100);
  check("no script ran and no unsafe element or attribute is on the board or in the preview", await page.evaluate(() => {
    const c = document.querySelector('.n-card[data-id="nX"]'), d = document.getElementById("noteDlg");
    return [window.__xss, c.querySelectorAll("img,script,iframe,a,[onerror],[onclick],[onmouseover]").length + d.querySelectorAll("img,script,iframe,a,[onerror],[onclick],[onmouseover]").length, c.querySelector(".n-text").innerHTML];
  }), [0, 0, 'link<b><span style="color:#dc2626">ok</span></b>odd']);
  await page.keyboard.press("Escape");
  check("a damaged sketch is repaired to safe values", await page.evaluate(() => OPF.sketch.valid(OPF.store.byId("notes", "nX").sketch)), { w: 1000, h: 560, strokes: [{ c: "#1f2937", s: 40, e: 0, p: [1, 0, 3, 4] }] });
  await newNote();
  check("pasting puts in plain text only", await page.evaluate(() => {
    const box = document.getElementById("rtBox"); box.focus();
    const dt = new DataTransfer(); dt.setData("text/html", '<img src=x onerror="window.__xss=2"><b>Bold</b>'); dt.setData("text/plain", "Pasted text");
    box.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
    return [box.innerHTML.indexOf("<img") < 0, /Pasted text/.test(box.textContent)];
  }), [true, true]);
  await page.keyboard.press("Escape");
  await page.evaluate(() => { OPF.store.db.notes = OPF.store.db.notes.filter((n) => n.id != "nX"); OPF.store.save(); });

  section("Rough Notes: edit, delete, Excel");
  await go("notes");
  await page.click(`.n-card[data-id="${n1.id}"] .n-text`);
  await act("notes.edit", { id: n1.id });
  check("Edit note in the preview opens the writing window with the text, the sketch and the colour", await page.evaluate(() => [!!document.querySelector("#noteDlg #mainForm"), /blue denim/.test(document.getElementById("rtBox").innerHTML), !!document.getElementById("skCanvas"), document.querySelector("#ncPick .on").dataset.color, document.querySelector("#noteDlg .nd-foot button:last-child").textContent]), [true, true, true, "green", "Update"]);
  await tap('[data-act="notes.removeSketch"]'); await submit();
  check("Remove sketch takes the sketch off the note; the colour is kept; still one record", await db((d) => { const n = d.notes.filter((x) => x.subject == "Next idea"); return [n.length, n[0].sketch, n[0].color]; }), [1, null, "green"]);
  await act("record.edit", { coll: "notes", id: n1.id }); await page.click('#noteDlg [data-act="notes.close"]');
  await newNote();
  check("closing an edit ends it: New note is empty again", await page.evaluate(() => document.getElementById("rtBox").textContent), "");
  await page.keyboard.press("Escape");
  await act("record.delete", { coll: "notes", id: n2 });
  check("a note can be deleted", await db((d) => d.notes.map((n) => n.subject)), ["Next idea"]);
  check("notes are in the Excel backup as plain text", await page.evaluate(() => OPF.sheets.byName("Rough Notes").rows), [[await db((d) => d.notes[0].date), "Next idea", "Try a new blue denim\n• Ask Rahim for price\u00a0now", "", "green"]]);

  section("Previously untested - Save costing to product");
  await go("costing");
  const pid = await db((d) => d.products[0].id);
  await fill({ product: pid, fabricYd: 1.5, fabricRate: 100, accessories: 20, factory: 25, packaging: 5, transport: 3, other: 2, margin: 20 }, "costForm");
  await submit("costForm");
  check("product cost / price updated", await db((d) => [d.products[0].cost, d.products[0].price, d.products[0].costing.margin]), [205, 246, 20]);
  await go("costing"); await fill({ product: pid }, "costForm");
  check("saved costing loads back", await page.$eval('#costForm [name="fabricYd"]', (e) => e.value), "1.5");

  section("Previously untested - Settings: logo, password change");
  await go("settings");
  const logoInput = await page.$('input[data-change="settings.pickLogo"]');
  await logoInput.uploadFile(path.join(ROOT, "assets/img/intus_algorithm_logo.png"));
  await sleep(300);
  await fill({ tagline: "Wholesale Garments" }, "coForm"); await submit("coForm");
  check("logo and branding saved", await db((d) => [d.company.logo.startsWith("data:image/png;base64,"), d.company.tagline]), [true, "Wholesale Garments"]);
  const lp = printed(); await act("print.preview"); const pv = await lp;
  check("invoice uses uploaded logo", await pv.evaluate(() => !!document.querySelector(".mlogo img")), true);
  await pv.screenshot({ path: path.join(OUT, "invoice_with_logo.png"), fullPage: true }); await pv.close();
  await act("auth.changePassword");
  await password("newpass", "newpass");
  check("password changed", alerts.pop(), "Admin password saved.");
  await act("auth.toggle");
  await go("customers"); await act("record.edit", { coll: "customers", id: c2 });
  await password("secret1");
  check("old password no longer works", await text("#modalMsg"), "Wrong password.");
  await page.$eval("#pw1", (e) => (e.value = "")); await password("newpass");
  check("new password works", await modalOpen(), false);

  section("Issue 11 / previously untested - Backup, clear, restore");
  await go("settings");
  await act("backup.excel"); await act("backup.json"); await sleep(1500);
  const files = fs.readdirSync(OUT);
  const xlsx = files.find((f) => f.endsWith(".xlsx")), json = files.find((f) => f.endsWith(".json"));
  check("Excel and JSON backups downloaded", [!!xlsx, !!json], [true, true]);
  const before = await db((d) => [d.sales.length, d.payments.length, d.customers.length]);
  await act("backup.clear");
  check("clear all data keeps password and branding", await db((d) => [d.sales.length, d.customers.length, !!d.auth.hash, d.company.tagline]), [0, 0, true, "Wholesale Garments"]);
  await go("settings");
  const restoreInput = await page.$('input[data-change="backup.restore"]');
  await restoreInput.uploadFile(path.join(OUT, json));
  await sleep(800);
  check("restore brings all data back", await db((d) => [d.sales.length, d.payments.length, d.customers.length]), before);
  fs.writeFileSync(path.join(OUT, "bad.json"), '{"hello":1}');
  await go("settings"); await (await page.$('input[data-change="backup.restore"]')).uploadFile(path.join(OUT, "bad.json")); await sleep(500);
  check("invalid backup file rejected", alerts.pop(), "Invalid backup file. Choose a .json file created by Download Restore File.");

  section("Every page renders");
  for (const [id] of await page.evaluate(() => OPF.config.MENU)) {
    await go(id);
    if (["dashboard", "sales", "payments", "courier", "costing", "ledger", "transfer", "productionOrder", "purchase"].includes(id)) await page.screenshot({ path: path.join(OUT, id + ".png"), fullPage: true });
  }
  check("no ERP error banners", await page.$$eval(".alert b", (b) => b.filter((x) => /ERP error/.test(x.innerText)).length), 0);

  section("Phones (iPhone 12): printing and every page fits the screen");
  {
    const ph = await browser.newPage();
    await bengaliOn(ph);
    const phoneErrors = [];
    ph.on("pageerror", (e) => phoneErrors.push(e.message));
    await ph.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1" });
    await ph.goto(APP); await sleep(400); // same browser profile: the data saved above
    await ph.evaluate(() => { window.__prints = 0; window.print = () => { window.__prints++; }; });
    const saleId = await ph.evaluate(() => OPF.store.db.sales[0].id);
    await ph.evaluate((id) => OPF.print.invoice(id), saleId);
    check("phone: the cash memo prints from the page itself (iPhone ignores a hidden frame)", await ph.evaluate(() => [window.__prints, !!document.getElementById("printFrame"), /Cash Memo/.test(document.getElementById("printDoc").innerHTML), document.body.classList.contains("print-doc"), document.getElementById("printCss").media]), [1, false, true, true, "print"]);
    await ph.emulateMediaType("print");
    check("phone: while printing only the memo shows, with its own styles", await ph.evaluate(() => [getComputedStyle(document.getElementById("app").closest("body > *")).display, getComputedStyle(document.getElementById("printDoc")).display, getComputedStyle(document.querySelector("#printDoc .memo")).fontFamily.indexOf("Times") >= 0]), ["none", "block", true]);
    check("phone: the memo is laid out at its A4 width (not the phone's) and fits one page (<= 250 mm)", await ph.evaluate(() => { const px = 96 / 25.4, r = document.querySelector("#printDoc .memo").getBoundingClientRect(); return [Math.round(r.width / px), r.height / px <= 250]; }), [194, true]);
    await ph.emulateMediaType("screen");
    check("phone: the memo is never visible on screen, and print styles never touch the screen", await ph.evaluate(() => [getComputedStyle(document.getElementById("printDoc")).display, getComputedStyle(document.body).fontFamily.indexOf("Times") < 0]), ["none", true]);
    await ph.touchscreen.tap(200, 400);
    check("phone: the next tap switches the memo styles off again", await ph.evaluate(() => [document.body.classList.contains("print-doc"), document.getElementById("printCss").media]), [false, "not all"]);
    const tooWide = [];
    for (const id of await ph.evaluate(() => OPF.config.MENU.map((m) => m[0]))) {
      await ph.evaluate((id) => OPF.router.go(id), id); await sleep(60);
      const w = await ph.evaluate(() => [document.documentElement.scrollWidth, Array.prototype.filter.call(document.querySelectorAll("#app *"), (e) => {
        if (e.getBoundingClientRect().right <= innerWidth + 1 || e.closest("#noteDlg")) return false;
        // Inside a row that scrolls sideways on purpose (e.g. the dashboard period buttons) is fine.
        for (let a = e.parentElement; a && a != document.body; a = a.parentElement) if (/auto|scroll/.test(getComputedStyle(a).overflowX) && a.scrollWidth > a.clientWidth) return false;
        return true;
      }).length]);
      if (w[0] > 390 || w[1]) tooWide.push(id + " " + w.join("/"));
    }
    check("phone: no page is wider than the screen (tables show as cards)", tooWide, []);
    await ph.evaluate(() => OPF.router.go("customers")); await sleep(60);
    check("phone: wide tables become cards with column names", await ph.evaluate(() => { const t = document.querySelector(".table.stack"); const td = t && t.querySelector("tbody td"); return [!!t, td && td.getAttribute("data-label"), getComputedStyle(t.querySelector("thead")).display]; }), [true, "Customer", "none"]);
    await ph.evaluate(() => OPF.router.go("sales")); await sleep(60);
    await ph.evaluate(() => document.querySelector('[data-act="sales.addItem"]').click()); await sleep(60);
    check("phone: invoice item rows (also a new one) are labelled cards", await ph.evaluate(() => Array.prototype.map.call(document.querySelectorAll("#items tr.item"), (tr) => tr.querySelector('input[data-k="qty"]').parentNode.getAttribute("data-label"))), ["Qty (PCS)", "Qty (PCS)", "Qty (PCS)", "Qty (PCS)"]);
    await ph.evaluate(() => document.querySelector('[data-act="shell.menu"]').click()); await sleep(100);
    const toolsShown = await ph.evaluate(() => getComputedStyle(document.querySelector(".phone-tools")).display != "none" && getComputedStyle(document.querySelector(".phone-tools .theme-switch")).display != "none");
    await ph.evaluate(() => document.querySelector('.phone-tools [data-theme-set="dark"]').click());
    check("phone: the menu has the theme switch (and Lock / Backup); dark mode switches on and the menu stays open", [toolsShown, await ph.evaluate(() => [document.documentElement.getAttribute("data-theme"), document.body.classList.contains("nav-open"), !!document.getElementById("lockBtnSide"), !!document.querySelector('.phone-tools [data-act="backup.excel"]'), !!document.querySelector('.phone-tools [data-lang="bn"]')])], [true, ["dark", true, true, true, true]]);
    await ph.evaluate(() => document.querySelector('.phone-tools [data-theme-set="light"]').click());
    check("phone: no JavaScript errors", phoneErrors, []);
    await ph.close();
  }
  check("computer: tables stay tables, the memo still prints from the hidden frame, menu tools stay in the header", await page.evaluate(() => [document.querySelectorAll(".table.stack").length, OPF.print.isMobile(), getComputedStyle(document.querySelector(".phone-tools")).display, getComputedStyle(document.querySelector(".top .theme-switch")).display != "none"]), [0, false, "none", true]);

  check("double-click version: no Install desktop app (it is a desktop version already)", await page.evaluate(() => { OPF.router.go("settings"); return [!!document.querySelector("#nav .get-app"), !!document.getElementById("appBox")]; }), [false, false]);

  section("Bengali screen language (English stays the default)");
  check("English by default; the header has the EN | বাং switch", await page.evaluate(() => [document.documentElement.lang, document.querySelector('.top [data-lang="en"]').classList.contains("on"), document.querySelector("#nav .menu").textContent.indexOf("Dashboard") >= 0]), ["en", true, true]);
  check("numbers typed with Bengali digits are understood", await page.evaluate(() => [OPF.util.num("১,২৫০.৫০"), OPF.util.num("1,250.50")]), [1250.5, 1250.5]);
  await page.click('.top [data-lang="bn"]'); await page.waitForNavigation({ waitUntil: "load" }).catch(() => {}); await sleep(600);
  await go("sales"); await sleep(150);
  const bn = await page.evaluate(() => ({
    lang: document.documentElement.lang, saved: JSON.parse(localStorage.getItem("opf_erp_ui")).lang,
    menu: document.querySelector('#nav a.item[data-page="dashboard"]').textContent.trim(),
    h1: document.querySelector("#app h1").textContent, search: document.getElementById("gsearch").placeholder,
    th: document.querySelector("#app .table th").textContent, invoiceNo: document.querySelector('#mainForm [name="invoice"]').value,
    regInvoice: Array.prototype.find.call(document.querySelectorAll("#app td"), (td) => /^INV-\d+$/.test(td.textContent.trim())) ? "English digits" : "changed",
    money: Array.prototype.some.call(document.querySelectorAll("#app td.num"), (td) => /^[০-৯,]+\.[০-৯]{2}$/.test(td.textContent.trim())),
    title: document.title
  }));
  check("বাং: menu, headings, placeholders and the page title in Bengali; amounts with Bengali digits", [bn.lang, bn.saved, bn.menu, bn.h1, bn.search, bn.money, /^বিক্রয় \/ ইনভয়েস/.test(bn.title)], ["bn", "bn", "ড্যাশবোর্ড", "পাইকারি বিক্রয় / ইনভয়েস", "নাম বা মোবাইল দিয়ে গ্রাহক খুঁজুন...", true, true]);
  check("বাং: invoice numbers and typed values stay as they are (INV-..., form values)", [bn.regInvoice, /^INV-\d+$/.test(bn.invoiceNo)], ["English digits", true]);
  await page.evaluate(() => { const f = document.getElementById("mainForm"); f.elements.namedItem("discount").value = "99999"; });
  await setItems([{ style: "S1", color: "Blue", size: "L", qty: 1, rate: 300 }]);
  await page.evaluate(() => { const f = document.getElementById("mainForm"); f.elements.namedItem("customer").selectedIndex = 1; f.requestSubmit(); });
  check("বাং: messages are shown in Bengali", alerts.pop(), "ছাড় উপমোটের চেয়ে বেশি হতে পারে না।");
  check("বাং: live totals still calculate (shown with Bengali digits)", /৩০০\.০০/.test(await text("#calc")), true);
  await page.evaluate(() => { window.print = () => {}; OPF.print.output = () => {}; OPF.print.invoice(OPF.store.db.sales[0].id); }); await sleep(500);
  check("বাং: the printed cash memo stays English", await page.evaluate(() => { const d = document.getElementById("printFrame").contentDocument.body.textContent; return [/Cash Memo/.test(d), /[০-৯]/.test(d)]; }), [true, false]);
  await go("notes"); await sleep(100);
  check("বাং: users' own notes are not translated", await page.evaluate(() => Array.prototype.some.call(document.querySelectorAll(".n-text"), (n) => /[A-Za-z]/.test(n.textContent))), true);
  await page.click('.top [data-lang="en"]'); await page.waitForNavigation({ waitUntil: "load" }).catch(() => {}); await sleep(600);
  check("EN switches back: English text and digits again", await page.evaluate(() => [document.documentElement.lang, document.querySelector('#nav a.item[data-page="dashboard"]').textContent.trim(), /[০-৯]/.test(document.getElementById("app").textContent)]), ["en", "Dashboard", false]);

  section("Feature flag ENABLE_BENGALI = false: English only, no switch");
  {
    const off = await browser.newPage();
    // Hand the ERP its settings with the flag off (config.js is frozen, so swap it as it is set).
    await off.evaluateOnNewDocument(() => {
      let cfg = null;
      window.OPF = {};
      Object.defineProperty(window.OPF, "config", { configurable: true, get: () => cfg, set: (v) => { cfg = Object.freeze(Object.assign({}, v, { ENABLE_BENGALI: false })); } });
    });
    await off.goto(APP); await sleep(400);
    await off.evaluate(() => { localStorage.setItem("opf_erp_ui", JSON.stringify(Object.assign(JSON.parse(localStorage.getItem("opf_erp_ui") || "{}"), { lang: "bn" }))); });
    await off.reload(); await sleep(500);
    check("flag off: English even if Bengali was chosen; no switch in the header or phone menu; the choice is kept", await off.evaluate(() => [document.documentElement.lang, document.querySelector('#nav a.item[data-page="dashboard"]').textContent.trim(), !!document.querySelector(".top .lang-switch"), !!document.querySelector(".phone-tools [data-lang]"), JSON.parse(localStorage.getItem("opf_erp_ui")).lang]), ["en", "Dashboard", false, false, "bn"]);
    await off.evaluate(() => { const p = JSON.parse(localStorage.getItem("opf_erp_ui")); p.lang = "en"; localStorage.setItem("opf_erp_ui", JSON.stringify(p)); });
    await off.close();
  }

  section("Performance (thousands of records)");
  await page.evaluate(() => {
    const d = OPF.store.db, uid = OPF.util.uid;
    for (let i = 0; i < 500; i++) d.customers.push({ id: "pc" + i, name: "Perf Customer " + i, mobile: "0170000" + i, previousDue: 1000 });
    for (let i = 0; i < 3000; i++) d.sales.push({ id: "ps" + i, created: "", date: "2026-0" + (1 + (i % 9)) + "-1" + (i % 9), invoice: "P-" + i, customer: "pc" + (i % 500), location: "Owner Permanent Shop", discount: 0, paid: 500, items: [{ style: "OPF-101", color: "Black", size: "M", qty: 2, rate: 300 }, { style: "OPF-102", qty: 1, rate: 450 }] });
    for (let i = 0; i < 2000; i++) d.payments.push({ id: "pp" + i, date: "2026-09-01", type: "Customer", party: "pc" + (i % 500), amount: 200 });
    OPF.store.save();
  });
  const timings = {};
  for (const id of ["dashboard", "customers", "payments", "sales", "ledger", "costing"]) {
    timings[id] = await page.evaluate((id) => { const t = performance.now(); OPF.router.go(id); return Math.round(performance.now() - t); }, id);
  }
  timings.excel = await page.evaluate(() => { const t = performance.now(); OPF.xlsx.build(OPF.sheets.all()); return Math.round(performance.now() - t); });
  timings.search = await page.evaluate(() => { const t = performance.now(); OPF.search.results("perf 4"); return Math.round(performance.now() - t); });
  console.log("  timings (ms, this machine):", JSON.stringify(timings));
  check("every page renders in under 0.6 s with 3,000 invoices / 500 customers", Object.values(timings).every((ms) => ms < 600), true);

  await T.finish();
})().catch((e) => { console.error(e); process.exit(1); });
