/* Application start-up. Loaded last, after every module has registered itself. */
(function (OPF) {
  "use strict";

  if (!window.OPF_BROWSER_OK) return;

  function showError(message, line) {
    const app = OPF.html.$("app");
    if (app) app.insertAdjacentHTML("afterbegin", `<div class="alert"><b>ERP error:</b> ${OPF.util.esc(message)}${line ? ` (line ${line})` : ""}</div>`);
  }

  function tick() {
    OPF.html.$("clock").textContent = new Date().toLocaleString();
    OPF.auth.refreshButton();
  }

  function start() {
    window.onerror = (message, src, line) => showError(message, line);
    OPF.store.load();
    OPF.store.save(); // persist any schema upgrade straight away
    OPF.actions.bind(document);
    OPF.shell.init();
    OPF.search.init();
    tick();
    setInterval(tick, 1000);
    OPF.router.start(); // opens the page in the address (#/...), else the dashboard
  }

  document.addEventListener("DOMContentLoaded", start);
})(window.OPF = window.OPF || {});
