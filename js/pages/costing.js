/* Product costing (cost build-up + margin = selling price) and the stock summary. */
(function (OPF) {
  "use strict";

  const H = OPF.html, F = OPF.forms, K = OPF.calc, S = OPF.store;
  const { esc, num, r2, sum, money, fmtQty } = OPF.util;

  const COST_FIELDS = ["fabricYd", "fabricRate", "accessories", "factory", "packaging", "transport", "other", "margin", "qty"];

  function render() {
    const fabrics = OPF.stock.raw().filter((x) => x.avg);
    const productOptions = '<option value="">-- New / not linked --</option>' + H.options(S.db.products, (p) => p.id, (p) => p.style + " - " + p.name);
    const fabricOptions = '<option value="">--</option>' + H.options(fabrics, (x) => x.avg, (x) => x.material + (x.color ? " / " + x.color : "") + " @ " + money(x.avg));
    H.mount(
      "<h1>Product Costing &amp; Stock Summary</h1>" +
      '<form id="costForm" class="box" data-submit="costing.apply" data-calc="costing.calc"><h2 style="margin-top:0">Product Costing</h2><div class="grid">' +
      H.select("product", "Product (to load / save costing)", productOptions, { change: "costing.load" }) +
      H.select("fabricPick", "Pick fabric (uses avg cost / yd)", fabricOptions, { change: "costing.pickFabric" }) +
      H.field("fabricYd", "Fabric Yards / PC", { type: "number", value: 0 }) + H.field("fabricRate", "Fabric Rate / Yard", { type: "number", value: 0 }) +
      H.field("accessories", "Accessories / PC", { type: "number", value: 0 }) + H.field("factory", "Factory Bill / PC", { type: "number", value: 0 }) +
      H.field("packaging", "Packaging / PC", { type: "number", value: 0 }) + H.field("transport", "Transport / PC", { type: "number", value: 0 }) +
      H.field("other", "Other Overhead / PC", { type: "number", value: 0 }) + H.field("margin", "Profit Margin %", { type: "number", value: 0 }) +
      H.field("qty", "Planned PCS", { type: "number", value: 0 }) +
      '</div><div class="calc" id="costout"></div><div class="actions"><button>Save Cost &amp; Selling Price to Product</button></div></form>' +
      stockSummary()
    );
    calc(H.$("costForm"));
  }

  function calc(form) {
    const d = F.data(form), c = K.costing(d);
    H.$("costout").innerHTML = '<div class="cols2"><div>' + H.calcTable([
      [`Fabric (${fmtQty(d.fabricYd)} yd x ${money(d.fabricRate)})`, money(c.fabric)], ["+ Accessories", money(d.accessories)], ["+ Factory Bill", money(d.factory)],
      ["+ Packaging", money(d.packaging)], ["+ Transport", money(d.transport)], ["+ Other Overhead", money(d.other)], ["= Total Cost / PC", money(c.total), true],
      [`+ Profit Margin (${fmtQty(d.margin)}%)`, money(c.profit)], ["= Selling Price / PC", `<span class="green">${money(c.price)}</span>`, true]
    ]) + "</div><div>" + (c.qty
      ? H.calcTable([["Planned PCS", fmtQty(c.qty)], ["Total Cost", money(c.totalCost)], ["Total Sales Value", money(c.totalSales)], ["Total Profit", money(c.totalProfit), true]])
      : '<span class="muted">Enter Planned PCS to see batch totals.</span>') + "</div></div>";
  }

  function load(select) {
    const p = S.byId("products", select.value), form = select.form;
    if (!p) return;
    COST_FIELDS.forEach((k) => F.set(form, k, p.costing && p.costing[k] != null ? p.costing[k] : 0));
  }

  function apply(form) {
    const d = F.data(form), p = S.byId("products", d.product);
    if (!p) { alert("Select a product first (add it in Style / Product if needed)."); return; }
    OPF.auth.require(() => {
      const c = K.costing(d);
      p.costing = {};
      COST_FIELDS.forEach((k) => { p.costing[k] = num(d[k]); });
      p.cost = c.total;
      p.price = c.price;
      S.log("Product Costing Saved", p.style);
      alert(`Saved: ${p.style} cost ${money(c.total)}, selling price ${money(c.price)}`);
      render();
      const again = H.$("costForm");
      F.set(again, "product", p.id);
      load(F.el(again, "product"));
      calc(again);
    });
  }

  function stockSummary() {
    const styles = OPF.stock.byStyle().filter((x) => x.godown || x.shop), finished = OPF.stock.finished(), raw = OPF.stock.raw(), byLocation = {};
    Object.keys(finished.shop).forEach((k) => { const loc = finished.names[k][0]; byLocation[loc] = r2((byLocation[loc] || 0) + finished.shop[k]); });
    const godown = sum(styles, (x) => x.godown), shop = sum(styles, (x) => x.shop), value = sum(styles, (x) => x.value);
    const noCost = styles.filter((x) => !x.cost && x.total).length;
    const rows = styles.map((x) => H.tr([H.td(esc(x.style)), H.td(esc(x.name)), H.tdn(fmtQty(x.godown)), H.tdn(fmtQty(x.shop)), H.tdn("<b>" + fmtQty(x.total) + "</b>", x.total < 0 ? "red" : ""), H.tdn(money(x.cost)), H.tdn(money(x.value))]));
    return "<h2>Stock Summary</h2>" +
      H.cards([
        H.card("Godown (Factory) PCS", fmtQty(godown)), H.card("Showroom PCS", fmtQty(shop)), H.card("Total PCS in Stock", fmtQty(godown + shop), "ok"),
        H.card("Finished Stock Value", money(value)), H.card("Raw Fabric (Yard)", fmtQty(sum(raw, (x) => x.yards))), H.card("Raw Material Value", money(sum(raw, (x) => x.value)))
      ]) +
      (Object.keys(byLocation).length > 1 ? `<p class="muted">Showroom breakdown: ${Object.keys(byLocation).map((l) => `${esc(l)}: ${fmtQty(byLocation[l])} PCS`).join(" | ")}</p>` : "") +
      (noCost ? `<div class="alert">${noCost} style(s) have no Cost / PC in Style / Product, so their stock value is counted as 0.</div>` : "") +
      H.table(["Style / Design", "Product", "#Godown PCS", "#Showroom PCS", "#Total PCS", "#Cost / PC", "#Stock Value"], rows, {
        foot: H.tr([H.td("Total"), H.tdEmpty(), H.tdn(fmtQty(godown)), H.tdn(fmtQty(shop)), H.tdn(fmtQty(godown + shop)), H.tdEmpty(), H.tdn(money(value))])
      }) +
      '<p class="muted">Godown = Accepted production − Dispatched to shops. Showroom = Received − Sold + Returned. Value = Total PCS x Cost / PC from Style / Product.</p>';
  }

  OPF.pages.costing = { render };
  OPF.actions.register({
    "costing.calc": calc,
    "costing.load": load,
    "costing.apply": apply,
    "costing.pickFabric": (el) => { if (el.value) F.set(el.form, "fabricRate", el.value); }
  });
})(window.OPF = window.OPF || {});
