/* <option> lists and <datalist> suggestions built from the current data. */
(function (OPF) {
  "use strict";

  const C = OPF.config, H = OPF.html;
  const withMobile = (p) => p.name + (p.mobile ? ` (${p.mobile})` : "");

  const lists = {
    parties: (type) => `<option value="">Select ${type}</option>` + H.options(OPF.store.db[C.PARTY_COLL[type]], (p) => p.id, withMobile),
    customers: () => lists.parties("Customer"),
    factories: () => lists.parties("Factory"),
    suppliers: () => lists.parties("Supplier"),
    orders: () =>
      '<option value="">-- None --</option>' +
      H.options(OPF.store.db.productionOrders, (o) => o.id, (o) => [o.no + " - " + o.style, o.color, o.size].filter(Boolean).join(" / ")),

    // Suggestions shared by all forms (style codes, materials, shops, invoices, expense categories).
    datalists() {
      const db = OPF.store.db;
      return (
        H.datalist("dl-style", db.products.map((p) => p.style).concat(db.productionOrders.map((o) => o.style), db.production.map((p) => p.style))) +
        H.datalist("dl-mat", db.purchases.map((p) => p.material)) +
        H.datalist("dl-shop", db.showrooms.map((s) => s.name)) +
        H.datalist("dl-inv", db.sales.map((s) => s.invoice)) +
        H.datalist("dl-exp", C.EXPENSE_CATEGORIES.concat(db.expenses.map((e) => e.category))) +
        H.datalist("dl-courier", C.COURIERS.concat(db.courier.map((c) => c.courier)))
      );
    }
  };

  OPF.lists = lists;
})(window.OPF = window.OPF || {});
