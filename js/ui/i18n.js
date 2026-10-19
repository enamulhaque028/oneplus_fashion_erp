/* Screen language: English (default) or Bengali.

   The pages are written in English. In Bengali mode this module translates what is on screen as it
   appears (a MutationObserver), using the word list in js/ui/lang-bn.js, and shows digits as
   Bengali digits. So no page needs translation calls, and new English text simply shows in English
   until it is added to the list.
   - Translated: text, placeholder / title / aria-label, the page title, alert / confirm messages.
   - Not translated: what the user typed (inputs, notes), the printed cash memo / receipt (they
     follow the shop's English memo book), Excel exports and stored data - only the screen changes.
   The choice is kept in the UI preferences (localStorage "opf_erp_ui".lang); switching reloads. */
(function (OPF) {
  "use strict";

  const DIGITS = "০১২৩৪৫৬৭৮৯";
  const ATTRS = ["placeholder", "title", "aria-label", "data-placeholder", "data-label"];
  // Users' own content and the printed documents stay as they are.
  const SKIP = "script, style, textarea, input, [contenteditable], [data-no-i18n], #printFrame, #printDoc, .n-text, .nd-text, .nd-title";

  const packs = {};
  let lang = "en", pack = null;

  function readLang() {
    if (OPF.config.ENABLE_BENGALI !== true) return "en"; // feature flag off: always English
    try { return JSON.parse(localStorage.getItem("opf_erp_ui") || "{}").lang == "bn" ? "bn" : "en"; } catch (e) { return "en"; }
  }

  // Amounts, dates and counts get Bengali digits; codes that mix letters and digits (INV-00012,
  // MR-00031, tracking numbers, sizes like 4-5Y) stay as printed on the memo and typed in forms.
  const toDigits = (s) => s.replace(/[A-Za-z0-9-]*[0-9][A-Za-z0-9-]*/g, (tok) => (/[A-Za-z]/.test(tok) ? tok : tok.replace(/[0-9]/g, (d) => DIGITS[d])));

  // One piece of text: exact match first, then the patterns (texts with numbers in them).
  function word(core) {
    if (!pack || !core) return null;
    if (Object.prototype.hasOwnProperty.call(pack.words, core)) return pack.words[core];
    for (let i = 0; i < pack.patterns.length; i++) {
      const p = pack.patterns[i];
      if (p[0].test(core)) return core.replace(p[0], p[1]);
    }
    return null;
  }

  // Translate a string, keeping its surrounding spaces; digits become Bengali digits.
  // Results are remembered: a page shows the same labels, names and amounts many times.
  const cache = new Map();
  function tr(s) {
    if (lang == "en" || s == null) return s;
    s = String(s);
    let out = cache.get(s);
    if (out !== undefined) return out;
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
    const core = m[2];
    // Text without letters (amounts, dates, counts) only needs its digits changed.
    const w = /[A-Za-z]/.test(core) ? word(core.replace(/\s+/g, " ")) : null;
    out = m[1] + toDigits(w == null ? core : w) + m[3];
    if (cache.size > 20000) cache.clear();
    cache.set(s, out);
    return out;
  }

  // Messages may have several lines (e.g. a list of short stock).
  const trMessage = (s) => String(s).split("\n").map(tr).join("\n");

  function skip(el) { return !!(el && el.closest && el.closest(SKIP)); }

  function textNode(n) {
    const v = n.nodeValue;
    if (!/\S/.test(v) || skip(n.parentElement)) return;
    const t = tr(v);
    if (t !== v) n.nodeValue = t;
  }

  // Attributes (placeholder hints, tooltips) are translated on typing boxes too - only what is
  // typed in them, and the users' own content, is left alone.
  const NO_ATTRS = "[data-no-i18n], #printFrame, #printDoc, .n-text, .nd-text";
  function element(el) {
    if (el.closest(NO_ATTRS) || (el.parentElement && el.parentElement.closest("[contenteditable]"))) return;
    ATTRS.forEach((a) => {
      const v = el.getAttribute(a);
      if (v) { const t = tr(v); if (t !== v) el.setAttribute(a, t); }
    });
  }

  function tree(root) {
    if (!root) return;
    if (root.nodeType == 3) { textNode(root); return; }
    if (root.nodeType != 1) return;
    element(root);
    Array.prototype.forEach.call(root.querySelectorAll("[placeholder], [title], [aria-label], [data-placeholder], [data-label]"), element);
    if (skip(root)) return;
    // Walk the text, leaving out whole areas that are not translated (checked once per element,
    // not once per piece of text: a register can hold tens of thousands of cells).
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.nodeType == 1 ? (n.matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP) : NodeFilter.FILTER_ACCEPT)
    }, false);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const v = n.nodeValue;
      if (!/\S/.test(v)) continue;
      const t = tr(v);
      if (t !== v) n.nodeValue = t;
    }
  }

  function start() {
    lang = readLang();
    pack = packs[lang] || null;
    document.documentElement.setAttribute("lang", lang);
    if (lang == "en" || !pack) return;
    tree(document.body);
    document.title = tr(document.title);
    // Everything drawn later (pages, dialogs, live totals, the clock) is translated as it appears.
    const observer = new MutationObserver((list) => {
      list.forEach((m) => {
        if (m.type == "characterData") textNode(m.target);
        else if (m.type == "attributes") element(m.target);
        else Array.prototype.forEach.call(m.addedNodes, tree);
      });
      observer.takeRecords(); // our own changes above: already translated, skip them
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    new MutationObserver(() => { const t = tr(document.title); if (t !== document.title) document.title = t; })
      .observe(document.querySelector("title"), { childList: true, characterData: true, subtree: true });
    // Pop-up messages written in English in the code.
    const alert0 = window.alert, confirm0 = window.confirm;
    window.alert = (msg) => alert0.call(window, trMessage(msg));
    window.confirm = (msg) => confirm0.call(window, trMessage(msg));
  }

  // A language pack: words { English: translation } and patterns [[RegExp, replacement], ...].
  function add(code, words, patterns) { packs[code] = { words, patterns: patterns || [] }; }

  // Translate one text in a language without switching the page (the self-test uses this).
  function preview(code, s) {
    const keep = [lang, pack];
    lang = code; pack = packs[code] || null; cache.clear();
    try { return tr(s); } finally { lang = keep[0]; pack = keep[1]; cache.clear(); }
  }

  OPF.i18n = { start, add, tr, preview, get lang() { return lang; } };
})(window.OPF = window.OPF || {});
