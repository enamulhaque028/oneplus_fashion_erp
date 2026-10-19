/* Settings: shop branding for print-outs, admin password, backup / restore. */
(function (OPF) {
  "use strict";

  const C = OPF.config, H = OPF.html, F = OPF.forms;
  const BRANDING = ["name", "motto", "tagline", "address", "phone", "email", "hotline", "memoNote", "quoteSource"];
  let pendingLogo = null; // null = unchanged, "" = remove, data URL = new logo

  const logoPreview = (src) => (src ? `<img src="${src}" style="max-height:80px;border:1px solid #dbe2ea;border-radius:4px;padding:4px;background:#fff">` : '<span class="muted">No shop logo uploaded.</span>');

  function render() {
    const co = OPF.store.db.company, hasPassword = !!OPF.store.db.auth.hash;
    pendingLogo = null;
    H.mount(
      "<h1>Settings / Backup</h1>" +
      '<form class="box" id="coForm" data-submit="settings.save"><h2 style="margin-top:0">Shop Branding (printed on the cash memo &amp; receipts)</h2><div class="grid">' +
      H.field("name", "Shop / Company Name", { value: co.name, required: true }) + H.field("motto", "Motto (dark bar under the name)", { value: co.motto }) +
      H.field("tagline", "Business Description", { value: co.tagline }) + H.field("address", "Address", { value: co.address }) +
      H.field("phone", "Phone Numbers", { value: co.phone }) + H.field("email", "E-mail", { value: co.email }) + H.field("hotline", "Hotline (top right)", { value: co.hotline }) +
      H.field("memoNote", "Footer Quote", { value: co.memoNote }) + H.field("quoteSource", "Quote Source", { value: co.quoteSource }) +
      H.cell(`Shop Logo (PNG / JPG, under ${C.LOGO_WARN_KB} KB)`, '<input type="file" accept="image/*" data-change="settings.pickLogo">') +
      `</div><div id="logoPrev" style="margin-top:10px">${logoPreview(co.logo)}</div>` +
      '<div class="actions"><button>Save Branding</button>' + H.button("Remove Logo", "settings.removeLogo", null, "light") + H.button("Preview Cash Memo", "print.preview", null, "light") + "</div></form>" +
      '<div class="box"><h2 style="margin-top:0">Admin Password</h2><p class="muted">' +
      (hasPassword ? "An admin password is set. It is required to edit or delete records, change settings and restore backups." : "No admin password yet. You will be asked to create one the first time you edit or delete a record.") +
      "</p>" + H.button(hasPassword ? "Change Admin Password" : "Create Admin Password", "auth.changePassword") + "</div>" +
      OPF.cloud.settingsHtml() +
      OPF.shell.installBox() +
      '<div class="box"><h2 style="margin-top:0">Data Safety</h2><div class="actions">' +
      H.button("Download Full Backup (Excel .xlsx)", "backup.excel", null, "good") + H.button("Download Restore File (.json)", "backup.json") +
      '<label class="btn light">Restore from .json<input type="file" accept=".json" style="display:none" data-change="backup.restore"></label>' +
      H.button("Clear All Data", "backup.clear", null, "bad") +
      '</div><p class="muted">The Excel backup contains every register, ledger and stock report on separate sheets for reading and accounting. To move data back into the ERP, use the .json restore file. Save both to a pen drive / external drive regularly. Data is stored locally in this browser.</p></div>'
    );
  }

  function pickLogo(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > C.LOGO_WARN_KB * 1024 && !confirm(`This image is ${Math.round(file.size / 1024)} KB. Large logos use a lot of browser storage. Continue?`)) return;
    const reader = new FileReader();
    reader.onload = () => { pendingLogo = reader.result; H.$("logoPrev").innerHTML = logoPreview(pendingLogo); };
    reader.readAsDataURL(file);
  }

  function save(form) {
    OPF.auth.require(() => {
      const d = F.data(form), co = OPF.store.db.company;
      BRANDING.forEach((k) => { co[k] = d[k] || ""; });
      if (pendingLogo != null) co.logo = pendingLogo;
      OPF.store.log("Company Settings Saved");
      alert("Shop branding saved.");
      render();
    });
  }

  OPF.pages.settings = { render };
  OPF.actions.register({
    "settings.save": save,
    "settings.pickLogo": pickLogo,
    "settings.removeLogo": () => { pendingLogo = ""; H.$("logoPrev").innerHTML = logoPreview(""); }
  });
})(window.OPF = window.OPF || {});
