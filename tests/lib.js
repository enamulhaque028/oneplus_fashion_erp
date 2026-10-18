/* Shared test harness: launches Chrome on the ERP (file://, no special flags) and provides
   helpers that drive the real UI.

   Environment:
     CHROME_PATH      Chrome / Chromium executable (default: the usual install location)
     PUPPETEER_PATH   use a different puppeteer-core install, e.g. v19 for Chromium 109
     OLD_BROWSER=1    classic headless mode, needed for old builds such as Chromium 109 */
const path = require("path");
const fs = require("fs");
const puppeteer = require(process.env.PUPPETEER_PATH || "puppeteer-core");

const ROOT = path.resolve(__dirname, "..");
const APP = "file://" + path.join(ROOT, "OnePlusFashion_ERP.html");
const CHROME = process.env.CHROME_PATH || {
  darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  win32: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  linux: "/usr/bin/google-chrome"
}[process.platform];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function start(outName) {
  const OUT = path.join(__dirname, "out", outName);
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await puppeteer.launch({ executablePath: CHROME, headless: process.env.OLD_BROWSER ? true : "new" });
  const version = await browser.version();
  console.log("Browser:", version);
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });

  const errors = [], alerts = [], confirms = [];
  let confirmAnswer = true;
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => {
    if (d.type() == "alert") alerts.push(d.message());
    if (d.type() == "confirm") { confirms.push(d.message()); return confirmAnswer ? d.accept() : d.dismiss(); }
    d.accept();
  });
  const cdp = await page.target().createCDPSession();
  await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: OUT });

  let passes = 0, failures = 0;
  const t = {
    browser, page, version, errors, alerts, confirms, OUT, ROOT, APP, sleep,
    answerConfirms(yes) { confirmAnswer = yes; },

    check(name, got, want) {
      const ok = JSON.stringify(got) === JSON.stringify(want);
      ok ? passes++ : failures++;
      console.log((ok ? "  PASS " : "  FAIL ") + name + (ok ? "" : `\n       got:  ${JSON.stringify(got)}\n       want: ${JSON.stringify(want)}`));
    },
    section: (title) => console.log("\n" + title),

    open: () => page.goto(APP),
    reset: async () => { await page.evaluate(() => localStorage.clear()); await page.reload(); },
    go: (p) => page.evaluate((p) => OPF.router.go(p), p),
    db: (fn) => page.evaluate(`(() => { const db = OPF.store.db; return (${fn})(db); })()`),
    text: (sel) => page.$eval(sel, (e) => e.innerText),

    // Set form fields and fire change events, so data-change handlers and live totals run.
    fill: (values, formId = "mainForm") => page.evaluate((v, id) => {
      const f = document.getElementById(id);
      for (const k in v) { const el = f.elements.namedItem(k); el.value = v[k]; el.dispatchEvent(new Event("change", { bubbles: true })); }
    }, values, formId),
    submit: (formId = "mainForm") => page.evaluate((id) => document.getElementById(id).requestSubmit(), formId),

    // Click the element with data-act=name whose data-* match `data`.
    act: (name, data = {}) => page.evaluate((name, data) => {
      const el = Array.from(document.querySelectorAll(`[data-act="${name}"]`)).find((e) => Object.keys(data).every((k) => e.dataset[k] == data[k]));
      if (!el) throw new Error("no element for action " + name + " " + JSON.stringify(data));
      el.click();
    }, name, data),

    modalOpen: () => page.$eval("#modal", (m) => m.innerHTML != ""),
    async password(pw, confirmPw) {
      await page.type("#pw1", pw);
      if (confirmPw != null) await page.type("#pw2", confirmPw);
      await page.click('#modal button:not([type="button"])');
    },
    // Resolves with the next window the page opens (print windows).
    popup: () => new Promise((res) => browser.once("targetcreated", async (target) => { const p = await target.page(); await sleep(800); res(p); })),

    async setItems(rows) {
      await page.evaluate((rows) => {
        const trs = document.querySelectorAll("#items tr.item");
        rows.forEach((r, i) => Object.keys(r).forEach((k) => { const el = trs[i].querySelector(`[data-k="${k}"]`); el.value = r[k]; el.dispatchEvent(new Event("change", { bubbles: true })); }));
      }, rows);
    },

    // Type into a real input like a user: focus, select existing text, type.
    async typeInto(selector, value) {
      await page.click(selector, { clickCount: 3 });
      await page.keyboard.press("Backspace");
      await page.type(selector, String(value));
    },

    async finish() {
      t.check("no JavaScript errors", errors, []);
      console.log(`\n${passes} passed, ${failures} failed  (${version})`);
      await browser.close();
      process.exit(failures ? 1 : 0);
    }
  };
  return t;
}

module.exports = { start, sleep, ROOT };
