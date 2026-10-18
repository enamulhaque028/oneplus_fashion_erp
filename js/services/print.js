/* Printed documents, laid out like the shop's printed "Cash Memo" book:
   the cash memo (invoice) and the money receipt / payment voucher.
   Printed from a hidden frame in the ERP page (no new tab), styled by assets/css/print.css.
   Shop details come from Settings. */
(function (OPF) {
  "use strict";

  const C = OPF.config, K = OPF.calc, L = OPF.ledger;
  const { esc, lc, num, r2, money, fmtQty, dueText, amountWords, today } = OPF.util;

  // Item area height on an A4 memo; rows use about 8.2 mm each, the rest is blank lined space.
  const BODY_MM = 132, ROW_MM = 8.2;

  // Print inside this page from a hidden frame - no new tab or window (and nothing for a
  // pop-up blocker to stop). The frame stays until the next print so tests can read it.
  let count = 0;
  function printWindow(title, body) {
    const old = document.getElementById("printFrame");
    if (old) old.remove();
    const frame = document.createElement("iframe");
    frame.id = "printFrame";
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    // Off screen at A4 size (not display:none: some browsers would then print an empty page).
    frame.style.cssText = "position:absolute;left:-10000px;top:0;width:210mm;height:297mm;border:0";
    document.body.appendChild(frame);
    const win = frame.contentWindow, doc = win.document;
    const css = new URL("assets/css/print.css", document.baseURI).href;
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><link rel="stylesheet" href="${css}"></head><body>${body}</body></html>`);
    doc.close();
    count++;
    // Print once the stylesheet has loaded (listeners must be added after document.open()).
    const ready = () => setTimeout(() => OPF.print.output(win), 50);
    if (doc.readyState == "complete") ready(); else win.addEventListener("load", ready);
  }

  // Opens the browser's print dialog for the frame. The page title is borrowed so "Save as PDF"
  // suggests e.g. "Cash Memo INV-00012". The self-test page replaces this to stay silent.
  function output(win) {
    const title = document.title;
    document.title = win.document.title;
    win.focus();
    win.print();
    setTimeout(() => { document.title = title; }, 1000);
  }


  /* ---- brand mark: the One Plus "op" logo, drawn so no image file is needed ----
     boxed = dark tile for the header; otherwise the pale watermark version. */
  function brandMark(boxed) {
    const wings = [[14, 74, 58, 56, 18], [20, 88, 56, 54, 24], [26, 102, 54, 52, 30]]
      .map(([x1, y, x2, x3, x4]) => `<polygon class="wing" points="${x1},${y} ${x2},${y} ${x3},${y + 8} ${x4},${y + 8}"/><polygon class="wing" points="${200 - x1},${y} ${200 - x2},${y} ${200 - x3},${y + 8} ${200 - x4},${y + 8}"/>`).join("");
    return `<svg class="mark" viewBox="0 0 200 ${boxed ? 196 : 214}" xmlns="http://www.w3.org/2000/svg">` +
      (boxed ? '<defs><linearGradient id="mboxg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f3f37"/><stop offset="1" stop-color="#0d1411"/></linearGradient></defs><rect class="box" width="200" height="196" rx="18"/>' : "") +
      '<polyline class="chev" points="42,70 100,34 158,70"/><polyline class="chev" points="42,118 100,154 158,118"/>' + wings +
      '<circle class="opline" cx="82" cy="94" r="14"/><circle class="opline" cx="120" cy="94" r="14"/><rect class="op" x="100.5" y="90" width="11" height="36"/>' +
      `<text class="word" x="100" y="${boxed ? 184 : 204}" text-anchor="middle">ONE PLUS</text></svg>`;
  }

  const logo = () => { const src = OPF.store.db.company.logo; return src ? `<img src="${src}" alt="">` : brandMark(true); };
  const watermark = () => { const src = OPF.store.db.company.logo; return `<div class="mark-wm">${src ? `<img src="${src}" alt="">` : brandMark(false)}</div>`; };

  // Logo | "Cash Memo" pill, shop name, motto, description, address, phone / e-mail | hotline
  function header(docTitle) {
    const co = OPF.store.db.company;
    const contact = [co.phone ? "Phone: " + co.phone : "", co.email ? "E-mail: " + co.email : ""].filter(Boolean).join(", ");
    return `<div class="mhead"><div class="mlogo">${logo()}</div><div class="mshop">` +
      `<div class="mtop"><span class="pill">${esc(docTitle)}</span>` +
      (co.hotline ? `<div class="mhot"><span class="badge">HOTLINE</span><div class="num"><span class="wa"></span>${esc(co.hotline)}</div></div>` : "") + "</div>" +
      // textLength stretches the name to the full width whatever font the computer has.
      `<svg class="mname" viewBox="0 0 1000 96" preserveAspectRatio="none"><text x="4" y="84" font-size="100" textLength="992" lengthAdjust="spacingAndGlyphs">${esc(String(co.name || "").toUpperCase())}</text></svg>` +
      (co.motto ? `<div class="mmotto"><span>${esc(co.motto)}</span></div>` : "") +
      (co.tagline ? `<svg class="mdesc" viewBox="0 0 1000 52" preserveAspectRatio="none"><text x="2" y="40" font-size="40" textLength="${Math.min(990, co.tagline.length * 20)}" lengthAdjust="spacingAndGlyphs">${esc(co.tagline)}</text></svg>` : "") +
      (co.address ? `<div class="maddr">${esc(co.address)}</div>` : "") +
      (contact ? `<div class="mphone">${esc(contact)}</div>` : "") +
      "</div></div>";
  }

  // rows: [[leftLabel, leftValue, rightLabel, rightValue, leftPlain?]]; values are HTML (escaped by caller)
  function infoRows(rows) {
    return '<table class="minfo"><colgroup><col style="width:1%"><col><col class="gap"><col style="width:1%"><col style="width:62mm"></colgroup>' +
      rows.map(([l, lv, r, rv, plain]) => `<tr><td class="lab">${l}</td><td class="val${plain ? " plain" : ""}">${lv}</td><td class="gap"></td><td class="lab">${r}</td><td class="val">${rv}</td></tr>`).join("") +
      "</table>";
  }

  function footer(leftLabel) {
    const co = OPF.store.db.company;
    return `<div class="msign"><div class="cust">${leftLabel}</div>` +
      (co.memoNote ? `<div class="quote">${esc(co.memoNote)}${co.quoteSource ? `<span class="src">${esc(co.quoteSource)}</span>` : ""}</div>` : "<div></div>") +
      `<div class="from">From: <span>${esc(String(co.name || "").toUpperCase())}</span></div></div>`;
  }

  const address = (p) => esc([p.address, p.district].filter(Boolean).join(", "));
  const courierFor = (s) => OPF.store.db.courier.find((c) => s.invoice && lc(c.invoice) == lc(s.invoice));

  /* ---- cash memo ---- */
  function invoiceHtml(s, c, previousDue) {
    const total = K.saleTotal(s), due = K.saleDue(s), paid = r2(s.paid), totalDue = r2(previousDue + due);
    const parcel = courierFor(s);
    const cells = (sl, desc, qty, rate, amt, cls) => `<tr${cls ? ` class="${cls}"` : ""}><td class="c-sl">${sl}</td><td class="c-desc">${desc}</td><td class="c-qty">${qty}</td><td class="c-rate">${rate}</td><td class="c-amt">${amt}</td></tr>`;

    const rows = s.items.map((i, n) => {
      const p = OPF.store.productByStyle(i.style);
      const detail = [p && p.name, [i.color, i.size].filter(Boolean).join(" / ")].filter(Boolean).join(" · ");
      return cells(n + 1, `<b>${esc(i.style)}</b>${detail ? ` <small>${esc(detail)}</small>` : ""}`, fmtQty(i.qty), money(i.rate), money(K.itemAmount(i)));
    });
    if (num(s.discount)) rows.push(cells("", "Less: Discount", "", "", "- " + money(s.discount), "less"));
    const fillMm = Math.max(6, BODY_MM - rows.length * ROW_MM);

    return `<div class="memo">${header("Cash Memo")}` +
      infoRows([
        ["Sl. No.", esc(s.invoice || s.id), "Date", esc(s.date), true],
        ["Name", esc(c.name || ""), "Mobile", esc(c.mobile || "")],
        ["Address", address(c), "Courier", parcel ? esc([parcel.courier, parcel.tracking].filter(Boolean).join(" - ")) : ""]
      ]) +
      `<div class="mwrap"><table class="mitems"><thead><tr><th class="c-sl">SL</th><th>Product Description</th><th class="c-qty">Quantity</th><th class="c-rate">Rate</th><th class="c-amt">Amount</th></tr></thead>` +
      `<tbody>${rows.join("")}${cells("", "", "", "", "", "fill").replace('<td class="c-sl">', `<td class="c-sl" style="height:${fillMm}mm">`)}</tbody></table>${watermark()}</div>` +
      '<table class="mfoot"><tr>' +
      `<td class="cond" rowspan="3"><b class="h">Condition:</b> ${esc(s.remarks || "")}<br>` +
      `<span class="stamp ${due > 0 ? "due" : "paid"}">${due > 0 ? "DUE" : "PAID"}</span>Payment: ${esc(s.method || "-")} &nbsp;|&nbsp; Total Qty: ${fmtQty(K.salePcs(s))} PCS<br>` +
      `Previous Due: ${dueText(previousDue)} &nbsp;|&nbsp; Total Due Now: <b>${dueText(totalDue)}</b><br>In words: ${amountWords(total)}</td>` +
      `<td class="tl">Total</td><td class="tv">${money(total)}</td></tr>` +
      `<tr><td class="tl">Advance</td><td class="tv">${money(paid)}</td></tr>` +
      `<tr><td class="tl">Due</td><td class="tv">${dueText(due)}</td></tr></table>` +
      footer("Customer") + "</div>";
  }

  /* ---- money receipt / payment voucher ---- */

  // Breakdown rows shared by the payment form and the printed receipt: [label, value, bold?]
  function snapshotRows(s, type) {
    const customer = type == "Customer";
    const rows = [["Previous Due", money(s.prev)], ["+ " + (customer ? "Today's Purchase" : "Today's Bill"), money(s.bill)], ["= Total Due", money(s.total), true]];
    if (s.less) rows.push(["- " + (customer ? "Paid / Returned earlier today" : "Paid earlier today"), money(s.less)]);
    rows.push(["- " + (customer ? "Paid Today (this receipt)" : "Paid Now (this voucher)"), money(s.paid)], ["= Remaining Due", dueText(s.remaining), true]);
    return rows;
  }

  function receiptHtml(p) {
    const party = OPF.store.byId(C.PARTY_COLL[p.type], p.party) || {};
    const customer = p.type == "Customer";
    const snap = p.snap || { prev: 0, bill: 0, total: 0, less: 0, paid: num(p.amount), remaining: L.balance(p.type, p.party) };
    return `<div class="memo">${header(customer ? "Money Receipt" : "Payment Voucher")}` +
      infoRows([
        ["Receipt No.", esc(p.no || p.id), "Date", esc(p.date), true],
        [customer ? "Received From" : "Paid To", esc(party.name || p.party) + ` <small>(${esc(p.type)})</small>`, "Mobile", esc(party.mobile || "")],
        ["Address", address(party), "Method", esc([p.method, p.reference].filter(Boolean).join(" - "))]
      ]) +
      `<table class="rtable"><thead><tr><th>Description</th><th class="r">Amount</th></tr></thead><tbody>` +
      snapshotRows(snap, p.type).map((r) => `<tr${r[2] ? ' class="g"' : ""}><td>${r[0]}</td><td class="r">${r[1]}</td></tr>`).join("") +
      "</tbody></table>" +
      `<table class="mfoot"><tr><td class="cond"><b class="h">In words:</b> ${amountWords(p.amount)}${p.remarks ? `<br>Remarks: ${esc(p.remarks)}` : ""}</td><td class="tl">Amount</td><td class="tv">${money(p.amount)}</td></tr></table>` +
      footer(customer ? "Customer" : "Receiver") + "</div>";
  }

  function invoice(id) {
    const s = OPF.store.byId("sales", id);
    if (s) printWindow("Cash Memo " + (s.invoice || ""), invoiceHtml(s, OPF.store.byId("customers", s.customer) || {}, L.invoicePreviousDue(s)));
  }

  function receipt(id) {
    const p = OPF.store.byId("payments", id);
    if (p) printWindow((p.type == "Customer" ? "Money Receipt " : "Payment Voucher ") + (p.no || ""), receiptHtml(p));
  }

  // Latest invoice, or a sample one when there are no sales yet.
  function preview() {
    const sales = OPF.store.db.sales;
    if (sales.length) { invoice(sales[sales.length - 1].id); return; }
    const sample = {
      id: "sample", invoice: "INV-00001", date: today(), location: C.MAIN_SHOP, method: "Cash", discount: 200, paid: 5000,
      items: [{ style: "OPF-101", color: "Black", size: "M", qty: 20, rate: 350 }, { style: "OPF-102", color: "Navy", size: "L", qty: 10, rate: 420 }]
    };
    printWindow("Cash Memo Preview", invoiceHtml(sample, { name: "Sample Fashion House", mobile: "01700000000", address: "Bongo Bazar", district: "Dhaka" }, 3000));
  }

  OPF.print = { invoice, receipt, preview, snapshotRows, brandMark, output, get count() { return count; } };
  OPF.actions.register({
    "print.invoice": (el) => invoice(el.dataset.id),
    "print.receipt": (el) => receipt(el.dataset.id),
    "print.preview": preview
  });
})(window.OPF = window.OPF || {});
