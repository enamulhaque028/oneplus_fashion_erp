# AGENTS.md — context for AI coding agents

Read this before changing anything. `CLAUDE.md` imports this file, so keep the content here.
Keep it short and true: update it in the same change whenever a rule, command or status below changes.

## What this is

**One Plus Fashion Smart ERP v4**: an offline, single-computer ERP for a Bangladeshi wholesale
garment manufacturer (One Plus Fashion). It covers supplier, purchase, raw stock, production,
transfer, showroom, sales/invoice, customer ledger, payment/receipt, courier/COD, costing and
reports.

- **Runs from disk:** the user double-clicks `START_ERP.bat`, which opens `OnePlusFashion_ERP.html`
  over `file://` in Chrome or Firefox.
- **No server, build step or package install. Works without internet**; the only network use is the
  optional Google Drive sync (off unless a Client ID is set, and only on the hosted https link).
- **Target:** an old Windows 7 laptop with 4 GB RAM. The newest browsers available are Chrome 109 and Firefox 115.
- **Minimum supported:** Chrome 73.
- **Data:** one JSON document in `localStorage` under the key `opf_erp_smart_v3`.
- **Currency:** Taka. Numbers use `en-BD` formatting and amounts in words use crore / lakh.

## Docs — read and keep in sync

| File | Audience | Keep in sync when |
|---|---|---|
| `docs/ARCHITECTURE.md` | developers / agents | structure, layers, conventions, how to add a page |
| `docs/USER_GUIDE.md` | shop staff and owner | **any user-visible change** (field, button, formula, rule) |
| `docs/QA_CHECKLIST.md` | person testing on the shop laptop | a checklist step changes; update `tests/uat.test.js` in the same change |
| `README.txt` | end user (plain text, Notepad) | start-up, files, requirements |
| `AGENTS.md` (this file) | agents | rules, commands, status |

## Hard constraints (breaking these breaks the product)

1. **No ES modules, no `fetch()` of local files, no `import`.** `file://` blocks them (the Google Drive
   calls in `js/services/drive.js` use `fetch` over https, which is fine). The code uses plain
   `<script src>` files that share `window.OPF`. Every file is an IIFE:
   `(function (OPF) { "use strict"; ... })(window.OPF = window.OPF || {});`
2. **ES2019 at most.** No `?.`, no `??`, no class fields, no top-level `await` (Chrome 73).
   `js/boot-check.js` stays ES5.
3. **No external dependencies, CDNs or web fonts.** It must work with no internet. Single exception:
   `js/services/drive.js` loads Google's sign-in script and calls the Drive API, only when cloud
   sync is configured; everything must still work offline (local save first, sync later). The Excel
   writer (`js/services/xlsx.js`) and SHA-256 (`js/core/sha256.js`) are hand-written for this reason.
4. **Script order matters.** It is `core → domain → ui → services → pages → app`. A new JS file
   must be added to **both**:
   - `OnePlusFashion_ERP.html`, before `js/app.js`;
   - `tests/browser-smoke.html`, in the same position.

   `node tests/smoke.js` fails if the two lists differ.
5. **Never rename `STORAGE_KEY`**, and never change the stored shape without a migration.
   - Add an **idempotent** upgrade to `upgrades` in `js/core/migrate.js`. If it compares *values*
     rather than shapes, gate it on `d.version` so it runs once only (see `memoBranding`).
   - Bump `SCHEMA_VERSION` in `js/core/config.js`.

   Users' real accounts live in that storage.
6. **All screens and users share one localStorage.** Chrome gives every `file://` page the same
   storage. Test pages must never read or write it: `tests/browser-smoke.html` swaps in an
   in-memory store for this reason.

## Code conventions

- **Layers:**
  - `js/domain/` has pure business rules and never touches the DOM.
  - Pages call domain and ui helpers and don't compute money inline.
