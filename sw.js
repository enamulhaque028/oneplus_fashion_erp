/* Offline support for the hosted ERP (https link). Not used by the double-click version: browsers
   do not run service workers from file://, and that version is offline already.

   - Install: saves a copy of every ERP file (SHELL), so the ERP opens with no internet.
   - Online: network first - the newest files are used and the saved copy is refreshed. If the network
     fails or takes over 4 seconds, the saved copy is used.
   - Google sign-in / Drive (other sites) are never cached: sync waits for the internet as before.
   - The data itself is in the browser's localStorage and is not touched here.
   SHELL must list every file the page loads: node tests/smoke.js checks it against the page. */
"use strict";

const CACHE = "opf-erp-v1";
const TIMEOUT_MS = 4000;
const SHELL = [
  "./",
  "index.html",
  "OnePlusFashion_ERP.html",
  "privacy.html",
  "terms.html",
  "manifest.webmanifest",
  "assets/css/app.css",
  "assets/css/print.css",
  "assets/css/legal.css",
  "assets/img/favicon.svg",
  "assets/img/favicon-32.png",
  "assets/img/apple-touch-icon.png",
  "assets/img/icon-192.png",
  "assets/img/icon-512.png",
  "js/boot-check.js",
  "js/core/config.js",
  "js/core/util.js",
  "js/core/sha256.js",
  "js/core/migrate.js",
  "js/core/store.js",
  "js/domain/calc.js",
  "js/domain/ledger.js",
  "js/domain/stock.js",
  "js/domain/audit.js",
  "js/ui/actions.js",
  "js/ui/i18n.js",
  "js/ui/lang-bn.js",
  "js/ui/icons.js",
  "js/ui/html.js",
  "js/ui/modal.js",
  "js/ui/router.js",
  "js/ui/shell.js",
  "js/ui/lists.js",
  "js/ui/forms.js",
  "js/ui/records.js",
  "js/ui/search.js",
  "js/ui/charts.js",
  "js/ui/richtext.js",
  "js/ui/sketch.js",
  "js/services/auth.js",
  "js/services/print.js",
  "js/services/xlsx.js",
  "js/services/sheets.js",
  "js/services/backup.js",
  "js/services/drive.js",
  "js/services/cloud.js",
  "js/pages/dashboard.js",
  "js/pages/suppliers.js",
  "js/pages/purchase.js",
  "js/pages/materials.js",
  "js/pages/productionOrder.js",
  "js/pages/issue.js",
  "js/pages/production.js",
  "js/pages/factories.js",
  "js/pages/products.js",
  "js/pages/transfer.js",
  "js/pages/showroom.js",
  "js/pages/customers.js",
  "js/pages/partyViews.js",
  "js/pages/sales.js",
  "js/pages/returns.js",
  "js/pages/payments.js",
  "js/pages/expenses.js",
  "js/pages/courier.js",
  "js/pages/notes.js",
  "js/pages/costing.js",
  "js/pages/reports.js",
  "js/pages/ledger.js",
  "js/pages/users.js",
  "js/pages/settings.js",
  "js/app.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k != CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method != "GET" || new URL(req.url).origin != self.location.origin) return;
  e.respondWith(networkFirst(req));
});

function saved(req) {
  return caches.match(req, { ignoreSearch: true }).then((hit) => {
    if (hit || req.mode != "navigate") return hit;
    return caches.match("OnePlusFashion_ERP.html"); // any page address opens the ERP
  });
}

function networkFirst(req) {
  const net = fetch(req).then((res) => {
    if (res && res.ok && res.type == "basic") {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
  });
  net.catch(() => {}); // a late failure after the saved copy was used is not an error
  // Slow or no network: the saved copy (if there is one) instead of waiting.
  const slow = new Promise((resolve) => setTimeout(resolve, TIMEOUT_MS));
  return Promise.race([net, slow.then(() => saved(req).then((hit) => hit || net))])
    .catch(() => saved(req).then((hit) => hit || Promise.reject(new Error("offline and not saved"))));
}
