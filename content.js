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
    const u = new URL(href);
    u.pathname = u.pathname + '.jpg';
    return u.toString();
  }
  return href;
}

function convertLinks() {
  Array.from(document.querySelectorAll('a')).forEach(link => {
    if (link.hasAttribute(ATTR) || !isImageLink(link.href)) return;
    const img = document.createElement('img');
    img.src = resolveImageSrc(link.href);
    img.style.cssText = 'display:block;max-width:100%';
    img.setAttribute('data-image-unhider-img', 'true');
    link.appendChild(img);
    link.setAttribute(ATTR, 'true');
  });
}

function revertLinks() {
  Array.from(document.querySelectorAll(`a[${ATTR}]`)).forEach(link => {
    link.querySelector('img[data-image-unhider-img]')?.remove();
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
