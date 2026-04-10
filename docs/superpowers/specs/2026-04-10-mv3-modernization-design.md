# Image UnHider — MV3 Modernization Design

**Date:** 2026-04-10  
**Status:** Approved

## Overview

Modernize the Image UnHider Chrome extension from Manifest V1 to Manifest V3, clean up the JavaScript to modern standards, and replace the one-shot "run on click" trigger model with a persistent per-site toggle that auto-converts image links whenever the extension is enabled for the current domain.

---

## 1. File Structure

**Deleted:**
- `background.html` — replaced by `service-worker.js`
- `variables.js` — merged into `content.js`

**Added:**
- `service-worker.js` — MV3 background service worker
- `content.js` — unified, modernized content script
- `build.sh` — zips distributable files for Chrome Web Store upload

**Kept:**
- `manifest.json` — fully rewritten for MV3
- `i_16.png`, `i_48.png`, `i_128.png`, `mag.png` — unchanged
- `test.html` — updated with https and new format examples
- `screen.png` — unchanged (store listing asset)

---

## 2. Manifest (`manifest.json`)

Key changes from V1:

| Field | Old | New |
|---|---|---|
| `manifest_version` | (absent, defaulted to 1) | `3` |
| `background` | `"background_page": "background.html"` | `"background": { "service_worker": "service-worker.js" }` |
| `page_action` | `{ "default_title": "...", "default_icon": "..." }` | `"action": { "default_title": "...", "default_icon": "..." }` |
| `permissions` | `["tabs", "http://*/*"]` | `["storage", "scripting", "activeTab"]` |
| `host_permissions` | (absent) | `["http://*/*", "https://*/*"]` |
| Content script matches | `["http://*/*"]` | `["http://*/*", "https://*/*"]` |

---

## 3. Service Worker (`service-worker.js`)

Responsibilities:
- **Toggle on icon click** (`chrome.action.onClicked`): reads the active tab's hostname from `chrome.storage.sync`, toggles its enabled state (add if absent, remove if present), and saves back to storage. The content script reacts via its own `chrome.storage.onChanged` listener — no explicit messaging needed.
- **Badge indicator**: shows `"ON"` badge text when the current domain is enabled, blank when not. Updated on `chrome.tabs.onActivated`, `chrome.tabs.onUpdated`, and after each storage write.

Implementation notes:
- ~40 lines, no keep-alive hacks required — purely event-driven
- Default state: all domains off (storage starts empty)

---

## 4. Content Script (`content.js`)

Replaces both `variables.js` and `convert_links.js`. Runs on every `http://` and `https://` page.

**On load:**
1. Check `chrome.storage.sync` for the current hostname.
2. If enabled, run `convertLinks()` immediately.

**Storage listener** (`chrome.storage.onChanged`):
- If current hostname flips to enabled → run `convertLinks()`
- If current hostname flips to disabled → run `revertLinks()`

**`convertLinks()`:**
- `Array.from(document.querySelectorAll('a'))` filtered by `isImageLink(href)`
- Skip links already marked `data-image-unhider="true"`
- Inject `<img src="..." style="display:block;max-width:100%">` as a child of the `<a>`
- Mark the link with `data-image-unhider="true"`

**`revertLinks()`:**
- Find all `a[data-image-unhider="true"]`
- Remove injected `<img>` child
- Remove `data-image-unhider` attribute

**`isImageLink(href)`:**
- Supported extensions: `bmp, jpg, jpeg, tif, tiff, png, gif, webp, avif, svg`
- Imgur special case: if hostname contains `imgur`, treat as image link regardless of extension; resolve URL by appending `.jpg` only if no recognized extension is present
- URL parsing via `new URL(href)` — no manual string slicing

**Code style:**
- `const`/`let` throughout, no `var`
- Arrow functions
- `Array.from()` for NodeList iteration
- `new URL()` for URL parsing

---

## 5. Build Script (`build.sh`)

Produces `image-unhider.zip` containing all distributable files. Excludes:
- `.git/`
- `_metadata/`
- `test.html`
- `screen.png`
- `build.sh`
- `docs/`

Usage: `bash build.sh` from the repo root.

---

## 6. Testing

Manual testing via `test.html`, served locally (e.g. `npx serve .`) or loaded via a real page:
- Load extension unpacked in `chrome://extensions`
- Verify badge shows `ON`/blank correctly when toggling
- Verify image links are converted on enable, reverted on disable
- Verify https image links are converted
- Verify new formats (webp, avif, svg) are detected
- Verify double-conversion guard (clicking enable twice doesn't duplicate images)
- Verify Imgur links work correctly
