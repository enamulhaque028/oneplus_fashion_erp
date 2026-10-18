/* Global customer search in the top bar (name or mobile number). */
(function (OPF) {
  "use strict";

  const { lc, esc, dueText } = OPF.util;
  const H = OPF.html;

  // Mobile digits in local form: "+880 1711-000000" and "01711000000" both become "01711000000".
  const mobileDigits = (v) => String(v || "").replace(/\D/g, "").replace(/^880/, "0");

  function results(query) {
    const q = lc(query), digits = mobileDigits(query);
    if (!q) return null;
    const bm = OPF.ledger.balances("Customer");
    return OPF.store.db.customers
      .filter((c) => lc(c.name).includes(q) || (digits.length >= 3 && mobileDigits(c.mobile).includes(digits)))
      .slice(0, 15)
      .map((c) => ({ c, due: bm[c.id].bal }));
  }

  function render(query) {
    const box = H.$("gresults"), list = results(query);
    if (!list) { box.style.display = "none"; return; }
    box.innerHTML = list.length
      ? list.map(({ c, due }) => `<a href="#" data-id="${c.id}"><b>${esc(c.name)}</b> <span class="muted">${esc(c.mobile)} | Due ${dueText(due)}</span></a>`).join("")
      : '<div class="muted" style="padding:10px">No customer found</div>';
    box.style.display = "block";
  }

  function open(id) {
    H.$("gresults").style.display = "none";
    H.$("gsearch").value = "";
    OPF.views.customer(id);
  }

  function init() {
    const input = H.$("gsearch"), box = H.$("gresults");
    input.addEventListener("input", () => render(input.value));
    input.addEventListener("keydown", (e) => {
      if (e.key == "Enter") { const first = box.querySelector("a"); if (first) open(first.dataset.id); }
      if (e.key == "Escape") { input.value = ""; render(""); }
    });
    input.addEventListener("blur", () => setTimeout(() => { box.style.display = "none"; }, 200));
    // mousedown fires before the input's blur hides the list.
    box.addEventListener("mousedown", (e) => {
      const a = e.target.closest("a[data-id]");
      if (a) { e.preventDefault(); open(a.dataset.id); }
    });
  }

  OPF.search = { init, results };
})(window.OPF = window.OPF || {});
