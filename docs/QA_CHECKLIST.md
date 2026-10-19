ONE PLUS FASHION ERP - FINAL CHECK ON THE SHOP LAPTOP
=====================================================

Who: the person who will use the ERP every day, with the shop owner for Part 7.
Time: about 30 minutes. You need a printer with A4 paper and Microsoft Excel.

Follow the steps in order and type exactly what is written. After each step, compare the
screen with the "Expect" line and tick the box:  [x] = same,  [!] = different.
If anything is marked [!], write down the step number and what you saw, take a photo of
the screen, and send both to the developer.

The steps enter SAMPLE data. Part 8 removes it again, so nothing here goes into your real accounts.


PART 1 - BEFORE YOU START (3 min)
---------------------------------

[ ] 1.1  Copy the whole ERP folder to the laptop, e.g. to D:\OnePlusFashion_ERP.
         Expect: the folder contains OnePlusFashion_ERP.html, START_ERP.bat, and the folders assets and js.

[ ] 1.2  If the ERP already holds real data on this laptop: open it, go to Settings / Backup,
         click "Download Restore File (.json)" and keep that file safe (e.g. on a pen drive).

[ ] 1.3  Open the folder "tests" and double-click browser-smoke.html.
         Expect: a green heading "PASS - this browser runs the ERP correctly" and "Checks passed: 23 / 23".
         (This test uses temporary data only. It does not touch your ERP data.)
         Write the "Browser:" line here: ______________________________

[ ] 1.4  Double-click START_ERP.bat.
         Expect: the ERP opens with the Dashboard, the grouped sidebar menu on the left and the clock at the top.
         Click the moon at the top: the screen turns dark. Click the sun to go back.


PART 2 - PURCHASE AND PRODUCTION (8 min)
----------------------------------------

[ ] 2.1  Suppliers: Party Name = Rahim Fabrics, Mobile = 01811111111. Click Save.
         Expect: Rahim Fabrics appears in the Supplier Register.

[ ] 2.2  Fabric / Raw Purchase: Supplier = Rahim Fabrics, Challan = CH-101, Material = Cotton Twill,
         Color = Black, Quantity = 1000, Unit = Yard, Rate = 12.5, Transport = 500, Loading = 250,
         Other = 100, Discount = 350, Paid Now = 10000.  (Do not save yet.)
         Expect in the grey box:  Subtotal 12,500.00   Total Purchase Cost 13,000.00
                                  Due to Supplier 3,000.00   Landed cost per Yard 13.00
         Now click Save.

[ ] 2.3  Raw Material Stock.
         Expect: Cotton Twill | Black | Purchased 1,000 | Issued 0 | Returned 0 | Yard 1,000

[ ] 2.4  Factory / Worker: Name = Star Garments, Default Rate / PCS = 25. Save.

[ ] 2.5  Production Order: Style Code = OPF-101, Color = Black, Size = M, Planned Quantity = 1500,
         Factory Name = Star Garments. Save.
         Expect: Order No. PO-0001 in the list.

[ ] 2.6  Production / Finished: choose Production Order = PO-0001.
         Expect: Style OPF-101, Color Black, Size M, Factory Star Garments and Rate 25 fill in by themselves.
         Type Produced / Accepted PCS = 1210.
         Expect in the grey box: Factory Bill 30,250.00 and Difference 290. Save.

[ ] 2.7  Production Order.
         Expect: PO-0001 | Star Garments | Planned 1,500 | Actual 1,210 | Difference 290 | In Progress

[ ] 2.8  Factory → Shop: From = Star Garments, Style = OPF-101, Color = Black, Size = M,
         Dispatched = 1210, Received = 1205.
         Expect in the grey box: Due / Shortage 5 PCS. Save.
         Expect: transfer TR-0001 with Due / Shortage 5.


PART 3 - SALES, PAYMENT, COURIER (8 min)
----------------------------------------

[ ] 3.1  Style / Product: Style Code = OPF-101, Product Name = Men Polo, Cost / Piece = 220,
         Wholesale Price = 300. Save.

[ ] 3.2  Customers: Name = Karim Store, Mobile = 01711111111, Address = Bongo Bazar,
         District = Dhaka, Previous Due = 50000. Save.

