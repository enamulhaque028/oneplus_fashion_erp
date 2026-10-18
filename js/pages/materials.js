/* Raw material / fabric stock in yards. */
(function (OPF) {
  "use strict";

  const H = OPF.html;
  const { esc, sum, money, fmtQty } = OPF.util;

  function render() {
    const stock = OPF.stock.raw();
    const yardLines = stock.filter((x) => x.inYd || x.outYd || x.retYd);
    const otherUnits = stock.filter((x) => Object.keys(x.other).length);
    const total = (k, fmt) => H.tdn((fmt || fmtQty)(sum(stock, (x) => x[k])));

    const rows = yardLines.map((x) => H.tr([
      H.td(esc(x.material)), H.td(esc(x.color)), H.tdn(fmtQty(x.inYd)), H.tdn(fmtQty(x.outYd)), H.tdn(fmtQty(x.retYd)),
      H.tdn("<b>" + fmtQty(x.yards) + "</b>", x.yards < 0 ? "red" : ""), H.tdn(money(x.avg)), H.tdn(money(x.value))
    ]));

    H.mount(
      "<h1>Raw Material / Fabric Stock</h1>" +
      H.cards([H.card("Fabric in Stock (Yard)", fmtQty(sum(stock, (x) => x.yards))), H.card("Stock Value", money(sum(stock, (x) => x.value))), H.card("Fabric Items", yardLines.length)]) +
      '<div class="alert">Formula: Purchase + Returned from Production − Issued = Stock (Yard). Purchases entered in Meter are converted automatically (1 m = 1.0936 yd).</div>' +
      H.table(["Material", "Color", "#Purchased (Yd)", "#Issued (Yd)", "#Returned (Yd)", "#Yard", "#Avg Cost / Yd", "#Stock Value"], rows, {
        foot: H.tr([H.td("Total"), H.tdEmpty(), total("inYd"), total("outYd"), total("retYd"), total("yards"), H.tdEmpty(), total("value", money)])
      }) +
      (otherUnits.length
        ? "<h2>Materials not measured in yards (Kg / Pcs)</h2>" +
          H.table(["Material", "Color", "#Balance"], otherUnits.map((x) => H.tr([H.td(esc(x.material)), H.td(esc(x.color)), H.tdn(Object.keys(x.other).map((u) => fmtQty(x.other[u]) + " " + esc(u)).join(", "))])), { tight: true })
        : "")
    );
  }

  OPF.pages.materials = { render };
})(window.OPF = window.OPF || {});
