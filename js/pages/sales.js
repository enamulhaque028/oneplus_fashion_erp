/* Customers & Sales page, New Invoice tab (#/sales): wholesale invoice with multiple item rows and a
   live Total / Paid / Due calculator. The customer is found by name or mobile as you type, and a new
   one can be added without leaving the invoice. The Customers tab (#/customers) is customers.js. */
(function (OPF) {
  "use strict";

  const C = OPF.config, H = OPF.html, F = OPF.forms, R = OPF.records, K = OPF.calc, L = OPF.ledger, S = OPF.store;
  const { esc, num, r2, lc, sum, money, fmtQty, dueText, today, byDateDesc } = OPF.util;

  const ITEM_FIELDS = ["style", "color", "size", "qty", "rate"];
  const TABS = [["All", "All Invoices"], ["Cash", "Cash (fully paid)"], ["Due", "Due Invoices"]];
  let tab = "All";
  let pendingCustomer = ""; // "New Invoice" on a customer: chosen when the tab is drawn

  // New Invoice | Customers: links, so each tab has its own address (#/sales, #/customers).
  const modeBar = (active) => '<div class="tabs modes no-print">' +
    H.pageLink(OPF.icon("receipt") + "<span>New Invoice</span>", "sales", active == "sales" ? "on" : "") +
    H.pageLink(OPF.icon("users") + `<span>Customers</span><small>${S.db.customers.length}</small>`, "customers", active == "customers" ? "on" : "") + "</div>";

  /* ---- customer picker: type a name or mobile; the real <select name="customer"> stays underneath
     (it holds the form's value). It is checked in save(), with a clearer message than the browser's. ---- */
  function customerPicker() {
    return '<div class="field cpick-field"><label>Customer <span class="req">*</span></label><div class="cpick">' +
      '<input id="custFind" placeholder="Search name or mobile, or add new" autocomplete="off" spellcheck="false">' +
      `<select name="customer" tabindex="-1" aria-hidden="true" data-change="sales.customer">${OPF.lists.customers()}</select>` +
      '<div class="cpick-list" id="custList" hidden></div></div></div>';
  }

  function render() {
    const rec = F.editingRecord("sales"), editing = !!rec;
    H.mount(
      `<h1>${editing ? "Edit - Invoice" : "Customers &amp; Sales"}</h1>` + (editing ? "" : modeBar("sales")) +
      `<form id="mainForm" class="box${editing ? " editing" : ""}" data-submit="sales.save" data-calc="sales.calc">${editing ? F.banner() : ""}` +
      '<div class="grid">' +
      H.field("date", "Date", { type: "date", value: today(), required: true }) +
      H.field("invoice", "Invoice No.", { value: editing ? "" : S.nextNo("sales", "invoice", "INV-", 5), required: true }) +
      customerPicker() +
      H.field("location", "Stock Location", { value: C.MAIN_SHOP, required: true, list: "dl-shop" }) +
      H.select("method", "Payment Method", H.optionList(C.METHODS)) + H.field("remarks", "Remarks") +
      '</div><div id="custInfo"></div><div id="custNew" class="cnew" hidden></div><h2>Items</h2>' +
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
    if (pendingCustomer) { F.set(form, "customer", pendingCustomer); pendingCustomer = ""; }
    pickerInit(form);
    calc(form);
    renderRegister();
  }

  const customerLabel = (c) => c.name + (c.mobile ? " · " + c.mobile : "");
  // A typed number (mobile): digits, with optional +, spaces or dashes.
  const isNumber = (q) => /^\+?[\d\s-]+$/.test(q) && /\d/.test(q);

  function pickerInit(form) {
    const find = H.$("custFind"), list = H.$("custList");
    let hits = [], at = -1, query = "";
    const show = () => {
      query = find.value.trim();
      const q = query;
      // 1-2 digits match too many mobiles: ask for more (Enter does nothing yet).
      const tooShort = isNumber(q) && q.replace(/\D/g, "").length < 3;
      // Typing: matches by name or mobile; empty: the first customers by name.
      hits = tooShort ? [] : q ? OPF.search.results(q).map((x) => x.c)
        : S.db.customers.slice().sort((a, b) => (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1)).slice(0, 15);
      const bm = L.balances("Customer");
      at = tooShort ? -1 : 0; // the first match, or "Add new customer" when nothing matches
      if (tooShort) { list.innerHTML = '<div class="hint">Type 3 or more digits of the mobile number</div>'; list.hidden = false; return; }
      list.innerHTML = hits.map((c, i) => `<a href="#" data-i="${i}"${i == at ? ' class="on"' : ""}><b>${esc(c.name)}</b><span>${esc(c.mobile || "")}</span>` +
        `<em class="${bm[c.id].bal > 0 ? "red" : "green"}">${bm[c.id].bal > 0 ? "Due " + money(bm[c.id].bal) : bm[c.id].bal < 0 ? dueText(bm[c.id].bal) : "No due"}</em></a>`).join("") +
        `<a href="#" class="add" data-i="new">${OPF.icon("plus")}${q ? `Add new customer "${esc(q)}"` : "Add new customer"}</a>`;
      list.hidden = false;
    };
    const move = (d) => {
      const items = list.querySelectorAll("a");
      if (!items.length) return;
      at = (at + d + items.length) % items.length;
      items.forEach((a, i) => a.classList.toggle("on", i == at));
      items[at].scrollIntoView({ block: "nearest" });
    };
    const choose = (i) => {
      list.hidden = true;
      if (i == "new" || i == hits.length) { openNew(query); return; }
      const c = hits[i];
      if (!c) return;
      setCustomer(form, c.id);
    };
    // Focus or a click starts a new search (the chosen name is selected, so typing replaces it).
    find.addEventListener("focus", () => { find.select(); show(); });
    find.addEventListener("click", () => { if (list.hidden) { find.select(); show(); } });
    find.addEventListener("input", show);
    find.addEventListener("keydown", (e) => {
      if (e.key == "ArrowDown" || e.key == "ArrowUp") { e.preventDefault(); if (list.hidden) show(); else move(e.key == "ArrowDown" ? 1 : -1); }
      else if (e.key == "Enter") { e.preventDefault(); if (!list.hidden && at >= 0) choose(at == hits.length ? "new" : at); }
      else if (e.key == "Escape") { list.hidden = true; showChosen(form); }
    });
    // mousedown runs before the box loses focus (which hides the list).
    list.addEventListener("mousedown", (e) => {
      const a = e.target.closest("a[data-i]");
      if (a) { e.preventDefault(); choose(a.dataset.i == "new" ? "new" : +a.dataset.i); }
    });
    find.addEventListener("blur", () => setTimeout(() => { list.hidden = true; showChosen(form); }, 150));
    showChosen(form);
  }

  function setCustomer(form, id) {
    const sel = F.el(form, "customer");
    sel.value = id;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // The search box shows the chosen customer; the card under the fields shows their due and limit.
  function showChosen(form) {
    const id = F.get(form, "customer"), c = id && S.byId("customers", id), find = H.$("custFind"), info = H.$("custInfo");
    if (!find || !info) return;
    find.value = c ? customerLabel(c) : "";
    if (!c) { info.innerHTML = ""; return; }
    const bal = L.balanceExcluding("Customer", id, F.editingId("sales")), limit = num(c.credit);
    const count = S.db.sales.filter((s) => s.customer == id).length;
    info.innerHTML = `<div class="ccard"><span class="av">${esc(c.name.trim().charAt(0).toUpperCase())}</span><span class="who"><b>${esc(c.name)}</b>` +
      `<small>${esc([c.mobile, c.address, c.district].filter(Boolean).join(" · ") || "No mobile / address")}</small></span>` +
      `<span class="fig"><small>Balance</small><b class="${bal > 0 ? "red" : "green"}">${dueText(bal)}</b></span>` +
      (limit ? `<span class="fig"><small>Credit Limit</small><b>${money(limit)}</b>${bal > limit ? H.pill("Over limit", "due") : ""}</span>` : "") +
      `<span class="fig"><small>Invoices</small><b>${count}</b></span>` +
      `<span class="grow"></span>${H.customerLink("View profile", id, "btn sm light")}</div>`;
  }

  /* ---- add a customer without leaving the invoice (fields have no names: not part of the invoice) ---- */
  function openNew(text) {
    const box = H.$("custNew"), digits = isNumber(text || "");
    const f = (k, label, value, type) => `<div class="field"><label>${label}</label><input data-k="${k}"${type ? ` type="${type}"` : ""} value="${esc(value || "")}"></div>`;
    box.innerHTML = `<div class="cnew-head"><b>${OPF.icon("plus")}New Customer</b><span class="muted">Saved to Customers and chosen for this invoice.</span></div><div class="grid">` +
      f("name", 'Shop / Customer Name <span class="req">*</span>', digits ? "" : text) + f("mobile", "Mobile", digits ? text : "") + f("address", "Address") + f("district", "District") +
      f("previousDue", "Previous Due", "0", "number") + "</div>" +
      `<div class="actions">${H.button("Save Customer", "sales.saveCustomer", null, "good")}${H.button("Cancel", "sales.cancelCustomer", null, "light")}</div>`;
    box.hidden = false;
    // What was typed fills the name (or the mobile, if it was a number); the cursor goes to the next empty one.
    box.querySelector(`[data-k="${text && !digits ? "mobile" : "name"}"]`).focus();
  }

  function saveCustomer() {
    const box = H.$("custNew"), v = (k) => box.querySelector(`[data-k="${k}"]`).value.trim();
    const d = { name: v("name"), mobile: v("mobile"), address: v("address"), district: v("district"), credit: 0, previousDue: num(v("previousDue")) };
    if (!d.name) { alert("Enter the shop / customer name."); box.querySelector('[data-k="name"]').focus(); return; }
    const digits = (m) => String(m || "").replace(/\D/g, "").replace(/^880/, "0");
    const same = S.db.customers.find((c) => (d.mobile && digits(c.mobile) == digits(d.mobile)) || lc(c.name) == lc(d.name));
    if (same && !confirm(`${same.name}${same.mobile ? " (" + same.mobile + ")" : ""} is already a customer.\n\nAdd a new customer anyway?`)) return;
    // Straight to the store (not records.save): an invoice being edited must stay in edit mode.
    const c = S.upsert("customers", d);
    S.log("Customer Created", d.name);
    const form = H.$("mainForm"), sel = F.el(form, "customer");
    sel.innerHTML = OPF.lists.customers();
    box.hidden = true; box.innerHTML = "";
    setCustomer(form, c.id);
  }

  // "New Invoice" on a customer (Customers tab, profile): the invoice opens with that customer.
  function forCustomer(el) {
    pendingCustomer = el.dataset.id;
    OPF.router.go("sales");
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
    if (!F.get(form, "customer")) { alert("Choose the customer (search by name or mobile)."); H.$("custFind").focus(); return; }
    if (!form.reportValidity()) return;
    const d = F.numify(F.data(form), ["discount", "paid"]), items = readItems(), editId = F.editingId("sales");
    if (!items.length || items.some((i) => !i.style || !i.qty)) { alert("Every item row needs a Style Code and Quantity. Remove empty rows with x."); return; }
    if (S.db.sales.some((s) => lc(s.invoice) == lc(d.invoice) && s.id != editId)) { alert(`Invoice No. ${d.invoice} already exists.`); return; }
    const old = editId && S.byId("sales", editId);
    if (old && lc(old.invoice) != lc(d.invoice) && R.isReferenced("sales", old)) {
      alert(`Invoice No. ${old.invoice} is used by a sales return or courier parcel, so it cannot be changed.`);
      return;
    }
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

  OPF.pages.sales = { render, modeBar };
  OPF.actions.register({
    "sales.customer": (el) => { showChosen(el.form); calc(el.form); },
    "sales.saveCustomer": saveCustomer,
    "sales.cancelCustomer": () => { const b = H.$("custNew"); b.hidden = true; b.innerHTML = ""; H.$("custFind").focus(); },
    "sales.forCustomer": forCustomer,
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