[ ] 3.3  Sales / Invoice: Customer = Karim Store.
         Item row 1: Style Code = OPF-101 (press Tab), Color = Black, Size = M, Qty = 20.
         Expect: Rate fills in as 300 by itself.
         Item row 2: Style Code = OPF-101 (press Tab), Color = Black, Size = M, Qty = 15.
         Discount = 500, Paid Amount = 0.
         Expect in the grey box:  Subtotal (2 items, 35 PCS) 10,500.00   Total Amount 10,000.00
                                  Due Amount 10,000.00   Customer Previous Balance 50,000.00
                                  Balance After This Invoice 60,000.00

[ ] 3.4  Click "Save & Print Invoice".
         Expect: the print dialog opens over the ERP page showing the cash memo - no new tab opens.
         Print it on A4 paper, then check the paper in Part 5. After printing you are still on the Sales page.

[ ] 3.5  Payment / Collection: in "Due Parties", click Collect next to Karim Store.
         Amount Paid Now = 20000, Method = bKash, Reference = TRX12345.
         Expect in the grey box:  Previous Due 50,000.00   + Today's Purchase 10,000.00
                                  = Total Due 60,000.00    - Paid Today 20,000.00
                                  = Remaining Due 40,000.00
         Leave "Print receipt after saving" ticked and click Save.
         Expect: the print dialog opens by itself showing the Money Receipt - no new tab. Print it.

[ ] 3.6  Courier / Delivery: Invoice No. = INV-00001 (press Tab).
         Expect: Customer = Karim Store, Destination = Bongo Bazar, Dhaka, COD = 10000 fill in by themselves.
         Change: Courier = Pathao, Tracking = PT-1, Note = Deliver after 5 pm. (No Advance or Charge fields.)
         Save.
         Expect: the parcel is in the list with its note, and "Pending Parcels 1" at the top.
         Expect: Customer Due on the Dashboard is the same as before (a parcel never changes dues).

[ ] 3.7  Rough Notes (left menu): click "New note". Title = Idea. In the note type "Try a ", click B,
         type "blue denim", click B again, type " style", press Enter, type "Ask the price".
         Click "Add sketch" and draw a line with the mouse. Click Save.
         Expect: a yellow card with "blue denim" in bold, "Ask the price" on the next line, and the
         drawing. Type "denim" in Search notes: only this note shows. Click the card: the preview
         opens with the full note and the sketch. Press Esc to close it.


PART 4 - REPORTS AND CONTROLS (5 min)
-------------------------------------

[ ] 4.1  Costing & Stock Summary: Fabric Yards / PC = 1.5, Fabric Rate / Yard = 100, Accessories = 20,
         Factory Bill = 25, Packaging = 5, Transport = 3, Other = 2, Profit Margin % = 20, Planned PCS = 100.
         Expect: Total Cost / PC 205.00, Selling Price / PC 246.00, Total Profit 4,100.00.
         Expect in Stock Summary: Godown 0, Showroom 1,170, Total 1,170, Finished Stock Value 257,400.00.

[ ] 4.2  Customers.
         Expect: Due Parties 1, Total Due Amount 40,000.00. Karim Store is listed under "Due Parties" (right side).

[ ] 4.3  Dashboard.
         Expect: Today Sales 10,000.00 | Today Collection 20,000.00 | Customer Due 40,000.00 |
                 Supplier / Factory Payable 33,250.00 | Finished Stock PCS 1,170 | Pending Parcels 1 / 1

[ ] 4.4  Ledgers / Due.
         Expect: three green "Reconciled" labels, and under "Items to review":
                 "1 transfer(s) have short delivery totalling 5 PCS."

[ ] 4.5  Customers: click Edit next to Karim Store.
         Expect: a "Create Admin Password" window. Type a password twice (write it down safely: ________).
         Change Mobile to 01722222222 and click Update.
         Expect: Karim Store now shows 01722222222. There is still only one Karim Store.

[ ] 4.6  Click "Admin: Unlocked" at the top so it shows "Admin: Locked". Click Edit on Karim Store again
         and type a wrong password.
         Expect: "Wrong password." Click Cancel.

