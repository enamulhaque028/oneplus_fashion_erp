/* Static configuration shared by every module. Loaded first after boot-check.js. */
(function (OPF) {
  "use strict";

  OPF.config = Object.freeze({
    // Unchanged since v3 so data saved by older versions keeps loading.
    STORAGE_KEY: "opf_erp_smart_v3",
    SCHEMA_VERSION: 6,
    MAIN_SHOP: "Owner Permanent Shop",
    ADMIN_MINUTES: 15,
    LOG_LIMIT: 3000,
    LOGO_WARN_KB: 300,

    // Feature flag: true = the EN | বাং switch (header and phone menu) and the Bengali screen
    // language are available; false = hidden, the ERP always shows English. A computer's saved
    // choice is kept, so it comes back when this is set to true again. See js/ui/i18n.js.
    ENABLE_BENGALI: true,

    // Google sign-in + Google Drive sync (see docs/CLOUD_SETUP.md). Leave GOOGLE_CLIENT_ID empty to
    // keep the ERP fully offline: no login screen, no network. Only works on the hosted (https) link.
    CLOUD: {
      // Feature flag: true = Google sign-in and Drive backup on the hosted link; false = switched off
      // (no sign-in screen, no sync badge, data stays on the computer). Nothing is deleted either
      // way: a computer that was signed in carries on syncing when this is set back to true.
      ENABLE_GOOGLE_LOGIN: false,
      GOOGLE_CLIENT_ID: "221238920928-f7u2jtl9eve5aj4pgogbl9f5clee26qi.apps.googleusercontent.com",
      FOLDER: "One Plus Fashion ERP",
      DATA_FILE: "OnePlusFashion ERP Data.json",
      KEEP_DAILY_BACKUPS: 30,
      UPLOAD_DELAY_MS: 4000
    },

    UNITS: ["Yard", "Meter", "Kg", "Pcs"],
    METHODS: ["Cash", "Bank", "bKash", "Nagad", "Rocket", "Cheque"],
    PO_STATUS: ["Open", "In Progress", "Completed", "Cancelled"],
    COURIER_STATUS: ["Pending", "Sent", "In Transit", "Delivered", "Returned", "Cancelled"],
    COURIER_OPEN: ["Pending", "Sent", "In Transit"],
    COURIERS: ["Pathao", "Steadfast", "RedX", "Sundarban Courier", "SA Paribahan", "eCourier", "Paperfly"],
    EXPENSE_CATEGORIES: ["Salary", "Rent", "Electricity", "Transport", "Food", "Maintenance", "Other"],

    PARTY_TYPES: ["Customer", "Supplier", "Factory"],
    PARTY_COLL: { Customer: "customers", Supplier: "suppliers", Factory: "factories" },

    // Printed on the cash memo and receipts; editable in Settings. Defaults follow the shop's printed memo book.
    DEFAULT_COMPANY: {
      name: "One Plus Fashion",
      motto: "QUALITY OUR VISION",
      tagline: "Manufacturer and Wholesaler of Readymade Garments.",
      address: "Shop # 99 (1st Floor), Ashraf Setu Shopping Complex, Tongi, Gazipur.",
      phone: "01619-741055, 01621-346375",
      email: "oneplusfashion2021@gmail.com",
      hotline: "01878638475",
      memoNote: "Allah has Made Business Lawful, Usury is Forbidden.",
      quoteSource: "-Al Qur'an",
      logo: ""
    },
    // Defaults shipped by v3/v4; replaced by the memo-book values only while still untouched.
    OLD_COMPANY_DEFAULTS: {
      phone: "01814109285",
      address: "",
      tagline: "Wholesale Garment Manufacturing & Distribution",
      memoNote: "Thank you for your business."
    },

    // Sidebar order: [page id, label]. Page ids match files in js/pages/.
    MENU: [
      ["dashboard", "Dashboard"],
      ["suppliers", "Suppliers"],
      ["purchase", "Fabric / Raw Purchase"],
      ["materials", "Raw Material Stock"],
      ["productionOrder", "Production Order"],
      ["issue", "Material Issue"],
      ["production", "Production / Finished"],
      ["factories", "Factory / Worker"],
      ["products", "Style / Product"],
      ["transfer", "Factory → Shop"],
      ["showroom", "Showroom Stock"],
      ["customers", "Customers"],
      ["sales", "Sales / Invoice"],
      ["returns", "Sales Return"],
      ["payments", "Payment / Collection"],
      ["expenses", "Expenses"],
      ["courier", "Courier / Delivery"],
      ["notes", "Rough Notes"],
      ["costing", "Costing & Stock Summary"],
      ["reports", "Reports"],
      ["ledger", "Ledgers / Due"],
      ["users", "Users / Activity"],
      ["settings", "Settings / Backup"]
    ],

    // Sidebar grouping (presentation only; every MENU id appears exactly once).
    // [group label, icon, tone, [page ids]]; a group with one page shows as a single item.
    NAV_GROUPS: [
      ["Dashboard", "grid", "teal", ["dashboard"]],
      ["Purchase", "bag", "orange", ["suppliers", "purchase", "materials"]],
      ["Production", "factory", "violet", ["productionOrder", "issue", "production", "factories"]],
      ["Product & Stock", "box", "blue", ["products", "transfer", "showroom", "costing"]],
      ["Sales", "cart", "green", ["customers", "sales", "returns", "payments", "courier"]],
      ["Accounts", "bars", "rose", ["expenses", "ledger", "reports"]],
      ["Rough Notes", "note", "orange", ["notes"]],
      ["Admin", "shield", "slate", ["users", "settings"]]
    ],
    PAGE_ICONS: {
      dashboard: "grid", suppliers: "users", purchase: "bag", materials: "layers", productionOrder: "clipboard",
      issue: "send", production: "check", factories: "factory", products: "tag", transfer: "transfer",
      showroom: "store", customers: "user", sales: "receipt", returns: "undo", payments: "wallet",
      expenses: "coins", courier: "truck", notes: "note", costing: "calc", reports: "bars", ledger: "book", users: "activity", settings: "gear"
    }
  });
})(window.OPF = window.OPF || {});
