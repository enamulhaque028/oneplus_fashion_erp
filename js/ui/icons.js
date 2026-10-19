/* Line icons as inline SVG (24 x 24, stroke = currentColor). Hand-drawn here because the ERP
   runs offline: no icon fonts or CDNs. Use OPF.icon(name); unknown names fall back to "grid". */
(function (OPF) {
  "use strict";

  const P = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M18 14.8c1.8.7 3 2.4 3.5 5.2"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.2-6 8-6s7 2 8 6"/>',
    bag: '<path d="M5 8h14l-1.2 12.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    layers: '<path d="M12 3 2.5 8 12 13l9.5-5z"/><path d="m2.5 12.5 9.5 5 9.5-5"/><path d="m2.5 17 9.5 5 9.5-5"/>',
    clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M9 10h6M9 14h6M9 18h4"/>',
    send: '<path d="M4 12h12"/><path d="m12 7 5 5-5 5"/><path d="M20 4v16"/>',
    factory: '<path d="M3 21V11l6 3.5V11l6 3.5V4h3v17z"/><path d="M2 21h20"/>',
    check: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m8 12 3 3 5-6"/>',
    tag: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    transfer: '<path d="M4 8h14"/><path d="m14 4 4 4-4 4"/><path d="M20 16H6"/><path d="m10 12-4 4 4 4"/>',
    store: '<path d="M4 4h16l1 5H3z"/><path d="M5 9v11h14V9"/><path d="M10 20v-6h4v6"/>',
    receipt: '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h4"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    wallet: '<rect x="3" y="6" width="18" height="14" rx="2.5"/><path d="M3 10h18"/><path d="M16 15h2"/><path d="M6 6l9-3 1 3"/>',
    coins: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
    truck: '<path d="M2 6h12v10H2z"/><path d="M14 9h4l3 3v4h-7"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    calc: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8"/><path d="M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h.01M16 19h.01"/>',
    bars: '<path d="M5 20V11M11 20V5M17 20v-6M3 20h18"/>',
    book: '<path d="M4 4h11a3 3 0 0 1 3 3v14H7a3 3 0 0 1-3-3z"/><path d="M4 18a3 3 0 0 1 3-3h11"/>',
    activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    shield: '<path d="M12 2 4 5v6c0 5 3.4 9 8 11 4.6-2 8-6 8-11V5z"/>',
    cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.6 12.4a1 1 0 0 0 1 .8h9.7a1 1 0 0 0 1-.8L21 7H6"/>',
    box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6"/><path d="M12 16.5h.01"/>',
    money: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/>',
    trend: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    pie: '<path d="M12 3a9 9 0 1 0 9 9h-9z"/><path d="M15 2.5A9 9 0 0 1 21.5 9H15z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 21h16"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    phone: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    printer: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
    cloud: '<path d="M7 18h10.5a4 4 0 0 0 .4-7.98A6 6 0 0 0 6.2 9.6 4.2 4.2 0 0 0 7 18z"/>',
    cloudoff: '<path d="M7 18h10.5a4 4 0 0 0 1.6-.33M20.9 13.6a4 4 0 0 0-3-3.58A6 6 0 0 0 9.4 5.4M6.2 9.6A4.2 4.2 0 0 0 7 18"/><path d="m3 3 18 18"/>',
    expand: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    pin: '<path d="M9 3h6l-1 6 4 4H6l4-4z"/><path d="M12 13v8"/>',
    note: '<path d="M5 3h10l4 4v14H5z"/><path d="M15 3v4h4"/><path d="M8.5 12h7M8.5 16h5"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>'
  };

  OPF.icon = (name) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${P[name] || P.grid}</svg>`;
})(window.OPF = window.OPF || {});
