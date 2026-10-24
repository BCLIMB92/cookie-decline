# GuardMe

A Firefox WebExtension that reduces cookie consent, tracking, and intrusive page behavior.

The extension can reject optional consent, remove common tracking parameters, block known tracker scripts, and apply Firefox privacy settings. Page-level features include autoplay suppression, newsletter popup dismissal, and blocking location and camera/microphone permission APIs.

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
- `permission-guard.js` — page-world guard for location and camera/microphone requests.
- `options.html`, `options.js`, `options.css` — privacy controls, site rules, and activity log.

## Settings and privacy

Open the toolbar popup for the current page's tracker rule, a 30-minute temporary allow, tracker counts, and Reader View. Open **Privacy settings and activity** for global feature switches, per-domain allow/block rules, and local activity export. Tab-close data clearing is opt-in because it can sign you out; it clears cookies, local storage, IndexedDB, and service-worker data for the closed tab's hostname.

Activity logs are stored locally in extension storage (up to 2,000 entries) and show page/resource hostnames, request types, timestamps, and action reasons. They omit full URLs and query strings. The extension requests broad host access for request filtering and Firefox privacy controls. Do Not Track is a request header and does not guarantee that a site honors it. Firefox settings such as fingerprinting resistance and tracker-cookie rejection are global browser settings and can affect site compatibility.

Site rules apply to matching domains and their subdomains. Allowlisted page domains bypass automatic consent actions, tracker-script blocking, and URL cleanup. Blocklisted domains are blocked when requested as third-party resources. Reader View is available on demand; automatic Reader View can be enabled in settings.

