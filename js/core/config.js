/* Static configuration shared by every module. Loaded first after boot-check.js. */
(function (OPF) {
  "use strict";

  OPF.config = Object.freeze({
    // Unchanged since v3 so data saved by older versions keeps loading.
    STORAGE_KEY: "opf_erp_smart_v3",
    SCHEMA_VERSION: 5,
    MAIN_SHOP: "Owner Permanent Shop",
    ADMIN_MINUTES: 15,
    LOG_LIMIT: 3000,
    LOGO_WARN_KB: 300,

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
      ["costing", "Costing & Stock Summary"],
      ["reports", "Reports"],
      ["ledger", "Ledgers / Due"],
      ["users", "Users / Activity"],
      ["settings", "Settings / Backup"]
    ]
  });
})(window.OPF = window.OPF || {});
