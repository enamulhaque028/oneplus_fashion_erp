/* Wholesale sales / invoice with multiple item rows and a live Total / Paid / Due calculator. */
(function (OPF) {
  "use strict";

  const C = OPF.config, H = OPF.html, F = OPF.forms, R = OPF.records, K = OPF.calc, L = OPF.ledger, S = OPF.store;
  const { esc, num, r2, lc, sum, money, fmtQty, dueText, today, byDateDesc } = OPF.util;

  const ITEM_FIELDS = ["style", "color", "size", "qty", "rate"];
  const TABS = [["All", "All Invoices"], ["Cash", "Cash (fully paid)"], ["Due", "Due Invoices"]];
  let tab = "All";

  function render() {
    const rec = F.editingRecord("sales"), editing = !!rec;
    H.mount(
      `<h1>${editing ? "Edit - " : ""}Wholesale Sales / Invoice</h1>` +
      `<form id="mainForm" class="box${editing ? " editing" : ""}" data-submit="sales.save" data-calc="sales.calc">${editing ? F.banner() : ""}` +
      '<div class="grid">' +
      H.field("date", "Date", { type: "date", value: today(), required: true }) +
      H.field("invoice", "Invoice No.", { value: editing ? "" : S.nextNo("sales", "invoice", "INV-", 5), required: true }) +
      H.select("customer", "Customer", OPF.lists.customers(), { required: true }) +
      H.field("location", "Stock Location", { value: C.MAIN_SHOP, required: true, list: "dl-shop" }) +
      H.select("method", "Payment Method", H.optionList(C.METHODS)) + H.field("remarks", "Remarks") +
      "</div><h2>Items</h2>" +
      '<div class="table"><table class="items"><thead><tr><th style="width:34px">#</th><th>Style Code</th><th>Color</th><th>Size</th><th style="width:110px">Qty (PCS)</th><th style="width:120px">Rate / PCS</th><th class="num" style="width:130px">Amount</th><th style="width:40px"></th></tr></thead><tbody id="items"></tbody></table></div>' +
      `<div class="actions">${H.button("+ Add Item", "sales.addItem", null, "light")}</div>` +
      '<div class="cols2" style="margin-top:12px"><div class="grid g2">' +
      H.field("discount", "Discount", { type: "number", value: 0 }) + H.field("paid", "Paid Amount (Cash received now)", { type: "number", value: 0 }) +
      H.cell("", H.button("Paid in Full (Cash)", "sales.payFull", null, "light")) +
      '</div><div class="calc" id="calc" style="margin-top:0"></div></div>' +
      F.buttons(editing, H.button((editing ? "Update" : "Save") + " &amp; Print Invoice", "sales.savePrint", null, "good")) +
      OPF.lists.datalists() + "</form>"
    );
    const form = H.$("mainForm");
    if (rec) { F.fill(form, rec); rec.items.forEach(addItemRow); } else [1, 2, 3].forEach(() => addItemRow());
    calc(form);
    renderRegister();
  }

  function renderRegister() {
    // Work out each invoice's figures once and look customers up in a map: this list can hold thousands of invoices.
    const customers = {};
    S.db.customers.forEach((c) => { customers[c.id] = c; });
    const list = byDateDesc(S.db.sales)
      .map((s) => ({ s, pcs: K.salePcs(s), total: K.saleTotal(s), due: K.saleDue(s) }))
      .filter((x) => tab == "All" || (tab == "Cash" ? x.due <= 0 : x.due > 0));
    const rows = list.map(({ s, pcs, total, due }) => {
      const c = customers[s.customer];
      return H.tr([
        H.td(s.date), H.td(esc(s.invoice)), H.td(c ? H.customerLink(esc(c.name), c.id) : esc(s.customer)),
        H.td(esc(s.items.map((i) => i.style).join(", "))), H.tdn(fmtQty(pcs)), H.tdn(money(total)), H.tdn(money(s.paid)),
        H.tdn(dueText(due), due > 0 ? "red" : ""), H.td(due > 0 ? H.pill("Due", "due") : H.pill("Cash", "cash")),
        R.rowActions("sales", s.id, H.button("Invoice", "print.invoice", { id: s.id }, "sm"))
      ]);
    });
    H.append(
      '<h2>Sales Register</h2><div class="tabs no-print">' + TABS.map(([id, label]) => H.button(label, "sales.tab", { tab: id }, tab == id ? "on" : "")).join("") + "</div>" +
      H.table(["Date", "Invoice", "Customer", "Items", "#PCS", "#Total", "#Paid", "#Due", "Type", ""], rows, {
        foot: H.tr([H.td("Total"), H.tdEmpty(3), H.tdn(fmtQty(sum(list, (x) => x.pcs))), H.tdn(money(sum(list, (x) => x.total))), H.tdn(money(sum(list, (x) => x.s.paid))), H.tdn(money(sum(list, (x) => x.due))), H.tdEmpty(2)])
      })
    );
  }

  /* ---- item rows ---- */
  const input = (row, k) => row.querySelector(`[data-k="${k}"]`);
  const itemRows = () => Array.prototype.slice.call(document.querySelectorAll("#items tr.item"));

  function addItemRow(item) {
    item = item || {};
    const cells = ITEM_FIELDS.map((k) => {
      const numeric = k == "qty" || k == "rate";
      const a = { "data-k": k, value: item[k] == null ? "" : item[k], type: numeric ? "number" : null, step: numeric ? "any" : null, min: numeric ? "0" : null, list: k == "style" ? "dl-style" : null, "data-change": k == "style" ? "sales.itemStyle" : null };
      return `<td><input${H.attrs(a)}></td>`;
    }).join("");
    H.$("items").insertAdjacentHTML("beforeend", `<tr class="item"><td class="sl"></td>${cells}<td class="num amt"></td><td>${H.button("x", "sales.removeItem", null, "sm bad")}</td></tr>`);
    const form = H.$("mainForm");
    if (form) calc(form);
  }

  function readItems() {
    return itemRows()
      .map((row) => ({ style: input(row, "style").value.trim(), color: input(row, "color").value.trim(), size: input(row, "size").value.trim(), qty: num(input(row, "qty").value), rate: num(input(row, "rate").value) }))
      .filter((i) => i.style || i.qty || i.rate);
  }

  // Picking a style fills rate / color / size from the product master when they are empty.
  function itemStyle(el) {
    const row = el.closest("tr"), p = S.productByStyle(el.value);
    if (!p) return;
    if (!num(input(row, "rate").value)) input(row, "rate").value = p.price || "";
    if (!input(row, "color").value) input(row, "color").value = p.color || "";
    if (!input(row, "size").value) input(row, "size").value = p.size || "";
  }

  function removeItem(el) {
    el.closest("tr").remove();
    calc(H.$("mainForm"));
  }

  function payFull() {
    const form = H.$("mainForm");
    F.set(form, "paid", r2(K.saleSubtotal({ items: readItems() }) - num(F.get(form, "discount"))));
    calc(form);
  }

  /* ---- calculation ---- */
  const skipSelf = () => { const id = F.editingId("sales"); return id ? { coll: "sales", id } : null; };

  function calc(form) {
    const d = F.data(form), items = readItems();
    itemRows().forEach((row, i) => {
      const amount = K.itemAmount({ qty: input(row, "qty").value, rate: input(row, "rate").value });
      row.querySelector(".sl").textContent = i + 1;
      row.querySelector(".amt").textContent = amount ? money(amount) : "";
    });
    const sale = { items, discount: d.discount, paid: d.paid };
    const sub = K.saleSubtotal(sale), total = K.saleTotal(sale), due = K.saleDue(sale);
    const prev = d.customer ? L.balanceExcluding("Customer", d.customer, F.editingId("sales")) : 0;
    const short = d.location ? OPF.stock.shopShortages(d.location, items.filter((i) => i.style && i.qty), skipSelf()) : [];
    F.showCalc(H.calcTable([
      [`Subtotal (${items.length} items, ${fmtQty(sum(items, (i) => i.qty))} PCS)`, money(sub)],
      ["- Discount", money(d.discount)],
      ["= Total Amount", money(total), true],
      ["- Paid Amount", money(d.paid)],
      ["= Due Amount", `<span class="${due > 0 ? "red" : "green"}">${dueText(due)}</span>`, true],
      ["Customer Previous Balance", dueText(prev)],
      ["Balance After This Invoice", dueText(r2(prev + due)), true]
    ]) + (short.length ? `<div class="alert">Not enough stock at ${esc(d.location)}:<br>${short.map(esc).join("<br>")}</div>` : ""));
  }

  /* ---- save ---- */
  function save(form, printAfter) {
    if (!form.reportValidity()) return;
    const d = F.numify(F.data(form), ["discount", "paid"]), items = readItems(), editId = F.editingId("sales");
    if (!items.length || items.some((i) => !i.style || !i.qty)) { alert("Every item row needs a Style Code and Quantity. Remove empty rows with x."); return; }
    if (S.db.sales.some((s) => lc(s.invoice) == lc(d.invoice) && s.id != editId)) { alert(`Invoice No. ${d.invoice} already exists.`); return; }
    d.items = items;
    if (d.discount > K.saleSubtotal(d)) { alert("Discount cannot be more than the subtotal."); return; }
    const short = OPF.stock.shopShortages(d.location, items, skipSelf());
    if (short.length && !confirm(`Not enough stock at ${d.location}:\n${short.join("\n")}\n\nSave anyway?`)) return;
    if (d.paid > K.saleTotal(d) && !confirm("Paid amount is more than the invoice total. The extra will be kept as customer advance. Continue?")) return;
    S.addShowroom(d.location);
    const rec = R.save("sales", d, "Sale / Invoice", d.invoice);
    OPF.router.go("sales");
    if (printAfter) OPF.print.invoice(rec.id);
  }

  OPF.pages.sales = { render };
  OPF.actions.register({
    "sales.calc": calc,
    "sales.save": (form) => save(form, false),
    "sales.savePrint": (el) => save(el.form, true),
    "sales.addItem": () => addItemRow(),
    "sales.removeItem": removeItem,
    "sales.itemStyle": itemStyle,
    "sales.payFull": payFull,
    "sales.tab": (el) => { tab = el.dataset.tab; render(); }
  });
})(window.OPF = window.OPF || {});
