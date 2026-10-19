# One Plus Fashion ERP — Architecture

An offline ERP that runs in the browser from the local disk (`file://`), with no server,
no install and no build step. The target is an old Windows 7 laptop (4 GB RAM) running Chrome 73 or later.

## Constraints that shape the design

| Constraint | Consequence |
|---|---|
| Opened by double-clicking (`file://`) | ES modules (`<script type="module">`) and `fetch()` of local files are blocked, so the code uses **plain `<script>` files** that share one global namespace, `window.OPF`. |
| No build tools on the target machine | The files you edit are the files that run. No bundler or transpiler. |
| Chrome 73+ (Windows 7 tops out at Chrome 109) | ES2019 syntax is allowed (`const`/`let`, arrows, template literals, destructuring). Do **not** use `?.` or `??` (they need Chrome 80). `js/boot-check.js` shows a message on older browsers. |
| Data lives in `localStorage` | One JSON document under the key `opf_erp_smart_v3`. The key is unchanged since v3, so existing data keeps loading. |

## Folder layout

```
OnePlusFashion_ERP.html   HTML shell: header, sidebar, <main id="app">, script tags in load order
START_ERP.bat             Opens the HTML in Chrome / Firefox on Windows
assets/css/app.css        Application styles: design tokens (light + dark), shell, components
assets/css/print.css      Invoice / receipt print styles (loaded into the hidden print frame)
assets/img/               Logos
js/boot-check.js          ES5 browser-support check (runs first)
js/core/                  Configuration, helpers, storage - no DOM, no business rules
  config.js               Constants, sidebar menu
  util.js                 num / r2 / money / dates / esc / amountWords ...
  sha256.js               Password hashing
  migrate.js              Empty database + upgrades for older data (idempotent)
  store.js                OPF.store.db, save/load, log, upsert/remove, lookups
js/domain/                Business rules - pure calculations over OPF.store.db, no DOM
  calc.js                 Per-record formulas: purchase, sale, production bill, COD, costing
  ledger.js               Party ledgers: the single source of truth for every due/payable
  stock.js                Godown / showroom / raw-fabric stock, derived from transactions
  audit.js                Reconciliation and data-quality checks
js/ui/                    UI framework
  actions.js              Action registry + delegated event listeners
  icons.js                Inline SVG line icons: OPF.icon(name)
  html.js                 HTML builders (field, select, table, card ...), mount/append
  modal.js                Dialog (admin password)
  router.js               Page navigation, "record being edited" state
  shell.js                Grouped sidebar, header title, theme, collapse / mobile menu
  lists.js                <option> lists and <datalist> suggestions
  forms.js                Form helpers + the standard form page layout
  records.js              Generic create / edit / delete with admin check + logging
  search.js               Global customer search
  charts.js               Dependency-free SVG charts (donut, line / bar / table trend)
  i18n.js                 Screen language: Bengali mode translates text as it appears (MutationObserver), Bengali digits
  lang-bn.js              Bengali word list (English text -> Bengali) + patterns for texts with numbers
  richtext.js             Rough Notes formatting toolbar + HTML cleaner (allow-list; runs on save AND display)
  sketch.js               Rough Notes sketch pad; sketches stored as strokes on a 1000 x 560 grid, not images
js/services/              Cross-cutting features
  auth.js                 Admin password and unlock session
  print.js                Invoice / cash memo and money receipt
  xlsx.js                 Dependency-free .xlsx writer (SpreadsheetML + ZIP)
  sheets.js               Every register / ledger / stock report as tabular data
  backup.js               Excel backup, JSON restore file, CSV, clear all
  drive.js                Google sign-in token + Google Drive REST (only network code)
  cloud.js                Drive sync rules, login screen, sync badge, Settings section
js/pages/                 One file per screen; registers OPF.pages.<id> and its actions
  partyViews.js           Customer profile + supplier/factory statement (OPF.views)
js/app.js                 Start-up (loaded last)
tests/                    End-to-end tests (development only)
```

## Layers and dependency rule

