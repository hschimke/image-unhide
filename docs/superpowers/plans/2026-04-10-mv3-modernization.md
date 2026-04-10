# Image UnHider MV3 Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade Image UnHider from Manifest V1 to V3, modernize the JavaScript, and replace the one-shot click trigger with a persistent per-site auto-convert toggle.

**Architecture:** A service worker manages per-site enabled state in `chrome.storage.sync` and keeps the toolbar badge in sync. A content script runs on every page, checks storage on load, and listens for storage changes to convert or revert image links in real time.

**Tech Stack:** Vanilla JS (ES2020+), Chrome Extension Manifest V3, `chrome.storage.sync`, `chrome.scripting`, no build tooling (except `build.sh` for packaging).

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Rewrite | `manifest.json` | MV3 declaration, permissions, content script registration |
| Create | `service-worker.js` | Icon click toggle, badge indicator, storage writes |
| Create | `content.js` | Image link detection, DOM conversion, revert, storage listener |
| Delete | `background.html` | Replaced by service-worker.js |
| Delete | `variables.js` | Merged into content.js |
| Update | `test.html` | Add https + new format examples |
| Create | `build.sh` | Zip distributable for Chrome Web Store |

---

## Task 1: Rewrite `manifest.json` for MV3

**Files:**
- Modify: `manifest.json`

- [ ] **Step 1: Replace the entire contents of `manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "Image UnHider",
  "version": "2.0.0",
  "description": "Automatically convert image links into inline images. Toggle per-site from the toolbar.",
  "permissions": ["storage", "scripting", "activeTab", "tabs"],
  "host_permissions": ["http://*/*", "https://*/*"],
  "icons": {
    "16": "i_16.png",
    "48": "i_48.png",
    "128": "i_128.png"
  },
  "action": {
    "default_title": "Toggle Image UnHider",
    "default_icon": "mag.png"
  },
  "background": {
    "service_worker": "service-worker.js"
  },
  "content_scripts": [
    {
      "matches": ["http://*/*", "https://*/*"],
      "js": ["content.js"]
    }
  ]
}
```

- [ ] **Step 2: Verify the manifest loads in Chrome**