- **Totals are derived, never stored.** Balances, stock and dues come from transactions every time:
  - dues from `OPF.ledger`;
  - stock from `OPF.stock`;
  - per-record formulas from `OPF.calc`.

  The only frozen figures are `payment.snap`, the numbers printed on a receipt.
- **One ledger.** Every due or payable anywhere comes from `OPF.ledger.postings()`. Don't add a
  second way to compute a balance.
- **Money:** use `r2()` / `sum()` from `js/core/util.js` for arithmetic and `money()` / `dueText()`
  for display. `num()` accepts `"1,250.50"`.
- **Escaping:** every user value in HTML goes through `OPF.util.esc`, or through `H.field` /
  `H.attrs`, which escape attributes.
- **Navigation:** links, not buttons: `H.pageLink(label, page, cls)`, `H.customerLink`,
  `H.statementLink` (routes `#/page`, `#/customer/<id>`, `#/statement/<type>/<id>`). A new view
  must get a route in `ui/router.js` so new tabs, bookmarks and Back work.
- **Events:** no inline `onclick`. Use `data-act` / `data-change` / `data-submit` / `data-calc` plus
  `OPF.actions.register({ "page.verb": fn })`. Handlers get `(element, event)`; parameters travel in `data-*`.
- **Forms:** use `form.elements.namedItem(name)` (via `F.el` / `F.get` / `F.set`), never `form.style`
  or `form.method`: field names clash with form properties.
- **State:** read `OPF.store.db` at call time. Restore and clear replace the object.
- **Saving:** go through `OPF.records.save(coll, data, label, ref)`. It handles create vs edit and the activity log.
- **Admin-only actions** (edit, delete, settings, restore, clear, courier status, costing save)
  must go through `OPF.auth.require(fn, onCancel)`.
- **Performance** (the target laptop is slow): across many parties use `ledger.balances()`,
  `allEntries()` or `breakdowns()`. They build postings once. Never call `ledger.balance()` or
  `breakdown()` inside a loop over parties. The e2e test fails if a page takes over 600 ms with 3,000 invoices.
- **UI:** colours only through the CSS tokens in `assets/css/app.css` (light + dark); icons via
  `OPF.icon(name)`; charts via `OPF.charts` (no chart libraries: offline). No flexbox `gap` in CSS
  (Chrome 73). Theme / sidebar preferences use the separate key `opf_erp_ui`, never the ERP data.
- **Match the surrounding style:**
  - `const`, arrow functions and template literals;
  - short comments that explain *why*;
  - user-facing text in plain English.

## Commands

```bash
cd tests && npm install                 # once; only puppeteer-core
npm test                                # e2e + edge + uat + regression + cloud + smoke on installed Chrome
node e2e.test.js | edge.test.js | uat.test.js   # one suite
node smoke.js [browser-exe]             # self-test page, headless; also checks the script list
node --check <file>.js                  # quick syntax check
node fixtures/make-demo-data.js         # rebuild demo data (dates end today), verified in the ERP
```

Old-browser runs, required before calling a change "done" if it touches JS syntax or browser APIs:

```bash
npx @puppeteer/browsers install chromium@1069273   # Chromium 109
npx @puppeteer/browsers install chromium@624492    # Chromium 73 (x64; use `arch -x86_64` on Apple silicon)
npx @puppeteer/browsers install firefox@esr_115.0esr
# Chromium 109 needs puppeteer-core@19.4 installed in a separate folder:
OLD_BROWSER=1 PUPPETEER_PATH=<dir>/node_modules/puppeteer-core CHROME_PATH=<chromium109> node e2e.test.js
node smoke.js arch -x86_64 <chromium73>             # Chrome 73: self-test only
<firefox> --headless --screenshot out.png file://$PWD/browser-smoke.html   # Firefox: read the screenshot
```

Tests write screenshots, PDFs and downloads to `tests/out/<suite>/`, which git ignores.

## Definition of done for a change