```
core  ->  domain  ->  ui  ->  services  ->  pages  ->  app
```

A file may use anything from the layers to its left. `domain/` never touches the DOM, so every
number the ERP shows can be tested without a screen. Scripts load in this order in
`OnePlusFashion_ERP.html`.

Every file has the same shape:

```js
(function (OPF) {
  "use strict";
  const H = OPF.html, F = OPF.forms;     // aliases to earlier layers
  function render() { ... }
  OPF.pages.example = { render };
  OPF.actions.register({ "example.save": save });
})(window.OPF = window.OPF || {});
```

## Data flow

1. `store.load()` reads localStorage and runs `migrate.normalize()`. That fills in missing
   collections and upgrades old record shapes.
2. Pages read `OPF.store.db` when they render. Read it at call time: restore and clear replace
   the whole object.
3. Saving goes through `records.save(coll, data, label, ref)`. It inserts a new record, or
   updates the one being edited (`router.editing`), writes the activity log and persists.
4. **Totals are never stored.** Balances, stock and due amounts are recalculated from the
   transactions every time (`domain/`). The one deliberate exception is `payment.snap`: the
   breakdown printed on a receipt is frozen at the moment the receipt was issued.

### Ledger model (`domain/ledger.js`)

`postings(type)` converts transactions into lines for `Customer`, `Supplier` or `Factory`:
`dr` increases what the party owes (or what we owe them); `cr` reduces it.

| Party | dr (+) | cr (−) |
|---|---|---|
| Customer | opening due, sale total | paid on invoice, sales return, collection |
| Supplier | opening due, purchase total | paid on purchase, payment |
| Factory | opening due, accepted PCS × rate | payment |

The dashboard, customer lists, payment breakdown, invoices, receipts, statements, Excel
export and the reconciliation check all derive from these lines. That is why they always agree.
When you work across many parties, use `balances()`, `allEntries()` or `breakdowns()`.
They build the postings once instead of once per party.

## UI events: actions instead of inline JavaScript

Markup has no `onclick="..."`. Elements name an action, and `ui/actions.js` dispatches it:

| Attribute | Fires on | Handler gets |
|---|---|---|
| `data-act="name"` | click | `(element, event)` |
| `data-change="name"` | change | `(element, event)` |
| `data-submit="name"` | form submit | `(form, event)` |
| `data-calc="name"` | any input/change inside the form (live totals) | `(form, event)` |

Parameters travel as `data-*` attributes: `H.button("Edit", "record.edit", { coll: "sales", id })`
renders `data-coll` / `data-id`, and the handler reads `el.dataset`. Action names are
`<page>.<verb>`. Shared ones are `nav.go`, `record.edit`, `record.delete`, `print.invoice`,
`backup.excel` and `auth.toggle`.

## Adding a page

1. Create `js/pages/myPage.js` using the file shape above. For a data-entry page:
   ```js
   F.page({ title: "My Page", coll: "myRecords", submit: "myPage.save", calc: "myPage.calc",
            fields: [H.field("date", "Date", { type: "date", required: true }), ...] });
   ```
   Then append the register table with `H.append(H.table(...))`, using `R.rowActions(coll, id)`
   for the Edit / Delete buttons.
2. Add `["myPage", "Label"]` to `MENU` in `js/core/config.js`.
3. Add a new collection to `fresh()` in `js/core/migrate.js`. Add it to `PAGE_OF` in
   `js/ui/records.js`, and to `REFERENCED_BY` if other records link to it.
4. Add the `<script>` tag in `OnePlusFashion_ERP.html` before `js/app.js`, and in the same
   position in `tests/browser-smoke.html`. `node tests/smoke.js` fails if the two lists differ.
5. If it should be exported, add a sheet in `js/services/sheets.js`.
6. Document it in `docs/USER_GUIDE.md` (section 5, in sidebar order). Add any formula to section 9.
   If it changes a checklist step, update `docs/QA_CHECKLIST.md` and `tests/uat.test.js` together.

**Any behaviour change** (a formula, a field, a button, a rule) must update `docs/USER_GUIDE.md`
in the same change, so the guide always matches the software.

