/* HTML building blocks. Labels passed in are trusted static text; every data value
   is escaped here or must be escaped by the caller with util.esc before it reaches a template.

   Behaviour is attached with data attributes handled by ui/actions.js:
     data-act="name"     click          data-change="name"  change
     data-submit="name"  form submit    data-calc="name"    form input/change (live totals) */
(function (OPF) {
  "use strict";

  const { esc } = OPF.util;

  // { name: "qty", required: true } -> ' name="qty" required'
  const attrs = (obj) =>
    Object.keys(obj || {})
      .filter((k) => obj[k] != null && obj[k] !== false)
      .map((k) => (obj[k] === true ? ` ${k}` : ` ${k}="${esc(obj[k])}"`))
      .join("");

  // data: { id: "x1", coll: "sales" } -> ' data-id="x1" data-coll="sales"'
  const dataAttrs = (data) => attrs(Object.keys(data || {}).reduce((o, k) => { o["data-" + k] = data[k]; return o; }, {}));

  // opts: { type, value, required, readonly, list, change (action), attrs: {...extra} }
  function field(name, label, opts = {}) {
    const type = opts.type || "text";
    const a = Object.assign(
      { name, type, value: opts.value == null ? "" : opts.value, required: !!opts.required, readonly: !!opts.readonly, list: opts.list, "data-change": opts.change },
      type == "number" ? { step: "any", min: "0" } : {},
      opts.attrs
    );
    return `<div class="field"><label>${label}${opts.required ? " *" : ""}</label><input${attrs(a)}></div>`;
  }

  function select(name, label, optionsHtml, opts = {}) {
    const a = Object.assign({ name, required: !!opts.required, "data-change": opts.change }, opts.attrs);
    return `<div class="field"><label>${label}${opts.required ? " *" : ""}</label><select${attrs(a)}>${optionsHtml}</select></div>`;
  }

  // Arbitrary HTML placed in a form grid cell (e.g. a checkbox or helper button).
  const cell = (label, html) => `<div class="field"><label>${label || "&nbsp;"}</label>${html}</div>`;

  const options = (list, valueOf, textOf) => list.map((x) => `<option value="${esc(valueOf(x))}">${esc(textOf(x))}</option>`).join("");
  const optionList = (values, selected) => values.map((v) => `<option${v == selected ? " selected" : ""}>${esc(v)}</option>`).join("");
  const datalist = (id, values) => `<datalist id="${id}">${OPF.util.uniq(values).map((v) => `<option value="${esc(v)}">`).join("")}</datalist>`;

  // Column headings starting with "#" are right-aligned numeric columns.
  function table(head, rows, opts = {}) {
    const th = head.map((h) => (h.charAt(0) == "#" ? `<th class="num">${h.slice(1)}</th>` : `<th>${h}</th>`)).join("");
    const body = rows.length ? rows.join("") : `<tr><td colspan="${head.length}" class="muted">No records found</td></tr>`;
    const foot = opts.foot && rows.length ? `<tfoot>${opts.foot}</tfoot>` : "";
    return `<div class="table${opts.tight ? " tight" : ""}"><table><thead><tr>${th}</tr></thead><tbody>${body}</tbody>${foot}</table></div>`;
  }
  const td = (html, cls) => `<td${cls ? ` class="${cls}"` : ""}>${html == null ? "" : html}</td>`;
  const tdn = (html, cls) => td(html, "num" + (cls ? " " + cls : ""));
  const tdEmpty = (n = 1) => (n > 1 ? `<td colspan="${n}"></td>` : "<td></td>");
  const tr = (cells, cls) => `<tr${cls ? ` class="${cls}"` : ""}>${cells.join("")}</tr>`;

  const card = (label, value, cls) => `<div class="card${cls ? " " + cls : ""}">${label}<div class="big">${value}</div></div>`;
  const cards = (list) => `<div class="cards">${list.join("")}</div>`;
  const pill = (text, kind) => `<span class="pill${kind ? " " + kind : ""}">${esc(text)}</span>`;

  // rows: [label, valueHtml, bold?]
  const calcTable = (rows) => `<table>${rows.map((r) => `<tr${r[2] ? ' class="b"' : ""}><td>${r[0]}</td><td class="v">${r[1]}</td></tr>`).join("")}</table>`;

  const button = (label, act, data, cls) => `<button type="button" class="${cls || ""}" data-act="${act}"${dataAttrs(data)}>${label}</button>`;
  const link = (label, act, data) => `<a href="#" data-act="${act}"${dataAttrs(data)}>${label}</a>`;

  const $ = (id) => document.getElementById(id);
  const mount = (html) => { $("app").innerHTML = html; };
  const append = (html) => { $("app").insertAdjacentHTML("beforeend", html); };

  OPF.html = { attrs, dataAttrs, field, select, cell, options, optionList, datalist, table, td, tdn, tdEmpty, tr, card, cards, pill, calcTable, button, link, $, mount, append };
})(window.OPF = window.OPF || {});
