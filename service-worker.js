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
