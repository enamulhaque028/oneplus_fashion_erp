/* Sketch pad for Rough Notes: draw with a mouse, finger or pen.
   A sketch is stored as the strokes drawn, not as a picture: a few KB instead of hundreds, which
   matters because all data shares the browser's ~5 MB storage and is synced to Google Drive.
   Shape: { w: 1000, h: 560, strokes: [{ c: "#hex", s: size, e: 1 (eraser), p: [x, y, x, y, ...] }] }
   Coordinates are on that fixed 1000 x 560 grid, so a sketch looks the same at any screen size. */
(function (OPF) {
  "use strict";

  const W = 1000, H = 560;
  const INKS = ["#1f2937", "#dc2626", "#2563eb", "#16a34a", "#ea580c", "#7c3aed"];
  const SIZES = [[3, "Thin"], [7, "Medium"], [14, "Thick"]];
  const ERASER = 28;
  const MAX_POINTS = 60000; // keeps one sketch well under ~400 KB

  const empty = () => ({ w: W, h: H, strokes: [] });
  const isEmpty = (sk) => !sk || !Array.isArray(sk.strokes) || !sk.strokes.length;

  // Accept only the expected shape (sketches also arrive from backups and Google Drive).
  function valid(sk) {
    if (!sk || !Array.isArray(sk.strokes)) return null;
    const strokes = sk.strokes.filter((s) => s && Array.isArray(s.p) && s.p.length >= 2).map((s) => ({
      c: INKS.indexOf(s.c) >= 0 ? s.c : INKS[0], s: Math.min(Math.max(Number(s.s) || 3, 1), 40), e: s.e ? 1 : 0,
      p: s.p.map((n) => Math.round(Number(n) || 0))
    }));
    return strokes.length ? { w: W, h: H, strokes } : null;
  }

  function drawStroke(ctx, st, k) {
    const p = st.p;
    ctx.globalCompositeOperation = st.e ? "destination-out" : "source-over";
    ctx.strokeStyle = st.c;
    ctx.fillStyle = st.c;
    ctx.lineWidth = st.s * k;
    if (p.length == 2) { // a dot
      ctx.beginPath(); ctx.arc(p[0] * k, p[1] * k, (st.s * k) / 2, 0, Math.PI * 2); ctx.fill();
      return;
    }
    ctx.beginPath();
    ctx.moveTo(p[0] * k, p[1] * k);
    // Smooth line: curve through the midpoints between recorded points.
    for (let i = 2; i < p.length - 2; i += 2) {
      ctx.quadraticCurveTo(p[i] * k, p[i + 1] * k, ((p[i] + p[i + 2]) / 2) * k, ((p[i + 1] + p[i + 3]) / 2) * k);
    }
    ctx.lineTo(p[p.length - 2] * k, p[p.length - 1] * k);
    ctx.stroke();
  }

  // Size the canvas to its box (sharp on high-density screens) and draw every stroke.
  function paint(canvas, sk) {
    const box = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    const cssW = box.width || canvas.clientWidth || W;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round((cssW * H / W) * dpr);
    const ctx = canvas.getContext("2d");
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const k = canvas.width / W;
    ((sk && sk.strokes) || []).forEach((st) => drawStroke(ctx, st, k));
    ctx.globalCompositeOperation = "source-over";
  }

  /* ---------- the pad (one at a time, on the Rough Notes form) ---------- */
  let pad = null; // { canvas, sketch, ink, size, eraser, drawing }

  function toolsHtml() {
    return '<div class="sk-bar" id="skBar">' +
      INKS.map((c, i) => `<button type="button" class="sk-ink${i == 0 ? " on" : ""}" style="background:${c}" data-act="sk.ink" data-ink="${c}" title="Pen colour"></button>`).join("") +
      '<span class="rt-sep"></span>' +
      SIZES.map(([s, label], i) => `<button type="button" class="sk-size${i == 0 ? " on" : ""}" data-act="sk.size" data-size="${s}" title="${label} line"><i style="width:${s + 2}px;height:${s + 2}px"></i></button>`).join("") +
      '<span class="rt-sep"></span>' +
      '<button type="button" class="rt-btn" data-act="sk.eraser" id="skEraser" title="Eraser">Eraser</button>' +
      '<button type="button" class="rt-btn" data-act="sk.undo" title="Undo the last line">Undo</button>' +
      '<button type="button" class="rt-btn" data-act="sk.clear" title="Clear the sketch">Clear</button>' +
      "</div>";
  }

  // Sketch area HTML; call mount() after it is in the page.
  const html = () => `<div class="sk" id="skWrap">${toolsHtml()}<canvas class="sk-paper" id="skCanvas"></canvas></div>`;

  function point(e) {
    const r = pad.canvas.getBoundingClientRect();
    return [Math.round(((e.clientX - r.left) / r.width) * W), Math.round(((e.clientY - r.top) / r.height) * H)];
  }
  const total = () => pad.sketch.strokes.reduce((t, s) => t + s.p.length, 0);

  function down(e) {
    if (e.button > 0) return;
    e.preventDefault();
    if (total() > MAX_POINTS) { alert("This sketch is full. Save it, and start another note for more drawing."); return; }
    try { pad.canvas.setPointerCapture(e.pointerId); } catch (err) { /* keeps drawing without capture */ }
    const [x, y] = point(e);
    pad.drawing = { c: pad.ink, s: pad.eraser ? ERASER : pad.size, e: pad.eraser ? 1 : 0, p: [x, y] };
    pad.sketch.strokes.push(pad.drawing);
    paint(pad.canvas, pad.sketch);
  }
  function move(e) {
    if (!pad.drawing) return;
    const p = pad.drawing.p, [x, y] = point(e);
    if (Math.abs(x - p[p.length - 2]) + Math.abs(y - p[p.length - 1]) < 3) return; // skip tiny moves: smaller data
    // Draw just the new piece while the pen moves (fast on a slow laptop); the smooth full
    // redraw happens when the pen lifts.
    const ctx = pad.canvas.getContext("2d"), k = pad.canvas.width / W, st = pad.drawing;
    ctx.globalCompositeOperation = st.e ? "destination-out" : "source-over";
    ctx.strokeStyle = st.c;
    ctx.lineWidth = st.s * k;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(p[p.length - 2] * k, p[p.length - 1] * k);
    ctx.lineTo(x * k, y * k);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
    p.push(x, y);
  }
  function up() {
    if (!pad.drawing) return;
    pad.drawing = null;
    paint(pad.canvas, pad.sketch);
  }

  function mount(sketch) {
    const canvas = document.getElementById("skCanvas");
    if (!canvas) { pad = null; return; }
    pad = { canvas, sketch: valid(sketch) || empty(), ink: INKS[0], size: SIZES[0][0], eraser: false, drawing: null };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    paint(canvas, pad.sketch);
  }

  const value = () => (pad && !isEmpty(pad.sketch) ? valid(pad.sketch) : null);

  function pick(el, cls) {
    Array.prototype.forEach.call(document.querySelectorAll("#skBar ." + cls), (b) => b.classList.toggle("on", b == el));
  }
  function setEraser(on) {
    pad.eraser = on;
    const b = document.getElementById("skEraser");
    if (b) b.classList.toggle("on", on);
    pad.canvas.classList.toggle("erasing", on);
  }

  // Draw saved sketches into every <canvas data-sketch="id"> on the page (the note cards).
  function paintAll(byId) {
    Array.prototype.forEach.call(document.querySelectorAll("canvas[data-sketch]"), (c) => paint(c, valid(byId(c.dataset.sketch))));
  }

  OPF.sketch = { html, mount, value, paint, paintAll, valid, isEmpty, size: (sk) => JSON.stringify(sk || "").length };
  OPF.actions.register({
    "sk.ink": (el) => { if (!pad) return; pad.ink = el.dataset.ink; pick(el, "sk-ink"); setEraser(false); },
    "sk.size": (el) => { if (!pad) return; pad.size = Number(el.dataset.size); pick(el, "sk-size"); setEraser(false); },
    "sk.eraser": () => { if (pad) setEraser(!pad.eraser); },
    "sk.undo": () => { if (!pad) return; pad.sketch.strokes.pop(); paint(pad.canvas, pad.sketch); },
    "sk.clear": () => { if (pad && !isEmpty(pad.sketch) && confirm("Clear the whole sketch?")) { pad.sketch = empty(); paint(pad.canvas, pad.sketch); } }
  });
})(window.OPF = window.OPF || {});