1. All suites pass on current Chrome. If syntax or browser APIs changed, run them on Chromium 109 and run the self-test on Chrome 73.
2. New behaviour has a test (`e2e` for rules, `edge` for corner cases).
3. `docs/USER_GUIDE.md` is updated for anything a user would notice. If a checklist step changed,
   update `docs/QA_CHECKLIST.md` and `tests/uat.test.js` too.
4. Nothing is committed unless the user asks.

## Status (update when it changes)

- **Uncommitted:** all v4 work (the 12 client issues, the restructure, tests and docs) is uncommitted
  on `main`. The two commits are the original v3 upload and the user's reformat of the v3 HTML.
- **Cash memo:** matches the shop's printed "Cash Memo" book (photo supplied by the client on
  2026-09-29): layout in `js/services/print.js`, styles in `assets/css/print.css`, shop details in
  Settings (`company.*`, schema v5). The logo is drawn as inline SVG unless an image is uploaded.
  The shop-name lettering uses a heavy system font stretched with SVG `textLength`: the memo's
  typeface isn't available offline. Keep the layout matching that book. Printing uses a hidden
  iframe in the same page (`#printFrame`) - never `window.open` (no new tab, no pop-up blocker).
- **UI redesign (2026-10-18):** bseba-style Material 3 look - grouped icon sidebar, new header
  (title, search, theme switch, clock, lock, Sale, Backup; no vendor logo), pastel cards, dashboard with period panels,
  cost-breakdown and 30-day trend charts, teal tables, light / dark themes. Presentation only:
  IDs, form names, actions and business logic unchanged.
- **Test results:**
  - current Chrome and Chromium 109: e2e 126, edge 64, uat 44, regression 62, cloud 34 checks, all passing;
  - self-test 26 / 26 on Chrome 73, 109, current and Firefox 115.
- **Courier and Rough Notes (business decision 2026-10-18, schema v6):** Courier / Delivery is a
  record only (date, invoice, customer, address, courier, tracking, COD as a note, status, note). No
  Advance, Charge, Net COD or Settled, and it never changes dues: dues change only through Sales and
  Payment / Collection entries. Old parcels keep those stored fields, unused. "Rough Notes" (`notes`
  collection, `js/pages/notes.js`) is a free notepad that changes no figure: rich text (`ui/richtext.js`,
  stored as cleaned `html` plus a plain `text` copy), colour, pin, and one sketch per note (`ui/sketch.js`, stored as
  strokes, never as images - localStorage is ~5 MB). Note HTML must go through `OPF.richtext.clean`
  on save and on display (it also arrives from backups / Drive). The page is a card board;
  writing and preview open in `#noteDlg` (z-index below the admin password `#modal`). This replaces the
  earlier COD-settlement option B, which the business dropped.
- **Google Drive sync (2026-10-18):** built and tested with fakes (`tests/cloud.test.js`); design in
  `docs/superpowers/specs/2026-10-18-google-drive-sync-design.md`. Client ID set in
  `CLOUD.GOOGLE_CLIENT_ID` on 2026-10-18 (project `one-plus-fashion-erp`, origin
  `https://enamulhaque028.github.io`, consent screen **published (In production)** on 2026-10-18; privacy / terms pages: `privacy.html`, `terms.html`). Never commit the
  client secret - the browser token flow does not use it. The real Google sign-in still needs a manual
  check on the hosted link, including on Windows 7 Chrome 109.
  Sync state lives under localStorage key `opf_erp_cloud` (tab token in sessionStorage
  `opf_erp_cloud_token`), never in the ERP data.
- **Not yet done:** the manual `docs/QA_CHECKLIST.md` run on the real Windows 7 laptop (printer,
  Microsoft Excel, the owner's sign-off on business rules).
- **Out of scope for this offline edition:** multi-user, per-user login and roles, cloud backup,
  barcode scanning, multi-branch. These need a server version.
- **Security limit:** the admin password is a salted SHA-256 hash in the same localStorage. It
  deters casual edits only. Don't describe it as strong security.
