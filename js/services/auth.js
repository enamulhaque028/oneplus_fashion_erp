/* Admin authorization for edits, deletes, settings and restore.
   The password is stored as a salted SHA-256 hash. This deters casual changes; it is not
   strong security, because the data itself lives in the browser.
   Recovery code: a spare key shown once when the password is created (or from Settings), for the
   owner to write on paper. "Forgot password?" takes it and sets a new password; a used code is
   replaced by a new one. Only its salted hash is stored (auth.rsalt / rhash / rdate). */
(function (OPF) {
  "use strict";

  const C = OPF.config;
  let unlockedUntil = 0;

  const hash = (pw) => OPF.sha256(OPF.store.db.auth.salt + "|" + pw);
  const isAdmin = () => Date.now() < unlockedUntil;
  const val = (id) => OPF.html.$(id).value;

  // 12 characters from 32 that cannot be mistaken for each other (no 0/O, 1/I): about 60 bits,
  // far too many to guess. Typed in any case, with or without dashes and spaces.
  const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const cleanCode = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const codeHash = (salt, code) => OPF.sha256(salt + "|recovery|" + cleanCode(code));
  const hasCode = () => !!OPF.store.db.auth.rhash;

  function newCode() {
    const r = new Uint8Array(12);
    window.crypto.getRandomValues(r);
    let c = "";
    for (let i = 0; i < r.length; i++) c += CODE_CHARS[r[i] % 32];
    return c.replace(/(.{4})(?=.)/g, "$1-");
  }

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

  // Make a new recovery code (the old one stops working) and show it once.
  function issueCode(then) {
    const auth = OPF.store.db.auth, code = newCode();
    auth.rsalt = OPF.util.uid();
    auth.rhash = codeHash(auth.rsalt, code);
    auth.rdate = OPF.util.today();
    OPF.store.log("Recovery Code Created");
    OPF.modal.open({
      icon: "shield",
      ok: "I have written it down",
      noCancel: true,
      html: '<h2>Your recovery code</h2><p class="muted">Write this code on paper and keep it safe, away from this computer. If you forget the admin password, click "Forgot password?" and enter this code. It is shown only once.</p>' +
        `<div class="rcode" id="rcode" data-no-i18n>${code}</div>`,
      then
    });
  }

  // "Forgot password?" in the password window: the recovery code lets you set a new password.
  function forgot() {
    OPF.modal.close(true);
    if (!hasCode()) {
      OPF.modal.open({
        icon: "alert",
        noCancel: true,
        html: '<h2>No recovery code</h2><p class="muted">No recovery code was made on this computer, so the password cannot be reset here. Contact the developer.</p>'
      });
      return;
    }
    OPF.modal.open({
      icon: "shield",
      html: '<h2>Reset Admin Password</h2><p class="muted">Enter the recovery code you wrote down when the password was created.</p><input id="rc1" class="rcode-in" placeholder="XXXX-XXXX-XXXX" autocomplete="off" spellcheck="false" data-no-i18n><div id="modalMsg" class="red"></div>',
      validate() {
        const auth = OPF.store.db.auth;
        if (codeHash(auth.rsalt, val("rc1")) != auth.rhash) return OPF.modal.message("Wrong recovery code.");
      },
      then: () => passwordDialog("Set New Admin Password", "Recovery code accepted. Enter the new admin password.", () => {
        OPF.store.log("Admin Password Reset", "recovery code");
        // The code has been used: give a new one.
        issueCode(() => { alert("Admin password saved."); OPF.router.refresh(); });
      })
    });
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
      passwordDialog("Create Admin Password", "No admin password exists yet. Create one now. It will be required to edit or delete records, change settings and restore backups.", () => issueCode(action), onCancel);
      return;
    }
    OPF.modal.open({
      html: `<h2>Admin Authorization</h2><p class="muted">Enter the admin password to continue. Admin stays unlocked for ${C.ADMIN_MINUTES} minutes.</p><input id="pw1" type="password" placeholder="Admin password"><div id="modalMsg" class="red"></div>` +
        '<button type="button" class="forgot" data-act="auth.forgot">Forgot password?</button>',
      validate() {
        if (hash(val("pw1")) != OPF.store.db.auth.hash) return OPF.modal.message("Wrong password.");
        unlock();
      },
      then: action,
      cancel: onCancel
    });
  }

  function changePassword() {
    // No password yet: creating it (and its recovery code) is all there is to do.
    if (!OPF.store.db.auth.hash) { require(() => OPF.router.refresh()); return; }
    require(() => passwordDialog("Change Admin Password", "Enter the new admin password.", () => { alert("Admin password saved."); OPF.router.refresh(); }));
  }

  // Settings: a new code for a password made before recovery codes existed, or a lost paper.
  function makeCode() {
    require(() => {
      if (hasCode() && !confirm("Make a new recovery code? The old code will stop working.")) return;
      issueCode(() => OPF.router.refresh());
    });
  }

  OPF.auth = { require, isAdmin, lock, refreshButton, changePassword, hasCode };
  OPF.actions.register({
    "auth.toggle": () => (isAdmin() ? lock() : require(() => {})),
    "auth.forgot": forgot,
    "auth.newCode": makeCode,
    "auth.changePassword": changePassword
  });
})(window.OPF = window.OPF || {});
