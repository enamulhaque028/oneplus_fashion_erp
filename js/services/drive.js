/* Google sign-in (token) and Google Drive REST calls for cloud sync.
   Everything Google-specific lives here; js/services/cloud.js holds the sync rules.

   - Google Identity Services "token model" runs entirely in the browser (no server). Its script is
     loaded only when cloud sync is configured (config CLOUD.GOOGLE_CLIENT_ID) and the ERP is opened
     from a web address - these are the only network calls the ERP makes.
   - Scope drive.file: the ERP can see and change only the files it created.
   - Access tokens last about an hour. Google opens its small window only right after a click, so
     getToken() must be called from a click; the token is kept for this browser tab (sessionStorage).
   Tests can set window.OPF_CLOUD_TEST = { GOOGLE_CLIENT_ID: "..." } to switch the feature on and
   replace window.google / window.fetch with fakes. */
(function (OPF) {
  "use strict";

  const API = "https://www.googleapis.com/drive/v3";
  const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
  const SCOPE = "https://www.googleapis.com/auth/drive.file";
  const TOKEN_KEY = "opf_erp_cloud_token";
  const FIELDS = "id,name,version,modifiedTime,appProperties";

  let client = null, pending = null, loading = null;
  let token = null, expiresAt = 0;

  const settings = () => Object.assign({}, OPF.config.CLOUD, window.OPF_CLOUD_TEST || {});
  const fail = (code, message, extra) => Object.assign(new Error(message || code), { code }, extra || {});

  // On only when a Client ID is set and the page is served from a web address (or under test).
  function enabled() {
    return !!settings().GOOGLE_CLIENT_ID && (/^https?:$/.test(location.protocol) || !!window.OPF_CLOUD_TEST);
  }

  /* ---- sign-in (access token) ---- */
  function loadGoogle() {
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    if (!loading) {
      loading = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://accounts.google.com/gsi/client";
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => { loading = null; reject(fail("offline", "Could not reach Google. Check the internet connection.")); };
        document.head.appendChild(s);
      });
    }
    return loading;
  }

  function restoreToken() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || "null");
      if (saved && saved.expiresAt > Date.now()) { token = saved.token; expiresAt = saved.expiresAt; }
    } catch (e) { /* no saved token */ }
  }

  // Valid for at least two more minutes.
  const hasToken = () => !!token && Date.now() < expiresAt - 120000;

  function forgetToken() {
    token = null;
    expiresAt = 0;
    try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ }
  }

  /* Ask Google for an access token. Call from a click (Google opens a small window).
     chooseAccount: true shows the account chooser (first sign-in); otherwise the window normally
     closes by itself for the account in `hint`. */
  function getToken(hint, chooseAccount) {
    return loadGoogle().then(() => new Promise((resolve, reject) => {
      if (!client) {
        client = google.accounts.oauth2.initTokenClient({
          client_id: settings().GOOGLE_CLIENT_ID,
          scope: SCOPE,
          callback: (r) => {
            const p = pending; pending = null;
            if (!p) return;
            if (r.error) { p.reject(fail("denied", r.error_description || r.error)); return; }
            token = r.access_token;
            expiresAt = Date.now() + (Number(r.expires_in) || 3600) * 1000;
            try { sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ token, expiresAt })); } catch (e) { /* tab-only convenience */ }
            p.resolve(token);
          },
          error_callback: (e) => {
            const p = pending; pending = null;
            if (p) p.reject(fail(e && e.type == "popup_closed" ? "closed" : "popup", e && e.type == "popup_closed" ? "Sign-in window was closed." : "Google sign-in window could not open. Allow pop-ups for this site."));
          }
        });
      }
      pending = { resolve, reject };
      const opts = { prompt: chooseAccount ? "select_account" : "" };
      if (hint) opts.login_hint = hint;
      client.requestAccessToken(opts);
    }));
  }

  /* ---- Drive REST ---- */
  function call(method, url, body, contentType) {
    if (!hasToken()) return Promise.reject(fail("auth", "Not connected to Google."));
    const headers = { Authorization: "Bearer " + token };
    if (contentType) headers["Content-Type"] = contentType;
    return fetch(url, { method, headers, body }).then((r) => {
      if (r.status == 401) { forgetToken(); throw fail("auth", "Google sign-in expired."); }
      if (r.status == 404) throw fail("missing", "File not found in Google Drive.", { status: 404 });
      if (!r.ok) return r.text().then((t) => { throw fail("http", `Google Drive error ${r.status}: ${t.slice(0, 160)}`, { status: r.status }); });
      if (r.status == 204) return null;
      return /json/.test(r.headers.get("content-type") || "") ? r.json() : r.text();
    }, () => { throw fail("offline", "No internet connection."); });
  }

  const query = (o) => Object.keys(o).map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(o[k])).join("&");

  // Files this app created, by kind: "data" | "backup" | "conflict" | "folder"; newest first.
  function find(kind) {
    return call("GET", API + "/files?" + query({
      q: `appProperties has { key='opfErp' and value='${kind}' } and trashed=false`,
      fields: `files(${FIELDS})`, orderBy: "modifiedTime desc", pageSize: 100, spaces: "drive"
    })).then((r) => (r && r.files) || []);
  }

  // Metadata + JSON content in one request (Drive multipart upload).
  function multipart(meta, text) {
    const b = "opf-erp-" + Date.now().toString(36);
    return {
      type: "multipart/related; boundary=" + b,
      body: `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${text}\r\n--${b}--`
    };
  }
  function create(meta, text) { const m = multipart(meta, text); return call("POST", `${UPLOAD}/files?uploadType=multipart&fields=${FIELDS}`, m.body, m.type); }
  function update(id, meta, text) { const m = multipart(meta, text); return call("PATCH", `${UPLOAD}/files/${id}?uploadType=multipart&fields=${FIELDS}`, m.body, m.type); }

  const drive = {
    enabled, settings, restoreToken, hasToken, forgetToken, getToken, preload: loadGoogle, find, create, update,
    createFolder: (name) => call("POST", `${API}/files?fields=${FIELDS}`, JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", appProperties: { opfErp: "folder" } }), "application/json"),
    meta: (id) => call("GET", `${API}/files/${id}?fields=${FIELDS}`),
    download: (id) => call("GET", `${API}/files/${id}?alt=media`).then((r) => (typeof r == "string" ? JSON.parse(r) : r)),
    copy: (id, meta) => call("POST", `${API}/files/${id}/copy?fields=${FIELDS}`, JSON.stringify(meta), "application/json"),
    remove: (id) => call("DELETE", `${API}/files/${id}`),
    whoAmI: () => call("GET", `${API}/about?fields=user(emailAddress,displayName)`).then((r) => r.user)
  };

  OPF.drive = drive;
})(window.OPF = window.OPF || {});
