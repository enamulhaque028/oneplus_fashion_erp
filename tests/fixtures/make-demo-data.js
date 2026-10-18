/* Builds demo data for trying the ERP: about 4 months of a wholesale garment business, ending today.
   Writes tests/fixtures/OnePlusFashion_Demo_Data.json - import it with Settings / Backup ->
   "Restore from .json".

   How it stays consistent: the business is simulated day by day, so fabric is bought before it is
   issued, garments are produced before they are transferred, and only showroom stock is sold. The
   result is then loaded into the real ERP (headless Chrome), which fills in receipt figures with its
   own ledger, runs the reconciliation audit and renders every page; any problem aborts the build.

   Run:  cd tests && node fixtures/make-demo-data.js        (deterministic: same day -> same data) */
const path = require("path");
const fs = require("fs");
const { start, sleep } = require("../lib");

const OUT_FILE = path.join(__dirname, "OnePlusFashion_Demo_Data.json");
const DAYS = 120;
const MAIN = "Owner Permanent Shop", OUTLET = "Gazipur Outlet";

/* ---------- helpers ---------- */
let seed = 20261018;
function rnd() { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const between = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (list) => list[Math.floor(rnd() * list.length)];
const chance = (p) => rnd() < p;
const round = (v, step) => Math.round(v / step) * step;
const pad = (n, w) => String(n).padStart(w, "0");
function dayISO(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}
let clock = 0; // keeps created stamps unique and in order within a day
const stamp = (date) => `${date}T${pad(9 + Math.floor(clock / 60) % 10, 2)}:${pad(clock++ % 60, 2)}:00.000Z`;
let idn = 0;
const id = (p) => p + (++idn).toString(36);

/* ---------- master data ---------- */
const PRODUCTS = [
  ["OPF-101", "Men Polo T-Shirt", "Cotton Pique", 1.3, 220, 300, ["Black", "Navy"], ["M", "L", "XL"]],
  ["OPF-102", "Men Basic T-Shirt", "Single Jersey", 1.0, 150, 210, ["White", "Grey"], ["M", "L", "XL"]],
  ["OPF-201", "Men Formal Shirt", "Oxford Cotton", 1.8, 380, 520, ["Sky Blue", "White"], ["M", "L", "XL"]],
  ["OPF-301", "Men Denim Jeans", "Denim 12oz", 1.4, 520, 720, ["Blue", "Black"], ["30", "32", "34"]],
  ["OPF-401", "Ladies Kurti", "Viscose Rayon", 2.2, 340, 470, ["Maroon", "Teal"], ["M", "L", "XL"]],
  ["OPF-501", "Hoodie", "Fleece", 1.9, 480, 680, ["Black", "Olive"], ["M", "L", "XL"]],
  ["OPF-601", "Panjabi", "Cotton Voile", 2.5, 450, 650, ["Off White", "Cream"], ["40", "42", "44"]],
  ["OPF-701", "Kids T-Shirt", "Single Jersey", 0.6, 90, 140, ["Red", "Yellow"], ["4-5Y", "6-7Y", "8-9Y"]]
];
// fabric -> [supplier index, rate per unit, unit]; Viscose is bought in metres (converted to yards by the ERP)
const FABRIC = { "Cotton Pique": [0, 165, "Yard"], "Single Jersey": [1, 110, "Yard"], "Oxford Cotton": [3, 210, "Yard"], "Denim 12oz": [2, 290, "Yard"], "Viscose Rayon": [3, 150, "Meter"], "Fleece": [4, 260, "Yard"], "Cotton Voile": [0, 175, "Yard"] };
const SUPPLIERS = [["Rahim Fabrics", "Rahim Textile Ltd.", "Islampur, Dhaka"], ["Bengal Knit Ltd.", "Bengal Knit", "Narayanganj"], ["Dhaka Denim Mills", "DDM", "Savar, Dhaka"], ["Narsingdi Textile", "NT Weaving", "Narsingdi"],
  ["Fleece World", "Fleece World BD", "Gazipur"], ["Gazipur Accessories", "GA Trims", "Gazipur"], ["PackPro Packaging", "PackPro", "Tejgaon, Dhaka"], ["Square Yarn Traders", "Square Yarn", "Chattogram"]];
const FACTORIES = [["Star Garments", 25, "Tongi, Gazipur"], ["Tongi Stitching House", 22, "Tongi, Gazipur"], ["Ashulia Apparels", 30, "Ashulia, Savar"], ["Mirpur Sewing Unit", 28, "Mirpur, Dhaka"], ["Savar Knit Factory", 18, "Savar, Dhaka"]];
const CUSTOMERS = [["Karim Store", "Bongo Bazar", "Dhaka"], ["Mirpur Traders", "Mirpur-10", "Dhaka"], ["Bongo Fashion", "Bongo Bazar", "Dhaka"], ["Tongi Mart", "Station Road, Tongi", "Gazipur"], ["Rahman Cloth House", "New Market", "Dhaka"],
  ["Dhaka Style", "Gulistan", "Dhaka"], ["Chittagong Garments Hub", "Reazuddin Bazar", "Chattogram"], ["Sylhet Fashion Point", "Zindabazar", "Sylhet"], ["Khulna Trend", "Boro Bazar", "Khulna"], ["Rajshahi Dress Gallery", "Shaheb Bazar", "Rajshahi"],
  ["Barishal Bazar Fashion", "Chawk Bazar", "Barishal"], ["Comilla Collection", "Kandirpar", "Cumilla"], ["Narayanganj Wholesale", "Tanbazar", "Narayanganj"], ["Gazipur Outfit", "Chowrasta", "Gazipur"], ["Savar Cloth Corner", "Savar Bazar", "Dhaka"],
  ["Uttara Style Zone", "Sector 7, Uttara", "Dhaka"], ["Mohammadpur Fashion", "Town Hall", "Dhaka"], ["Feni Garments", "Trunk Road", "Feni"], ["Bogura Fashion House", "Satmatha", "Bogura"], ["Mymensingh Dress Mart", "Ganginar Par", "Mymensingh"],
  ["Rangpur Clothing", "Jahaj Company Mor", "Rangpur"], ["Jessore Fashion", "Doratana", "Jashore"], ["Cox's Bazar Beachwear", "Laboni Point", "Cox's Bazar"], ["নিউ মার্কেট ফ্যাশন", "নিউ মার্কেট", "ঢাকা"], ["রহিম বস্ত্রালয়", "চকবাজার", "ঢাকা"],
  ["Noakhali Traders", "Maijdee", "Noakhali"], ["Tangail Saree & Dress", "Main Road", "Tangail"], ["Pabna Fashion World", "Abdul Hamid Road", "Pabna"]];
const COURIERS = ["Pathao", "Steadfast", "RedX", "Sundarban Courier", "SA Paribahan", "eCourier"];
const METHODS = ["Cash", "Cash", "Cash", "bKash", "Nagad", "Bank", "Cheque"];

/* ---------- simulation ---------- */
function build() {
  const db = {
    version: 6, company: null, auth: { salt: "", hash: "" }, materials: [],
    suppliers: [], purchases: [], issues: [], products: [], productionOrders: [], production: [], factories: [], transfers: [],
    customers: [], sales: [], returns: [], payments: [], expenses: [], courier: [], notes: [],
    showrooms: [{ id: "main", name: MAIN }, { id: "outlet", name: OUTLET }], logs: [],
    users: [{ id: "u1", name: "Administrator", username: "admin", role: "Admin" }]
  };
  const log = (date, action, ref) => db.logs.push({ date: stamp(date), action, ref: ref || "" });
  const day0 = dayISO(-DAYS);

  SUPPLIERS.forEach(([name, company, address], i) => db.suppliers.push({ id: "sup" + i, name, company, mobile: "0181" + pad(1000000 + i * 7311, 7), address, credit: 500000, terms: pick(["15 days", "30 days", "Cash"]), previousDue: i < 3 ? 25000 * (i + 1) : 0, created: stamp(day0) }));
  FACTORIES.forEach(([name, rate, address], i) => db.factories.push({ id: "fac" + i, name, mobile: "0171" + pad(2000000 + i * 5113, 7), address, rate, previousDue: i == 0 ? 15000 : 0, created: stamp(day0) }));
  PRODUCTS.forEach(([style, name, fabric, ypp, cost, price, colors, sizes], i) => {
    const fabricCost = Math.round(ypp * FABRIC[fabric][1]);
    db.products.push({ id: "prd" + i, style, name, image: "", fabric, color: "", size: "", barcode: "8901" + pad(1000 + i * 37, 6), cost, price, retail: Math.round(price * 1.35),
      costing: { fabricYd: ypp, fabricRate: FABRIC[fabric][1], accessories: 15, factory: FACTORIES[i % 5][1], packaging: 6, transport: 4, other: Math.max(0, cost - fabricCost - 15 - FACTORIES[i % 5][1] - 10), margin: Math.round(((price - cost) / cost) * 100), qty: 0 }, created: stamp(day0) });
  });
  CUSTOMERS.forEach(([name, address, district], i) => db.customers.push({ id: "cus" + i, name, mobile: "01" + pick(["7", "8", "9", "5", "6"]) + pad(10000000 + i * 1234567 % 89999999, 8), address, district, credit: pick([0, 100000, 150000, 250000]), previousDue: i % 4 == 0 ? round(between(5000, 60000), 500) : 0, created: stamp(day0) }));

  const raw = {};      // fabric|color -> yards in stock
  const godown = {};   // style|color|size -> pcs at factories (with factory id)
  const shop = {};     // location|style|color|size -> pcs
  const custDue = {};  db.customers.forEach((c) => { custDue[c.id] = c.previousDue; });
  const supDue = {};   db.suppliers.forEach((s) => { supDue[s.id] = s.previousDue; });
  const facDue = {};   db.factories.forEach((f) => { facDue[f.id] = f.previousDue; });
  const pending = [];  // production orders awaiting output: { order, readyDay, ypp }
  const toShip = [];   // finished batches awaiting transfer: { day, prod }
  const no = { po: 0, is: 0, tr: 0, inv: 0, mr: 0, ch: 0, trk: 0 };
  const key = (...p) => p.join("|");

  function buyFabric(date, fabric, color, yardsNeeded) {
    const [si, rate, unit] = FABRIC[fabric];
    const yards = Math.max(round(yardsNeeded * (1.1 + rnd() * 0.4), 50), 500);
    const qty = unit == "Meter" ? round(yards / 1.0936133, 10) : yards;
    const total = qty * rate + 1500;
    const paid = pick([0, round(total * 0.3, 1000), round(total * 0.5, 1000), total]);
    const p = { id: id("pu"), supplier: "sup" + si, date, invoice: "CH-" + pad(++no.ch + 3100, 4), material: fabric, type: "Woven / Knit", color, gsm: pick(["160", "180", "200", "220"]), width: pick(["58\"", "60\"", "72\""]), qty, unit, rate, transport: 1000, loading: 500, other: 0, discount: chance(0.3) ? 1000 : 0, paid, method: paid ? pick(METHODS) : "Cash", remarks: "", created: stamp(date) };
    db.purchases.push(p);
    raw[key(fabric, color)] = (raw[key(fabric, color)] || 0) + (unit == "Meter" ? qty * 1.0936133 : qty);
    supDue[p.supplier] += total - p.discount - paid;
    log(date, "Purchase Created", p.invoice);
  }

  function buyAccessories(date) {
    const si = pick([5, 6, 7]), item = pick(["Buttons", "Zipper", "Poly Bags", "Main Labels", "Rib Knit"]);
    const unit = item == "Rib Knit" ? "Kg" : "Pcs", qty = unit == "Kg" ? between(40, 120) : round(between(2000, 10000), 500), rate = unit == "Kg" ? 420 : pick([0.8, 1.2, 2, 3.5]);
    const total = Math.round(qty * rate) + 300, paid = chance(0.5) ? total : 0;
    db.purchases.push({ id: id("pu"), supplier: "sup" + si, date, invoice: "CH-" + pad(++no.ch + 3100, 4), material: item, type: "Accessories", color: "", gsm: "", width: "", qty, unit, rate, transport: 300, loading: 0, other: 0, discount: 0, paid, method: "Cash", remarks: "", created: stamp(date) });
    supDue["sup" + si] += total - paid;
  }

  for (let off = -DAYS; off <= 0; off++) {
    const date = dayISO(off), dom = +date.slice(8, 10), recent = off > -30;

    // ---- plan production every 4 days: order, issue fabric (buying it first if short) ----
    if ((off + DAYS) % 4 == 0 && off < -2) {
      for (let k = 0; k < between(1, 2); k++) {
        const pi = between(0, PRODUCTS.length - 1), [style, , fabric, ypp] = PRODUCTS[pi];
        const color = pick(PRODUCTS[pi][6]), size = pick(PRODUCTS[pi][7]), fi = between(0, FACTORIES.length - 1);
        const planned = round(between(250, 650), 50), need = Math.ceil(planned * ypp);
        // now and then an order is cancelled before cutting: no fabric issued, no production
        // (the 8th order always is, so the demo shows every order state whatever the random draws)
        if (chance(0.05) || no.po == 7) {
          db.productionOrders.push({ id: id("po"), no: "PO-" + pad(++no.po, 4), date, style, color, size, planned, factory: "fac" + fi, status: "Cancelled", remarks: "Buyer cancelled", created: stamp(date) });
          continue;
        }
        if ((raw[key(fabric, color)] || 0) < need) buyFabric(date, fabric, color, need);
        const order = { id: id("po"), no: "PO-" + pad(++no.po, 4), date, style, color, size, planned, factory: "fac" + fi, status: "Open", remarks: "", created: stamp(date) };
        db.productionOrders.push(order);
        log(date, "Production Order Created", order.no);
        db.issues.push({ id: id("is"), date, slip: "IS-" + pad(++no.is, 4), order: order.id, style, material: fabric, color, qty: need, unit: "Yard", remarks: "Cutting", created: stamp(date) });
        raw[key(fabric, color)] -= need;
        // the newest orders stay in progress / open so the Production Order page shows every state
        pending.push({ order, ypp, readyDay: off + between(5, 9), partial: off > -14 });
      }
    }
    if (dom == 3 || dom == 17) buyAccessories(date);

    // ---- production arrives ----
    for (let i = pending.length - 1; i >= 0; i--) {
      const job = pending[i];
      if (job.readyDay != off) continue;
      pending.splice(i, 1);
      const o = job.order, f = db.factories.find((x) => x.id == o.factory);
      // older orders mostly complete (some a little short or over); the newest are part-delivered
      const accepted = job.partial ? round(o.planned * (0.4 + rnd() * 0.3), 5) : chance(0.65) ? o.planned : round(o.planned * (0.92 + rnd() * 0.12), 5);
      const rejected = between(2, 12), returnedYd = round(between(5, 40), 5);
      const p = { id: id("pr"), date, order: o.id, style: o.style, color: o.color, size: o.size, factory: o.factory, issued: Math.ceil(o.planned * job.ypp), accepted, rejected, wastage: between(0, 6), returned: returnedYd, material: PRODUCTS.find((x) => x[0] == o.style)[2], rate: f.rate, remarks: "", created: stamp(date) };
      db.production.push(p);
      raw[key(p.material, o.color)] = (raw[key(p.material, o.color)] || 0) + returnedYd;
      godown[key(o.style, o.color, o.size)] = (godown[key(o.style, o.color, o.size)] || 0) + accepted;
      facDue[o.factory] += accepted * f.rate;
      toShip.push({ day: off + between(1, 2), prod: p });
      log(date, "Production Entry Created", o.style);
    }

    // ---- ship finished goods to a showroom (occasional short delivery) ----
    for (let i = toShip.length - 1; i >= 0; i--) {
      if (toShip[i].day != off) continue;
      const p = toShip.splice(i, 1)[0].prod, k = key(p.style, p.color, p.size), have = godown[k] || 0;
      if (have <= 0) continue;
      const dispatched = round(have * (0.85 + rnd() * 0.15), 5) || have, received = chance(0.25) ? dispatched - between(1, 6) : dispatched;
      const to = chance(0.7) ? MAIN : OUTLET;
      db.transfers.push({ id: id("tr"), date, reference: "TR-" + pad(++no.tr, 4), from: p.factory, to, style: p.style, color: p.color, size: p.size, dispatched, received, remarks: received < dispatched ? "Short delivery - follow up" : "", created: stamp(date) });
      godown[k] = have - dispatched;
      shop[key(to, p.style, p.color, p.size)] = (shop[key(to, p.style, p.color, p.size)] || 0) + received;
      log(date, "Stock Transfer Created", "TR-" + pad(no.tr, 4));
    }

    // ---- sales (only from stock on hand) ----
    const nSales = off == 0 ? 5 : between(recent ? 2 : 1, recent ? 6 : 4);
    for (let s = 0; s < nSales; s++) {
      const location = chance(0.75) ? MAIN : OUTLET;
      const lines = Object.keys(shop).filter((k) => k.startsWith(location + "|") && shop[k] >= 5);
      if (!lines.length) continue;
      const items = [], used = {};
      for (let j = 0; j < between(1, 4); j++) {
        const k = pick(lines);
        if (used[k]) continue;
        used[k] = 1;
        const [, style, color, size] = k.split("|"), prod = PRODUCTS.find((x) => x[0] == style);
        const qty = Math.min(shop[k], round(between(5, 40), 5) || 5);
        if (qty <= 0) continue;
        items.push({ style, color, size, qty, rate: prod[5] + pick([0, 0, 0, -10, 10, 20]) });
        shop[k] -= qty;
      }
      if (!items.length) continue;
      const c = pick(db.customers), sub = items.reduce((t, i) => t + i.qty * i.rate, 0);
      const discount = chance(0.25) ? round(sub * 0.02, 50) : 0, total = sub - discount;
      const paid = off == 0 && s == 0 ? total : pick([total, total, round(total * 0.5, 500), round(total * 0.3, 500), 0, 0]);
      const sale = { id: id("sa"), date, invoice: "INV-" + pad(++no.inv, 5), customer: c.id, location, method: paid ? pick(METHODS) : "Cash", remarks: chance(0.15) ? "Goods once sold are not returnable." : "", items, discount, paid, created: stamp(date) };
      db.sales.push(sale);
      custDue[c.id] += total - paid;
      log(date, "Sale / Invoice Created", sale.invoice);

      // ---- some due invoices go out by courier as COD ----
      const due = total - paid;
      if (due > 0 && chance(0.3)) {
        const age = -off;
        let status = "Pending", courierPaid = false;
        if (age > 12) { status = pick(["Delivered", "Delivered", "Delivered", "Delivered", "Delivered", "Delivered", "Returned", "In Transit", "Cancelled"]); courierPaid = status == "Delivered" && age > 16 && chance(0.85); }
        else if (age > 3) status = pick(["Sent", "In Transit", "In Transit", "Delivered"]);
        else status = pick(["Pending", "Sent"]);
        const cod = due, courier = pick(COURIERS);
        const parcel = { id: id("cr"), date, invoice: sale.invoice, customer: c.id, destination: c.address + ", " + c.district, courier, tracking: courier.slice(0, 2).toUpperCase() + pad(++no.trk + 50210, 6), cod, status, remarks: chance(0.2) ? pick(["Call before delivery", "Fragile - pack well", "Deliver after 5 pm"]) : "", created: stamp(date) };
        db.courier.push(parcel);
        if (courierPaid) {
          // the courier paid the shop, entered on Payment / Collection a few days later (the parcel record itself never changes dues)
          const payDate = dayISO(off + between(3, 6));
          db.payments.push({ id: id("py"), no: "MR-" + pad(++no.mr, 5), date: payDate, type: "Customer", party: c.id, amount: cod, method: "Bank", reference: "COD " + courier + " " + parcel.tracking, remarks: "Courier paid", created: stamp(payDate) });
          custDue[c.id] -= cod;
        }
      }
    }

    // ---- returns (a few pieces back from a recent invoice) ----
    if (chance(0.08) && db.sales.length > 10) {
      const sale = db.sales[db.sales.length - between(1, 10)], it = pick(sale.items), qty = Math.min(it.qty, between(1, 5));
      db.returns.push({ id: id("rt"), date, invoice: sale.invoice, customer: sale.customer, location: sale.location, style: it.style, color: it.color, size: it.size, qty, amount: qty * it.rate, reason: pick(["Size problem", "Colour mismatch", "Damaged piece", "Stitching fault"]), created: stamp(date) });
      shop[key(sale.location, it.style, it.color, it.size)] += qty;
      custDue[sale.customer] -= qty * it.rate;
    }

    // ---- collections from customers who owe ----
    const owing = db.customers.filter((c) => custDue[c.id] > 2000);
    for (let j = 0; j < (off == 0 ? 3 : between(0, recent ? 3 : 2)) && owing.length; j++) {
      const c = owing.splice(Math.floor(rnd() * owing.length), 1)[0];
      const amount = Math.min(custDue[c.id], round(custDue[c.id] * (0.2 + rnd() * 0.6), 500)) || 1000;
      const method = pick(METHODS);
      db.payments.push({ id: id("py"), no: "MR-" + pad(++no.mr, 5), date, type: "Customer", party: c.id, amount, method, reference: method == "Cash" ? "" : "TRX" + between(100000, 999999), remarks: "", created: stamp(date) });
      custDue[c.id] -= amount;
      log(date, "Payment Created", "MR-" + pad(no.mr, 5));
    }

    // ---- paying suppliers and factories (weekly) ----
    if ((off + DAYS) % 7 == 3) {
      db.suppliers.forEach((s) => {
        if (supDue[s.id] < 10000 || !chance(0.6)) return;
        const amount = round(supDue[s.id] * (0.3 + rnd() * 0.5), 1000);
        db.payments.push({ id: id("py"), no: "MR-" + pad(++no.mr, 5), date, type: "Supplier", party: s.id, amount, method: pick(["Bank", "Cheque", "Cash"]), reference: "PV-" + between(1000, 9999), remarks: "", created: stamp(date) });
        supDue[s.id] -= amount;
      });
      db.factories.forEach((f) => {
        if (facDue[f.id] < 5000 || !chance(0.7)) return;
        const amount = round(facDue[f.id] * (0.4 + rnd() * 0.5), 500);
        db.payments.push({ id: id("py"), no: "MR-" + pad(++no.mr, 5), date, type: "Factory", party: f.id, amount, method: pick(["Cash", "bKash", "Bank"]), reference: "", remarks: "Factory bill payment", created: stamp(date) });
        facDue[f.id] -= amount;
      });
    }

    // ---- expenses ----
    const exp = (category, amount, location, remarks) => db.expenses.push({ id: id("ex"), date, category, amount, method: pick(["Cash", "Bank", "bKash"]), location, remarks: remarks || "", created: stamp(date) });
    if (dom == 1) exp("Salary", 92000, "Office", "Monthly staff salary");
    if (dom == 5) { exp("Rent", 35000, "Shop", MAIN); exp("Rent", 18000, "Shop", OUTLET); }
    if (dom == 10) exp("Electricity", between(7, 13) * 1000, "Factory");
    if (chance(0.45) || off == 0) exp("Transport", round(between(600, 3500), 50), pick(["Factory", "Shop"]), "Goods carrying");
    if (chance(0.2)) exp(pick(["Food", "Maintenance", "Other"]), round(between(300, 2500), 50), pick(["Office", "Shop", "Factory"]));
  }
  db.logs.push({ date: new Date().toISOString(), action: "Demo data loaded", ref: "tests/fixtures/make-demo-data.js" });
  // ---- a few rough notes (formatted text; one with a sketch, stored as strokes on a 1000 x 560 grid) ----
  const jacket = { w: 1000, h: 560, strokes: [
    { c: "#1f2937", s: 3, e: 0, p: [350, 110, 450, 85, 550, 85, 650, 110, 800, 200, 720, 250, 650, 210, 650, 480, 350, 480, 350, 210, 280, 250, 200, 200, 350, 110] },
    { c: "#2563eb", s: 7, e: 0, p: [500, 95, 500, 480] },
    { c: "#dc2626", s: 3, e: 0, p: [560, 300, 620, 300, 620, 360, 560, 360, 560, 300] }
  ] };
  [[-20, "New design idea", "<h3>Winter denim jacket</h3><div>Fabric: <b>12 oz denim</b>, blue and black.</div><ul><li>Ask Rahim Fabrics for the price</li><li><span style=\"color:#dc2626\">Sample ready by the 1st</span></li></ul>",
    "Winter denim jacket\nFabric: 12 oz denim, blue and black.\n• Ask Rahim Fabrics for the price\n• Sample ready by the 1st", jacket, "blue"],
    [-6, "Reminder", "Courier: Steadfast pickup changes to <mark>4 pm</mark> from next week.", "Courier: Steadfast pickup changes to 4 pm from next week.", null, "pink"],
    [-1, "", "Karim Store wants <b>50 pcs</b> of style 1203 next month - keep stock.", "Karim Store wants 50 pcs of style 1203 next month - keep stock.", null, "yellow"]].forEach(([off, subject, html, text, sketch, color]) => {
    const date = dayISO(off);
    db.notes.push({ id: id("nt"), date, subject, html, text, sketch, color, created: stamp(date) });
  });

  return db;
}

/* ---------- verify with the real ERP and write the file ---------- */
(async () => {
  const draft = build();
  const T = await start("demo_data");
  const { page, check, section, alerts } = T;
  await T.open();
  await page.evaluate((d) => localStorage.setItem("opf_erp_smart_v3", JSON.stringify(d)), draft);
  await page.reload();

  section("Demo data - loaded into the ERP");
  // Receipt figures are frozen at save time; let the ERP's own ledger compute them, in date order.
  await page.evaluate(() => {
    OPF.store.db.payments.forEach((p) => { p.snap = OPF.ledger.paymentSnapshot(p, p.id); });
    OPF.store.save();
  });
  const report = await page.evaluate(() => {
    const db = OPF.store.db, a = OPF.audit.run(), st = OPF.stock.finished();
    const negFinished = Object.keys(st.godown).filter((k) => st.godown[k] < 0).length + Object.keys(st.shop).filter((k) => st.shop[k] < 0).length;
    const negRaw = OPF.stock.raw().filter((x) => x.yards < -0.01).length;
    const counts = {};
    ["suppliers", "purchases", "issues", "products", "productionOrders", "production", "factories", "transfers", "customers", "sales", "returns", "payments", "expenses", "courier", "notes", "logs"].forEach((k) => { counts[k] = db[k].length; });
    const statuses = {}; db.productionOrders.forEach((o) => { const s = OPF.calc.orderStatus(o, OPF.calc.orderActual(o)); statuses[s] = (statuses[s] || 0) + 1; });
    const parcels = {}; db.courier.forEach((c) => { parcels[c.status] = (parcels[c.status] || 0) + 1; });
    return { checks: a.checks.map((c) => c.ok), orphanIssues: a.issues.filter((x) => /not linked/.test(x)), negFinished, negRaw, counts, statuses, parcels, today: db.sales.filter((s) => s.date == OPF.util.today()).length };
  });
  check("all three ledgers reconcile", report.checks, [true, true, true]);
  check("every transaction belongs to a party", report.orphanIssues, []);
  check("no negative finished or raw stock", [report.negFinished, report.negRaw], [0, 0]);
  check("sales today (dashboard 'Today' has data)", report.today > 0, true);
  check("production orders in every state", ["Completed", "In Progress", "Open", "Cancelled"].every((s) => report.statuses[s] > 0), true);
  console.log("  counts:", JSON.stringify(report.counts));
  console.log("  orders:", JSON.stringify(report.statuses), " parcels:", JSON.stringify(report.parcels));

  const broken = await page.evaluate(() => OPF.config.MENU.filter(([id]) => { try { OPF.router.go(id); return /ERP error/.test(document.getElementById("app").textContent); } catch (e) { return true; } }).map((m) => m[0]));
  check("every page renders with the demo data", broken, []);
  await T.go("dashboard");
  await page.setViewport({ width: 1440, height: 900 });
  await page.select('select[data-change="dashboard.period"]', "month");
  await sleep(1200);
  await page.screenshot({ path: path.join(T.OUT, "dashboard_month.png"), fullPage: true });

  const finalDb = await page.evaluate(() => OPF.store.db);
  fs.writeFileSync(OUT_FILE, JSON.stringify(finalDb, null, 2));
  console.log(`  wrote ${path.relative(process.cwd(), OUT_FILE)} (${Math.round(fs.statSync(OUT_FILE).size / 1024)} KB)`);

  section("Demo data - importing through Settings / Backup -> Restore from .json");
  await T.reset();
  await T.go("settings");
  await (await page.$('input[data-change="backup.restore"]')).uploadFile(OUT_FILE);
  await sleep(300);
  if (await T.modalOpen()) await T.password("demo1234", "demo1234");
  await sleep(800);
  check("restore loads every record", await page.evaluate(() => [OPF.store.db.sales.length, OPF.store.db.payments.length, OPF.store.db.customers.length]), [report.counts.sales, report.counts.payments, report.counts.customers]);
  check("no error messages during import", alerts.filter((a) => !/Backup restored/.test(a)), []);
  await T.finish();
})().catch((e) => { console.error(e); process.exit(1); });
