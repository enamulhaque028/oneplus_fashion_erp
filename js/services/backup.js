/* Backups and exports: Excel (.xlsx) for reading, JSON for restoring, CSV per sheet. */
(function (OPF) {
  "use strict";

  const { today, download } = OPF.util;

  function excel() {
    download(OPF.xlsx.build(OPF.sheets.all()), `OnePlusFashion_ERP_Backup_${today()}.xlsx`);
    OPF.store.log("Excel Backup Downloaded");
  }

  function json() {
    download(new Blob([JSON.stringify(OPF.store.db, null, 2)], { type: "application/json" }), `OnePlusFashion_ERP_Restore_${today()}.json`);
  }

  function csv(sheetName) {
    const sheet = OPF.sheets.byName(sheetName);
    if (!sheet || !sheet.rows.length) { alert("No data available"); return; }
    const quote = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
    const lines = [sheet.head].concat(sheet.rows).map((r) => r.map(quote).join(","));
    // BOM so Excel opens UTF-8 (Bangla text) correctly.
    download(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv" }), `OnePlusFashion_${sheetName.replace(/\s+/g, "_")}_${today()}.csv`);
  }

  function restore(input) {
    const file = input.files[0];
    input.value = "";
    if (!file) return;
    OPF.auth.require(() => {
      const reader = new FileReader();
      reader.onload = () => {
        let data;
        try {
          data = JSON.parse(reader.result);
          if (!data || !Array.isArray(data.sales) || !Array.isArray(data.customers)) throw new Error("not a backup");
        } catch (e) {
          alert("Invalid backup file. Choose a .json file created by Download Restore File.");
          return;
        }
        if (!confirm("Replace ALL current data with this backup?")) return;
        OPF.store.replace(OPF.migrate.normalize(data));
        OPF.store.log("Backup Restored", file.name);
        alert("Backup restored.");
        OPF.router.go("dashboard");
      };
      reader.readAsText(file);
    });
  }

  // Keeps the admin password and shop branding.
  function clearAll() {
    OPF.auth.require(() => {
      if (!confirm("Delete ALL ERP data? Make a backup first.") || !confirm("Are you sure? This cannot be undone.")) return;
      const old = OPF.store.db, db = OPF.migrate.fresh();
      db.auth = old.auth;
      db.company = old.company;
      OPF.store.replace(db);
      OPF.store.log("All Data Cleared");
      OPF.router.go("dashboard");
    });
  }

  OPF.backup = { excel, json, csv, restore, clearAll };
  OPF.actions.register({
    "backup.excel": excel,
    "backup.json": json,
    "backup.csv": (el) => csv(el.dataset.sheet),
    "backup.restore": restore,
    "backup.clear": clearAll
  });
})(window.OPF = window.OPF || {});
