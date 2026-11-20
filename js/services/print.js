/* Printed documents, laid out like the shop's printed "Cash Memo" book:
   the cash memo (invoice) and the money receipt / payment voucher.
   Printed from a hidden frame in the ERP page (no new tab), styled by assets/css/print.css.
   Shop details come from Settings. */
(function (OPF) {
  "use strict";

  const C = OPF.config, K = OPF.calc, L = OPF.ledger;
  const { esc, lc, num, r2, money, fmtQty, dueText, amountWords, today } = OPF.util;

  // The memo book has 19 numbered item lines; items fill them from the top and the rest stay blank.
  // Phones print with bigger page margins (iOS adds its own), so they get fewer lines.
  const LINES = 19, PHONE_LINES = 14;

  // Phones and tablets: iPhone / iPad browsers (all WebKit) print the whole page instead of a
  // hidden frame, so there the document is printed from the page itself (printInPage).
  const isMobile = () => /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    (navigator.platform == "MacIntel" && navigator.maxTouchPoints > 1); // iPad asking for the desktop site

  // Print inside this page from a hidden frame - no new tab or window (and nothing for a
  // pop-up blocker to stop). The frame stays until the next print so tests can read it.
  let count = 0;
  function printWindow(title, body) {
    if (isMobile()) { printInPage(title, body); return; }
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

  /* Phones: the document goes into #printDoc (hidden on screen) and print.css is switched on only
     while printing - it is preloaded as <link id="printCss" media="not all">, so the print dialog
     opens at once, still inside the tap (iOS needs that), and its page-wide rules never touch the
     ERP screen or the "Print this page" reports. */
  function printInPage(title, body) {
    let css = document.getElementById("printCss");
    if (!css) { // normally preloaded in the page's <head>
      css = document.createElement("link");
      css.id = "printCss"; css.rel = "stylesheet"; css.media = "not all";
      css.href = new URL("assets/css/print.css", document.baseURI).href;
      document.head.appendChild(css);
    }
    let doc = document.getElementById("printDoc");
    if (doc) doc.remove();
    doc = document.createElement("div");
    doc.id = "printDoc";
    doc.innerHTML = body;
    document.body.appendChild(doc);
    count++;
    OPF.print.outputPage(title);
  }

  // Switched back after printing, or at the next tap (iPhone's print sheet does not block the page,
  // so no timer: the memo must stay "printable" until the sheet has made its preview). Leaving it
  // on a little longer is harmless - it only applies to printing, never to the screen.
  function outputPage(title) {
    const css = document.getElementById("printCss"), old = document.title;
    const done = () => {
      document.body.classList.remove("print-doc");
      css.media = "not all";
      document.title = old;
      window.removeEventListener("afterprint", done);
      document.removeEventListener("pointerdown", done, true);
    };
    css.media = "print";
    document.body.classList.add("print-doc");
    document.title = title;
    window.addEventListener("afterprint", done);
    setTimeout(() => document.addEventListener("pointerdown", done, true), 0);
    // The memo styles normally loaded with the page; if not yet (printing right after opening),
    // wait for them so the print is not laid out without them.
    if (css.sheet) window.print();
    else css.addEventListener("load", () => window.print());
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
     Shapes measured from the logo the shop supplied (1280 px artwork, kept in its coordinates):
     two white chevron bands, three orange wing bars each side and the red "op".
     boxed = black square tile (sidebar, sign-in); "memo" = the memo book's wider rounded tile;
     otherwise the pale watermark version.
     assets/img/favicon.svg draws the same shapes: change both together. */
  const WING_BARS = [[560, 598], [620, 658], [680, 718]];
  function brandMark(boxed) {
    // The wings' outer ends follow one slanted line; the right wing mirrors the left (x -> 1280 - x).
    const edge = (y) => +(186 + (y - 560) * 0.6).toFixed(1);
    const wings = WING_BARS.map(([t, b]) => {
      const l = `${edge(t)},${t} 396,${t} 396,${b} ${edge(b)},${b}`, rt = `${1280 - edge(t)},${t} 884,${t} 884,${b} ${1280 - edge(b)},${b}`;
      return `<polygon class="wing" points="${l}"/><polygon class="wing" points="${rt}"/>`;
    }).join("");
    const box = boxed == "memo" ? [120, 264, 1040, 752, 56] : boxed ? [136, 136, 1008, 1008, 0] : null;
    return `<svg class="mark" viewBox="${box ? box.slice(0, 4).join(" ") : "176 325 928 630"}" xmlns="http://www.w3.org/2000/svg">` +
      (box ? `<rect class="box" x="${box[0]}" y="${box[1]}" width="${box[2]}" height="${box[3]}" rx="${box[4]}"/>` : "") +
      '<polygon class="band" points="640,335 930,502 882,521 640,388 398,521 350,502"/>' +
      '<polygon class="band" points="640,944 930,777 882,758 640,891 398,758 350,777"/>' + wings +
      '<circle class="opline" cx="541" cy="605.5" r="78"/><circle class="opline" cx="730" cy="605.5" r="78"/><rect class="op" x="627" y="605" width="42" height="207"/></svg>';
  }

  /* ---- "ONE PLUS" lettering of the memo book (red ONE, black PLUS), drawn as thick rounded
     strokes: its typeface is not on the shop's computer. Letters are 100 units high. */
  const LETTER = 22, CORNER = 16;
  // A stroke through the points with rounded corners (outer radius about one stroke width).
  function rounded(pts, closed) {
    const n = pts.length, at = (i) => pts[(i + n) % n];
    let d = "";
    const corner = (i) => {
      const [px, py] = at(i - 1), [cx, cy] = at(i), [nx, ny] = at(i + 1);
      const l1 = Math.hypot(cx - px, cy - py), l2 = Math.hypot(nx - cx, ny - cy);
      const ux = (cx - px) / l1, uy = (cy - py) / l1, vx = (nx - cx) / l2, vy = (ny - cy) / l2;
      return `L${cx - ux * CORNER},${cy - uy * CORNER}A${CORNER},${CORNER} 0 0 ${ux * vy - uy * vx > 0 ? 1 : 0} ${cx + vx * CORNER},${cy + vy * CORNER}`;
    };
    if (closed) {
      const [ax, ay] = pts[0], [bx, by] = pts[1];
      d = `M${(ax + bx) / 2},${(ay + by) / 2}`;
      for (let i = 1; i <= n; i++) d += corner(i);
      return d + "Z";
    }
    d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < n - 1; i++) d += corner(i);
    return d + `L${pts[n - 1][0]},${pts[n - 1][1]}`;
  }
  const LETTERS = {
    O: [150, [[[11, 11], [139, 11], [139, 89], [11, 89]], true]],
    N: [120, [[[11, 100], [11, 11], [109, 11], [109, 100]]]],
    E: [92, [[[92, 11], [11, 11], [11, 89], [92, 89]]], [[[11, 50], [84, 50]]]],
    P: [124, [[[11, 100], [11, 11], [113, 11], [113, 56], [11, 56]]]],
    L: [96, [[[11, 0], [11, 89], [96, 89]]]],
    U: [120, [[[11, 0], [11, 89], [109, 89], [109, 0]]]],
    S: [112, [[[112, 11], [11, 11], [11, 50], [101, 50], [101, 89], [0, 89]]]]
  };
  function lettering(word, x0) {
    let x = x0, d = "";
    word.split("").forEach((ch) => {
      const [w, ...strokes] = LETTERS[ch];
      strokes.forEach(([pts, closed]) => { d += rounded(pts.map(([px, py]) => [px + x, py]), closed); });
      x += w + 16;
    });
    return d;
  }
  // The memo prints this lettering for One Plus; any other shop name is printed as text.
  const isOnePlus = () => /^\s*one\s*plus\b/i.test(OPF.store.db.company.name || "");
  function wordmark(cls) {
    const one = lettering("ONE", 0), plus = lettering("PLUS", 440);
    const paths = (w) => `<path class="w1" d="${one}" stroke-width="${w}"/><path class="w2" d="${plus}" stroke-width="${w}"/>`;
    return `<svg class="${cls}" viewBox="0 0 940 100" xmlns="http://www.w3.org/2000/svg">${paths(LETTER)}</svg>`;
  }

  const logo = () => { const src = OPF.store.db.company.logo; return src ? `<img src="${src}" alt="">` : brandMark("memo"); };
  const watermark = () => {
    const src = OPF.store.db.company.logo;
    return `<div class="mark-wm">${src ? `<img src="${src}" alt="">` : brandMark(false)}${isOnePlus() ? wordmark("wm-word") : ""}</div>`;
  };

  // Phone numbers as the memo book prints them: 01621-346375 -> +880 1621346375.
  const intl = (n) => { const d = String(n).replace(/\D/g, ""); return /^01\d{9}$/.test(d) ? "+880 " + d.slice(1) : String(n).trim(); };
  const WA = '<svg class="wa" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#04a556"/><path fill="none" stroke="#fff" stroke-width="1.6" d="M7.6 16.6A6.6 6.6 0 1 1 9.7 18.3L6 19.4z"/><path fill="#fff" d="M9.3 8.3c.3-.2.7-.2.9.1l.8 1.5c.1.3 0 .6-.2.8l-.5.5c.4.9 1.2 1.7 2.1 2.1l.5-.5c.2-.2.5-.3.8-.2l1.5.8c.3.2.3.6.1.9-.5.7-1.2 1.1-2 .9-2.2-.5-3.9-2.2-4.4-4.4-.2-.8.1-1.3.4-1.5z"/></svg>';
  // bKash: the payment number (the hotline) carries its pink bird.
  const BKASH = '<svg class="bk" viewBox="0 0 24 24"><path fill="#ec3699" d="M2 6l10 4-3 9z"/><path fill="#c41f79" d="M12 10l10-6-6 14z"/><path fill="#f47cb8" d="M12 10l-3 9 7-1z"/></svg>';
  function phones() {
    const co = OPF.store.db.company;
    const list = [co.hotline].concat(String(co.phone || "").split(/[,;\/]/)).map((n) => String(n || "").trim()).filter(Boolean);
    return list.length ? `<div class="mphones">${list.map((n, i) => `<div>${i == 0 && co.hotline ? BKASH : ""}${WA}<span>${esc(intl(n))}</span></div>`).join("")}</div>` : "";
  }

  // Logo | "Cash Memo" pill, shop name, motto, description, address, e-mail | phone numbers
  function header(docTitle) {
    const co = OPF.store.db.company;
    const descLen = Math.min(980, String(co.tagline || "").length * 15.2);
    return `<div class="mhead"><div class="mlogo">${logo()}</div>${phones()}<div class="mshop">` +
      `<div class="mtop"><span class="pill">${esc(docTitle)}</span></div>` +
      (isOnePlus() ? wordmark("mname mword")
        // textLength stretches the name to the full width whatever font the computer has.
        : `<svg class="mname" viewBox="0 0 1000 96" preserveAspectRatio="none"><text x="4" y="84" font-size="100" textLength="992" lengthAdjust="spacingAndGlyphs">${esc(String(co.name || "").toUpperCase())}</text></svg>`) +
      (co.motto ? `<svg class="mmotto" viewBox="0 0 820 34"><text x="2" y="27" font-size="31" textLength="816" lengthAdjust="spacing">${esc(String(co.motto).toUpperCase())}</text></svg>` : "") +
      (co.tagline ? `<svg class="mdesc" viewBox="0 0 1000 46" preserveAspectRatio="none"><text x="${(1000 - descLen) / 2}" y="36" font-size="38" textLength="${descLen}" lengthAdjust="spacingAndGlyphs">${esc(co.tagline)}</text></svg>` : "") +
      (co.address ? `<div class="maddr">${esc(co.address)}</div>` : "") +
      (co.email ? `<div class="mmail">E-mail: ${esc(co.email)}</div>` : "") +
      "</div></div>";
  }

  // rows: [[leftLabel, leftValue, rightLabel, rightValue, leftPlain?]]; values are HTML (escaped by caller)
  function infoRows(rows) {
    return '<table class="minfo"><colgroup><col style="width:1%"><col><col class="gap"><col style="width:1%"><col style="width:59mm"></colgroup>' +
      rows.map(([l, lv, r, rv, plain]) => `<tr><td class="lab">${l}</td><td class="val${plain ? " plain" : ""}">${lv}</td><td class="gap"></td><td class="lab">${r}</td><td class="val">${rv}</td></tr>`).join("") +
      "</table>";
  }

  // Bank accounts from Settings, one per line: Bank | A/C Name | A/C Number | Branch
  function banks() {
    const lines = String(OPF.store.db.company.banks || "").split(/\r?\n/).map((l) => l.split("|").map((x) => x.trim())).filter((b) => b[0]);
    if (!lines.length) return "<div></div>";
    return '<div class="mbanks">' + lines.map(([bank, name, no, branch]) =>
      `<div class="bank">Bank Name: <b class="bn">${esc(bank)}</b>${name ? `, A/C Name: <b class="an">${esc(name)}</b>` : ""}<br>` +
      `${no ? `A/C Number: <b class="no">${esc(no)}</b>` : ""}${branch ? `${no ? ", " : ""}Branch: <b>${esc(branch)}</b>` : ""}</div>`).join("") + "</div>";
  }

  function footer(leftLabel) {
    return `<div class="msign"><div class="cust">${leftLabel}</div>${banks()}<div class="auth">Authorised Signature</div></div>`;
  }

  const address = (p) => esc([p.address, p.district].filter(Boolean).join(", "));
  const courierFor = (s) => OPF.store.db.courier.find((c) => s.invoice && lc(c.invoice) == lc(s.invoice));

  /* ---- cash memo ---- */
  function invoiceHtml(s, c, previousDue) {
    const total = K.saleTotal(s), due = K.saleDue(s), paid = r2(s.paid), totalDue = r2(previousDue + due);
    const parcel = courierFor(s);
    const cells = (sl, desc, qty, rate, amt, cls) => `<tr${cls ? ` class="${cls}"` : ""}><td class="c-sl">${sl}</td><td class="c-desc">${desc}</td><td class="c-qty">${qty}</td><td class="c-rate">${rate}</td><td class="c-amt">${amt}</td></tr>`;

    const sl = (n) => (n < 10 ? "0" : "") + n;
    const rows = s.items.map((i, n) => {
      const p = OPF.store.productByStyle(i.style);
      const detail = [p && p.name, [i.color, i.size].filter(Boolean).join(" / ")].filter(Boolean).join(" · ");
      return cells(sl(n + 1), `<b>${esc(i.style)}</b>${detail ? ` <small>${esc(detail)}</small>` : ""}`, fmtQty(i.qty), money(i.rate), money(K.itemAmount(i)));
    });
    if (num(s.discount)) rows.push(cells("", "Less: Discount", "", "", "- " + money(s.discount), "less"));
    // The rest of the book's numbered lines stay blank.
    for (let n = s.items.length + 1; rows.length < (isMobile() ? PHONE_LINES : LINES); n++) rows.push(cells(sl(n), "", "", "", "", "blank"));

    return `<div class="memo">${header("Cash Memo")}` +
      infoRows([
        ["Sl. No.", esc(s.invoice || s.id), "Date", esc(s.date), true],
        ["Name", esc(c.name || ""), "Mobile", esc(c.mobile || "")],
        ["Address", address(c), "Courier", parcel ? esc([parcel.courier, parcel.tracking].filter(Boolean).join(" - ")) : ""]
      ]) +
      `<div class="mwrap"><table class="mitems"><thead><tr><th class="c-sl">SL</th><th>Description</th><th class="c-qty">Quantity</th><th class="c-rate">Rate</th><th class="c-amt">Amount</th></tr></thead>` +
      `<tbody>${rows.join("")}</tbody></table>${watermark()}</div>` +
      '<table class="mfoot"><tr>' +
      `<td class="cond" rowspan="2"><span class="h">Condition:</span> ${esc(s.remarks || "")}<br>` +
      `<span class="stamp ${due > 0 ? "due" : "paid"}">${due > 0 ? "DUE" : "PAID"}</span>Payment: ${esc(s.method || "-")} &nbsp;|&nbsp; Total Qty: ${fmtQty(K.salePcs(s))} PCS<br>` +
      `Previous Due: ${dueText(previousDue)} &nbsp;|&nbsp; Total Due Now: <b>${dueText(totalDue)}</b></td>` +
      `<td class="tl">Total</td><td class="tv">${money(total)}</td></tr>` +
      `<tr><td class="tl">Advance</td><td class="tv">${money(paid)}</td></tr>` +
      `<tr><td class="cond words"><span class="h">Inword:</span> ${amountWords(total)}</td><td class="tl">Due</td><td class="tv">${dueText(due)}</td></tr></table>` +
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
      `<table class="mfoot"><tr><td class="cond words"><span class="h">Inword:</span> ${amountWords(p.amount)}${p.remarks ? `<br>Remarks: ${esc(p.remarks)}` : ""}</td><td class="tl">Amount</td><td class="tv">${money(p.amount)}</td></tr></table>` +
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

  OPF.print = { invoice, receipt, preview, snapshotRows, brandMark, output, outputPage, isMobile, get count() { return count; } };
  OPF.actions.register({
    "print.invoice": (el) => invoice(el.dataset.id),
    "print.receipt": (el) => receipt(el.dataset.id),
    "print.preview": preview
  });
})(window.OPF = window.OPF || {});