[ ] 4.7  In the search bar at the top, type 01722.
         Expect: "Karim Store 01722222222 | Due 40,000.00". Press Enter.
         Expect: the customer profile with Current Due 40,000.00, the ledger, invoice INV-00001 and receipt MR-00001.


PART 5 - PRINTED PAPER (3 min)
------------------------------

[ ] 5.1  Cash memo paper: everything fits on one A4 page. Nothing is cut off at the right edge.
[ ] 5.2  Cash memo paper: the dark blue labels (Sl. No., Name, Date ...), the red shop name and the
         coloured columns are printed (not blank). If they are blank: in the print dialog open
         "More settings" and tick "Background graphics".
[ ] 5.3  Cash memo paper shows: Cash Memo, HOTLINE 01878638475, Sl. No. INV-00001, Karim Store,
         Less: Discount - 500.00, Total 10,000.00, Advance 0.00, Due 10,000.00, a DUE stamp,
         Previous Due: 50,000.00, Total Due Now: 60,000.00, "Ten Thousand Taka Only", the Qur'an quote.
         Lay it next to a page of the printed memo book: the layout should look the same.
[ ] 5.4  Receipt paper shows: Money Receipt, MR-00001, bKash - TRX12345, Remaining Due 40,000.00,
         "Twenty Thousand Taka Only".
[ ] 5.5  Print the invoice again, choosing "Save as PDF". Open the PDF.
         Expect: it looks the same as the paper.
[ ] 5.6  Owner: does the cash memo match the printed memo book closely enough? For the exact logo,
         upload the logo file in Settings / Backup and print again. Comments: ________________________


PART 6 - EXCEL AND BACKUP (4 min)
---------------------------------

[ ] 6.1  Settings / Backup: click "Download Full Backup (Excel .xlsx)".
         Open the downloaded file OnePlusFashion_ERP_Backup_<date>.xlsx in Excel.
         Expect: Excel opens it without a warning or a "repair" message.
[ ] 6.2  Expect: tabs at the bottom from "Summary" through "Activity Log" (21 tabs).
[ ] 6.3  Customers tab: Karim Store, Current Due 40,000.00 (the number is right-aligned, so Excel reads it as a number).
[ ] 6.4  Click the Current Due cell and use AutoSum (Σ).
         Expect: Excel calculates the total. (That shows the values are real numbers, not text.)
[ ] 6.5  Settings / Backup: click "Download Restore File (.json)". Keep the file.


PART 7 - OWNER SIGN-OFF ON THE BUSINESS RULES (5 min)
-----------------------------------------------------

The owner reads each rule and confirms it matches how the shop keeps its books.

[ ] 7.1  Customer due = Previous Due + Sales − Paid on invoice − Returns − Collections.
[ ] 7.2  A customer who pays more than they owe is shown with "(Advance)" and listed as a cash party.
[ ] 7.3  Supplier payable = Previous Due + Purchases − Payments.
         A purchase costs Qty × Rate + Transport + Loading + Other − Discount.
[ ] 7.4  Factory payable = Accepted PCS × Rate − Payments. Rejected pieces are not paid.
[ ] 7.5  Courier / Delivery is a record only: dues change only through Sales and Payment / Collection entries.
[ ] 7.6  Transfer shortage (Dispatched − Received) is only reported; it is not charged to anyone.
[ ] 7.7  P/L on the Reports page = Sales − Returns − Purchases − Factory Bill − Expenses (a simple cash view).
Owner comments: _______________________________________________________________


PART 8 - REMOVE THE SAMPLE DATA
-------------------------------

[ ] 8.1  Settings / Backup: click "Clear All Data" and confirm both questions.
         Expect: the Dashboard shows 0.00 everywhere. The admin password and shop name are kept.
[ ] 8.2  Only if you made a backup in step 1.2: click "Restore from .json" and choose that file.
         Expect: your real data is back.
[ ] 8.3  From now on, download both backups (Excel and .json) at least once a week and copy them
         to a pen drive or another computer.


RESULT
------
All boxes [x]:  the ERP is ready for live use on this laptop.
Any box [!]:    send the step numbers, what you saw and photos to the developer before going live.

Checked by: ______________________   Date: ____________   Laptop / browser: ______________________
