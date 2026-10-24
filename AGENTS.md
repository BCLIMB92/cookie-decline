# Repository Guidelines

## Project Structure & Module Organization

This repository is a dependency-free Firefox WebExtension, with all runtime files at the repository root:

- `manifest.json` - Manifest V3 metadata, permissions, popup, and content-script registration.
- `content.js` - detects cookie-consent dialogs and attempts explicit reject/decline actions on pages.
- `permission-guard.js` - page-world guard for location and camera/microphone requests; requires Firefox 128+.
- `background.js` - extension background service-worker logic.
- `popup.html`, `popup.css`, `popup.js` - toolbar popup markup, styling, and behavior.
- `options.html`, `options.css`, `options.js` - global privacy controls, per-domain rules, and local activity log.
- `README.md` - user-facing setup and project overview.
- `cookie-guard.zip` is a generated package and is ignored by Git; do not treat it as source.

## Build, Test, and Development Commands

There is no build step, package manager, or automated test command. Load the extension directly in Firefox:

1. Open `about:debugging`.
2. Select **This Firefox** and **Load Temporary Add-on...**.
3. Choose the repository's `manifest.json`.

After editing files, reload the temporary extension and refresh test pages. Use the browser console and extension debugging tools to inspect errors and content-script behavior.

## Coding Style & Naming Conventions

Use four-space indentation, semicolons, and double-quoted JavaScript strings, matching the existing files. Prefer `const` for values that do not change and descriptive lower camelCase names (for example, `actionButton`). Keep popup, background, and content-script responsibilities separated. Use lowercase filenames with extensions that match their role (`content.js`, `popup.css`).

## Testing Guidelines

Testing is currently manual. Check representative cookie banners, including banners with explicit "Reject all" or "Decline all" controls, pages without consent dialogs, and dialogs inside frames. Confirm that the popup loads, its action updates status text, and no unrelated page controls are activated. Re-test after changes to `manifest.json`, permissions, selectors, or frame handling.

## Commit & Pull Request Guidelines

Use short, imperative commit subjects, consistent with the existing history (for example, `Use Manifest V3 action property`). Keep each commit focused. Pull requests should explain the behavior change, list manual Firefox checks performed, identify affected files, and include screenshots or a short recording for popup/UI changes. Call out any new permissions or manifest changes explicitly.

## Security & Configuration Tips

Keep permissions minimal and preserve the manifest's `data_collection_permissions` declaration. Do not add credentials, tracking, or broad network access. Avoid committing generated archives or browser artifacts; update `.gitignore` when introducing new generated output.
