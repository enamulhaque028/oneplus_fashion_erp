# Google sign-in + Google Drive sync — design

Date: 2026-10-18. Decided with the project owner in conversation; items marked *(builder's call)* were
proposed by the builder and accepted without change.

## Why

The shop's data lives only in one browser on one old laptop. If the laptop dies, the data is gone.
Goal: the data is never lost, and signing in with the same Google account on another computer brings
everything back. **Not** a goal: two people working at the same time (one computer at a time).

## Decisions (owner)

- The ERP is opened from a web link (GitHub Pages: `https://enamulhaque028.github.io/oneplus_fashion_erp/`),
  because Google sign-in does not work for pages opened from a file.
- **Sign in once per computer** (required for sync). After that the ERP opens immediately, works
  offline, and syncs when the internet is back.
- Data is saved in **the shop's own Google Drive**.
- Setup must be easy: the developer creates the Google sign-in key once with a step-by-step guide;
  the shop only clicks "Sign in with Google".
- Login screen: **Option A** from the mockups — moving teal/blue gradient blobs, frosted-glass card,
  dark One Plus logo tile, white "One Plus Fashion ERP" title, "Sign in with Google" button, three
  chips (Auto backup / Any computer / Works offline). Restoring and "all set" screens use the same card.
- Keep existing data: the first sign-in on a computer that already has data uploads it.

## Behaviour

- **Off unless configured:** with no Google Client ID in `js/core/config.js` (`CLOUD.GOOGLE_CLIENT_ID`),
  or when opened from a file, nothing changes: no login screen, no badge, no network.
- **First sign-in on a computer:**
  - Drive has no data file → upload this computer's data;
  - Drive has data and this computer has none → download it;
  - both have data → show both (record counts, last change) and ask which to keep. The other copy is
    saved in Drive as a "Conflict copy" file, never deleted *(builder's call)*.
- **After every save:** upload a few seconds later (debounced). Header badge: Synced ✓ / Saving… /
  Changes waiting / Offline – will sync later / Click to sync / Not signed in *(builder's call)*.
- **Changes from another computer:** checked when the ERP opens, when its tab becomes visible again
  and before every upload. If this computer has no unsynced changes, the newer Drive copy replaces it
  (with a short notice); if both changed, the same conflict question as above.
- **Drive layout** *(builder's call)*: folder "One Plus Fashion ERP" holding "OnePlusFashion ERP Data.json"
  (a normal ERP restore file) plus one dated safety copy per day ("OnePlusFashion ERP Backup YYYY-MM-DD.json"),
  keeping the last 30.
- **Permissions:** scope `drive.file` only — the ERP sees only the files it created.
- **Settings** *(builder's call)*: signed-in account, last sync, Sync now, Sign out (keeps local data;
  the login screen shows again on next start).
- Unchanged: admin password (it syncs with the data), calculations, Excel / JSON backups.

## Technical constraints and approach

- No server: Google Identity Services **token model** in the browser (script from
  `accounts.google.com/gsi/client`, loaded only when the feature is configured) + Drive REST v3 via
  `fetch`. These are the only network calls in the ERP.
- Access tokens last 1 hour and Google can only open its window from a click. So: the token is kept
  for the browser tab (sessionStorage); when it is missing or about to expire and a sync is needed,
  the next click anywhere in the ERP renews it (`prompt: ""`, `login_hint` = the account), which
  normally closes by itself. Until then the badge shows "Click to sync".
- Offline-first: data is always saved to localStorage first; sync state (account, Drive file id,
  last synced Drive version, unsynced-change counter, device id, last daily backup) lives under its
  own localStorage key `opf_erp_cloud`, never inside the ERP data.
- Change detection uses the Drive file `version`; a revision counter guards against saves made
  during an upload.
- Old-browser rules still apply (ES2019, no `?.`); works in Chrome 109 / Firefox 115.

## Testing

Automated tests replace Google's sign-in and Drive with fakes at the network boundary (fake
`google.accounts.oauth2`, fake `fetch` routed to an in-test Drive), so the real sync code runs:
first sign-in upload, second computer restore, live sync after saves, changes from another computer,
conflicts, daily backups, expired token, offline, sign-out. The real Google flow is verified by the
owner after creating the Client ID (`docs/CLOUD_SETUP.md`).