## Changing the data shape

Add an upgrade function to the `upgrades` list in `js/core/migrate.js`. It must be
**idempotent**, because it runs on every start and on every restore. An upgrade that compares
values (e.g. "replace the old default phone") must also check `d.version`, so it runs once only;
see `memoBranding`. Bump `SCHEMA_VERSION` in
`config.js`. Never rename `STORAGE_KEY`.

## Look and feel (UI shell, theme, charts)

- **Design system:** Material 3 style, modelled on the bseba ERP: tonal surfaces, soft shadows,
  rounded cards and pill buttons, teal primary. Every colour is a CSS token in
  `assets/css/app.css` (`:root`); `[data-theme="dark"]` on `<html>` swaps them. Never hard-code a
  colour in a page.
- **Old-browser CSS:** no flexbox `gap` (Chrome 84), `clamp()`, `:is()` or `aspect-ratio`. Space flex
  children with margins (`.actions > *`). Grid `gap` is fine.
- **Addresses (routing):** every view has a hash route - `#/<page>`, `#/customer/<id>`,
  `#/statement/<type>/<id>` (only the part after `#` can change for `file://` pages). Navigation in
  markup is a real link: `H.pageLink`, `H.customerLink`, `H.statementLink` - not a `data-act` button -
  so right-click "Open in new tab", Ctrl/Cmd-click and Back / Forward work. `router.go` / `router.show`
  draw immediately and record the route with `history.pushState`; the `hashchange` listener draws
  views reached by links, Back / Forward or a pasted address; `router.start()` opens the address
  at start-up. Unknown or broken addresses fall back (dashboard / ledger) and replace the address.
- **Sidebar:** `NAV_GROUPS` and `PAGE_ICONS` in `config.js` group and decorate the flat `MENU`; every
  MENU id must appear in exactly one group. `ui/shell.js` draws it on each navigation.
- **UI preferences** (theme, collapsed sidebar) are stored under the localStorage key `opf_erp_ui`,
  separate from the ERP data. Only `shell.init()` reads it; the self-test page never calls `init()`.
- **Icons:** `OPF.icon(name)` in `ui/icons.js`. Static markup uses `<span data-icon="name">`, which
  `shell.init()` replaces.
- **Summary cards:** `H.card(label, value, cls, icon?)` picks an icon from the label and a pastel
  tone from its position; the card's *text* stays "label value", which tests read.
- **Charts** (`ui/charts.js`): one money axis, legend always shown for 2+ series, hover tooltip,
  table view, `prefers-reduced-motion` respected. Series colours are `--series-1..3`, validated
  for colour-blind separation and contrast in both themes. Set them with `style="fill:var(--...)"`:
  SVG `fill=` / `stroke=` attributes ignore `var()`. Call `OPF.charts.bind(container)` after mounting
  to switch on the hover. The donut shows costs only (purchases, factory bill, expenses): sales are
  not part of costs, so they belong on the trend chart, not in the ring.

## Google Drive sync

Design: `docs/superpowers/specs/2026-10-18-google-drive-sync-design.md`; setup: `docs/CLOUD_SETUP.md`.
- **Off by default.** `OPF.drive.enabled()` needs `CLOUD.GOOGLE_CLIENT_ID` and an http(s) page;
  otherwise `OPF.cloud.start` just opens the ERP. Tests switch it on with `window.OPF_CLOUD_TEST`.
- **Local first.** Every `store.save()` notifies `cloud.js` (`store.onSave`). It bumps a change
  counter and uploads after `UPLOAD_DELAY_MS`. Data replaced from Drive is applied with `applying`
  set, so it is not counted as a local change.
- **One data file** in the shop's Drive (scope `drive.file`, found by `appProperties.opfErp`). The
  `syncId` the ERP stamps on each upload decides (never Drive's `version`, which Google changes by
  itself): changed only there → download; only here → upload; both → ask, and keep
  the loser as a conflict copy. A dated copy is kept before the first upload of each day (30 kept).
