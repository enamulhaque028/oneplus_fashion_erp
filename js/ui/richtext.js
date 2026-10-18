/* Rich text for Rough Notes: a small formatting toolbar over a contenteditable box, and a cleaner
   that keeps only safe formatting. Notes can come back from a backup file or Google Drive, so the
   HTML is cleaned when saved AND when shown: only the tags below survive, every attribute is
   dropped, and colours are kept only if they are in the palette. */
(function (OPF) {
  "use strict";

  const { esc } = OPF.util;

  const COLORS = { red: "#dc2626", blue: "#2563eb", green: "#16a34a", orange: "#ea580c", purple: "#7c3aed" };
  const HIGHLIGHT = "#fde68a";
  const PALETTE = Object.keys(COLORS).map((k) => COLORS[k]);

  const KEEP = { B: "b", STRONG: "b", I: "i", EM: "i", U: "u", H1: "h3", H2: "h3", H3: "h3", H4: "h3", UL: "ul", OL: "ol", LI: "li", DIV: "div", P: "div", MARK: "mark" };
  const DROP = /^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|TEMPLATE|SVG|MATH|NOSCRIPT|HEAD|TITLE|META|LINK|CANVAS|VIDEO|AUDIO|IMG|INPUT|TEXTAREA|SELECT|BUTTON)$/;
  const BLOCK = /^(div|h3|ul|ol|li)$/;

  // "rgb(220, 38, 38)" or "#DC2626" -> "#dc2626"
  function hex(c) {
    c = String(c || "").trim().toLowerCase();
    const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c);
    if (m) return "#" + [m[1], m[2], m[3]].map((n) => ("0" + Number(n).toString(16)).slice(-2)).join("");
    return /^#[0-9a-f]{6}$/.test(c) ? c : "";
  }

  // An inert document: nothing in it runs or loads (no scripts, no images, no event handlers).
  let inert = null;
  function parse(html) {
    if (!inert) inert = document.implementation.createHTMLDocument("");
    const box = inert.createElement("div");
    box.innerHTML = String(html || "");
    return box;
  }

  // Rebuild the content as a new HTML string from text nodes and allowed tags only.
  function clean(html) {
    let out = "";
    (function walk(node) {
      Array.prototype.forEach.call(node.childNodes, (n) => {
        if (n.nodeType == 3) { out += esc(n.nodeValue); return; }
        if (n.nodeType != 1 || DROP.test(n.tagName)) return;
        if (n.tagName == "BR") { out += "<br>"; return; }
        const open = [], st = n.style || {};
        const tag = KEEP[n.tagName];
        if (tag) open.push(tag);
        const w = st.fontWeight;
        if (tag != "b" && tag != "h3" && (w == "bold" || Number(w) >= 600)) open.push("b");
        if (tag != "i" && st.fontStyle == "italic") open.push("i");
        if (tag != "u" && /underline/.test(st.textDecoration || st.textDecorationLine || "")) open.push("u");
        const color = hex(n.getAttribute("color") || st.color);
        if (PALETTE.indexOf(color) >= 0) open.push(`span style="color:${color}"`);
        if (tag != "mark" && hex(st.backgroundColor) == HIGHLIGHT) open.push("mark");
        out += open.map((t) => "<" + t + ">").join("");
        walk(n);
        out += open.slice().reverse().map((t) => "</" + t.split(" ")[0] + ">").join("");
      });
    })(parse(html));
    // Drop empty trailing lines the editor leaves behind.
    return out.replace(/(<div><br><\/div>|<br>)+$/g, "").slice(0, 200000);
  }

  // Plain text (for search, the Excel sheet and the activity log): line breaks at <br> and blocks.
  function text(html) {
    let out = "";
    (function walk(node) {
      Array.prototype.forEach.call(node.childNodes, (n) => {
        if (n.nodeType == 3) { out += n.nodeValue; return; }
        if (n.nodeType != 1) return;
        if (n.tagName == "BR") { out += "\n"; return; }
        const block = BLOCK.test((KEEP[n.tagName] || "").toLowerCase()) || n.tagName == "LI";
        if (block && out && !/\n$/.test(out)) out += "\n";
        if (n.tagName == "LI") out += "• ";
        walk(n);
        if (block && !/\n$/.test(out)) out += "\n";
      });
    })(parse(clean(html)));
    return out.replace(/\n{3,}/g, "\n\n").trim();
  }

  // Plain text from older notes -> HTML with the same line breaks.
  const fromText = (t) => esc(String(t || "")).replace(/\r?\n/g, "<br>");

  const TOOLS = [
    ["bold", "<b>B</b>", "Bold (Ctrl+B)"], ["italic", "<i>I</i>", "Italic (Ctrl+I)"], ["underline", "<u>U</u>", "Underline (Ctrl+U)"],
    ["formatBlock", "H", "Heading", "<h3>"], ["insertUnorderedList", "&bull; List", "Bullet list"], ["insertOrderedList", "1. List", "Numbered list"],
    ["hiliteColor", '<span class="rt-hl">ab</span>', "Highlight", HIGHLIGHT]
  ];

  // Toolbar + editable box. Buttons carry the editor command; notes.js wires the clicks.
  function editor(html) {
    const btn = (cmd, label, title, val) => `<button type="button" class="rt-btn" data-act="rt.cmd" data-cmd="${cmd}"${val ? ` data-val="${esc(val)}"` : ""} title="${esc(title)}">${label}</button>`;
    return '<div class="rt"><div class="rt-bar" id="rtBar">' +
      TOOLS.map((t) => btn(t[0], t[1], t[2], t[3])).join("") + '<span class="rt-sep"></span>' +
      Object.keys(COLORS).map((k) => `<button type="button" class="rt-dot" style="background:${COLORS[k]}" data-act="rt.cmd" data-cmd="foreColor" data-val="${COLORS[k]}" title="${k} text"></button>`).join("") +
      btn("removeFormat", "&#10005; Clear", "Clear formatting") +
      `</div><div class="rt-box" id="rtBox" contenteditable="true" data-placeholder="Write anything: an idea, a reminder, a rough calculation...">${clean(html)}</div></div>`;
  }

  // Light up the buttons for the formatting where the cursor is (so staff can see Bold is on).
  const STATE = ["bold", "italic", "underline", "insertUnorderedList", "insertOrderedList"];
  function showState() {
    const bar = document.getElementById("rtBar"), box = document.getElementById("rtBox");
    if (!bar || !box || !box.contains(document.getSelection().anchorNode)) return;
    Array.prototype.forEach.call(bar.querySelectorAll(".rt-btn"), (b) => {
      const cmd = b.dataset.cmd;
      let on = false;
      try {
        on = STATE.indexOf(cmd) >= 0 ? document.queryCommandState(cmd) : cmd == "formatBlock" && /h3/i.test(document.queryCommandValue("formatBlock"));
      } catch (e) { /* not supported here */ }
      b.classList.toggle("on", !!on);
    });
  }
  let listening = false;

  // Keep the text selection when a toolbar button is pressed, and paste as plain text only.
  function wire() {
    if (!listening) { document.addEventListener("selectionchange", showState); listening = true; }
    const bar = document.getElementById("rtBar"), box = document.getElementById("rtBox");
    if (!bar || !box) return;
    bar.addEventListener("mousedown", (e) => e.preventDefault());
    box.addEventListener("paste", (e) => {
      const t = e.clipboardData && e.clipboardData.getData("text/plain");
      if (t == null) return;
      e.preventDefault();
      document.execCommand("insertText", false, t);
    });
  }

  function command(el) {
    const box = document.getElementById("rtBox");
    if (!box) return;
    box.focus();
    const cmd = el.dataset.cmd;
    // Clicking Heading again turns the line back into normal text.
    const val = cmd == "formatBlock" && document.queryCommandValue("formatBlock").toLowerCase() == "h3" ? "<div>" : el.dataset.val;
    if (cmd == "hiliteColor" && !document.queryCommandSupported("hiliteColor")) document.execCommand("backColor", false, val);
    else document.execCommand(cmd, false, val || null);
    if (cmd == "removeFormat") document.execCommand("hiliteColor", false, "transparent");
    showState();
  }

  OPF.richtext = { clean, text, fromText, editor, wire, COLORS, HIGHLIGHT };
  OPF.actions.register({ "rt.cmd": command });
})(window.OPF = window.OPF || {});
