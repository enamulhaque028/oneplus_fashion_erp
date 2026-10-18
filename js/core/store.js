/* The single in-memory database (OPF.store.db), its persistence in localStorage,
   the activity log and record lookups. Always read OPF.store.db at call time:
   restore / clear replace the whole object. */
(function (OPF) {
  "use strict";

  const C = OPF.config;
  const { lc, pad, uid, today } = OPF.util;

  const store = {
    db: null,

    load() {
      const raw = localStorage.getItem(C.STORAGE_KEY);
      let parsed = null;
      try {
        parsed = JSON.parse(raw || "null");
      } catch (e) {
        // Keep the unreadable copy instead of silently overwriting it with an empty database.
        localStorage.setItem(C.STORAGE_KEY + "_unreadable_" + today(), raw);
      }
      store.db = OPF.migrate.normalize(parsed);
    },

    save() {
      try {
        localStorage.setItem(C.STORAGE_KEY, JSON.stringify(store.db));
        return true;
      } catch (e) {
        alert("Could not save: browser storage is full. Download a backup now, and remove a large shop logo from Settings.");
        return false;
      }
    },

    replace(db) {
      store.db = db;
      store.save();
    },

    log(action, ref) {
      store.db.logs.push({ date: new Date().toISOString(), action, ref: ref || "" });
      if (store.db.logs.length > C.LOG_LIMIT) store.db.logs = store.db.logs.slice(-C.LOG_LIMIT);
      store.save();
    },

    // Insert a new record (id + created stamp) or merge changes into an existing one.
    upsert(coll, data, existingId) {
      const list = store.db[coll];
      const i = existingId ? list.findIndex((x) => x.id == existingId) : -1;
      if (i >= 0) {
        list[i] = Object.assign({}, list[i], data, { id: existingId });
        return list[i];
      }
      const rec = Object.assign({}, data, { id: uid(), created: new Date().toISOString() });
      list.push(rec);
      return rec;
    },

    remove(coll, id) {
      store.db[coll] = store.db[coll].filter((x) => x.id != id);
    },

    byId: (coll, id) => store.db[coll].find((x) => x.id == id),

    // Next sequential number such as INV-00012 for the given prefix.
    nextNo(coll, field, prefix, width) {
      let max = 0;
      store.db[coll].forEach((r) => {
        const v = String(r[field] || "");
        const m = v.match(/(\d+)\s*$/);
        if (m && v.startsWith(prefix)) max = Math.max(max, +m[1]);
      });
      return prefix + pad(max + 1, width);
    },

    partyName(type, id) {
      const p = store.byId(C.PARTY_COLL[type] || "customers", id);
      return p ? p.name : id || "";
    },
    factoryName: (id) => store.partyName("Factory", id),
    productByStyle: (style) => store.db.products.find((p) => lc(p.style) == lc(style)),
    saleByInvoice: (no) => store.db.sales.find((s) => no && lc(s.invoice) == lc(no)),

    addShowroom(name) {
      if (name && !store.db.showrooms.some((s) => lc(s.name) == lc(name))) {
        store.db.showrooms.push({ id: uid(), name: String(name).trim() });
      }
    }
  };

  OPF.store = store;
})(window.OPF = window.OPF || {});
