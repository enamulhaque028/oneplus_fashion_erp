/* A single modal dialog (used for the admin password).
   validate() returns false to keep the dialog open; then() runs after it closes. */
(function (OPF) {
  "use strict";

  let current = null;

  function open({ html, validate, then, cancel }) {
    current = { validate, then, cancel };
    OPF.html.$("modal").innerHTML =
      `<div class="overlay"><form class="dialog" data-submit="modal.ok"><div class="dlg-ic">${OPF.icon("lock")}</div>${html}` +
      `<div class="actions"><button>OK</button><button type="button" class="light" data-act="modal.cancel">Cancel</button></div></form></div>`;
    const input = document.querySelector("#modal input");
    if (input) input.focus();
  }

  function close(cancelled) {
    const c = current;
    current = null;
    OPF.html.$("modal").innerHTML = "";
    if (cancelled && c && c.cancel) c.cancel();
  }

  function ok() {
    if (!current) return;
    if (current.validate && current.validate() === false) return;
    const then = current.then;
    close(false);
    if (then) then();
  }

  // Show a validation message inside the dialog; returns false so validate() can `return message(...)`.
  function message(text) {
    const el = OPF.html.$("modalMsg");
    if (el) el.textContent = text;
    return false;
  }

  OPF.modal = { open, close, message };
  OPF.actions.register({ "modal.ok": ok, "modal.cancel": () => close(true) });
})(window.OPF = window.OPF || {});
