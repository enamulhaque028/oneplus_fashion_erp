/* Application start-up. Loaded last, after every module has registered itself. */
(function (OPF) {
  "use strict";

  if (!window.OPF_BROWSER_OK) return;

  function showError(message, line) {
    const app = OPF.html.$("app");
    if (app) app.insertAdjacentHTML("afterbegin", `<div class="alert"><b>ERP error:</b> ${OPF.util.esc(message)}${line ? ` (line ${line})` : ""}</div>`);
  }

  let day = OPF.util.today();

  // Midnight while the ERP is open: date fields still showing the old day move to the new day
  // (so the first sale of the morning is not dated yesterday) and an open dashboard redraws.
  // Fields the user changed and records being edited are left alone.
  function rollover(oldDay, newDay) {
    Array.prototype.forEach.call(document.querySelectorAll('#app input[type="date"]'), (el) => {
      if (el.value == oldDay && !el.closest("form.editing")) el.value = newDay;
    });
    if (OPF.router.current == "dashboard" && !document.querySelector("#modal .overlay")) OPF.router.refresh();
  }

  function tick() {
    const now = new Date();
    OPF.html.$("clock").innerHTML = `<b>${now.toLocaleTimeString("en-US")}</b><small>${now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</small>`;
    OPF.auth.refreshButton();
    const d = OPF.util.today();
    if (d != day) { rollover(day, d); day = d; }
  }

  function start() {
    window.onerror = (message, src, line) => showError(message, line);
    OPF.store.load();
    OPF.store.save(); // persist any schema upgrade straight away
    OPF.actions.bind(document);
    OPF.i18n.start(); // Bengali mode: translates the screen from here on
    OPF.shell.init();
    OPF.search.init();
    tick();
    setInterval(tick, 1000);
    // Google Drive sync shows its sign-in screen first when needed, then the ERP opens the page in
    // the address (#/...), else the dashboard. Without sync configured it opens straight away.
    OPF.cloud.start(() => OPF.router.start());
  }

  OPF.app = { rollover };
  document.addEventListener("DOMContentLoaded", start);
})(window.OPF = window.OPF || {});
