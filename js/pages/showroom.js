/* Showroom / shop closing stock per location. */
(function (OPF) {
  "use strict";

  const H = OPF.html;
  const { esc, sum, fmtQty } = OPF.util;

  function render() {
    const st = OPF.stock.finished();
    const keys = Object.keys(st.shop).filter((k) => st.shop[k]).sort();
    const rows = keys.map((k) => {
      const [location, style, color, size] = st.names[k];
      return H.tr([H.td(esc(style)), H.td(esc(color)), H.td(esc(size)), H.td(esc(location)), H.tdn("<b>" + fmtQty(st.shop[k]) + "</b>", st.shop[k] < 0 ? "red" : "")]);
    });
    H.mount(
      "<h1>Showroom / Shop Stock</h1>" +
      H.cards([H.card("Showroom PCS", fmtQty(sum(keys, (k) => st.shop[k]))), H.card("Items", keys.length)]) +
      '<p class="muted">Closing Qty = Received from transfers − Sold + Returned, for each shop location.</p>' +
      H.table(["Style", "Color", "Size", "Location", "#Closing Qty"], rows)
    );
  }

  OPF.pages.showroom = { render };
})(window.OPF = window.OPF || {});
