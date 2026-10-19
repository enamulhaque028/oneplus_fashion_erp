/* Admin authorization for edits, deletes, settings and restore.
   The password is stored as a salted SHA-256 hash. This deters casual changes; it is not
   strong security, because the data itself lives in the browser. */
(function (OPF) {
  "use strict";

  const C = OPF.config;
  let unlockedUntil = 0;

  const hash = (pw) => OPF.sha256(OPF.store.db.auth.salt + "|" + pw);
  const isAdmin = () => Date.now() < unlockedUntil;
  const val = (id) => OPF.html.$(id).value;

  function unlock() {
    unlockedUntil = Date.now() + C.ADMIN_MINUTES * 60000;
    refreshButton();
  }

  function lock() {
    unlockedUntil = 0;
    refreshButton();
  }

  function refreshButton() {
    const b = OPF.html.$("lockBtn");
    if (!b) return;
    const on = isAdmin();
    // Header user chip: avatar, "Admin", and the lock state (click to lock / log in).
    const state = on ? "Unlocked" : "Locked";
    if (b.getAttribute("data-state") != state) {
      b.innerHTML = `<span class="av">A</span><span class="tx"><b>Admin</b><small>${OPF.icon("lock")}<span>${state}</span></small></span>`;
      b.setAttribute("data-state", state);
      b.title = on ? "Admin unlocked - click to lock" : "Admin locked - click to log in";
    }
    b.className = "user " + (on ? "on" : "off");
    // Phones: the same button in the menu (js/ui/shell.js phoneTools).
    const side = OPF.html.$("lockBtnSide");
    if (side) { side.innerHTML = OPF.icon("lock") + (on ? "Lock admin" : "Admin login"); side.className = on ? "warn" : "light"; }
  }

  function passwordDialog(title, note, then, cancel) {
    OPF.modal.open({
      html: `<h2>${title}</h2><p class="muted">${note}</p><input id="pw1" type="password" placeholder="New password"><input id="pw2" type="password" placeholder="Confirm new password"><div id="modalMsg" class="red"></div>`,
      validate() {
        const a = val("pw1"), b = val("pw2");
        if (a.length < 4) return OPF.modal.message("Password must be at least 4 characters.");
        if (a != b) return OPF.modal.message("Passwords do not match.");
        const auth = OPF.store.db.auth;
        auth.salt = OPF.util.uid();
        auth.hash = hash(a);
        OPF.store.log("Admin Password Set");
        unlock();
      },
      then,
      cancel
    });
  }

  // Run `action` once the user is authorized; creates the password on first use.
  function require(action, onCancel) {
    if (isAdmin()) { unlock(); action(); return; }
    if (!OPF.store.db.auth.hash) {
      passwordDialog("Create Admin Password", "No admin password exists yet. Create one now. It will be required to edit or delete records, change settings and restore backups.", action, onCancel);
      return;
    }
    OPF.modal.open({
      html: `<h2>Admin Authorization</h2><p class="muted">Enter the admin password to continue. Admin stays unlocked for ${C.ADMIN_MINUTES} minutes.</p><input id="pw1" type="password" placeholder="Admin password"><div id="modalMsg" class="red"></div>`,
      validate() {
        if (hash(val("pw1")) != OPF.store.db.auth.hash) return OPF.modal.message("Wrong password.");
        unlock();
      },
      then: action,
      cancel: onCancel
    });
  }

  function changePassword() {
    require(() => passwordDialog("Change Admin Password", "Enter the new admin password.", () => { alert("Admin password saved."); OPF.router.refresh(); }));
  }

  OPF.auth = { require, isAdmin, lock, refreshButton, changePassword };
  OPF.actions.register({
    "auth.toggle": () => (isAdmin() ? lock() : require(() => {})),
    "auth.changePassword": changePassword
  });
})(window.OPF = window.OPF || {});
