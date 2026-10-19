# One Plus Fashion ERP — User Guide

For the shop owner and staff who use the ERP every day.
Version 4 (see VERSION.txt). Last updated: 29 September 2026.

> **Keeping this guide current:** whenever a feature changes, update the matching section here
> in the same change. The list of sections follows the sidebar menu.

---

## Contents

1. [What the ERP does](#1-what-the-erp-does)
2. [Starting the ERP](#2-starting-the-erp)
3. [The screen](#3-the-screen)
4. [The daily workflow](#4-the-daily-workflow)
5. [Pages, one by one](#5-pages-one-by-one)
6. [Editing, deleting and the admin password](#6-editing-deleting-and-the-admin-password)
7. [Printing invoices and receipts](#7-printing-invoices-and-receipts)
8. [Backup, restore and data safety](#8-backup-restore-and-data-safety)
9. [How the numbers are calculated](#9-how-the-numbers-are-calculated)
10. [Automatic numbers](#10-automatic-numbers)
11. [Questions and problems](#11-questions-and-problems)
12. [What this edition does not do](#12-what-this-edition-does-not-do)

---

## 1. What the ERP does

The ERP runs the whole business on one computer, from buying fabric to collecting money:

```
Supplier → Fabric purchase → Raw stock → Material issue → Production → Godown stock
→ Transfer to showroom → Sale / invoice → Customer due → Payment / receipt → Courier → Reports
```

- It works **offline**. It needs no internet, server or installation. Only a web browser is needed.
- It keeps all **dues and stock** up to date by itself. You enter transactions; the ERP works out
  balances, stock and totals.
- It prints **invoices / cash memos** and **money receipts**. It exports everything to **Excel**.

## 2. Starting the ERP

1. Double-click **START_ERP.bat** in the ERP folder. It opens the ERP in Google Chrome, or in
   Firefox if Chrome is not installed.
2. The Dashboard appears.

**Requirements:** Google Chrome 73 or newer or Firefox. On Windows 7 the newest you can install
are Chrome 109 and Firefox 115. To check a computer, double-click `tests\browser-smoke.html`.
It must say **PASS**.

**Keep the folder together.** The ERP is the whole folder: `OnePlusFashion_ERP.html`,
`START_ERP.bat`, `assets\` and `js\`. Copy or move them together. The data is not kept in the
folder; it is saved inside the browser (see [section 8](#8-backup-restore-and-data-safety)).

## 3. The screen

| Area | What it is |
|---|---|
| **Sidebar** (left) | The shop name and logo at the top, then the pages in groups: Purchase, Production, Product & Stock, Sales, Accounts, Admin. Click a group to open or close it; the group of the page you are on opens by itself, and that page is highlighted in green. **Search menu...** finds a page by name. The shop hotline is at the bottom. |
| **Menu button** (☰, top left) | Shrinks the sidebar to icons only, for more room; click again to bring the names back. On a phone-sized window it slides the menu in and out. |
| **Page title** (top left) | "Home › group" and the name of the page you are on. |
| **Search bar** (top) | Type a customer's name or at least 3 digits of their mobile (with or without +880). Click a result, or press Enter for the first result, to open the customer's full history. **Ctrl+K** jumps to the search bar from anywhere. |
| **Clock** (top right) | The time, with the date under it. |
| **Sun / moon, EN \| বাং, download** (top right, one group) | Light or dark colours; screen language; **download** = a full Excel backup at once. The choices are remembered on this computer. |
| **+ New sale** (green, top right) | Opens a new sale / invoice. |
| **Admin** (top right, with the letter A) | Shows **Locked** (red) or **Unlocked** (green): whether editing is allowed. Click it to log in, or to lock again when you are done. See [section 6](#6-editing-deleting-and-the-admin-password). |
| **Form** (white card with a green border) | Where you enter a new record. Fields marked with a red `*` are required. **Save** stores it; **Clear** empties the form. |
| **Grey box** (dashed border) | Live calculation. It updates as you type: totals, due, stock available, and so on. Check it before you save. |
| **Register** (table with a green heading) | Saved records, newest first. Totals are in the bottom row. The yellow **Edit** and red **Delete** buttons are on the right of each row. |

**Language (English / বাংলা):** the **EN | বাং** switch in the header (on a phone, in the ☰ menu)
changes the whole screen to Bengali, with Bengali digits. The choice is remembered on that computer.
- English is the default. Switching reloads the page in the other language.
- Stays as it is: what you type and your saved data (names, notes), document numbers such as
  INV-00012 and MR-00031, the printed Cash Memo / Money Receipt (English, like the memo book) and
  the Excel / CSV files. Typing Bengali digits in amount boxes also works.
- Wording can be corrected in `js/ui/lang-bn.js` (English text → Bengali).
- No **EN | বাং** switch? Bengali is switched off (`ENABLE_BENGALI: false` in `js/core/config.js`);
  the ERP then shows English only.

**Without internet (the online link):** after the ERP has been opened once with internet, it also
opens with no internet, with all its data: the browser keeps a copy of the ERP's files. Google Drive
backup waits until the internet is back. (Chrome forgets this copy when an Incognito window is
closed - use a normal window.)

**Desktop app (the online link):** click **Install desktop app** at the bottom of the side menu (also in
**Settings / Backup**). In Chrome or Edge it installs the ERP as an app: its own window, a Start menu /
Dock icon, opens without internet, updates by itself, same data. Where the browser cannot install with
one click (iPhone, Firefox), the button shows the steps (iPhone: Share → Add to Home Screen). The
double-click version does not show the button: it is a desktop version already.
When the app is installed the card says **Uninstall desktop app**. A web page is not allowed to remove an
app itself, so it shows the browser's steps: in the app window, menu (⋮) → **Uninstall One Plus Fashion
ERP**; in a browser tab, `chrome://apps` → right-click → **Remove from Chrome**. The ERP data is kept.

**On a phone** (the online link): the menu opens from the ☰ button at the top left. At the bottom of
the menu are the **Theme** switch (light / dark), **Admin login / Lock admin** and **Backup**. Wide tables show
each row as a card with the column names on the left, so nothing is cut off. The search box takes the
header; the page name is the heading under it.

**Pages work like a website.** Every page has its own address, shown after `#` in the address bar,
e.g. `OnePlusFashion_ERP.html#/suppliers` or `#/customer/...` for a customer's profile. So:
- the browser's **Back** and **Forward** buttons move between the pages you visited;
- right-click a menu item, customer name or **Statement** / **View** button and choose
  **Open link in new tab**, or Ctrl-click it (Cmd-click on a Mac), to work in two pages at once.
  All tabs use the same saved data; after saving in one tab, press F5 in the other to see the change;
- you can bookmark a page, and **F5** reloads the page you are on.

If the ERP is left open overnight, at midnight any date box still showing yesterday moves to the new
day and the Dashboard refreshes, so the first entry of the morning gets today's date.

Many fields suggest earlier entries as you type (style codes, materials, shops, invoice numbers,
courier companies). Pick a suggestion to avoid spelling differences. "OPF-101" and "OPF 101"
count as two different styles.

## 4. The daily workflow

| When | What to do | Page |
|---|---|---|
| Fabric arrives | Record the purchase and what you paid | Fabric / Raw Purchase |
| Cutting starts | Create a production order; issue fabric to it | Production Order, Material Issue |
| Goods are finished | Record accepted / rejected pieces | Production / Finished |
| Goods go to the shop | Record dispatched and received pieces | Factory → Shop |
| A customer buys | Make the invoice, print it | Sales / Invoice |
| Money comes in | Record the collection, print the receipt | Payment / Collection |
| A parcel is sent | Record it with tracking and a note; update status on delivery. When the courier pays, enter it on Payment / Collection | Courier / Delivery |
| Any expense | Record it | Expenses |
| End of day / week | Check the Dashboard and Ledgers; **download backups** | Dashboard, Ledgers, Settings |

## 5. Pages, one by one

### Dashboard
- **Coloured buttons** at the top jump to the most-used pages.
- **Period** buttons (Today, Last 7 Days, This Month, This Year, All Time; the dates shown on the right) set the four large panels and the cost chart:
  - **Sales**: number of invoices, total, paid, due and the % collected;
  - **Purchase**: number of purchases, total, paid, due and the % paid;
  - **Cash Flow**: money received (invoice cash + collections) and paid out (purchase payments,
    supplier / factory payments, expenses), and the difference;
  - **Outstanding**: what customers owe in total and what you owe suppliers and factories (always the current total).
- **Six small cards** always show today: sales, collection, customer due, payable, finished
  pieces in stock, and pending parcels.
- **Cost Breakdown** (ring chart): how the period's costs split between purchases, factory bill
  and expenses, with the amounts and percentages beside it. Point at a slice to see its value.
- **Last 30 Days Trend**: daily sales, purchases and expenses. Point at the chart to see each
  day's figures. **Line**, **Bar** and **Table** switch the view; Table lists the numbers day by day.
- **Latest Invoices**: the six newest sales, with **Memo** to print each one.

### Suppliers
The list of fabric and raw-material parties.
- **Previous Due (we owe)**: the amount you owed this supplier before starting the ERP.
- **Current Payable** = Previous Due + purchases − payments. It updates by itself.
- Click a supplier's name or **Statement** to see every purchase and payment with a running balance.

### Fabric / Raw Purchase
Record each purchase challan.
- Enter Quantity, Unit (Yard, Meter, Kg or Pcs), Rate, and any Transport, Loading, Other cost and Discount.
- The grey box shows: **Subtotal** (Qty × Rate) → **Total Purchase Cost** → **Due to Supplier**
  (Total − Paid Now), plus **Landed cost per unit**.
- Decimals are fine, e.g. a rate of 12.5.
- The due goes to the supplier's payable automatically. Pay later from Payment / Collection.

### Raw Material Stock
Fabric stock in **yards** for each material and color: Purchased − Issued + Returned from
production = **Yard**. Also shows the average cost per yard and the stock value.
- Purchases in **Meter** are converted to yards (1 m = 1.0936 yd).
- Materials bought in **Kg** or **Pcs** are listed separately below, in their own unit.

### Production Order
Plan a batch: Style, Color, Size, **Planned Quantity** and **Factory Name**. The order gets a number (PO-0001).
- **Actual** = accepted pieces from Production entries linked to this order.
- **Difference** = Planned − Actual. Positive means still to produce; negative means more was produced than planned.
- Status changes by itself: In Progress once production starts, Completed when Actual reaches
  Planned. Choose **Cancelled** to stop an order.

### Material Issue
Record fabric given to production. Choose the Production Order and the style fills in.
- The grey box shows the yards in stock and the balance after this issue.
- If you issue more than is in stock, the ERP asks before saving.

### Production / Finished
One entry when goods come back from the factory.
- Choose the **Production Order**. Style, Color, Size, Factory and Rate fill in.
- **Accepted PCS** go into godown (factory) stock and count towards the order's Actual.
- **Factory Bill** = Accepted PCS × Rate. It goes to the factory's payable. Rejected pieces are not billed.
- Leftover fabric: enter **Remaining Material Returned (Yd)** and the **Returned Material** name,
  and it goes back into raw stock.

### Factory / Worker
The list of factories and workers, with their default rate per piece, production bill, amount
paid and **Current Payable**. **Statement** shows the full history.

### Style / Product
The product master. Every style code must be unique.
- **Cost / Piece** is used for stock value.
- **Wholesale Price** fills in automatically on invoices.
- Margin % = (Wholesale − Cost) ÷ Cost.
- You can calculate cost and price on the Costing page and save them here.

### Factory → Shop
Record goods moving from a factory to a showroom.
- **From** (factory), **To** (showroom; type a new name to add a new showroom), style, and quantities.
- **Dispatched** leaves godown stock; **Received** enters showroom stock.
- **Due / Shortage** = Dispatched − Received. Example: 1,210 sent, 1,205 received → 5 short.
- If the missing pieces arrive later, **Edit** the transfer and correct Received.

### Showroom Stock
Closing stock for each showroom: received − sold + returned, per style, color and size.

### Customers
The wholesale party list, with a summary of dues.
- **Previous Due**: what the customer owed before starting the ERP. **Credit Limit** is optional;
  customers above it are marked **Over limit**.
- **Summary cards**: total parties, due parties, total due, cash parties, customer advance, highest due.
- **Cash Parties** (left): customers who owe nothing. A customer who paid extra shows "(Advance)".
  **Due Parties** (right): customers who owe money, largest first.
- **Date-wise Due List**: choose From and To and click **Show**. You get:
  - invoices with a due in that period, day by day with subtotals;
  - each party's full due **as on** the To date.
- Click a customer's name, or **View**, to open their profile.

### Customer profile
Opened from search, customer lists, invoices and payments. It shows:
- totals: opening due, sales, returns, received, current due;
- contact details and credit limit;
- the **Ledger Statement** with a running balance;
- every invoice (reprint with **Invoice**), payment (reprint with **Receipt**), return and parcel.

Buttons: **Collect Payment**, **Edit Profile**, **Print Statement**.

### Sales / Invoice
Make a wholesale invoice with as many items as needed.
1. Choose the **Customer**. Check the **Stock Location** (which showroom the goods come from).
2. Fill the item rows: Style Code (press Tab and the rate fills in from the product), Color, Size, Qty.
   Use **+ Add Item** for more rows and **x** to remove a row.
3. Enter the **Discount** and the **Paid Amount** received now. **Paid in Full (Cash)** fills in the full total.
4. The grey box shows **Subtotal → Total Amount → Due Amount** (Total − Paid), plus the
   customer's **Previous Balance** and **Balance After This Invoice**.
5. Click **Save**, or **Save & Print Invoice**.

- If a showroom does not have enough stock, the grey box warns you and the ERP asks before saving.
- The register has tabs: **All**, **Cash** (fully paid) and **Due** invoices.

### Sales Return
Enter the **Original Invoice** number. The customer and location fill in, and so does the item if
the invoice has only one. Enter the return quantity: the **Return Amount** is worked out from the
invoice rate, and you can change it. The amount is credited to the customer and the pieces go back
into that showroom's stock.

### Payment / Collection
Record money received from customers, or paid to suppliers and factories.
1. Choose **Party Type** and **Party**. Or click **Collect** / **Pay** in the lists below the form.
2. The grey box shows the party's breakdown for the day:

   ```
   Previous Due        50,000   (before today)
   + Today's Purchase  10,000
   = Total Due         60,000
   - Paid Today        20,000   (this receipt)
   = Remaining Due     40,000
   ```

3. Enter the amount, method (Cash, Bank, bKash, Nagad, Rocket, Cheque) and reference / transaction number.
4. Save. With **Print receipt after saving** ticked, the **Money Receipt** (customers) or
   **Payment Voucher** (suppliers and factories) prints: the print dialog opens over the page.

- **Due Parties - Detailed** lists every customer who owes money, with today's figures.
- **Payable to Suppliers / Factories** lists whom you owe.

### Expenses
Salary, rent, electricity, transport and other costs, with date, amount, method and location.
They are included in the P/L on the Reports page.

### Courier / Delivery
A simple record of parcels sent. **It never changes any due.**
- Enter the **Invoice No.** and the customer, address and COD (the invoice due) fill in.
- **COD Amount** is a note for your reference only. There is no Advance, Charge or Settled.
- **Note:** anything to remember about the parcel.
- The cards at the top count parcels: Sent, Delivered, Pending and Returned.
- Change a parcel's **Status** from the dropdown in the list (needs the admin password).
- **When the courier pays you,** enter the money on **Payment / Collection** for that customer.
  The customer's due goes down only from that entry.

### Rough Notes
A notepad for ideas, reminders or anything to note: a title, a date, the note, a sketch and a colour.
- Notes show as a board of cards, all the same height, pinned first and then newest first. A long
  note fades out at the bottom of its card; **click the card** (or Preview) to read all of it.
- **New note** opens the writing window. **Ctrl+Enter** saves, **Esc** or Cancel closes it.
- **Preview** shows the full note and the sketch, with **Copy text** (paste it into a message),
  **Delete** and **Edit note**.
- **Pin** (the pin at the top right of a card) keeps a note at the top of the board. Pinning does not
  need the admin password.
- **Search notes** filters as you type. When notes have different colours, the colour chips
  (All / Yellow / Pink ...) show only that colour.
- **Formatting:** select text and use the toolbar: **B** bold, *I* italic, U underline, **H** heading,
  bullet or numbered list, the highlighter (click it again to take the highlight off), **A** for
  text colour, the **link** button, and **Clear** to remove formatting.
- **Links:** select a word, click the link button (or press **Ctrl+K**), paste the address and press
  Enter. With nothing selected, the address itself is put in as a link. Put the cursor in a link and
  click the link button to change the address or **Remove link**. Only web addresses (https://...,
  www...), email (mailto:...) and phone (tel:...) links are allowed. On a card or in the preview, a
  link opens in a new tab.
  Ctrl+B / Ctrl+I / Ctrl+U also work. Pasted text comes in plain (no formatting from other programs).
- **Sketch:** click **Add sketch** and draw with the mouse, a finger or a pen. Pick a colour and a
  line thickness; **Eraser** rubs out, **Undo** removes the last line, **Clear** empties the sketch.
  **Remove sketch** takes it off the note. One sketch per note.
- **Colour:** pick the note's colour (Plain, Yellow, Pink, Green, Blue, Purple, Orange) - for example
  one colour for design ideas and another for reminders. New notes start yellow; the editor shows
  the colour while you write.
- Notes don't change any figure. They are included in backups (.json, and Google Drive). The Excel
  backup has the note text and says "Yes" where a note has a sketch (the drawing itself opens in the ERP).
- Editing or deleting a note needs the admin password, like other records.

### Costing & Stock Summary
**Product Costing:** enter the cost per piece:
- fabric (yards × rate; **Pick fabric** uses the average purchase cost);
- accessories, factory bill, packaging, transport and other overhead.

Then add a **Profit Margin %**.
- The result shows **Total Cost / PC** and **Selling Price / PC** (cost + margin). Enter Planned PCS
  to see the batch cost, sales value and profit.
- Choose a **Product** and click **Save Cost & Selling Price to Product** to update the product
  master (needs the admin password). Choosing the product again later loads its saved costing.

**Stock Summary:**
- pieces in godown vs showroom, and the total;
- pieces per style / design;
- total stock value (pieces × cost per piece);
- raw fabric yards and value;
- a breakdown per showroom.

### Reports
Totals for sales, returns, purchases, factory bill and expenses, and a simple **P/L view**.
Export buttons:
- **Export Everything to Excel**;
- CSV files for Sales Invoices, Sales Items, Purchases, Production, Expenses, Payments and Party Ledger;
- **Print / Save PDF** of the page.

### Ledgers / Due
Tabs for **Customers**, **Suppliers** and **Factories**: opening balance, additions, payments and
current balance for every party, with totals. Click a name for the full statement.

**Reconciliation Check** (bottom):
- It confirms that every transaction belongs to a party and all balances add up (green **Reconciled**).
- Under **Items to review** it lists anything worth checking: duplicate invoice numbers,
  overpayments, negative stock, transfer shortages.

### Users / Activity
The roles in the proposal, and the last 200 actions: what was created, edited or deleted, and when.

### Settings / Backup
- **Shop Branding**: everything printed on the cash memo and receipts:
  - shop name, motto, business description, address, phone numbers, e-mail, hotline;
  - the footer quote and its source;
  - the **shop logo** (PNG / JPG, preferably under 300 KB).

  They start with the details from the shop's printed memo book. **Preview Cash Memo** shows the
  result. Saving needs the admin password.
- **Admin Password**: create or change it.
- **Data Safety**: backup, restore and clear. See [section 8](#8-backup-restore-and-data-safety).

## 6. Editing, deleting and the admin password

- Every register has **Edit** and **Delete**. Both need the **admin password**. So do changing
  settings, restoring a backup, clearing data, changing courier status and saving costing.
- The first time, the ERP asks you to **create** the password (at least 4 characters).
  **Write it down somewhere safe. A forgotten password cannot be recovered.**
- After you enter it, editing stays unlocked for **15 minutes** (the top button shows
  **Admin - Unlocked**). Click it to lock at once.
- **Edit** opens the record in the form with an orange border. Click **Update** to save or **Cancel Edit**.
  Totals, dues and stock recalculate everywhere.
- **Delete** asks for confirmation. A record that other records depend on cannot be deleted; for
  example, a customer with invoices, a production order with production entries, or a sale that has
  a sales return or courier parcel against its invoice. Edit it instead.
- The **invoice number** of a sale that has a return or courier parcel cannot be changed either,
  because those records point at that number.
- Every edit and delete is recorded in **Users / Activity**.

## 7. Printing invoices and receipts

- **Invoices** print from **Save & Print Invoice**, or from the **Invoice** button in any list.
- **Receipts** print automatically after a payment is saved, or from the **Receipt** button.
- The print dialog opens over the ERP page - no new tab. Choose the printer, or **Save as PDF**
  (the file name is suggested, e.g. "Cash Memo INV-00012"). Closing the dialog leaves you on the same page.
- **On a phone or tablet** (iPhone, iPad, Android) the same memo or receipt prints. Tap the button, then
  in the print sheet choose the printer, or share / save it as a PDF.
- **Cash memo layout** (the same design as the shop's printed Cash Memo book):
  - the logo on the left, "Cash Memo" and the shop name, motto, business description, address,
    phone and e-mail in the middle, and the **HOTLINE** number on the right;
  - **Sl. No.** (the invoice number), Date, Name, Mobile, Address and **Courier** (the courier and
    tracking number, once the parcel is recorded on the Courier page);
  - the item table: SL, Product Description, Quantity, Rate, Amount, with the faded One Plus logo
    behind it. A discount shows as a "Less: Discount" line;
  - **Condition** on the left: remarks, a **PAID** or **DUE** stamp, payment method, previous due,
    total due now and the amount in words. **Total**, **Advance** (paid) and **Due** are on the right;
  - the Customer signature line, the Qur'an quote and "From: ONE PLUS FASHION".
- **Logo:** without an uploaded logo, the ERP draws the One Plus logo itself. Upload the shop's
  logo file in Settings to use it on the memo and receipt instead.
- **Money receipt / payment voucher:** the same header and colours, the receipt number, the
  party, the payment breakdown and the amount in words.
- **Dark bars printing blank?** In the print dialog open **More settings** and tick **Background graphics**.
- Any page (a statement, the due list, reports) can be printed with its **Print** button.
  The menu and buttons are left out of the printout.

## 8. Backup, restore and data safety

### Google Drive backup (sign in with Google)

When the ERP is opened from its web link, and the sign-in key is set up (see `docs/CLOUD_SETUP.md`),
every computer shows a sign-in screen the first time:

1. Click **Sign in with Google** and choose the shop's Google account.
2. The ERP connects to Google Drive:
   - **first computer:** its data is uploaded to a folder **One Plus Fashion ERP** in that Drive;
   - **another computer:** the data is downloaded, and the ERP opens with everything as it was;
   - **both have data:** it asks which copy to keep. The other one is saved in Drive as a
     "Conflict copy" file, so nothing is lost.
3. From then on the ERP opens straight away, even without internet.

**Every save is backed up a few seconds later.** The badge at the top shows:

| Badge | Meaning |
|---|---|
| **Synced** (green) | Everything is in Google Drive. |
| **Saving…** / **Changes waiting** (blue) | Uploading, or about to. |
| **Offline – will sync later** (amber) | No internet; changes are kept and go up when it returns. |
| **Click to sync** (amber) | Google access expires about once an hour. Your next click anywhere renews it. |
| **Not signed in** (amber) | This computer isn't backing up. Click the badge to sign in. |
| **Sync problem** (red) | Point at the badge to see why; click it to try again. |

- **Changes made on another computer** come in when the ERP opens or when you come back to its tab.
  A short notice says "Updated with the latest data from Google Drive".
- **Use one computer at a time.** If two computers changed the data while one was offline, the ERP
  asks which copy to keep, as above. Each choice shows its invoice, customer, supplier and payment
  counts and the time of its last change; normally keep the newer one. It never asks for saves made
  on just one computer.
- **Daily copies:** the folder also keeps a copy for each day ("OnePlusFashion ERP Backup <date>.json"),
  the last 30 days. Any of them can be loaded with **Restore from .json** after downloading it from Drive.
- **Settings / Backup → Google Drive backup** shows the account and last sync time, with
  **Sync now** and **Sign out**. Signing out keeps the data on the computer; the sign-in screen
  appears the next time the ERP opens.
- The admin password travels with the data, so it is the same on every computer.
- If **Settings / Backup** says Google Drive backup is "Switched off", the developer has turned it off.
  Everything is still saved on the computer, and changes upload once it is switched back on. Use the
  backup buttons meanwhile.

### Backup files (any version)

**Where the data is:** inside the browser on this computer, plus Google Drive when signed in
(above). Without Google Drive backup it is **not** online and **not** shared with other computers:
if the browser's data is cleared, or Windows / Chrome is reinstalled, it is gone, unless you have a backup.

| Button (Settings / Backup) | What it does |
|---|---|
| **Download Full Backup (Excel .xlsx)** | Every register, ledger and stock report on separate Excel sheets (21 tabs). For reading, accounting and printing. Also on the **Backup** button at the top. |
| **Download Restore File (.json)** | A complete copy that the ERP can load back. **This is the file to use to recover data.** |
| **Restore from .json** | Replaces **all** current data with a restore file. Asks for confirmation. |
| **Clear All Data** | Deletes all records (asks twice). The admin password and shop branding are kept. |

**Do this at least once a week** (daily when busy): download **both** files and copy them to a pen
drive or another computer.

**Moving to a new computer:** download the .json restore file on the old computer. Copy the ERP
folder and the file to the new one. Open the ERP there and use **Restore from .json**.

The first time a newer ERP version opens, it upgrades older saved data by itself. Take a backup before upgrading.

## 9. How the numbers are calculated

| Figure | Formula |
|---|---|
| Purchase total | Qty × Rate + Transport + Loading + Other − Discount |
| Due to supplier (one purchase) | Purchase total − Paid now |
| Supplier payable | Previous Due + Purchases − Paid on purchases − Payments |
| Raw stock (yards) | Purchased + Returned from production − Issued |
| Factory bill | Accepted PCS × Rate |
| Factory payable | Previous Due + Factory bills − Payments |
| Production order difference | Planned − Actual (accepted PCS) |
| Transfer shortage | Dispatched − Received |
| Godown stock | Accepted production − Dispatched |
| Showroom stock | Received − Sold + Returned (per showroom) |
| Invoice total | Σ (Qty × Rate) − Discount |
| Invoice due | Invoice total − Paid on the invoice |
| Customer due | Previous Due + Invoices − Paid on invoices − Returns − Collections (below zero = Advance) |
| Payment breakdown | Previous Due (before the day) + Today's purchases − Paid earlier today − This payment = Remaining |
| Cost per piece | Fabric (yards × rate) + Accessories + Factory + Packaging + Transport + Other |
| Selling price | Cost per piece × (1 + Margin % ÷ 100) |
| Stock value | Pieces in stock × Cost / Piece (from Style / Product) |
| P/L view | Sales − Returns − Purchases − Factory bill − Expenses |

Amounts are rounded to 2 decimals (paisa). Every due shown anywhere comes from the same ledger, so
the Dashboard, customer lists, invoices, receipts, statements and Excel always agree.

## 10. Automatic numbers

| Record | Format | Example |
|---|---|---|
| Invoice | INV- + 5 digits | INV-00001 |
| Money receipt / payment | MR- + 5 digits | MR-00001 |
| Production order | PO- + 4 digits | PO-0001 |
| Material issue slip | IS- + 4 digits | IS-0001 |
| Transfer | TR- + 4 digits | TR-0001 |

The number is filled in for you and continues from the highest one used. You can type your own
invoice number; the ERP refuses a number that already exists.

## 11. Questions and problems

| Problem | What to do |
|---|---|
| The ERP shows a message that the browser is too old | Install Chrome 109 (Windows 7) or Firefox 115, then open START_ERP.bat again. |
| The page is blank or a red "ERP error" box appears | Take a photo of the screen and send it to the developer. Then reload the page (F5). Saved data is not lost. |
| The print dialog does not appear | Wait a second and click the print button again; if it still does not appear, press F5 and retry. |
| "Not enough stock" warning | Check that the stock location is right and that the transfer was recorded. You can still save if the goods really are there. |
| A customer's due looks wrong | Open the customer profile and read the Ledger Statement line by line. Then check Ledgers / Due → Reconciliation Check. |
| Two spellings of the same style or color | Edit the records so they match, and pick from the suggestions when typing. |
| Forgot the admin password | It cannot be recovered in the ERP. Contact the developer. |
| All data disappeared | The browser data was cleared. Use **Restore from .json** with your latest restore file. |
| "Browser storage is full" | Download both backups at once. Then remove a large shop logo in Settings. |

## 12. What this edition does not do

This is the offline, single-computer edition, made for the current Windows 7 laptop. The proposal's
server-based features are not included:
- several users on different computers, or mobile access;
- a login per user with separate role permissions;
- automatic cloud backup;
- barcode scanning;
- multi-branch operation.

These need a server-based version.
