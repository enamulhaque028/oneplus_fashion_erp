/* Edge cases: several showrooms, kg units, long invoices, Bangla text, keyboard-only entry,
   advances, supplier/factory vouchers, validation rules, admin timeout, HTML escaping.
   Run:  node edge.test.js   (options: see lib.js) */
const path = require("path");
const fs = require("fs");
const { execFileSync } = require("child_process");
const { start, sleep } = require("./lib");

(async () => {
  const T = await start("edge");
  const { page, alerts, confirms, check, section, go, db, text, fill, submit, act, password, popup, setItems } = T;
  await T.open();
  await T.reset();
  const calc = () => text("#calc");

  /* ---------- master data ---------- */
  await go("factories"); await fill({ name: "Star Garments", rate: 20 }); await submit();
  const fid = await db((d) => d.factories[0].id);
  await go("products"); await fill({ style: "S1", name: "Shirt", cost: 200, price: 300 }); await submit();
  await go("production"); await fill({ style: "S1", color: "Blue", size: "L", factory: fid, accepted: 500 }); await submit();
  await go("transfer"); await fill({ from: fid, to: "Owner Permanent Shop", style: "S1", color: "Blue", size: "L", dispatched: 100, received: 100 }); await submit();

  section("Several showrooms");
  await go("transfer"); await fill({ from: fid, to: "Shop B (Mirpur)", style: "S1", color: "Blue", size: "L", dispatched: 50, received: 50 }); await submit();
  check("new showroom added to the location list", await db((d) => d.showrooms.map((s) => s.name)), ["Owner Permanent Shop", "Shop B (Mirpur)"]);
  await go("customers"); await fill({ name: "Mirpur Traders", mobile: "01900000001", credit: 1000 }); await submit();
  const c1 = await db((d) => d.customers[0].id);
  await go("sales"); await fill({ customer: c1, location: "Shop B (Mirpur)" }); await setItems([{ style: "S1", color: "Blue", size: "L", qty: 20, rate: 300 }]); await submit();
  const shop = await page.evaluate(() => { const st = OPF.stock.finished(); return Object.keys(st.shop).map((k) => [st.names[k][0], st.shop[k]]); });
  check("sale reduces only the chosen showroom", shop, [["Owner Permanent Shop", 100], ["Shop B (Mirpur)", 30]]);
  await go("costing");
  check("stock summary shows showroom breakdown", /Owner Permanent Shop: 100 PCS \| Shop B \(Mirpur\): 30 PCS/.test(await text("#app")), true);

  section("Stock warnings can be cancelled");
  await go("sales"); await fill({ customer: c1, location: "Shop B (Mirpur)" }); await setItems([{ style: "S1", color: "Blue", size: "L", qty: 40, rate: 300 }]);
  check("live warning shows the shortage", /S1 \/ BLUE \/ L: need 40, in stock 30/.test(await calc()), true);
  T.answerConfirms(false); await submit(); T.answerConfirms(true);
  check("cancelling the stock warning does not save", [confirms.pop().startsWith("Not enough stock at Shop B (Mirpur)"), await db((d) => d.sales.length)], [true, 1]);

  section("Credit limit");
  await go("customers");
  check("customer over credit limit is flagged", /Over limit/.test(await text("#app")), true);

  section("Fabric bought in kg");
  await go("suppliers"); await fill({ name: "Knit Yarn Co" }); await submit();
  const sid = await db((d) => d.suppliers[0].id);
  await go("purchase"); await fill({ supplier: sid, material: "Rib Knit", color: "White", qty: 50, unit: "Kg", rate: 400 }); await submit();
  await go("materials");
  check("kg material listed separately, not in yards", /Materials not measured in yards[\s\S]*Rib Knit\s+White\s+50 Kg/.test(await text("#app")), true);
  await go("issue"); await fill({ material: "Rib Knit", color: "White", qty: 10, unit: "Kg", style: "S1" });
  check("issue form explains kg has no yard check", /Yard \/ Meter only/.test(await calc()), true);
  await submit();
  check("kg balance after issue", await page.evaluate(() => OPF.stock.raw().find((x) => x.material == "Rib Knit").other), { Kg: 40 });
  await go("issue"); await fill({ material: "Cotton", color: "Red", qty: 5, unit: "Yard", style: "S1" });
  T.answerConfirms(false); await submit(); T.answerConfirms(true);
  check("issuing fabric that is not in stock asks first; cancel keeps it unsaved", [/Only 0 yd of Cotton \/ Red/.test(confirms.pop()), await db((d) => d.issues.length)], [true, 1]);

  section("Validation rules");
  await go("transfer"); await fill({ from: fid, style: "S1", color: "Blue", size: "L", dispatched: 10, received: 12 }); await submit();
  check("received more than dispatched is rejected", alerts.pop(), "Received quantity cannot be more than dispatched quantity.");
  await go("sales"); await fill({ customer: c1, discount: 99999 }); await setItems([{ style: "S1", color: "Blue", size: "L", qty: 1, rate: 300 }]); await submit();
  check("discount above subtotal is rejected", alerts.pop(), "Discount cannot be more than the subtotal.");
  await go("courier"); await fill({ cod: 1000, advance: 1500 }); await submit();
  check("advance above COD is rejected", alerts.pop(), "Advance cannot be more than the COD amount.");
  await go("payments"); await act("payments.collect", { id: c1 }); await fill({ amount: 0 }); await submit();
  check("zero payment is blocked by the form", await db((d) => d.payments.length), 0);
  await go("returns"); await fill({ invoice: "INV-00001" }); await fill({ qty: 25 });
  check("return above sold quantity warns", /Return qty is more than the sold qty/.test(await calc()), true);

  section("Customer advance (paid more than due)");
  await go("payments"); await act("payments.collect", { id: c1 }); await page.$eval('[name="print"]', (e) => (e.checked = false));
  await fill({ amount: 7000 }); await submit();
  check("balance becomes advance", await page.evaluate((id) => OPF.ledger.balance("Customer", id), c1), -1000);
  await go("customers");
  const cards = await page.$$eval(".cards .card", (c) => c.map((x) => x.innerText.replace(/\n/g, " ")));
  check("advance customer counted as cash party; advance card", [cards[1], cards[3], cards[4]], ["Due Parties 0", "Cash Parties (no due) 1", "Customer Advance 1,000.00"]);
  check("advance shown as '(Advance)'", /1,000\.00 \(Advance\)/.test(await text(".cols2")), true);

  section("Supplier and factory payments");
  await go("payments"); await act("payments.collect", { type: "Supplier", id: sid }); await fill({ amount: 5000 });
  check("supplier breakdown: bill 20,000 today", /Today's Bill\s+20,000\.00/.test(await calc()) && /Remaining Due\s+15,000\.00/.test(await calc()), true);
  const vp = popup(); await submit(); const voucher = await vp;
  check("supplier payment prints a PAYMENT VOUCHER", /Payment Voucher[\s\S]*Paid To[\s\S]*Knit Yarn Co \(Supplier\)/i.test(await voucher.evaluate(() => document.body.innerText)), true);
  await voucher.close();
  await go("payments"); await act("payments.collect", { type: "Factory", id: fid }); await page.$eval('[name="print"]', (e) => (e.checked = false));
  await fill({ amount: 4000 }); await submit();
  check("factory payable = 500 PCS x 20 - 4,000", await page.evaluate((id) => OPF.ledger.balance("Factory", id), fid), 6000);

  section("Same-day invoices and date ranges");
  await go("customers"); await fill({ name: "Day Shop", previousDue: 1000 }); await submit();
  const c2 = await db((d) => d.customers.find((c) => c.name == "Day Shop").id);
  for (const rate of [100, 200]) { await go("sales"); await fill({ customer: c2 }); await setItems([{ style: "S1", color: "Blue", size: "L", qty: 1, rate }]); await submit(); }
  const second = await db((d) => d.sales[d.sales.length - 1].id);
  check("2nd invoice today shows 1st invoice in Previous Due", await page.evaluate((id) => OPF.ledger.invoicePreviousDue(OPF.store.byId("sales", id)), second), 1100);
  await page.evaluate((c2) => { const s = OPF.store.db.sales.find((x) => x.customer == c2); s.date = "2026-01-15"; OPF.store.save(); }, c2);
  await go("customers"); await page.$eval("#dueFrom", (e) => (e.value = "2026-02-01")); await act("customers.dueReport");
  const range = await text("#dueOut");
  check("invoice outside the date range is excluded", /2026-01-15/.test(range), false);
  await page.$eval("#dueFrom", (e) => (e.value = "2026-01-01")); await page.$eval("#dueTo", (e) => (e.value = "2026-01-31")); await act("customers.dueReport");
  check("party due 'as on' 31 Jan counts only Jan transactions", /Day Shop[\s\S]*1,100\.00/.test(await text("#dueOut")) && !/1,300\.00/.test(await text("#dueOut")), true);

  section("Long invoice (40 lines) prints on several pages");
  await go("sales"); await fill({ customer: c1, location: "Owner Permanent Shop" });
  for (let i = 3; i < 40; i++) await act("sales.addItem");
  await setItems(Array.from({ length: 40 }, (_, i) => ({ style: "S1", color: "Blue", size: "L", qty: 1, rate: 10 + i })));
  const lp = popup(); await act("sales.savePrint"); const longInv = await lp;
  check("all 40 lines printed", await longInv.$$eval(".mitems tbody tr", (r) => r.length), 41);
  const pdf = await longInv.pdf({ format: "A4", printBackground: true });
  // A4 printable height is 297 - 16 mm margins = 281 mm, about 1062 CSS px; the saved PDF is kept for inspection.
  const pages = Math.ceil((await longInv.evaluate(() => document.documentElement.scrollHeight)) / 1062);
  fs.writeFileSync(path.join(T.OUT, "long_invoice.pdf"), pdf);
  check("long invoice spans 2+ A4 pages", pages >= 2, true);
  check("total and signatures on the last page", /One Thousand One Hundred Eighty Taka Only/.test(await longInv.evaluate(() => document.body.innerText)), true);
  await longInv.close();

  section("Bangla text");
  const bn = "রহিম বস্ত্রালয়";
  await go("customers"); await fill({ name: bn, mobile: "01555555555", address: "নিউ মার্কেট" }); await submit();
  const cb = await db((d) => d.customers.find((c) => c.mobile == "01555555555").id);
  await go("sales"); await fill({ customer: cb }); await setItems([{ style: "S1", color: "Blue", size: "L", qty: 1, rate: 300 }]);
  const bp = popup(); await act("sales.savePrint"); const bnInv = await bp;
  check("Bangla name and address on the invoice", (await bnInv.evaluate(() => document.body.innerText)).includes(bn) && (await bnInv.evaluate(() => document.body.innerText)).includes("নিউ মার্কেট"), true);
  await bnInv.screenshot({ path: path.join(T.OUT, "invoice_bangla.png") }); await bnInv.close();
  await page.type("#gsearch", "রহিম");
  check("search finds Bangla name", await page.$$eval("#gresults a b", (b) => b.map((x) => x.textContent)), [bn]);
  await page.evaluate(() => { document.getElementById("gsearch").value = ""; document.getElementById("gresults").style.display = "none"; });
  await go("reports"); await act("backup.csv", { sheet: "Sales Invoices" }); await act("backup.excel"); await sleep(1500);
  const csvFile = fs.readdirSync(T.OUT).find((f) => f.endsWith(".csv"));
  const csv = fs.readFileSync(path.join(T.OUT, csvFile), "utf8");
  check("CSV has UTF-8 BOM (Excel shows Bangla) and the name", [csv.charCodeAt(0) == 0xfeff, csv.includes(bn)], [true, true]);
  const xlsxFile = fs.readdirSync(T.OUT).find((f) => f.endsWith(".xlsx"));
  let excelName = "";
  const py = process.env.PYTHON || path.join(__dirname, "..", "..", "venv", "bin", "python");
  try {
    excelName = execFileSync(fs.existsSync(py) ? py : "python3", ["-c", "import openpyxl,sys;ws=openpyxl.load_workbook(sys.argv[1])['Customers'];print([r[0].value for r in ws.iter_rows(min_row=2)][-1])", path.join(T.OUT, xlsxFile)], { encoding: "utf8" }).trim();
  } catch (e) { excelName = "openpyxl not available: " + e.message.split("\n")[0]; }
  check("Excel file keeps the Bangla name", excelName, bn);

  section("Keyboard-only entry (typing, Tab, Enter)");
  await go("expenses");
  await page.focus('[name="category"]');
  await page.keyboard.type("Electricity");
  await page.keyboard.press("Tab"); await page.keyboard.type("2450.75");
  await page.keyboard.press("Tab"); await page.keyboard.press("Tab"); await page.keyboard.type("Factory");
  await page.keyboard.press("Enter");
  check("expense saved from keyboard (category, decimal amount, location)", await db((d) => { const e = d.expenses[0]; return [e.category, e.amount, e.location]; }), ["Electricity", 2450.75, "Factory"]);
  await go("sales");
  await page.select('[name="customer"]', c1);
  await page.click("#items tr.item:first-child [data-k='style']"); await page.keyboard.type("S1");
  await page.keyboard.press("Tab"); await page.keyboard.type("Blue");
  await page.keyboard.press("Tab"); await page.keyboard.type("L");
  await page.keyboard.press("Tab"); await page.keyboard.type("3");
  await page.keyboard.press("Tab"); await page.keyboard.press("Backspace"); await page.keyboard.press("Backspace"); await page.keyboard.press("Backspace"); await page.keyboard.type("310");
  check("typed item row updates amount and totals live", [await page.$eval("#items tr.item:first-child .amt", (e) => e.textContent), /Total Amount\s+930\.00/.test(await calc())], ["930.00", true]);
  await T.typeInto('[name="paid"]', "930");
  await page.click('#mainForm button:not([type="button"])');
  check("keyboard sale saved as cash", await db((d) => { const s = d.sales[d.sales.length - 1]; return [s.items[0].qty, s.items[0].rate, s.paid]; }), [3, 310, 930]);

  section("Admin session and protected records");
  await go("customers"); await act("record.edit", { coll: "customers", id: c1 }); await password("admin99", "admin99");
  await T.go("customers");
  await page.evaluate(() => { const real = Date.now; Date.now = () => real() + 16 * 60000; });
  await act("record.edit", { coll: "customers", id: c1 });
  check("admin locks again after 15 minutes", /Admin Authorization/.test(await text("#modal")), true);
  await password("admin99");
  await go("productionOrder"); await fill({ style: "S1", planned: 10, factory: fid }); await submit();
  const oid = await db((d) => d.productionOrders[0].id);
  await go("production"); await fill({ order: oid }); await fill({ accepted: 5 }); await submit();
  await go("productionOrder"); await act("record.delete", { coll: "productionOrders", id: oid });
  check("production order used by production cannot be deleted", [alerts.pop().startsWith("This record is linked"), await db((d) => d.productionOrders.length)], [true, 1]);
  await page.evaluate(() => { OPF.auth.lock(); });
  await go("courier"); await fill({ customer: c1, cod: 500, status: "Sent" }); await submit();
  await page.evaluate(() => { const s = document.querySelector('select[data-change="courier.status"]'); s.value = "Delivered"; s.dispatchEvent(new Event("change", { bubbles: true })); });
  await page.click('#modal button[type="button"]');
  check("cancelling the password keeps courier status unchanged", await db((d) => d.courier[0].status), "Sent");

  section("User input is shown as text, never run as code");
  const evil = '<img src=x onerror="window.__hacked=1">Evil & Co';
  await go("customers"); await fill({ name: evil }); await submit();
  await go("customers"); await go("payments"); await go("sales");
  const ep = popup(); await page.evaluate(() => OPF.print.preview()); const prev = await ep; await prev.close();
  check("HTML in names is escaped everywhere", [await page.evaluate(() => !!window.__hacked), (await page.$$eval("select[name=customer] option", (o) => o.map((x) => x.textContent))).some((t) => t.startsWith("<img"))], [false, true]);

  section("UI shell: sidebar, header, theme, dashboard charts");
  await go("courier");
  check("every menu page appears exactly once in the grouped sidebar", await page.evaluate(() => {
    const ids = Array.from(document.querySelectorAll('#nav .menu a.item')).map((b) => b.dataset.page).sort();
    return [ids.length, ids.join() == OPF.config.MENU.map((m) => m[0]).sort().join()];
  }), [22, true]);
  check("the current page's group is open and the page highlighted", await page.evaluate(() => [document.querySelector("#nav .grp.open .on").dataset.page, document.getElementById("pageTitle").textContent]), ["courier", "SalesCourier / Delivery"]);
  await act("nav.group", { group: "1" });
  check("clicking a group opens it", await page.$eval('#nav [data-group="1"]', (b) => b.parentNode.classList.contains("open")), true);
  await page.type("#navSearch", "ledg");
  check("menu search filters the pages", await page.$$eval('#nav .menu a.item', (b) => b.map((x) => x.dataset.page)), ["ledger"]);
  await page.$eval("#navSearch", (e) => { e.value = ""; e.dispatchEvent(new Event("input", { bubbles: true })); });
  await page.click('[data-theme-set="dark"]');
  await page.reload();
  check("dark theme is remembered after reload, in its own key", await page.evaluate(() => [document.documentElement.getAttribute("data-theme"), JSON.parse(localStorage.getItem("opf_erp_ui")).theme, !("theme" in OPF.store.db)]), ["dark", "dark", true]);
  await page.click('[data-theme-set="light"]');
  await page.click(".top .iconbtn");
  check("menu button collapses the sidebar to icons", await page.evaluate(() => document.body.classList.contains("nav-collapsed")), true);
  await page.click(".top .iconbtn");
  await go("dashboard");
  await page.select('select[data-change="dashboard.period"]', "all");
  const allSales = await db((d) => d.sales.length);
  check("dashboard period 'All Time' counts every invoice", await page.$eval(".stat .cnt", (e) => +e.textContent), allSales);
  check("cost breakdown ring and trend line are drawn", await page.evaluate(() => [!!document.querySelector(".donut svg"), document.querySelectorAll(".chart-wrap .ln").length]), [true, 3]);
  await page.$eval(".chart-wrap[data-chart]", (e) => e.scrollIntoView({ block: "center" })); // the mouse only reaches what is on screen
  const tb = await (await page.$(".chart-wrap[data-chart] svg")).boundingBox();
  await page.mouse.move(tb.x + tb.width * 0.97, tb.y + tb.height * 0.5);
  check("hovering the trend shows a tooltip with today's figures", await page.evaluate(() => { const t = document.querySelector(".chart-tip"); return [t.style.display, /Sales/.test(t.textContent) && /Purchases/.test(t.textContent)]; }), ["block", true]);
  await act("dashboard.chart", { type: "bar" });
  check("bar view draws bars", await page.evaluate(() => document.querySelectorAll(".chart-wrap .br").length > 0), true);
  await act("dashboard.chart", { type: "table" });
  check("table view lists 30 days", await page.$$eval(".dash2 .table tbody tr", (r) => r.length), 30);
  check("chart colours use style (var() is ignored in SVG attributes)", await page.evaluate(() => document.querySelectorAll('svg [fill^="var("], svg [stroke^="var("]').length), 0);

  section("Page navigation: real links, address bar, Back / Forward, new tabs");
  await page.evaluate(() => { location.hash = "#/dashboard"; });
  await sleep(200);
  check("every sidebar item is a link to its page (right-click -> open in new tab)", await page.evaluate(() =>
    OPF.config.MENU.every(([id]) => !!document.querySelector(`#nav a.item[href="#/${id}"]`)) && !document.querySelector('#nav a.item[data-act]')), true);
  // Click a sidebar link like a person: open its group first when the link is hidden.
  async function navClick(id, modifier) {
    const sel = `#nav a.item[href="#/${id}"]`;
    if (!(await page.$eval(sel, (e) => e.offsetParent !== null))) {
      const gi = await page.evaluate((id) => OPF.config.NAV_GROUPS.findIndex((g) => g[3].indexOf(id) >= 0), id);
      await page.click(`#nav [data-group="${gi}"]`);
    }
    if (modifier) await page.keyboard.down(modifier);
    await page.click(sel);
    if (modifier) await page.keyboard.up(modifier);
    await sleep(150);
  }
  const hereIs = () => page.evaluate(() => [location.hash, document.querySelector("#app h1").textContent, document.title]);
  await navClick("suppliers");
  check("clicking a sidebar link opens the page and changes the address and tab title", await hereIs(), ["#/suppliers", "Supplier / Fabric Party", "Suppliers · One Plus Fashion ERP"]);
  await navClick("customers");
  const cust = await db((d) => d.customers.find((c) => c.name == "Mirpur Traders"));
  await page.click(`a[href="#/customer/${cust.id}"]`); await sleep(150);
  check("customer name links open the profile with its own address", await hereIs(), [`#/customer/${cust.id}`, "Mirpur Traders", "Mirpur Traders · One Plus Fashion ERP"]);
  await page.goBack(); await sleep(150);
  check("Back returns to the previous page", (await hereIs())[0], "#/customers");
  await page.goBack(); await sleep(150);
  check("Back again returns to the page before", (await hereIs()).slice(0, 2), ["#/suppliers", "Supplier / Fabric Party"]);
  await page.goForward(); await sleep(150);
  check("Forward works too", (await hereIs())[0], "#/customers");
  await page.evaluate(() => OPF.pages.payments.collect("Customer", OPF.store.db.customers[0].id)); await sleep(100);
  await page.goBack(); await sleep(150);
  check("pages opened by buttons (Collect) are in the history as well", (await hereIs())[0], "#/customers");

  const tab = await T.browser.newPage();
  await tab.goto(T.APP + `#/customer/${cust.id}`); await sleep(400);
  check("a customer link opened in a new tab shows that customer (same saved data)", await tab.evaluate(() => [document.querySelector("#app h1").textContent, document.querySelector("#nav a.item.on").dataset.page]), ["Mirpur Traders", "customers"]);
  const sup = await db((d) => d.suppliers[0]);
  await tab.goto(T.APP + `#/statement/Supplier/${sup.id}`); await sleep(400);
  check("supplier statement links work in a new tab", await tab.evaluate(() => document.querySelector("#app h1").textContent.indexOf("Supplier statement") > 0), true);
  await tab.goto(T.APP + "#/no-such-page"); await sleep(400);
  check("an unknown address falls back to the dashboard and corrects the address", await tab.evaluate(() => [location.hash, document.querySelector("#app h1").textContent]), ["#/dashboard", "Dashboard"]);
  await tab.goto(T.APP + "#/statement/Nonsense/x1"); await sleep(400);
  check("a broken statement link opens the Ledgers page instead of failing", await tab.evaluate(() => location.hash), "#/ledger");
  await tab.close();

  await navClick("suppliers");
  const before = await page.evaluate(() => history.length);
  // The ERP must leave modified clicks to the browser: record whether anything cancelled the click.
  await page.evaluate(() => { window.__prevented = null; window.addEventListener("click", (e) => { window.__prevented = e.defaultPrevented; }, { once: true }); });
  const opened = new Promise((res) => T.browser.once("targetcreated", (t) => res(t.url())));
  await navClick("expenses", process.platform == "darwin" ? "Meta" : "Control");
  const newTabUrl = await Promise.race([opened, sleep(3000).then(() => "")]);
  check("Ctrl / Cmd-click is left to the browser and this tab stays put", [await page.evaluate(() => window.__prevented), await page.evaluate(() => location.hash), await page.evaluate(() => history.length) == before], [false, "#/suppliers", true]);
  // Classic headless (used for Chromium 109) has no tabs to open, so only check the new tab where it can exist.
  if (!process.env.OLD_BROWSER) check("Ctrl / Cmd-click opens the page in a new tab", /#\/expenses$/.test(newTabUrl), true);
  await page.type('#mainForm [name="name"]', "Half typed");
  await navClick("suppliers");
  check("clicking the current page's link redraws it (clears the form)", await page.$eval('#mainForm [name="name"]', (e) => e.value), "");

  await T.finish();
})().catch((e) => { console.error(e); process.exit(1); });
