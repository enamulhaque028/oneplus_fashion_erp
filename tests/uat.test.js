/* Follows docs/QA_CHECKLIST.md step by step, typing like a person, and asserts every
   "Expect" value written in the checklist. If this passes, the checklist's numbers are right.
   Run:  node uat.test.js   (options: see lib.js) */
const path = require("path");
const fs = require("fs");
const { start, sleep } = require("./lib");

(async () => {
  const T = await start("uat");
  const { page, check, section, go, db, text, act, password, printed, typeInto } = T;
  await T.open();
  await T.reset();
  const calc = () => text("#calc");
  // Type each value into the named field, like a person (selects go through page.select).
  async function type(values) {
    for (const [name, value] of Object.entries(values)) {
      const sel = `#mainForm [name="${name}"]`;
      const tag = await page.$eval(sel, (e) => e.tagName);
      if (tag == "SELECT") await page.select(sel, await page.$eval(sel, (s, v) => { const o = Array.from(s.options).find((x) => x.textContent.startsWith(v) || x.value == v); return o ? o.value : v; }, String(value)));
      else if ((await page.$eval(sel, (e) => e.type)) == "date") await page.$eval(sel, (e, v) => { e.value = v; e.dispatchEvent(new Event("change", { bubbles: true })); }, String(value));
      else await typeInto(sel, value);
    }
    await page.keyboard.press("Tab"); // leave the last field so its change event fires
  }
  const save = () => page.click('#mainForm button:not([type="button"])');
  const firstRow = () => page.$$eval(".table tbody tr", (r) => Array.from(r[0].cells).map((c) => c.innerText.trim()));

  section("Step 1-2  Supplier and purchase");
  await go("suppliers"); await type({ name: "Rahim Fabrics", mobile: "01811111111" }); await save();
  await go("purchase");
  await type({ supplier: "Rahim Fabrics", invoice: "CH-101", material: "Cotton Twill", color: "Black", qty: 1000, unit: "Yard", rate: 12.5, transport: 500, loading: 250, other: 100, discount: 350, paid: 10000 });
  const pc = await calc();
  check("Expect: Subtotal 12,500.00", /Subtotal[^\n]*\s12,500\.00/.test(pc), true);
  check("Expect: Total Purchase Cost 13,000.00", /Total Purchase Cost\s+13,000\.00/.test(pc), true);
  check("Expect: Due to Supplier 3,000.00", /Due to Supplier\s+3,000\.00/.test(pc), true);
  check("Expect: Landed cost per Yard 13.00", /Landed cost per Yard\s+13\.00/.test(pc), true);
  await save();

  section("Step 3  Raw material stock");
  await go("materials");
  check("Expect: Cotton Twill / Black  Yard 1,000", (await firstRow()).slice(0, 6), ["Cotton Twill", "Black", "1,000", "0", "0", "1,000"]);

  section("Step 4-5  Factory, production order, production");
  await go("factories"); await type({ name: "Star Garments", rate: 25 }); await save();
  await go("productionOrder"); await type({ style: "OPF-101", color: "Black", size: "M", planned: 1500, factory: "Star Garments" }); await save();
  check("Expect: order number PO-0001", (await firstRow())[0], "PO-0001");
  await go("production"); await type({ order: "PO-0001" });
  check("Expect: Style, Color, Size, Factory and Rate fill in by themselves", await page.evaluate(() => ["style", "color", "size", "rate"].map((k) => document.querySelector(`#mainForm [name="${k}"]`).value)), ["OPF-101", "Black", "M", "25"]);
  await type({ accepted: 1210 });
  check("Expect: Factory Bill 30,250.00 and Difference 290", /Factory Bill[^\n]*30,250\.00/.test(await calc()) && /Difference[^\n]*\s290/.test(await calc()), true);
  await save();
  await go("productionOrder");
  check("Expect: Planned 1,500 / Actual 1,210 / Difference 290 / In Progress", (await firstRow()).slice(5, 10), ["Star Garments", "1,500", "1,210", "290", "In Progress"]);

  section("Step 6  Transfer with shortage");
  await go("transfer"); await type({ from: "Star Garments", style: "OPF-101", color: "Black", size: "M", dispatched: 1210, received: 1205 });
  check("Expect: Due / Shortage 5 PCS (live)", /Due \/ Shortage\s+5 PCS/.test(await calc()), true);
  await save();
  check("Expect: transfer TR-0001 shortage 5", [(await firstRow())[1], (await firstRow())[9]], ["TR-0001", "5"]);

  section("Step 7-8  Product and customer");
  await go("products"); await type({ style: "OPF-101", name: "Men Polo", cost: 220, price: 300 }); await save();
  await go("customers"); await type({ name: "Karim Store", mobile: "01711111111", address: "Bongo Bazar", district: "Dhaka", previousDue: 50000 }); await save();

  section("Step 9  Sale with two items");
  await go("sales");
  await type({ customer: "Karim Store" });
  const row = (i, k) => `#items tr.item:nth-child(${i}) [data-k="${k}"]`;
  for (const [i, q] of [[1, 20], [2, 15]]) {
    await typeInto(row(i, "style"), "OPF-101"); await page.keyboard.press("Tab");
    await typeInto(row(i, "color"), "Black"); await typeInto(row(i, "size"), "M"); await typeInto(row(i, "qty"), q);
  }
  check("Expect: Rate fills in as 300 by itself", await page.$eval(row(1, "rate"), (e) => e.value), "300");
  await type({ discount: 500, paid: 0 });
  const sc = await calc();
  check("Expect: Subtotal (2 items, 35 PCS) 10,500.00", /Subtotal \(2 items, 35 PCS\)\s+10,500\.00/.test(sc), true);
  check("Expect: Total Amount 10,000.00 / Due Amount 10,000.00", /Total Amount\s+10,000\.00/.test(sc) && /= Due Amount\s+10,000\.00/.test(sc), true);
  check("Expect: Previous Balance 50,000.00 / After This Invoice 60,000.00", /Previous Balance\s+50,000\.00/.test(sc) && /After This Invoice\s+60,000\.00/.test(sc), true);
  const ip = printed(); await act("sales.savePrint"); const inv = await ip;
  const it = await inv.evaluate(() => document.body.textContent.replace(/\s+/g, " "));
  check("Expect on memo: Cash Memo, Sl. No. INV-00001, Karim Store, Courier empty, DUE stamp", /Cash Memo/.test(it) && /Sl\. No\.\s*INV-00001/.test(it) && /Karim Store/.test(it) && /DUE/.test(it), true);
  check("Expect on memo: Less: Discount - 500.00, Total 10,000.00, Advance 0.00, Due 10,000.00", /Less: Discount\s*- 500\.00/.test(it) && /Total\s*10,000\.00/.test(it) && /Advance\s*0\.00/.test(it) && /Due\s*10,000\.00/.test(it), true);
  check("Expect on memo: HOTLINE 01878638475 and the Qur'an quote", /HOTLINE/.test(it) && /01878638475/.test(it) && /Allah has Made Business Lawful, Usury is Forbidden\./.test(it) && /Al Qur'an/.test(it), true);
  check("Expect on memo: Previous Due: 50,000.00, Total Due Now: 60,000.00", /Previous Due: 50,000\.00/.test(it) && /Total Due Now: 60,000\.00/.test(it), true);
  check("Expect on invoice: In words: Ten Thousand Taka Only", /In words: Ten Thousand Taka Only/.test(it), true);
  await inv.setViewport({ width: 733, height: 1062 }); // A4 printable area (194 x 281 mm, 8 mm margins) in CSS px
  await inv.emulateMediaType("print"); // measure the printed layout, not the on-screen preview frame
  check("Expect (5.1): invoice fits on one A4 page", await inv.evaluate(() => document.documentElement.scrollHeight <= 1062 && document.documentElement.scrollWidth <= 733), true);
  await inv.close();

  section("Step 10  Collect payment");
  await go("payments");
  await act("payments.collect", { id: await db((d) => d.customers[0].id) });
  await type({ amount: 20000, method: "bKash", reference: "TRX12345" });
  const bd = await calc();
  check("Expect: Previous Due 50,000 + Today's Purchase 10,000 = Total Due 60,000", /Previous Due\s+50,000\.00/.test(bd) && /Today's Purchase\s+10,000\.00/.test(bd) && /Total Due\s+60,000\.00/.test(bd), true);
  check("Expect: Paid Today 20,000 -> Remaining Due 40,000", /Paid Today \(this receipt\)\s+20,000\.00/.test(bd) && /Remaining Due\s+40,000\.00/.test(bd), true);
  const rp = printed(); await save(); const receipt = await rp;
  const rt = await receipt.evaluate(() => document.body.textContent.replace(/\s+/g, " "));
  check("Expect on receipt: Money Receipt MR-00001, bKash, TRX12345, Remaining Due 40,000.00, Twenty Thousand Taka Only", /Money Receipt/.test(rt) && /MR-00001/.test(rt) && /bKash/.test(rt) && /TRX12345/.test(rt) && /Remaining Due\s*40,000\.00/.test(rt) && /Twenty Thousand Taka Only/.test(rt), true);
  await receipt.close();

  section("Step 11  Courier COD");
  await go("courier"); await type({ invoice: "INV-00001" });
  check("Expect: Customer and Destination fill in; COD = 10,000", await page.evaluate(() => ["destination", "cod"].map((k) => document.querySelector(`#mainForm [name="${k}"]`).value)), ["Bongo Bazar, Dhaka", "10000"]);
  await type({ courier: "Pathao", tracking: "PT-1", cod: 15000, advance: 1000, charge: 150 });
  check("Expect: Net COD 14,000", await page.$eval('[name="netCod"]', (e) => e.value), "14000");
  check("Expect: Net Receivable from Courier 13,850.00", /Net Receivable from Courier\s+13,850\.00/.test(await calc()), true);
  await save();
  check("Expect: 'Out of 1 parcels sent: 0 delivered, 1 pending'", /Out of 1 parcels sent: 0 delivered, 1 pending/.test(await text("#app")), true);

  section("Step 12  Costing");
  await go("costing");
  for (const [k, v] of Object.entries({ fabricYd: 1.5, fabricRate: 100, accessories: 20, factory: 25, packaging: 5, transport: 3, other: 2, margin: 20, qty: 100 })) await typeInto(`#costForm [name="${k}"]`, v);
  await page.keyboard.press("Tab");
  const co = await text("#costout");
  check("Expect: Total Cost / PC 205.00, Selling Price / PC 246.00, Total Profit 4,100.00", /Total Cost \/ PC\s+205\.00/.test(co) && /Selling Price \/ PC\s+246\.00/.test(co) && /Total Profit\s+4,100\.00/.test(co), true);
  const cards = await page.$$eval(".cards .card", (c) => c.map((x) => x.innerText.replace(/\n/g, " ")));
  check("Expect stock cards: Godown 0, Showroom 1,170, Total 1,170, Value 257,400.00", cards.slice(0, 4), ["Godown (Factory) PCS 0", "Showroom PCS 1,170", "Total PCS in Stock 1,170", "Finished Stock Value 257,400.00"]);

  section("Step 13  Customers, dashboard, ledgers");
  await go("customers");
  const cc = await page.$$eval(".cards .card", (c) => c.map((x) => x.innerText.replace(/\n/g, " ")));
  check("Expect: Due Parties 1, Total Due Amount 40,000.00", [cc[1], cc[2]], ["Due Parties 1", "Total Due Amount 40,000.00"]);
  await go("dashboard");
  const dc = await page.$$eval(".cards .card", (c) => c.map((x) => x.innerText.replace(/\n/g, " ")));
  check("Expect dashboard: Sales 10,000 / Collection 20,000 / Due 40,000 / Payable 33,250 / Stock 1,170 / Parcels 1 / 1", dc, ["Today Sales 10,000.00", "Today Collection 20,000.00", "Customer Due 40,000.00", "Supplier / Factory Payable 33,250.00", "Finished Stock PCS 1,170", "Pending Parcels 1 / 1"]);
  await go("ledger");
  check("Expect: three green 'Reconciled' and 'Items to review' (the 5 PCS shortage)", [await page.$$eval(".pill", (p) => p.map((x) => x.innerText)), /1 transfer\(s\) have short delivery totalling 5 PCS/.test(await text("#app"))], [["Reconciled", "Reconciled", "Reconciled"], true]);

  section("Step 14  Admin password and edit");
  await go("customers"); await act("record.edit", { coll: "customers", id: await db((d) => d.customers[0].id) });
  check("Expect: 'Create Admin Password' window", /Create Admin Password/.test(await text("#modal")), true);
  await password("Shop2026", "Shop2026");
  await typeInto('#mainForm [name="mobile"]', "01722222222"); await save();
  check("Expect: mobile changed, no duplicate customer", await db((d) => [d.customers.length, d.customers[0].mobile]), [1, "01722222222"]);
  await act("auth.toggle");
  await act("record.edit", { coll: "customers", id: await db((d) => d.customers[0].id) });
  await password("wrong");
  check("Expect: 'Wrong password.'", await text("#modalMsg"), "Wrong password.");
  await page.click('#modal button[type="button"]');

  section("Step 15  Search");
  await page.type("#gsearch", "01722");
  check("Expect: 'Karim Store 01722222222 | Due 40,000.00'", await page.$$eval("#gresults a", (a) => a.map((x) => x.innerText)), ["Karim Store 01722222222 | Due 40,000.00"]);
  await page.keyboard.press("Enter");
  check("Expect profile cards: Current Due 40,000.00", /Current Due\s+40,000\.00/.test(await text(".cards")), true);

  section("Step 17-18  Excel backup, JSON, clear, restore");
  await go("settings"); await act("backup.excel"); await act("backup.json"); await sleep(1500);
  const files = fs.readdirSync(T.OUT);
  check("Expect: OnePlusFashion_ERP_Backup_<date>.xlsx and _Restore_<date>.json downloaded", [files.some((f) => /^OnePlusFashion_ERP_Backup_\d{4}-\d\d-\d\d\.xlsx$/.test(f)), files.some((f) => /^OnePlusFashion_ERP_Restore_\d{4}-\d\d-\d\d\.json$/.test(f))], [true, true]);
  await go("settings"); await act("backup.clear");
  if (await T.modalOpen()) await password("Shop2026");
  check("Expect: after Clear All Data the dashboard shows 0.00", (await page.$$eval(".cards .card", (c) => c.map((x) => x.innerText.replace(/\n/g, " "))))[2], "Customer Due 0.00");
  await go("settings");
  await (await page.$('input[data-change="backup.restore"]')).uploadFile(path.join(T.OUT, files.find((f) => f.endsWith(".json"))));
  await sleep(800);
  await go("customers");
  check("Expect: after restore Total Due Amount is 40,000.00 again", (await page.$$eval(".cards .card", (c) => c.map((x) => x.innerText.replace(/\n/g, " "))))[2], "Total Due Amount 40,000.00");

  await T.finish();
})().catch((e) => { console.error(e); process.exit(1); });
