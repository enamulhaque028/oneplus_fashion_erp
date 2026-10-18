/* Database schema: the empty database, and upgrades for data saved by older versions
   or restored from backups. Every upgrade is idempotent, so normalize() is safe to run on
   already-current data. */
(function (OPF) {
  "use strict";

  const C = OPF.config;
  const { num, r2, lc, pad, esc } = OPF.util;

  function fresh() {
    return {
      version: C.SCHEMA_VERSION,
      company: Object.assign({}, C.DEFAULT_COMPANY),
      auth: { salt: "", hash: "" },
      suppliers: [], materials: [], purchases: [], issues: [], products: [],
      productionOrders: [], production: [], factories: [], transfers: [],
      customers: [], sales: [], returns: [], payments: [], expenses: [], courier: [], notes: [],
      showrooms: [{ id: "main", name: C.MAIN_SHOP }],
      logs: [],
      users: [{ id: "u1", name: "Administrator", username: "admin", role: "Admin" }]
    };
  }

  // Add any collection or settings field the stored data is missing.
  function fillDefaults(d, base) {
    Object.keys(base).forEach((k) => {
      const b = base[k];
      if (Array.isArray(b)) {
        if (!Array.isArray(d[k])) d[k] = b;
      } else if (b && typeof b == "object") {
        if (!d[k] || typeof d[k] != "object") d[k] = b;
        else Object.keys(b).forEach((j) => { if (d[k][j] == null) d[k][j] = b[j]; });
      }
    });
    if (!d.showrooms.length) d.showrooms = base.showrooms;
  }

  // v3 stored some links as typed names; v4 stores record ids.
  function toId(list, value) {
    if (!value) return "";
    if (list.some((x) => x.id == value)) return value;
    const match = list.find((x) => lc(x.name) == lc(value));
    return match ? match.id : value;
  }

  const upgrades = [
    function saleItems(d) {
      d.sales.forEach((s) => {
        if (!Array.isArray(s.items)) {
          s.items = [{ style: s.style || "", color: s.color || "", size: s.size || "", qty: num(s.qty), rate: num(s.rate) }];
          ["style", "color", "size", "qty", "rate"].forEach((k) => delete s[k]);
        }
        if (!s.location) s.location = C.MAIN_SHOP;
      });
    },
    function transferQuantities(d) {
      d.transfers.forEach((t) => {
        if (t.dispatched == null) {
          t.dispatched = num(t.qty);
          t.received = num(t.qty);
          delete t.qty;
        }
        t.from = toId(d.factories, t.from);
      });
    },
    function returnLinks(d) {
      d.returns.forEach((r) => {
        r.customer = toId(d.customers, r.customer);
        if (!r.location) r.location = C.MAIN_SHOP;
      });
    },
    function productionLinks(d) {
      d.production.forEach((p) => {
        p.factory = toId(d.factories, p.factory);
        if (p.order == null) p.order = "";
      });
      d.productionOrders.forEach((o, i) => {
        if (!o.no) o.no = "PO-" + pad(i + 1, 4);
        o.factory = toId(d.factories, o.factory);
      });
    },
    function paymentParties(d) {
      d.payments.forEach((p) => {
        const t = lc(p.type);
        p.type = t.startsWith("sup") ? "Supplier" : t.startsWith("fac") ? "Factory" : "Customer";
        p.party = toId(d[C.PARTY_COLL[p.type]], p.party);
      });
    },
    // v5: memo-book branding. New fields arrive via fillDefaults; old untouched defaults are replaced.
    // Value-based, so it runs once only (a user may later clear the address on purpose).
    function memoBranding(d) {
      if ((d.version || 0) >= 5) return;
      Object.keys(C.OLD_COMPANY_DEFAULTS).forEach((k) => {
        if (d.company[k] === C.OLD_COMPANY_DEFAULTS[k]) d.company[k] = C.DEFAULT_COMPANY[k];
      });
    },
    function courierNetCod(d) {
      d.courier.forEach((c) => {
        if (c.netCod == null) {
          c.charge = num(c.payable);
          delete c.payable;
          c.netCod = r2(num(c.cod) - num(c.advance));
        }
        if (!c.settled) c.settled = "No";
      });
    },
    // Rough Notes became rich text: plain notes get an HTML copy with the same line breaks.
    function noteHtml(d) {
      d.notes.forEach((n) => {
        if (n.html == null) n.html = esc(String(n.text || "")).replace(/\r?\n/g, "<br>");
        if (n.sketch === undefined) n.sketch = null;
        if (n.color == null) n.color = "";
      });
    }
  ];

  function normalize(d) {
    if (!d || typeof d != "object" || Array.isArray(d)) return fresh();
    fillDefaults(d, fresh());
    upgrades.forEach((upgrade) => upgrade(d));
    d.version = C.SCHEMA_VERSION;
    return d;
  }

  OPF.migrate = { fresh, normalize };
})(window.OPF = window.OPF || {});
