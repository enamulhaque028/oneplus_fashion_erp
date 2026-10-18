/* Action registry + one set of delegated DOM listeners. Modules register handlers by name;
   markup refers to them with data-act / data-change / data-submit / data-calc (see ui/html.js).
   Handlers receive (element, event); parameters travel in the element's data-* attributes. */
(function (OPF) {
  "use strict";

  const registry = {};

  function run(name, el, ev) {
    const fn = registry[name];
    if (!fn) throw new Error("Unknown action: " + name);
    return fn(el, ev);
  }

  function runCalc(ev) {
    const form = ev.target.closest && ev.target.closest("form[data-calc]");
    if (form) run(form.dataset.calc, form, ev);
  }

  function bind(root) {
    root.addEventListener("click", (ev) => {
      const el = ev.target.closest("[data-act]");
      if (!el || el.disabled) return;
      if (el.tagName == "A") ev.preventDefault();
      run(el.dataset.act, el, ev);
    });
    root.addEventListener("change", (ev) => {
      const el = ev.target.closest("[data-change]");
      if (el) run(el.dataset.change, el, ev);
      runCalc(ev);
    });
    root.addEventListener("input", runCalc);
    root.addEventListener("submit", (ev) => {
      const form = ev.target.closest("form[data-submit]");
      if (!form) return;
      ev.preventDefault();
      run(form.dataset.submit, form, ev);
    });
  }

  OPF.actions = {
    register(map) { Object.assign(registry, map); },
    run,
    bind
  };
})(window.OPF = window.OPF || {});
