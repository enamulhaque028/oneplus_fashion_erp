/* Stock positions, always recalculated from transactions (never stored):
     Godown (factory)  = accepted production - dispatched transfers
     Showroom (shop)   = received transfers - sold + returned, per location
     Raw fabric (yard) = purchased + returned from production - issued */
(function (OPF) {
  "use strict";

  const C = OPF.config, K = OPF.calc;
  const { num, r2, lc, str, skey } = OPF.util;

  // skip: { coll, id } leaves out the record being edited so its own quantity is not counted twice.
  function finished(skip) {
    const db = OPF.store.db;
    const godown = {}, shop = {}, names = {};
    const add = (map, parts, q) => {
      const k = skey(...parts);
      if (!names[k]) names[k] = parts.map((v) => str(v).trim());
      map[k] = r2((map[k] || 0) + q);
    };
    const keep = (coll, r) => !(skip && skip.coll == coll && skip.id == r.id);

    db.production.forEach((r) => { if (keep("production", r)) add(godown, [r.style, r.color, r.size], num(r.accepted)); });
    db.transfers.forEach((r) => {
      if (!keep("transfers", r)) return;
      add(godown, [r.style, r.color, r.size], -num(r.dispatched));
      add(shop, [r.to || C.MAIN_SHOP, r.style, r.color, r.size], num(r.received));
    });
    db.sales.forEach((r) => {
      if (keep("sales", r)) r.items.forEach((i) => add(shop, [r.location || C.MAIN_SHOP, i.style, i.color, i.size], -num(i.qty)));
    });
    db.returns.forEach((r) => { if (keep("returns", r)) add(shop, [r.location || C.MAIN_SHOP, r.style, r.color, r.size], num(r.qty)); });
    return { godown, shop, names };
  }

  // One line per material + color. Units other than yard/meter are kept apart in `other`.
  function raw(skipIssueId) {
    const db = OPF.store.db;
    const map = {};
    const line = (material, color) => {
      const k = skey(material, color);
      return map[k] || (map[k] = { material: str(material).trim(), color: str(color).trim(), inYd: 0, outYd: 0, retYd: 0, cost: 0, other: {} });
    };
    const addOther = (x, unit, q) => { const u = unit || "unit"; x.other[u] = r2((x.other[u] || 0) + q); };

    db.purchases.forEach((r) => {
      const x = line(r.material, r.color), y = K.yardsOf(r.qty, r.unit);
      if (y == null) addOther(x, r.unit, num(r.qty));
      else { x.inYd = r2(x.inYd + y); x.cost = r2(x.cost + K.purchase(r).total); }
    });
    db.issues.forEach((r) => {
      if (r.id == skipIssueId) return;
      const x = line(r.material, r.color), y = K.yardsOf(r.qty, r.unit);
      if (y == null) addOther(x, r.unit, -num(r.qty));
      else x.outYd = r2(x.outYd + y);
    });
    db.production.forEach((r) => {
      if (r.material && num(r.returned)) { const x = line(r.material, r.color); x.retYd = r2(x.retYd + num(r.returned)); }
    });

    return Object.keys(map).sort().map((k) => {
      const x = map[k];
      x.yards = r2(x.inYd - x.outYd + x.retYd);
      x.avg = x.inYd ? r2(x.cost / x.inYd) : 0;
      x.value = r2(Math.max(x.yards, 0) * x.avg);
      return x;
    });
  }

  const rawLine = (material, color, skipIssueId) => raw(skipIssueId).find((x) => skey(x.material, x.color) == skey(material, color));

  // Godown / showroom / total pieces and value per style (value uses Cost / PC from the product master).
  function byStyle() {
    const st = finished();
    const map = {};
    const row = (style) => map[lc(style)] || (map[lc(style)] = { style: str(style).trim(), godown: 0, shop: 0 });
    Object.keys(st.godown).forEach((k) => { const x = row(st.names[k][0]); x.godown = r2(x.godown + st.godown[k]); });
    Object.keys(st.shop).forEach((k) => { const x = row(st.names[k][1]); x.shop = r2(x.shop + st.shop[k]); });
    return Object.keys(map).sort().map((k) => {
      const x = map[k], p = OPF.store.productByStyle(x.style);
      x.name = p ? p.name : "";
      x.cost = p ? num(p.cost) : 0;
      x.total = r2(x.godown + x.shop);
      x.value = r2(Math.max(x.total, 0) * x.cost);
      return x;
    });
  }

  // Lines where the requested quantity exceeds shop stock, e.g. "OPF-101 / BLACK / M: need 40, in stock 35".
  function shopShortages(location, items, skip) {
    const st = finished(skip), need = {}, out = [];
    items.forEach((i) => { const k = skey(location, i.style, i.color, i.size); need[k] = r2((need[k] || 0) + num(i.qty)); });
    Object.keys(need).forEach((k) => {
      const have = st.shop[k] || 0;
      if (need[k] > have) out.push(`${k.split("|").slice(1).filter(Boolean).join(" / ").toUpperCase()}: need ${OPF.util.fmtQty(need[k])}, in stock ${OPF.util.fmtQty(have)}`);
    });
    return out;
  }

  OPF.stock = { finished, raw, rawLine, byStyle, shopShortages };
})(window.OPF = window.OPF || {});
