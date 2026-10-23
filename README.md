# Cookie Consent Guard

A minimal Firefox WebExtension starter project.

The content script automatically looks for common cookie-consent dialogs and
clicks an explicit “reject all” or “decline all” option when available.

## Load locally

1. Open `about:debugging` in Firefox.
2. Select **This Firefox**.
3. Choose **Load Temporary Add-on…**.
4. Select `manifest.json`.

## Structure

- `manifest.json` — Firefox extension configuration.
- `background.js` — background service worker.
- `popup.html`, `popup.css`, `popup.js` — toolbar popup UI.
- `content.js` — content script loaded on web pages.

