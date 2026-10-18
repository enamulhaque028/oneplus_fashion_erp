/* Dependency-free SVG charts (the ERP runs offline; Chart.js & co. would need a download).
   - donut():  part-of-whole, with a value legend (labels carry identity; colour never alone)
   - trend():  line / bar / table views of daily series on ONE money axis, with a hover
               crosshair + tooltip (bind() wires the hover after the HTML is mounted)
   Colours come from CSS tokens --series-1..3 (validated light & dark, see docs/ARCHITECTURE.md).
   They go in style="" because SVG presentation attributes (fill=, stroke=) ignore var(). */
(function (OPF) {
  "use strict";

  const { esc, money } = OPF.util;
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const store = {}; // chart id -> data, read by the hover handler
  let seq = 0;

  // 1,250,000 -> "12.5 L" (Bangladeshi lakh / crore) for axis labels.
  function compact(v) {
    const a = Math.abs(v), f = (x, s) => (Math.round(x * 10) / 10).toString().replace(/\.0$/, "") + s;
    if (a >= 1e7) return f(v / 1e7, " Cr");
    if (a >= 1e5) return f(v / 1e5, " L");
    if (a >= 1e3) return f(v / 1e3, "K");
    return String(Math.round(v));
  }
  const dayLabel = (iso) => { const p = String(iso).split("-"); return p.length == 3 ? `${MONTHS[+p[1] - 1]} ${+p[2]}` : iso; };

  // Round the axis maximum up to 1 / 2 / 2.5 / 5 x 10^n.
  function niceMax(v) {
    if (v <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  }

  /* ---------- donut ---------- */
  function donut({ segments, centerTop, empty }) {
    const total = segments.reduce((t, s) => t + Math.max(0, s.value), 0);
    const R = 70, CIRC = 2 * Math.PI * R, GAP = total ? 2 : 0;
    let start = 0;
    const arcs = total
      ? segments.filter((s) => s.value > 0).map((s) => {
          const len = (s.value / total) * CIRC, dash = Math.max(len - GAP, 0.5);
          const a = `<circle class="seg" cx="100" cy="100" r="${R}" style="stroke:${s.color}" stroke-dasharray="${dash} ${CIRC - dash}" stroke-dashoffset="${-start}" transform="rotate(-90 100 100)"><title>${esc(s.label)}: ${money(s.value)} (${Math.round((s.value / total) * 100)}%)</title></circle>`;
          start += len;
          return a;
        }).join("")
      : `<circle cx="100" cy="100" r="${R}" fill="none" stroke-width="26" style="stroke:var(--grid-line)"/>`;
    const svg = `<svg viewBox="0 0 200 200" role="img" aria-label="${esc(centerTop)}"><g class="arcs">${arcs}</g>` +
      `<text class="ctr1" x="100" y="94" text-anchor="middle">${esc(centerTop)}</text>` +
      `<text class="ctr2" x="100" y="116" text-anchor="middle">${total ? esc(compact(total)) : "0"}</text></svg>`;
    const rows = segments.map((s) => `<div class="row"><span><span class="sw" style="background:${s.color}"></span>${esc(s.label)}</span><span><b>${money(s.value)}</b><small>${total ? Math.round((s.value / total) * 100) : 0}%</small></span></div>`).join("");
    return `<div class="donut"><div class="chart-wrap">${svg}</div><div class="dleg">${rows}${total ? "" : `<p class="muted">${esc(empty || "No data for this period.")}</p>`}</div></div>`;
  }

  /* ---------- trend: line / bar / table ---------- */
  const W = 720, H = 270, M = { l: 58, r: 14, t: 12, b: 28 }, PW = W - M.l - M.r, PH = H - M.t - M.b;

  function roundedTop(x, y, w, h, r) {
    r = Math.min(r, w / 2, h);
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  }

  function trend({ labels, series, type }) {
    if (type == "table") {
      const H_ = OPF.html;
      const rows = labels.map((d, i) => H_.tr([H_.td(esc(d))].concat(series.map((s) => H_.tdn(money(s.values[i])))))).reverse();
      return H_.table(["Date"].concat(series.map((s) => "#" + esc(s.name))), rows, { tight: true });
    }
    const id = "c" + ++seq, n = labels.length;
    const max = niceMax(Math.max.apply(null, series.map((s) => Math.max.apply(null, s.values.concat([0])))));
    const y = (v) => M.t + PH - (v / max) * PH;
    const step = n > 1 ? PW / (n - 1) : PW, band = PW / n;
    const xLine = (i) => M.l + i * step, xBand = (i) => M.l + i * band;

    let g = "";
    for (let k = 0; k <= 4; k++) {
      const v = (max / 4) * k, yy = y(v);
      g += `<line class="${k ? "gridl" : "zero"}" x1="${M.l}" x2="${W - M.r}" y1="${yy}" y2="${yy}"/><text class="axis" x="${M.l - 8}" y="${yy + 4}" text-anchor="end">${compact(v)}</text>`;
    }
    labels.forEach((d, i) => {
      if (i % 5 && i != n - 1) return;
      const x = type == "bar" ? xBand(i) + band / 2 : xLine(i);
      g += `<text class="axis" x="${x}" y="${H - 8}" text-anchor="middle">${dayLabel(d)}</text>`;
    });

    let marks = "";
    if (type == "bar") {
      const pad = Math.max(1, band * 0.14), bw = (band - pad * 2) / series.length;
      series.forEach((s, si) => s.values.forEach((v, i) => {
        if (v <= 0) return;
        const hgt = Math.max(1, (v / max) * PH);
        marks += `<path class="br" style="fill:${s.color}" d="${roundedTop(xBand(i) + pad + si * bw + 1, y(v), Math.max(bw - 2, 1), hgt, 4)}"/>`;
      }));
    } else {
      series.forEach((s) => {
        const pts = s.values.map((v, i) => `${xLine(i).toFixed(1)},${y(v).toFixed(1)}`);
        marks += `<path class="ar" style="fill:${s.color}" d="M${xLine(0)},${y(0)}L${pts.join("L")}L${xLine(n - 1)},${y(0)}Z"/>` +
          `<path class="ln" style="stroke:${s.color}" pathLength="1" d="M${pts.join("L")}"/>`;
      });
    }
    const dots = type == "bar" ? "" : series.map((s, si) => `<circle class="dot" data-s="${si}" r="4.5" style="fill:${s.color}" cx="0" cy="0"/>`).join("");
    store[id] = { labels, series, type, max, y, xLine, xBand, band, n };
    return `<div class="chart-wrap" data-chart="${id}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Trend chart">${g}${marks}` +
      `<line class="xh" y1="${M.t}" y2="${M.t + PH}" x1="0" x2="0"/>${dots}` +
      `<rect class="hit" x="${M.l}" y="${M.t}" width="${PW}" height="${PH}" fill="transparent"/></svg><div class="chart-tip"></div></div>` +
      `<div class="legend">${series.map((s) => `<span><span class="sw" style="background:${s.color}"></span>${esc(s.name)}<b>${money(s.values.reduce((t, v) => t + v, 0))}</b></span>`).join("")}</div>`;
  }

  // Crosshair + tooltip for every trend chart inside `root` (call after mounting the HTML).
  function bind(root) {
    Array.prototype.forEach.call((root || document).querySelectorAll(".chart-wrap[data-chart]"), (wrap) => {
      const d = store[wrap.getAttribute("data-chart")];
      if (!d) return;
      const svg = wrap.querySelector("svg"), tip = wrap.querySelector(".chart-tip"), xh = wrap.querySelector(".xh");
      wrap.addEventListener("mousemove", (e) => {
        const r = svg.getBoundingClientRect(), sx = ((e.clientX - r.left) * W) / r.width;
        if (sx < M.l || sx > W - M.r) { wrap.classList.remove("hovering"); tip.style.display = "none"; return; }
        const i = d.type == "bar" ? Math.min(d.n - 1, Math.max(0, Math.floor((sx - M.l) / d.band))) : Math.min(d.n - 1, Math.max(0, Math.round((sx - M.l) / ((W - M.l - M.r) / Math.max(d.n - 1, 1)))));
        const cx = d.type == "bar" ? d.xBand(i) + d.band / 2 : d.xLine(i);
        xh.setAttribute("x1", cx); xh.setAttribute("x2", cx);
        Array.prototype.forEach.call(wrap.querySelectorAll(".dot"), (dot) => { const s = d.series[+dot.getAttribute("data-s")]; dot.setAttribute("cx", cx); dot.setAttribute("cy", d.y(s.values[i])); });
        wrap.classList.add("hovering");
        tip.innerHTML = `<b>${esc(dayLabel(d.labels[i]))}</b>` + d.series.map((s) => `<div class="r"><span><span class="sw" style="background:${s.color}"></span>${esc(s.name)}</span><span>${money(s.values[i])}</span></div>`).join("");
        tip.style.display = "block";
        // Beside the crosshair; flips to the left side near the right edge.
        const px = (cx / W) * r.width, w = tip.offsetWidth;
        tip.style.left = (px + 14 + w > r.width ? Math.max(px - w - 14, 0) : px + 14) + "px";
        tip.style.top = Math.max(e.clientY - r.top - 20, 0) + "px";
      });
      wrap.addEventListener("mouseleave", () => { wrap.classList.remove("hovering"); tip.style.display = "none"; });
    });
  }

  OPF.charts = { donut, trend, bind, compact, dayLabel };
})(window.OPF = window.OPF || {});
