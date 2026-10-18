/* Rough notes: a free notepad for ideas, reminders and anything to note, with simple formatting
   and one sketch per note. No calculations; nothing here changes any other figure.
   Record: { date, subject, html (cleaned rich text), text (plain copy for search / Excel), sketch } */
(function (OPF) {
  "use strict";

  const H = OPF.html, F = OPF.forms, R = OPF.records, RT = OPF.richtext, SK = OPF.sketch;
  const { esc, lc, today, byDateDesc } = OPF.util;
  const MAX_NOTE = 450000; // characters; the browser keeps all ERP data in about 5 MB
  // Sticky-note colours (CSS .nc-<name>); "" = plain. New notes start yellow.
  const COLORS = [["", "Plain"], ["yellow", "Yellow"], ["pink", "Pink"], ["green", "Green"], ["blue", "Blue"], ["purple", "Purple"], ["orange", "Orange"]];
  const colorOf = (c) => (COLORS.some((x) => x[0] == c) ? c : "");

  let notesFilter = "";

  function render() {
    const rec = F.editingRecord("notes");
    const hasSketch = !!(rec && !SK.isEmpty(rec.sketch));
    F.page({
      title: "Rough Notes", coll: "notes", submit: "notes.save",
      fields: [
        H.field("date", "Date", { type: "date", value: today(), required: true }),
        H.field("subject", "Subject (optional)", { wide: true }),
        H.cell("Colour", '<input type="hidden" name="color" value="yellow"><div class="nc-pick" id="ncPick">' +
          COLORS.map(([c, label]) => `<button type="button" class="nc-sw nc-${c || "plain"}" data-act="notes.color" data-color="${c}" title="${label}" aria-label="${label}"></button>`).join("") + "</div>", true),
        H.cell("Note", RT.editor(rec ? rec.html : ""), true),
        H.cell("Sketch", `<div id="skSlot">${hasSketch ? SK.html() : ""}</div>` +
          `<div class="actions" style="margin:0">${H.button(OPF.icon("plus") + " Add sketch", "notes.addSketch", null, "light" + (hasSketch ? " hide" : ""))}` +
          `${H.button("Remove sketch", "notes.removeSketch", null, "light bad" + (hasSketch ? "" : " hide"))}</div>`, true)
      ]
    });
    RT.wire();
    paintColor(F.get(H.$("mainForm"), "color"));
    SK.mount(hasSketch ? rec.sketch : null); // always: forgets the previous note's sketch

    const q = lc(notesFilter);
    const list = byDateDesc(OPF.store.db.notes).filter((n) => !q || lc((n.subject || "") + " " + (n.text || "")).indexOf(q) >= 0);
    H.append(
      `<div class="box"><div class="inline no-print"><div class="field" style="flex:1"><label>Search notes</label><input type="search" placeholder="Type a word and press Enter" value="${esc(notesFilter)}" data-change="notes.search"></div></div></div>` +
      (list.length ? `<div class="note-cards">${list.map(card).join("")}</div>` : `<div class="box muted">${q ? "No note matches the search." : "No notes yet."}</div>`)
    );
    SK.paintAll((id) => { const n = OPF.store.byId("notes", id); return n && n.sketch; });
  }

  function card(n) {
    const sketch = SK.isEmpty(n.sketch) ? "" : `<canvas class="note-sketch" data-sketch="${esc(n.id)}"></canvas>`;
    return `<div class="note-card nc-${colorOf(n.color) || "plain"}"><div class="note-head"><b>${esc(n.subject || "Note")}</b><small>${esc(n.date)}</small></div>` +
      `<div class="note-body">${RT.clean(n.html)}</div>${sketch}` +
      `<div class="note-act no-print">${H.button("Edit", "record.edit", { coll: "notes", id: n.id }, "sm light")}${H.button("Delete", "record.delete", { coll: "notes", id: n.id }, "sm bad")}</div></div>`;
  }

  // Mark the chosen swatch and tint the editor, so the colour shows while writing.
  function paintColor(c) {
    c = colorOf(c);
    F.set(H.$("mainForm"), "color", c);
    Array.prototype.forEach.call(document.querySelectorAll("#ncPick .nc-sw"), (b) => b.classList.toggle("on", b.dataset.color == c));
    const rt = document.querySelector("#mainForm .rt");
    if (rt) rt.className = "rt nc-" + (c || "plain");
  }

  function toggleSketch(show) {
    const slot = H.$("skSlot");
    slot.innerHTML = show ? SK.html() : "";
    SK.mount(null);
    document.querySelector('[data-act="notes.addSketch"]').classList.toggle("hide", show);
    document.querySelector('[data-act="notes.removeSketch"]').classList.toggle("hide", !show);
  }

  function save(form) {
    const html = RT.clean(H.$("rtBox").innerHTML), text = RT.text(html), sketch = SK.value();
    if (!text && !sketch) { alert("Write the note or draw a sketch first."); return; }
    const d = Object.assign(F.data(form), { html, text, sketch });
    d.color = colorOf(d.color);
    if (JSON.stringify(d).length > MAX_NOTE) { alert("This note is too large to save. Shorten the text or clear part of the sketch."); return; }
    R.save("notes", d, "Note", d.subject || text.slice(0, 40) || "Sketch");
    render();
  }

  OPF.pages.notes = { render };
  OPF.actions.register({
    "notes.save": save,
    "notes.search": (el) => { notesFilter = el.value; render(); },
    "notes.color": (el) => paintColor(el.dataset.color),
    "notes.addSketch": () => toggleSketch(true),
    "notes.removeSketch": () => { if (!SK.value() || confirm("Remove the sketch from this note?")) toggleSketch(false); }
  });
})(window.OPF = window.OPF || {});
