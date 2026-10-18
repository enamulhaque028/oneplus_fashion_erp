/* Form helpers and the standard "form + register" page layout used by most modules. */
(function (OPF) {
  "use strict";

  const { num } = OPF.util;
  const H = OPF.html;

  const forms = {
    data: (form) => Object.fromEntries(new FormData(form)),

    // Convert the listed keys of a form-data object to numbers (in place).
    numify(d, keys) { keys.forEach((k) => { d[k] = num(d[k]); }); return d; },

    // Always use form.elements: names like "style" or "method" clash with form properties.
    el: (form, name) => form.elements.namedItem(name),
    set(form, name, value) { const e = forms.el(form, name); if (e) e.value = value; },
    get(form, name) { const e = forms.el(form, name); return e ? e.value : ""; },

    fill(form, rec) {
      Array.prototype.forEach.call(form.elements, (el) => {
        if (el.name && rec[el.name] != null && el.type != "file" && el.type != "checkbox") el.value = rec[el.name];
      });
    },

    isEditing(coll) {
      const e = OPF.router.editing;
      return !!(e && e.coll == coll && OPF.store.byId(coll, e.id));
    },
    editingId: (coll) => (forms.isEditing(coll) ? OPF.router.editing.id : null),
    editingRecord: (coll) => (forms.isEditing(coll) ? OPF.store.byId(coll, OPF.router.editing.id) : null),

    banner: () => '<div class="alert">Editing an existing record (admin). Click <b>Update</b> to save changes or <b>Cancel Edit</b>.</div>',

    // Save / Update, plus Cancel Edit or Clear. `extra` is added between them.
    buttons(editing, extra) {
      return `<div class="actions"><button>${editing ? "Update" : "Save"}</button>${extra || ""}` +
        (editing ? H.button("Cancel Edit", "edit.cancel", null, "light") : H.button("Clear", "nav.reload", null, "light")) + "</div>";
    },

    /* Render the page heading and a data-entry form, pre-filled when editing.
       spec: { title, coll, submit (action), calc (action, optional), fields: [html], after: html } */
    page(spec) {
      const editing = forms.isEditing(spec.coll);
      H.mount(
        `<h1>${editing ? "Edit - " : ""}${spec.title}</h1>` +
        `<form id="mainForm" class="box${editing ? " editing" : ""}" data-submit="${spec.submit}"${spec.calc ? ` data-calc="${spec.calc}"` : ""}>` +
        (editing ? forms.banner() : "") +
        `<div class="grid">${spec.fields.join("")}</div>${spec.after || ""}${forms.buttons(editing)}${OPF.lists.datalists()}</form>`
      );
      const form = H.$("mainForm");
      if (editing) forms.fill(form, OPF.store.byId(spec.coll, OPF.router.editing.id));
      if (spec.calc) OPF.actions.run(spec.calc, form);
      return form;
    },

    calcBox: () => '<div class="calc" id="calc"></div>',
    showCalc: (html) => { H.$("calc").innerHTML = html; }
  };

  OPF.forms = forms;
})(window.OPF = window.OPF || {});
