/* Create / edit / delete for any collection, with admin authorization and activity logging. */
(function (OPF) {
  "use strict";

  const H = OPF.html;

  // Which page holds the form for each collection.
  const PAGE_OF = {
    suppliers: "suppliers", purchases: "purchase", issues: "issue", productionOrders: "productionOrder",
    production: "production", factories: "factories", products: "products", transfers: "transfer",
    customers: "customers", sales: "sales", returns: "returns", payments: "payments", expenses: "expenses", courier: "courier"
  };

  // Records that other records point to cannot be deleted: [collection, field, own field (default id)].
  // Returns and courier parcels point at a sale by its invoice number.
  const REFERENCED_BY = {
    sales: [["returns", "invoice", "invoice"], ["courier", "invoice", "invoice"]],
    customers: [["sales", "customer"], ["returns", "customer"], ["courier", "customer"], ["payments", "party"]],
    suppliers: [["purchases", "supplier"], ["payments", "party"]],
    factories: [["productionOrders", "factory"], ["production", "factory"], ["transfers", "from"], ["payments", "party"]],
    productionOrders: [["production", "order"], ["issues", "order"]]
  };

  const label = (r) => r.invoice || r.no || r.name || r.slip || r.reference || r.tracking || r.style || r.category || r.id;

  // True when another record points at `rec` (see REFERENCED_BY); text keys compare case-insensitively.
  function isReferenced(coll, rec) {
    const lc = OPF.util.lc;
    return (REFERENCED_BY[coll] || []).some(([other, field, own]) => {
      const key = rec[own || "id"];
      return key != null && key !== "" && OPF.store.db[other].some((x) => lc(x[field]) == lc(key));
    });
  }

  // Insert, or update the record currently being edited in this collection.
  function save(coll, data, what, ref) {
    const S = OPF.store, editId = OPF.forms.editingId(coll);
    const rec = S.upsert(coll, data, editId);
    OPF.router.editing = null;
    S.log(`${what} ${editId ? "Edited" : "Created"}`, ref);
    return rec;
  }

  function edit(coll, id) {
    OPF.auth.require(() => {
      OPF.router.editing = { coll, id };
      OPF.router.go(PAGE_OF[coll], true);
    });
  }

  function remove(coll, id) {
    OPF.auth.require(() => {
      const S = OPF.store, rec = S.byId(coll, id);
      if (!rec) return;
      const linked = isReferenced(coll, rec);
      if (linked) {
        alert("This record is linked to other transactions and cannot be deleted. Edit it instead, or delete the linked transactions first.");
        return;
      }
      if (!confirm("Delete this record permanently?\n\n" + label(rec))) return;
      S.remove(coll, id);
      S.log(`Deleted (${coll})`, label(rec));
      OPF.router.refresh();
    });
  }

  // Table cell with optional extra buttons followed by Edit / Delete.
  const rowActions = (coll, id, extra) =>
    `<td class="act no-print">${extra || ""}${H.button("Edit", "record.edit", { coll, id }, "sm light")}${H.button("Delete", "record.delete", { coll, id }, "sm bad")}</td>`;

  OPF.records = { save, edit, remove, rowActions, isReferenced };
  OPF.actions.register({
    "record.edit": (el) => edit(el.dataset.coll, el.dataset.id),
    "record.delete": (el) => remove(el.dataset.coll, el.dataset.id)
  });
})(window.OPF = window.OPF || {});
