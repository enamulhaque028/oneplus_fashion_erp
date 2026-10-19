/* The hosted link opens without internet (sw.js keeps a copy of the ERP's files).
   Serves the project over http at /oneplus_fashion_erp/ (like GitHub Pages), opens it once online,
   then goes offline and reloads. Run: node offline.test.js */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { start, sleep, ROOT } = require("./lib");

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json", ".json": "application/json" };
const BASE = "/oneplus_fashion_erp/";

(async () => {
  const T = await start("offline");
  const { browser, check, section } = T;
  const newContext = () => (browser.createBrowserContext || browser.createIncognitoBrowserContext).call(browser);
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split("?")[0]);
    if (!p.startsWith(BASE)) { res.writeHead(404); res.end(); return; }
    p = p.slice(BASE.length) || "index.html";
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  }).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const site = `http://127.0.0.1:${server.address().port}${BASE}`;
  const shell = (fs.readFileSync(path.join(ROOT, "sw.js"), "utf8").match(/const SHELL = \[([\s\S]*?)\];/)[1].match(/"[^"]+"/g) || []).length;

  /* ---- a computer already signed in (or Google sign-in switched off): the ERP itself ---- */
  const ctx = await newContext();
  const pg = await ctx.newPage();
  const errors = [];
  pg.on("pageerror", (e) => errors.push(e.message));
  // No sign-in screen for this page: the Google sign-in flag is set off as config.js loads.
  await pg.evaluateOnNewDocument(() => {
    let cfg = null;
    window.OPF = {};
    Object.defineProperty(window.OPF, "config", { configurable: true, get: () => cfg, set: (v) => { cfg = Object.freeze(Object.assign({}, v, { CLOUD: Object.assign({}, v.CLOUD, { ENABLE_GOOGLE_LOGIN: false }) })); } });
  });

  section("First visit online: the ERP's files are saved for offline use");
  await pg.goto(site); await sleep(800);
  check("the ERP opens at the short address", [await pg.evaluate(() => location.pathname), await pg.$eval("#app h1", (h) => h.textContent)], [BASE, "Dashboard"]);
  check("the offline helper is active", await pg.evaluate(() => navigator.serviceWorker.ready.then((r) => !!r.active)), true);
  check("every ERP file is saved", await pg.evaluate(() => caches.open("opf-erp-v1").then((c) => c.keys()).then((k) => k.length)), shell);
  await pg.evaluate(() => { OPF.store.db.customers.push({ id: "offc1", name: "Offline Test Shop", mobile: "01700000999", previousDue: 0 }); OPF.store.save(); });

  section("Install desktop app (hosted link)");
  check("the side menu offers Install desktop app", await pg.evaluate(() => !!document.querySelector('#nav .get-app[data-act="app.install"]')), true);
  await pg.evaluate(() => document.querySelector("#nav .get-app").click()); await sleep(150);
  check("without a browser install prompt: a how-to opens", await pg.evaluate(() => { const d = document.getElementById("appDialog"); return !!d && d.querySelectorAll(".app-steps li").length > 0; }), true);
  await pg.evaluate(() => document.querySelector('[data-act="app.closeHow"]').click());
  await pg.evaluate(() => { const e = new Event("beforeinstallprompt", { cancelable: true }); e.prompt = () => { window.__prompted = (window.__prompted || 0) + 1; }; e.userChoice = Promise.resolve({ outcome: "accepted" }); window.dispatchEvent(e); });
  await pg.evaluate(() => document.querySelector("#nav .get-app").click()); await sleep(200);
  check("with Chrome's install prompt: the button opens it; once installed the card says Uninstall", await pg.evaluate(() => { const g = document.querySelector("#nav .get-app"); return [window.__prompted, g.getAttribute("data-act"), g.textContent.trim()]; }), [1, "app.uninstall", "Uninstall desktop appInstalled on this computer"]);
  await pg.evaluate(() => document.querySelector("#nav .get-app").click()); await sleep(150);
  check("Uninstall shows the browser's steps (a web page cannot uninstall an app itself)", await pg.evaluate(() => { const d = document.getElementById("appDialog"); return [d.querySelector("h2").textContent, /chrome:\/\/apps/.test(d.textContent), /not deleted/.test(d.textContent)]; }), ["Uninstall the desktop app", true, true]);
  await pg.evaluate(() => document.querySelector('[data-act="app.closeHow"]').click());
  await pg.evaluate(() => OPF.router.go("settings"));
  check("Settings / Backup says installed, with Uninstall", await pg.evaluate(() => { const b = document.getElementById("appBox"); return [/installed on this computer/.test(b.textContent), !!b.querySelector('[data-act="app.uninstall"]')]; }), [true, true]);
  // After uninstalling, Chrome offers to install again: the card goes back to Install.
  await pg.evaluate(() => { const e = new Event("beforeinstallprompt", { cancelable: true }); e.prompt = () => {}; e.userChoice = Promise.resolve({ outcome: "dismissed" }); window.dispatchEvent(e); });
  check("after uninstalling (Chrome offers install again) it shows Install again", await pg.evaluate(() => document.querySelector("#nav .get-app").getAttribute("data-act")), "app.install");
  await pg.evaluate(() => OPF.router.go("dashboard"));

  section("No internet: the ERP still opens, with its data");
  await pg.setOfflineMode(true);
  await pg.reload(); await sleep(900);
  check("reload without internet: the dashboard opens", await pg.$eval("#app h1", (h) => h.textContent), "Dashboard");
  await pg.goto(site + "#/customers"); await sleep(700);
  check("typing the address without internet: pages open and the saved data is there", [await pg.$eval("#app h1", (h) => h.textContent), /Offline Test Shop/.test(await pg.$eval("#app", (a) => a.textContent))], ["Customer / Wholesale Party", true]);
  await pg.goto(site + "OnePlusFashion_ERP.html#/notes"); await sleep(700);
  check("the old address works offline too", await pg.$eval("#app h1", (h) => h.textContent), "Rough Notes");
  check("styles are loaded offline", await pg.evaluate(() => getComputedStyle(document.querySelector(".top")).position), "fixed");

  section("Back online: newest files are used again");
  await pg.setOfflineMode(false);
  await pg.reload(); await sleep(800);
  check("online again: the ERP opens normally", await pg.$eval("#app h1", (h) => h.textContent), "Rough Notes");
  check("no JavaScript errors", errors, []);
  await ctx.close();

  /* ---- never signed in on this computer, opened without internet ---- */
  section("Never signed in, no internet: the sign-in screen offers to continue offline");
  const ctx2 = await newContext();
  const p2 = await ctx2.newPage();
  // Google sign-in switched on for this page, whatever config.js says (tests switch it on this way).
  await p2.evaluateOnNewDocument(() => { window.OPF_CLOUD_TEST = { ENABLE_GOOGLE_LOGIN: true }; });
  await p2.goto(site); await sleep(1200);
  await p2.evaluate(() => navigator.serviceWorker.ready);
  await p2.setOfflineMode(true);
  await p2.reload(); await sleep(1500);
  check("offline: the sign-in screen says there is no internet", await p2.evaluate(() => { const g = document.querySelector("#cloudGate h1"); return g && g.textContent; }), "No internet connection");
  await p2.evaluate(() => document.querySelector('[data-act="cloud.skip"]').click()); await sleep(300);
  check("'Continue offline' opens the ERP", await p2.$eval("#app h1", (h) => h.textContent), "Dashboard");
  await ctx2.close();

  server.close();
  await T.finish();
})().catch((e) => { console.error(e); process.exit(1); });
