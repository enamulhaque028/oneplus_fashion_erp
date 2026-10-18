/* Style / product master (style code is unique). */
(function (OPF) {
  "use strict";

  const H = OPF.html, F = OPF.forms, R = OPF.records;
  const { esc, num, r2, lc, money, fmtQty, byDateDesc } = OPF.util;

  function render() {
    F.page({
      title: "Style / Product Master", coll: "products", submit: "products.save",
      fields: [
        H.field("style", "Unique Style Code", { required: true }), H.field("name", "Product Name", { required: true }), H.field("image", "Image File Name"),
        H.field("fabric", "Main Fabric"), H.field("color", "Color"), H.field("size", "Size"), H.field("barcode", "Barcode"),
        H.field("cost", "Cost / Piece", { type: "number", value: 0 }), H.field("price", "Wholesale Price", { type: "number", value: 0 }), H.field("retail", "Retail Price", { type: "number", value: 0 })
      ]
    });
    const rows = byDateDesc(OPF.store.db.products).map((p) => {
      const margin = num(p.cost) ? r2(((num(p.price) - num(p.cost)) / num(p.cost)) * 100) : 0;
      return H.tr([
        H.td(esc(p.style)), H.td(esc(p.name)), H.td(esc(p.color)), H.td(esc(p.size)), H.td(esc(p.barcode)),
        H.tdn(money(p.cost)), H.tdn(money(p.price)), H.tdn(money(p.retail)), H.tdn(fmtQty(margin) + "%"), R.rowActions("products", p.id)
      ]);
    });
    H.append(H.table(["Style", "Product", "Color", "Size", "Barcode", "#Cost/PC", "#Wholesale", "#Retail", "#Margin", ""], rows));
  }

  function save(form) {
    const d = F.numify(F.data(form), ["cost", "price", "retail"]);
    const editId = F.editingId("products");
    if (OPF.store.db.products.some((p) => lc(p.style) == lc(d.style) && p.id != editId)) { alert(`Style code ${d.style} already exists.`); return; }
    R.save("products", d, "Product", d.style);
    render();
  }

  OPF.pages.products = { render };
  OPF.actions.register({ "products.save": save });
})(window.OPF = window.OPF || {});
