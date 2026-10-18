/* Pure helpers: numbers, money, dates, strings. No DOM access and no data access. */
(function (OPF) {
  "use strict";

  const ENTITIES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

  const str = (v) => (v == null ? "" : String(v));
  const lc = (v) => str(v).trim().toLowerCase();
  const esc = (v) => str(v).replace(/[&<>"']/g, (m) => ENTITIES[m]);

  // Accepts "1,250.50" as well as numbers; anything unparsable is 0.
  const num = (v) => parseFloat(str(v).replace(/,/g, "")) || 0;

  // Round to paisa, avoiding binary float artefacts such as 1.005 -> 1.00.
  function r2(v) {
    const n = num(v);
    return Math.round((n + (n < 0 ? -Number.EPSILON : Number.EPSILON)) * 100) / 100;
  }

  const sum = (list, fn) => r2(list.reduce((t, x) => t + num(fn(x)), 0));
  const money = (v) => r2(v).toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtQty = (v) => r2(v).toLocaleString("en-BD", { maximumFractionDigits: 2 });
  const dueText = (v) => (v < 0 ? `${money(-v)} (Advance)` : money(v));
  const pad = (n, width) => String(n).padStart(width, "0");

  // Local calendar date (YYYY-MM-DD). toISOString() alone would give the UTC date,
  // which is yesterday in Bangladesh between 00:00 and 06:00.
  function today() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }
  const monthStart = () => today().slice(0, 8) + "01";

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // Case-insensitive composite key, e.g. skey(style, color, size).
  const skey = (...parts) => parts.map((v) => str(v).trim()).join("|").toLowerCase();

  // Distinct non-empty values (case-insensitive), sorted.
  function uniq(values) {
    const seen = {};
    const out = [];
    values.forEach((v) => {
      v = str(v).trim();
      if (v && !seen[lc(v)]) {
        seen[lc(v)] = true;
        out.push(v);
      }
    });
    return out.sort();
  }

  // Newest first; records on the same date keep creation order (newest first).
  const byDateDesc = (list) =>
    list.slice().sort((a, b) => {
      if (a.date != b.date) return a.date < b.date ? 1 : -1;
      return str(a.created) < str(b.created) ? 1 : -1;
    });

  function download(blob, fileName) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  // Bangladeshi style: crore / lakh / thousand. 60250.5 -> "Sixty Thousand Two Hundred Fifty Taka and Fifty Paisa Only"
  function amountWords(n) {
    const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    const two = (x) => (x < 20 ? ones[x] : tens[Math.floor(x / 10)] + (x % 10 ? " " + ones[x % 10] : ""));
    const three = (x) => (x >= 100 ? ones[Math.floor(x / 100)] + " Hundred" + (x % 100 ? " " : "") : "") + (x % 100 ? two(x % 100) : "");
    function words(x) {
      const parts = [];
      const crore = Math.floor(x / 10000000); x %= 10000000;
      const lakh = Math.floor(x / 100000); x %= 100000;
      const thousand = Math.floor(x / 1000); x %= 1000;
      if (crore) parts.push(words(crore) + " Crore");
      if (lakh) parts.push(two(lakh) + " Lakh");
      if (thousand) parts.push(two(thousand) + " Thousand");
      if (x) parts.push(three(x));
      return parts.join(" ");
    }
    n = Math.abs(r2(n));
    const taka = Math.floor(n);
    const paisa = Math.round((n - taka) * 100);
    return (words(taka) || "Zero") + " Taka" + (paisa ? " and " + two(paisa) + " Paisa" : "") + " Only";
  }

  OPF.util = { str, lc, esc, num, r2, sum, money, fmtQty, dueText, pad, today, monthStart, uid, skey, uniq, byDateDesc, download, amountWords };
})(window.OPF = window.OPF || {});
