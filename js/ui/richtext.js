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

  // Toolbar icons (24 x 24 line drawings, like OPF.icon).
  const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const ICON = {
    bold: svg('<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7z"/><path d="M7 12h7a3.5 3.5 0 0 1 0 7H7z"/>'),
    italic: svg('<path d="M10 5h8M6 19h8M14.5 5l-5 14"/>'),
    underline: svg('<path d="M7 4v7a5 5 0 0 0 10 0V4"/><path d="M5 20h14"/>'),
    heading: svg('<path d="M5 5v14M15 5v14M5 12h10"/><path d="M18.5 12.5l2-1.5v8"/>'),
    bullets: svg('<circle cx="5" cy="7" r="1.3"/><circle cx="5" cy="12" r="1.3"/><circle cx="5" cy="17" r="1.3"/><path d="M10 7h10M10 12h10M10 17h10"/>'),
    numbers: svg('<path d="M4 5.5l1.5-1v5M4 9.5h3M4 14.5a1.5 1.5 0 1 1 2.6 1L4 19h3"/><path d="M11 7h9M11 12h9M11 17h9"/>'),
    marker: svg('<path d="M14.5 4.5l5 5-8 8H6.5v-5z"/><path d="M4 21h16"/>'),
    clear: svg('<path d="M6 5h12M12 5l-3 14"/><path d="M15 14l5 5M20 14l-5 5"/>')
  };

  // One toolbar button. Groups sit in pills; tooltips name the shortcut.
  const btn = (cmd, icon, title, val, cls) => `<button type="button" class="rt-btn${cls ? " " + cls : ""}" data-act="rt.cmd" data-cmd="${cmd}"${val ? ` data-val="${esc(val)}"` : ""} title="${esc(title)}" aria-label="${esc(title)}">${icon}</button>`;
  const group = (html) => `<div class="rt-grp">${html}</div>`;

  // Toolbar + editable box. Buttons carry the editor command; notes.js wires the clicks.
  function editor(html) {
    const palette = Object.keys(COLORS).map((k) => `<button type="button" class="rt-swatch" style="background:${COLORS[k]}" data-act="rt.color" data-val="${COLORS[k]}" title="${k[0].toUpperCase() + k.slice(1)} text" aria-label="${k} text"></button>`).join("");
    return '<div class="rt"><div class="rt-bar" id="rtBar">' +
      group(btn("bold", ICON.bold, "Bold (Ctrl+B)") + btn("italic", ICON.italic, "Italic (Ctrl+I)") + btn("underline", ICON.underline, "Underline (Ctrl+U)")) +
      group(btn("formatBlock", ICON.heading, "Heading", "<h3>") + btn("insertUnorderedList", ICON.bullets, "Bullet list") + btn("insertOrderedList", ICON.numbers, "Numbered list")) +
      group(btn("hiliteColor", ICON.marker, "Highlight", HIGHLIGHT, "rt-mark") +
        `<span class="rt-pal-wrap"><button type="button" class="rt-btn rt-color" data-act="rt.palette" title="Text colour" aria-label="Text colour"><b>A</b><i id="rtColorBar" style="background:${COLORS.red}"></i></button>` +
        `<span class="rt-pal" id="rtPal" hidden>${palette}</span></span>`) +
      '<span class="grow"></span>' +
      group(btn("removeFormat", ICON.clear, "Clear formatting")) +
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
  // Text colour: the A button opens a small palette; picking a colour applies it and closes it.
  function togglePalette(force) {
    const pal = document.getElementById("rtPal");
    if (pal) pal.hidden = force == null ? !pal.hidden : !force;
  }
  function color(el) {
    const box = document.getElementById("rtBox");
    if (!box) return;
    box.focus();
    document.execCommand("foreColor", false, el.dataset.val);
    const bar = document.getElementById("rtColorBar");
    if (bar) bar.style.background = el.dataset.val;
    togglePalette(false);
  }
  document.addEventListener("mousedown", (e) => {
    if (!(e.target.closest && e.target.closest(".rt-pal-wrap"))) togglePalette(false);
  });

  OPF.actions.register({ "rt.cmd": command, "rt.palette": () => togglePalette(), "rt.color": color });
})(window.OPF = window.OPF || {});
