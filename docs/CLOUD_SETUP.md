# Turning on Google sign-in and Google Drive backup

One-time setup, about 10 minutes. You create a free "Google sign-in key" (an OAuth **Client ID**),
paste it into one line of the ERP, and push. After that, the shop only clicks **Sign in with Google**.

Until this is done the ERP works exactly as before: no login screen, data only on the computer.

**You need:**
- a Google account to own the setup. It can be yours as the developer; the shop's data still goes
  into **the shop's own** Google Drive, whichever account signs in at the shop.
- the hosted address of the ERP: `https://enamulhaque028.github.io/oneplus_fashion_erp/`

## 1. Create a Google Cloud project

1. Open https://console.cloud.google.com/ and sign in.
2. Click the project picker at the top → **New project**. Name: `One Plus Fashion ERP` → **Create**,
   then make sure it is the selected project.

## 2. Switch on the Google Drive API

1. Open https://console.cloud.google.com/apis/library/drive.googleapis.com
2. Click **Enable**.

## 3. Describe the app (consent screen)

1. Open **Google Auth Platform** (https://console.cloud.google.com/auth/overview) → **Get started**.
2. App name: `One Plus Fashion ERP`. User support email: your email.
3. Audience: **External**.
4. Contact email: your email. Agree to the policy → **Create**.

## 4. Allow access to Drive files the ERP creates

1. Google Auth Platform → **Data Access** → **Add or remove scopes**.
2. Find and tick **`.../auth/drive.file`**. It's described as "See, edit, create and delete only the
   specific Google Drive files you use with this app". → **Update** → **Save**.

This scope lets the ERP see only the files it created; nothing else in the Drive. Google treats it
as "non-sensitive", so the app does not need a Google review.

## 5. Let any Google account sign in

1. Google Auth Platform → **Branding**. Fill in (no logo: a logo needs Google's review):
   - App home page: `https://enamulhaque028.github.io/oneplus_fashion_erp/`
   - Privacy policy: `https://enamulhaque028.github.io/oneplus_fashion_erp/privacy.html`
   - Terms of service: `https://enamulhaque028.github.io/oneplus_fashion_erp/terms.html`
   - Authorized domains: `enamulhaque028.github.io`
   → **Save**. (Both pages are in the repository: `privacy.html`, `terms.html`.)
2. Google Auth Platform → **Audience** → **Publish app** → **Confirm**. The status becomes
   "In production".

If you'd rather not publish, leave it in "Testing" and add the shop's Gmail address under **Test users**
instead. Only listed addresses can then sign in, and Google shows an extra "unverified app" screen.

## 6. Create the Client ID

1. Google Auth Platform → **Clients** → **Create client**.
2. Application type: **Web application**. Name: `ERP web`.
3. **Authorized JavaScript origins** → **Add URI**:
   ```
   https://enamulhaque028.github.io
   ```
   Use just the address, without `/oneplus_fashion_erp/` and without a slash at the end.
4. Leave "Authorized redirect URIs" empty → **Create**.
5. Copy the **Client ID**. It looks like `1234567890-abc123def456.apps.googleusercontent.com`.
   You do **not** need the client secret.

## 7. Put the Client ID into the ERP

1. Open `js/core/config.js` and find the `CLOUD` section:
   ```js
   CLOUD: {
     GOOGLE_CLIENT_ID: "",
   ```
2. Paste the Client ID between the quotes:
   ```js
     GOOGLE_CLIENT_ID: "1234567890-abc123def456.apps.googleusercontent.com",
   ```
3. Commit and push. GitHub Pages updates the site in about a minute.

The Client ID is not a secret: it is safe in the public repository. It only works from the address
in step 6.

## 8. First sign-in at the shop

1. Open `https://enamulhaque028.github.io/oneplus_fashion_erp/`. The teal sign-in screen appears.
2. Click **Sign in with Google**, choose **the shop's** Google account, and allow access.
3. The ERP saves its data to the shop's Drive, in the folder **One Plus Fashion ERP**, then opens.

On every other computer: open the same link and sign in with the same account, and all the data comes back.

**Moving data from the old double-click version:** the web link keeps its data separately from the
file version. Either sign in for the first time on the laptop that has the data, opened from the
web link after restoring it there, or simpler:
1. In the file version, use **Settings / Backup → Download Restore File (.json)**.
2. In the web version, use **Restore from .json**.
3. Sign in. The data uploads.

## Switching Google sign-in off and on (feature flag)

In `js/core/config.js`, in the `CLOUD` section:

```js
      ENABLE_GOOGLE_LOGIN: true,   // false = Google sign-in and Drive backup switched off
```

Change it, then commit and push. GitHub Pages updates the site in about a minute; staff reload the page.

- **`false`:** no sign-in screen and no sync badge. Google's script is not even loaded. The ERP opens
  straight away and saves on the computer only. Settings / Backup says "Switched off".
- **Nothing is lost:** computers that were signed in stay signed in, and the ERP keeps a note of
  every change made while it was off.
- **Back to `true`:** those changes upload at the next click. If another computer also changed the data
  meanwhile, the usual "Which data should be kept?" question appears.

Only the exact value `true` switches it on.

## If something goes wrong

| Message | Fix |
|---|---|
| `Error 400: origin_mismatch` | The address in step 6 is wrong. It must be exactly `https://enamulhaque028.github.io`. |
| `Access blocked: app has not completed verification` / `access_denied` | Do step 5 (publish), or add the account as a test user. |
| "Google sign-in window could not open" | Allow pop-ups for the site. Click the icon at the right end of the address bar. |
| Sign-in screen never appears | The Client ID is empty or the page was opened as a file. Use the web link. |
| "This browser or app may not be secure" | Google refuses very old browsers. Use the newest Chrome available, which is Chrome 109 on Windows 7. |
| The badge says **Click to sync** | Normal about once an hour: Google access expires. The next click anywhere renews it. |
