/* Runs browser-smoke.html in a browser (no puppeteer needed, works with very old Chrome builds).
   Usage: node smoke.js [chrome-executable] [extra launcher prefix...]
   Prints the self-test result; exit code 1 on failure. */
const { execFileSync } = require("child_process");
const path = require("path");
const args = process.argv.slice(2);
const chrome = args.length ? args : [process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"];
const url = "file://" + path.join(__dirname, "browser-smoke.html");

// The self-test page must load exactly the app's scripts (minus js/app.js), in the same order.
const fs = require("fs");
const scripts = (file, prefix) => [...fs.readFileSync(file, "utf8").matchAll(new RegExp(`src="${prefix}(js/[^"]+)"`, "g"))].map((m) => m[1]);
const appList = scripts(path.join(__dirname, "..", "OnePlusFashion_ERP.html"), "").filter((s) => s != "js/app.js");
const smokeList = scripts(path.join(__dirname, "browser-smoke.html"), "\\.\\./");
if (appList.join() != smokeList.join()) {
  console.log("FAIL browser-smoke.html script list differs from OnePlusFashion_ERP.html");
  console.log("   only in app:  ", appList.filter((s) => !smokeList.includes(s)).join(", ") || "-");
  console.log("   only in smoke:", smokeList.filter((s) => !appList.includes(s)).join(", ") || "-");
  process.exit(1);
}
const dom = execFileSync(chrome[0], chrome.slice(1).concat(["--headless", "--disable-gpu", "--virtual-time-budget=5000", "--dump-dom", url]), { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const unescape = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
const title = (dom.match(/<title>(.*?)<\/title>/) || [])[1] || "NO RESULT";
const browser = (dom.match(/Browser: ([^ <&]+)/) || [])[1] || "?";
console.log(`${browser}: ${title}`);
for (const m of dom.matchAll(/<td class="no">FAIL<\/td><td>(.*?)<\/td>(?:<td>(.*?)<\/td>)?/g)) console.log("   FAIL", unescape(m[1]), unescape(m[2] || ""));
const report = dom.slice(dom.indexOf('<div id="report">'), dom.indexOf('<div id="erp">'));
const err = report.match(/Stopped with an error: (.*?)<\/p>/);
if (err) console.log("   ERROR", unescape(err[1]));
process.exit(/PASS/.test(title) ? 0 : 1);
