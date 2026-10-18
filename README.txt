ONE PLUS FASHION — SMART OFFLINE ERP v4
Windows 7 / 64-bit / 4 GB RAM / NO PYTHON
============================================

I reworked the ERP around the attached Intu's Algorithm requirements.

Run:
1) Extract this ZIP.
2) Double-click START_ERP.bat.
3) No Python, MySQL, Node.js or VPS is required for this single-computer edition.
4) Use Google Chrome 73 or newer (Chrome 109 is the last version for Windows 7) or Firefox.
   Older browsers show a message explaining this.

Files:
The ERP is the whole folder, not only the .html file. Always copy or move these together:
  OnePlusFashion_ERP.html, START_ERP.bat, assets\ and js\
The folders docs\ and tests\ are for developers and are not needed to run the ERP.

How to use the ERP: see docs\USER_GUIDE.md (every page, printing, backups, formulas, troubleshooting).

Before going live:
- Double-click tests\browser-smoke.html. It must say "PASS - this browser runs the ERP correctly".
  (It uses temporary data only and never changes your ERP data.)
- Follow docs\QA_CHECKLIST.md (about 30 minutes) on the laptop that will run the ERP.

Main workflow:
Supplier -> Purchase -> Raw Material Stock -> Material Issue -> Production Order
-> Production -> Finished Goods -> Factory/Shop Transfer -> Showroom Stock
-> Customer Sale -> Customer Ledger -> Payment -> Courier -> Invoice -> P/L

Modules:
- Dashboard
- Supplier / Fabric Party
- Fabric & Raw Material Purchase
- Raw Material Stock
- Production Order
- Material Issue
- Simplified Production Entry
- Factory / Worker
- Style / Product / Barcode
- Factory -> Shop Transfer
- Showroom Stock
- Customer Management
- Wholesale Sales / Invoice
- Sales Return
- Payment / Collection
- Money Receipt
- Expense
- Courier / COD / Tracking
- Product Costing
- Reports / CSV (Excel-compatible)
- Customer Ledger / Due
- Users / Activity
- Backup / Restore
- Print / Save PDF

Important:
The proposal calls for automatic cloud backup, secure login/role permissions, multi-user mobile/web access,
barcode scanning, complete server database and future multi-branch support. Those require a server-based deployment.
This edition is deliberately offline/lightweight for your current old laptop and is designed to avoid heavy dependencies.

New in v4:
- Admin password: editing or deleting any record asks for the admin password (created on first use,
  changed in Settings / Backup). Admin stays unlocked for 15 minutes; click "Admin: Unlocked" to lock.
  If the password is forgotten it cannot be recovered - keep it written somewhere safe.
- Search bar (top): type a customer name or mobile number to open their full history and ledger.
- Download Full Backup now creates an Excel (.xlsx) file with every register and ledger.
  To restore data into the ERP, use "Download Restore File (.json)" and "Restore from .json".
- Invoices and money receipts print straight from the ERP page: the print dialog opens over it (no new tab).
- Upload your shop logo in Settings / Backup; it is printed on invoices and receipts.
- Existing v3 data is upgraded automatically the first time v4 opens. Take a backup before upgrading.

Data:
Local browser storage. Back up regularly and keep backup copies on another drive.
Before using for live accounts, enter a small sample and reconcile totals with your books.
