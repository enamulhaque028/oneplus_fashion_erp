/* Rough notes: a free notepad for ideas, reminders and anything to note, with simple formatting,
   one sketch per note, colours and pins. No calculations; nothing here changes any other figure.
   Record: { date, subject, html (cleaned rich text), text (plain copy for search / Excel), sketch,
             color, pinned }

   Layout: the page is a board of same-height cards (pinned first). "New note" and Edit open the
   writing window; clicking a card opens a read-only preview. Both windows sit below the admin
   password dialog (#modal), so Edit / Delete can still ask for the password on top of them. */
(function (OPF) {
  "use strict";

  const H = OPF.html, F = OPF.forms, R = OPF.records, RT = OPF.richtext, SK = OPF.sketch, S = OPF.store;
  const { esc, lc, today } = OPF.util;
  const MAX_NOTE = 450000; // characters; the browser keeps all ERP data in about 5 MB
  // Sticky-note colours (CSS .nc-<name>); "" = plain. New notes start yellow.
  const COLORS = [["", "Plain"], ["yellow", "Yellow"], ["pink", "Pink"], ["green", "Green"], ["blue", "Blue"], ["purple", "Purple"], ["orange", "Orange"]];
  const colorOf = (c) => (COLORS.some((x) => x[0] == c) ? c : "");
  const cls = (n) => "nc-" + (colorOf(n.color) || "plain");

  let query = "", colorFilter = null, flashId = null;

  /* ---------- the board ---------- */
  function render() {
    closeDialog();
    H.mount(
      `<div class="notes-head"><h1>Rough Notes</h1>${H.button(OPF.icon("plus") + " New note", "notes.new", null, "notes-new")}</div>` +
      '<div class="notes-bar no-print">' +
      `<label class="notes-search">${OPF.icon("search")}<input type="search" id="noteSearch" placeholder="Search notes" value="${esc(query)}" autocomplete="off"></label>` +
      `<div class="notes-chips" id="noteChips">${chips()}</div></div>` +
      '<div id="noteGrid"></div>'
    );
    const box = H.$("noteSearch");
    let t = null;
    box.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { query = box.value; grid(); }, 120); });
    // Enter or Space on a focused card opens its preview (keyboard use).
    H.$("noteGrid").addEventListener("keydown", (e) => {
      if ((e.key == "Enter" || e.key == " ") && e.target.classList && e.target.classList.contains("n-card")) { e.preventDefault(); preview(e.target.dataset.id); }
    });
    grid();
    // Edit (from a card, after the admin password) lands here: open the writing window.
    const rec = F.editingRecord("notes");
    if (rec) compose(rec);
  }

  function chips() {
    const used = COLORS.filter(([c]) => S.db.notes.some((n) => colorOf(n.color) == c));
    if (used.length < 2) return "";
    return `<button type="button" class="nchip${colorFilter == null ? " on" : ""}" data-act="notes.filter">All</button>` +
      used.map(([c, label]) => `<button type="button" class="nchip ${"nc-" + (c || "plain")}${colorFilter === c ? " on" : ""}" data-act="notes.filter" data-color="${c}"><i class="nc-dot"></i>${label}</button>`).join("");
  }

  // Pinned first, then newest date, then newest saved.
  function sorted() {
    const q = lc(query.trim());
    return S.db.notes
      .filter((n) => (colorFilter == null || colorOf(n.color) === colorFilter) && (!q || lc((n.subject || "") + " " + (n.text || "")).indexOf(q) >= 0))
      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || String(b.date).localeCompare(String(a.date)) || String(b.created || "").localeCompare(String(a.created || "")));
  }

  function grid() {
    const list = sorted(), el = H.$("noteGrid");
    if (!el) return;
    if (!S.db.notes.length) {
      el.innerHTML = `<div class="notes-empty">${OPF.icon("note")}<b>No notes yet</b><span>Keep ideas, reminders and quick sketches here.</span>${H.button(OPF.icon("plus") + " Write the first note", "notes.new")}</div>`;
      return;
    }
    el.innerHTML = list.length ? `<div class="note-board">${list.map(card).join("")}</div>`
      : '<div class="notes-empty"><b>No note matches</b><span>Try another word or colour.</span></div>';
    SK.paintAll(sketchOf);
    if (flashId) {
      const c = el.querySelector(`[data-id="${flashId}"]`);
      if (c) c.classList.add("flash");
      flashId = null;
    }
  }

  const sketchOf = (id) => { const n = S.byId("notes", id); return n && n.sketch; };
  // No title: the first line of the note, without the link addresses kept in the plain copy.
  const titleOf = (n) => n.subject || (n.text || "").split("\n")[0].replace(/ \((https?:|mailto:|tel:)[^)]*\)/g, "").slice(0, 60) || "Sketch";
  const pinBtn = (n) => `<button type="button" class="n-pin${n.pinned ? " on" : ""}" data-act="notes.pin" data-id="${esc(n.id)}" title="${n.pinned ? "Unpin" : "Pin to the top"}" aria-label="${n.pinned ? "Unpin" : "Pin to the top"}">${OPF.icon("pin")}</button>`;

  function card(n) {
    const sketch = SK.isEmpty(n.sketch) ? "" : `<div class="n-thumb"><canvas data-sketch="${esc(n.id)}"></canvas></div>`;
    return `<article class="n-card ${cls(n)}${sketch ? " has-sketch" : ""}" data-act="notes.preview" data-id="${esc(n.id)}" tabindex="0">` +
      `<header class="n-top"><i class="nc-dot"></i><b>${esc(titleOf(n))}</b><time>${esc(n.date)}</time>${pinBtn(n)}</header>` +
      `<div class="n-main"><div class="n-text">${RT.clean(n.html)}</div>${sketch}</div>` +
      `<footer class="n-foot no-print"><button type="button" class="n-link" data-act="notes.preview" data-id="${esc(n.id)}">${OPF.icon("expand")} Preview</button><span class="grow"></span>` +
      `${H.button("Edit", "record.edit", { coll: "notes", id: n.id }, "sm light")}${H.button("Delete", "record.delete", { coll: "notes", id: n.id }, "sm bad")}</footer></article>`;
  }

  /* ---------- windows (preview, writing) ---------- */
  function dialog(html, wide) {
    closeDialog();
    const d = document.createElement("div");
    d.id = "noteDlg";
    d.innerHTML = `<div class="nd-card${wide ? " wide" : ""}" role="dialog" aria-modal="true">${html}</div>`;
    d.addEventListener("mousedown", (e) => { if (e.target == d) closeWindow(); });
    document.body.appendChild(d);
    document.body.classList.add("nd-open");
    return d;
  }
  function closeDialog() {
    const d = H.$("noteDlg");
    if (d) d.remove();
    document.body.classList.remove("nd-open");
  }
  // Closing the writing window also ends an edit, so the next "New note" starts empty.
  function closeWindow() {
    if (F.isEditing("notes")) OPF.router.editing = null;
    closeDialog();
  }

  function preview(id) {
    const n = S.byId("notes", id);
    if (!n) return;
    dialog(
      `<div class="nd-top ${cls(n)}"><i class="nc-dot"></i><span>${esc(n.date)}</span><span class="grow"></span>${pinBtn(n)}<button type="button" class="nd-x" data-act="notes.close" aria-label="Close">&times;</button></div>` +
      `<div class="nd-body"><h2>${esc(titleOf(n))}</h2><div class="nd-text ${cls(n)}">${RT.clean(n.html) || '<span class="muted">No text</span>'}</div>` +
      (SK.isEmpty(n.sketch) ? "" : `<div class="nd-label">Sketch</div><div class="nd-sketch"><canvas data-sketch="${esc(n.id)}"></canvas></div>`) + "</div>" +
      `<div class="nd-foot"><button type="button" class="light" data-act="notes.copy" data-id="${esc(n.id)}">Copy text</button><span class="grow"></span>` +
      `${H.button("Delete", "record.delete", { coll: "notes", id: n.id }, "light bad")}${H.button("Edit note", "notes.edit", { id: n.id }, "nd-main")}</div>`,
      true
    );
    SK.paintAll(sketchOf);
  }

  // The writing window; `rec` when editing (after the admin password), else a new note.
  function compose(rec) {
    const r = rec || { date: today(), color: "yellow" };
    const hasSketch = !SK.isEmpty(r.sketch);
    const d = dialog(
      `<form id="mainForm" data-submit="notes.save" autocomplete="off">` +
      `<div class="nd-top ${cls(r)}" id="ndTop"><i class="nc-dot"></i><span>${rec ? "Edit note" : "New note"}</span><span class="grow"></span><button type="button" class="nd-x" data-act="notes.close" aria-label="Close">&times;</button></div>` +
      '<div class="nd-body">' +
      `<input class="nd-title" name="subject" placeholder="Title (optional)" value="${esc(r.subject || "")}">` +
      '<div class="nd-row">' +
      `<label class="nd-date">${OPF.icon("calendar")}<input type="date" name="date" value="${esc(r.date || today())}" required></label>` +
      `<input type="hidden" name="color" value="${esc(colorOf(r.color))}"><div class="nc-pick" id="ncPick">` +
      COLORS.map(([c, label]) => `<button type="button" class="nc-sw nc-${c || "plain"}" data-act="notes.color" data-color="${c}" title="${label}" aria-label="${label}"></button>`).join("") +
      "</div></div>" +
      RT.editor(r.html || "") +
      `<div id="skSlot">${hasSketch ? SK.html() : ""}</div>` +
      "</div>" +
      '<div class="nd-foot">' +
      H.button(OPF.icon("plus") + " Add sketch", "notes.addSketch", null, "light" + (hasSketch ? " hide" : "")) +
      H.button("Remove sketch", "notes.removeSketch", null, "light nd-rm" + (hasSketch ? "" : " hide")) +
      '<span class="grow"></span><span class="nd-hint">Ctrl+Enter to save</span>' +
      `<button type="button" class="light" data-act="notes.close">Cancel</button><button>${rec ? "Update" : "Save"}</button></div></form>`,
      true
    );
    RT.wire();
    paintColor(colorOf(r.color));
    SK.mount(hasSketch ? r.sketch : null); // always: forgets the previous note's sketch
    d.querySelector("form").addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key == "Enter") { e.preventDefault(); H.$("mainForm").requestSubmit ? H.$("mainForm").requestSubmit() : save(H.$("mainForm")); }
    });
    const focus = rec ? H.$("rtBox") : d.querySelector(".nd-title");
    if (focus) focus.focus();
  }

  // Mark the chosen swatch and tint the window, so the colour shows while writing.
  function paintColor(c) {
    c = colorOf(c);
    F.set(H.$("mainForm"), "color", c);
    Array.prototype.forEach.call(document.querySelectorAll("#ncPick .nc-sw"), (b) => b.classList.toggle("on", b.dataset.color == c));
    const k = "nc-" + (c || "plain");
    const rt = document.querySelector("#mainForm .rt");
    if (rt) rt.className = "rt " + k;
    const top = H.$("ndTop");
    if (top) top.className = "nd-top " + k;
  }

  function toggleSketch(show) {
    H.$("skSlot").innerHTML = show ? SK.html() : "";
    SK.mount(null);
    document.querySelector('[data-act="notes.addSketch"]').classList.toggle("hide", show);
    document.querySelector('[data-act="notes.removeSketch"]').classList.toggle("hide", !show);
    if (show) H.$("skCanvas").scrollIntoView({ block: "nearest" });
  }

  function save(form) {
    const html = RT.clean(H.$("rtBox").innerHTML), text = RT.text(html), sketch = SK.value();
    if (!text && !sketch) { alert("Write the note or draw a sketch first."); return; }
    const d = Object.assign(F.data(form), { html, text, sketch });
    d.color = colorOf(d.color);
    if (JSON.stringify(d).length > MAX_NOTE) { alert("This note is too large to save. Shorten the text or clear part of the sketch."); return; }
    const saved = R.save("notes", d, "Note", d.subject || text.slice(0, 40) || "Sketch");
    if (saved.pinned == null) saved.pinned = false;
    flashId = saved.id;
    render();
  }

  // Pinning only reorders the board, so it does not need the admin password.
  function pin(el) {
    const n = S.byId("notes", el.dataset.id);
    if (!n) return;
    n.pinned = !n.pinned;
    S.log(n.pinned ? "Note Pinned" : "Note Unpinned", titleOf(n));
    const inPreview = !!document.querySelector("#noteDlg .nd-text");
    grid();
    if (inPreview) preview(n.id);
  }

  function copy(el) {
    const n = S.byId("notes", el.dataset.id);
    if (!n) return;
    const text = (n.subject ? n.subject + "\n\n" : "") + (n.text || "");
    const done = () => OPF.cloud.toast("Note copied.");
    const fallback = () => {
      const t = document.createElement("textarea");
      t.value = text;
      t.style.position = "fixed"; t.style.opacity = "0";
      document.body.appendChild(t); t.select();
      try { document.execCommand("copy"); done(); } catch (e) { alert("Could not copy. Select the text and press Ctrl+C."); }
      t.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  }

  // Leaving the page (Back, a link, the menu) closes a window left open.
  window.addEventListener("hashchange", () => { if (!/^#\/notes/.test(location.hash) && H.$("noteDlg")) closeWindow(); });

  // Esc closes the open window (but not while the admin password dialog is up).
  document.addEventListener("keydown", (e) => {
    if (e.key == "Escape" && H.$("noteDlg") && !document.querySelector("#modal .overlay")) closeWindow();
  });

  OPF.pages.notes = { render };
  OPF.actions.register({
    "notes.new": () => { OPF.router.editing = null; compose(null); },
    "notes.save": save,
    "notes.edit": (el) => R.edit("notes", el.dataset.id),
    "notes.close": closeWindow,
    // A click on a link inside the card opens the link (new tab), not the preview.
    "notes.preview": (el, e) => { if (!(e && e.target.closest && e.target.closest("a, button:not([data-act='notes.preview'])"))) preview(el.dataset.id); },
    "notes.filter": (el) => { colorFilter = el.dataset.color == null ? null : el.dataset.color; H.$("noteChips").innerHTML = chips(); grid(); },
    "notes.pin": pin,
    "notes.copy": copy,
    "notes.color": (el) => paintColor(el.dataset.color),
    "notes.addSketch": () => toggleSketch(true),
    "notes.removeSketch": () => { if (!SK.value() || confirm("Remove the sketch from this note?")) toggleSketch(false); }
  });
})(window.OPF = window.OPF || {});