1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the repo directory
4. Confirm the extension loads without errors (no red error banner)
5. Confirm the extension shows in the toolbar (it will have no service worker yet — that's fine)

- [ ] **Step 3: Commit**

```bash
git add manifest.json
git commit -m "feat: upgrade manifest to V3"
```

---

## Task 2: Create `service-worker.js`

**Files:**
- Create: `service-worker.js`

- [ ] **Step 1: Create `service-worker.js`**

```javascript
async function getEnabledDomains() {
  const { enabledDomains = [] } = await chrome.storage.sync.get('enabledDomains');
  return enabledDomains;
}

async function setEnabledDomains(domains) {
  await chrome.storage.sync.set({ enabledDomains: domains });
}

async function updateBadge(tabId, hostname) {
  const domains = await getEnabledDomains();
  const enabled = domains.includes(hostname);
  await chrome.action.setBadgeText({ text: enabled ? 'ON' : '', tabId });
  await chrome.action.setBadgeBackgroundColor({ color: '#4CAF50', tabId });
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.url) return;
  const hostname = new URL(tab.url).hostname;
  const domains = await getEnabledDomains();
  const idx = domains.indexOf(hostname);
  if (idx === -1) {
    domains.push(hostname);
  } else {
    domains.splice(idx, 1);
  }
  await setEnabledDomains(domains);
  await updateBadge(tab.id, hostname);
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url) return;
    await updateBadge(tabId, new URL(tab.url).hostname);
  } catch {
    // non-navigable tabs (chrome://, etc.) — ignore
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;
  try {
    await updateBadge(tabId, new URL(tab.url).hostname);
  } catch {
    // non-http tabs — ignore
  }
});
```

- [ ] **Step 2: Reload the extension and verify the service worker**

1. Go to `chrome://extensions`, click the reload icon on Image UnHider
2. Click "Service worker" link — it should open DevTools showing the worker is active
3. Navigate to any http/https page
4. Click the toolbar icon — badge should show `ON`
5. Click again — badge should clear
6. Navigate to a different domain — badge should be blank (that domain is off)
7. Navigate back to the first domain — badge should show `ON` again

- [ ] **Step 3: Commit**

```bash
git add service-worker.js
git commit -m "feat: add MV3 service worker with per-site toggle and badge"
```

---

## Task 3: Create `content.js`

**Files:**
- Create: `content.js`

- [ ] **Step 1: Create `content.js`**

```javascript
const IMAGE_EXTENSIONS = new Set(['bmp', 'jpg', 'jpeg', 'tif', 'tiff', 'png', 'gif', 'webp', 'avif', 'svg']);
const ATTR = 'data-image-unhider';

function getExtension(href) {
  try {
    const pathname = new URL(href).pathname;
    const dot = pathname.lastIndexOf('.');
    return dot >= 0 ? pathname.substring(dot + 1).toLowerCase() : null;
  } catch {
    return null;
  }
}

function isImgur(href) {
  try {
    return new URL(href).hostname.includes('imgur');
  } catch {
    return false;
  }
}

function isImageLink(href) {
  if (!href) return false;
  if (IMAGE_EXTENSIONS.has(getExtension(href))) return true;
  if (isImgur(href)) return true;
  return false;
}

function resolveImageSrc(href) {
  if (isImgur(href) && !IMAGE_EXTENSIONS.has(getExtension(href))) {
    return href + '.jpg';
  }
  return href;
}

function convertLinks() {
  Array.from(document.querySelectorAll('a')).forEach(link => {
    if (!isImageLink(link.href) || link.hasAttribute(ATTR)) return;
    const img = document.createElement('img');
    img.src = resolveImageSrc(link.href);
    img.style.cssText = 'display:block;max-width:100%';
    link.appendChild(img);
    link.setAttribute(ATTR, 'true');
  });
}

function revertLinks() {
  document.querySelectorAll(`a[${ATTR}]`).forEach(link => {
    link.querySelector('img')?.remove();
    link.removeAttribute(ATTR);
  });
}

async function init() {
  const { enabledDomains = [] } = await chrome.storage.sync.get('enabledDomains');
  if (enabledDomains.includes(location.hostname)) {
    convertLinks();
  }
}

chrome.storage.onChanged.addListener((changes) => {
  if (!changes.enabledDomains) return;
  const domains = changes.enabledDomains.newValue ?? [];
  if (domains.includes(location.hostname)) {
    convertLinks();
  } else {
    revertLinks();
  }
});

init();
```

- [ ] **Step 2: Reload the extension and verify conversion**

1. Reload the extension at `chrome://extensions`
2. Navigate to a page that has links ending in `.jpg`, `.png`, etc. (or use `test.html` served locally via `npx serve .`)
3. Click the toolbar icon — badge shows `ON` and image links on the page should immediately render as inline images (without a page reload)
4. Click the toolbar icon again — badge clears and images should disappear, links restored to their original state
5. Reload the page while the domain is enabled — images should appear on load without clicking anything

- [ ] **Step 3: Verify the double-conversion guard**

1. With the domain enabled and images showing, open the browser console on the page
2. Run: `document.querySelectorAll('[data-image-unhider]').length`
3. Confirm the count matches the number of converted links
4. Click the toolbar icon off, then on again
5. Run the count again — it should be the same number (no duplicates)

- [ ] **Step 4: Commit**

```bash
git add content.js
git commit -m "feat: add content script with per-site auto-convert and revert"
```

---

## Task 4: Remove old files

**Files:**
- Delete: `background.html`
- Delete: `variables.js`

- [ ] **Step 1: Delete the old files**

```bash
git rm background.html variables.js
```

- [ ] **Step 2: Reload and confirm no regressions**

1. Reload the extension at `chrome://extensions`
2. Confirm no errors appear (no missing file warnings)
3. Toggle a domain on/off — confirm badge and image conversion still work

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: remove MV1 background page and variables shim"
```

---

## Task 5: Update `test.html`

**Files:**
- Modify: `test.html`

- [ ] **Step 1: Replace the contents of `test.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Image UnHider — Test Page</title>
</head>
<body>
  <h1>Image UnHider — Test Page</h1>
  <p>Serve locally with <code>npx serve .</code> then enable the extension for <code>localhost</code>.</p>

  <h2>Should Convert</h2>
  <a href="https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Good_Food_Display_-_NCI_Visuals_Online.jpg/640px-Good_Food_Display_-_NCI_Visuals_Online.jpg">JPEG via https</a><br>
  <a href="http://i.imgur.com/2Ur3K.gif">Imgur GIF (http)</a><br>
  <a href="https://www.gstatic.com/webp/gallery/1.webp">WebP</a><br>
  <a href="https://svgsilh.com/svg/1295397.svg">SVG</a><br>
  <a href="https://www.gstatic.com/webp/gallery3/1.png">PNG</a><br>

  <h2>Should Not Convert</h2>
  <a href="https://www.reddit.com/r/programming/">Reddit page link</a><br>
  <a href="https://example.com">Plain URL</a><br>
  <a href="https://example.com/image">No extension, not imgur</a>
</body>
</html>
```

- [ ] **Step 2: Verify the test page**

1. Run `npx serve .` in the repo directory (or any static file server)
2. Enable the extension for `localhost`
3. Open `http://localhost:<port>/test.html`
4. Confirm all "Should Convert" links render images inline
5. Confirm all "Should Not Convert" links remain as plain links

- [ ] **Step 3: Commit**

```bash
git add test.html
git commit -m "chore: update test page with https and modern format examples"
```

---

## Task 6: Create `build.sh`

**Files:**
- Create: `build.sh`

- [ ] **Step 1: Create `build.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

OUT="image-unhider.zip"
rm -f "$OUT"

zip -r "$OUT" . \
  --exclude "*.git*" \
  --exclude "*_metadata*" \
  --exclude "test.html" \
  --exclude "screen.png" \
  --exclude "build.sh" \
  --exclude "docs/*" \
  --exclude "*.zip"

echo "Built: $OUT"
```

- [ ] **Step 2: Make it executable and run it**

```bash
chmod +x build.sh
bash build.sh
```

Expected output:
```
  adding: content.js (deflated ...)
  adding: i_128.png (stored ...)
  adding: i_16.png (stored ...)
  adding: i_48.png (stored ...)
  adding: mag.png (deflated ...)
  adding: manifest.json (deflated ...)
  adding: service-worker.js (deflated ...)
  adding: i_48.png (stored ...)
Built: image-unhider.zip
```

- [ ] **Step 3: Verify the zip contents**

```bash
unzip -l image-unhider.zip
```

Confirm the zip contains: `manifest.json`, `service-worker.js`, `content.js`, `i_16.png`, `i_48.png`, `i_128.png`, `mag.png`.

Confirm the zip does NOT contain: `background.html`, `variables.js`, `test.html`, `screen.png`, `build.sh`, `.git/`, `docs/`.

- [ ] **Step 4: Commit**

```bash
git add build.sh
git commit -m "chore: add build script for Chrome Web Store packaging"
```

---

## Task 7: End-to-End Verification

No new files — this is a final manual smoke test across the full feature set.

- [ ] **Step 1: Load the packaged zip**

1. Go to `chrome://extensions`
2. Remove the unpacked version of the extension
3. There is no direct way to install a `.crx` from a zip locally without signing — instead, keep the unpacked version loaded and verify the zip contents look correct from Task 6 Step 3
4. Re-load the unpacked extension for final testing

- [ ] **Step 2: Test per-site persistence**

1. Enable the extension on `example.com` (or any real site with image links)
2. Close the tab entirely
3. Re-open the tab to the same domain
4. Confirm images are auto-converted on load (no click needed) and badge shows `ON`

- [ ] **Step 3: Test badge across tabs**

1. Open two tabs: one on an enabled domain, one on a non-enabled domain
2. Switch between tabs — badge should show `ON` on the enabled tab, blank on the other
3. Click the icon on the non-enabled tab — badge shows `ON`, images convert immediately
4. Switch back to the first tab — badge still shows `ON`

- [ ] **Step 4: Test https support**

1. Navigate to any `https://` page with image links (e.g. a GitHub issue with raw image URLs)
2. Enable the extension — confirm images convert

- [ ] **Step 5: Final commit**

```bash
git add -A
git status  # confirm nothing unexpected is staged
git commit -m "chore: verify MV3 modernization complete"
```