- **Google access** (token model) lasts an hour and can only be requested from a click: the next
  click (capture listener) renews it when a sync is waiting. It is kept per tab in sessionStorage.

## Security notes

- All user data is HTML-escaped (`util.esc`) before it reaches a template. `html.field` and
  `html.attrs` escape attribute values themselves.
- The admin password is a salted SHA-256 hash in the same localStorage. It stops casual edits
  and deletions, not someone with developer tools. Real multi-user security needs a server.

## Tests and QA

```
cd tests
npm install        # installs puppeteer-core only; uses your installed Chrome
npm test           # runs all suites below; CHROME_PATH=/path/to/chrome if Chrome is elsewhere
```

| File | What it proves |
|---|---|
| `e2e.test.js` | Every business rule through the UI: data upgrades; purchase, stock, production, transfer, sales, payments, courier, costing; reconciliation; admin password, edit/delete, search; returns, expenses, settings, logo; Excel/JSON backup, clear, restore; every page renders; performance with 3,000 invoices (each page under 0.6 s). |
| `edge.test.js` | Several showrooms, kg units, cancelled stock warnings, validation rules, customer advance, supplier/factory vouchers, same-day invoices and date ranges, a 40-line invoice over several pages, Bangla text in print/CSV/Excel, keyboard-only entry, admin timeout, HTML escaping. |
| `regression.test.js` | Loads the demo data (324 invoices, 203 payments) and compares every invoice, purchase, party balance, receipt breakdown, invoice previous due, stock line, dashboard period, Customers summary, date-wise due list and Excel column with an independent oracle written in the test. It then drives risky cases through the UI: decimals and rounding, overpayment, backdated and future-dated entries, editing and deleting payments, moving a sale between months, time zones, invoice references, midnight rollover, and search with +880. |
| `cloud.test.js` | Google sign-in + Drive sync with fakes at the network boundary (fake `google.accounts.oauth2`, fake `fetch` to an in-test Drive shared by separate browser profiles): first sign-in upload, restore on a second computer, upload after saves, changes from another computer, offline conflict and conflict copy, daily copies (30 kept), expired access renewed by a click, reload keeps access, sign-out, first visit without internet. |
| `uat.test.js` | Performs `docs/QA_CHECKLIST.md` step by step, typing like a person, and asserts every "Expect" value in it. Change the checklist and this file together. |
| `browser-smoke.html` | Self-test page: double-click it on any computer to check that browser runs the ERP. It uses in-memory data only and never touches saved ERP data. `node smoke.js [browser]` runs it headless; that also works for very old builds that puppeteer cannot drive. |
| `fixtures/make-demo-data.js` | Builds `fixtures/OnePlusFashion_Demo_Data.json`: about 4 months of simulated business ending on the day it runs, for demos and manual testing. Each piece of data is created only after what it depends on (fabric before cutting, production before transfer, sales only from shop stock). The script then loads the file into the real ERP and aborts unless every ledger reconciles, no stock goes negative, every page renders and the file imports through Settings → Restore. Re-run it to move the dates up to today. |
| `lib.js` | Shared harness: launches the browser on `file://` with no special flags and provides UI helpers. |

**Browser versions verified** (on macOS, with archived builds):

| Browser | Checks |
|---|---|
| Chrome 154 | all suites |
| Chromium 109 (last for Windows 7) | all suites: `OLD_BROWSER=1 PUPPETEER_PATH=<puppeteer-core@19.4 dir> CHROME_PATH=<chromium 109>` |
| Chromium 73 (oldest supported) | browser self-test |
| Firefox 115 ESR (last for Windows 7) | browser self-test |

Old builds can be downloaded with `npx @puppeteer/browsers install chromium@1069273` (109),
`chromium@624492` (73) or `firefox@esr_115.0esr`.

Screenshots, PDFs and downloaded files go to `tests/out/<suite>/`.

**Still manual** (`docs/QA_CHECKLIST.md`, about 30 minutes on the shop laptop):
- Windows 7 itself
- printing on paper
- opening the backup in Microsoft Excel
- the owner's sign-off on the business rules
