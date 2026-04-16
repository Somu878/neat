const DEFAULTS = {
  staleThresholdDays: 5,
  autoCleanupEnabled: false,
  autoCleanupIntervalHours: 24,
  categoryOrder: ["work", "social", "shopping", "entertainment", "news", "docs", "dev", "finance", "travel", "learning", "health", "other"],
  excludedUrls: ["chrome://", "chrome-extension://", "about:"],
};

export async function getSettings() {
  const stored = await chrome.storage.local.get("settings");
  return { ...DEFAULTS, ...stored.settings };
}

export async function saveSettings(settings) {
  await chrome.storage.local.set({ settings });
}

export async function getTabMeta() {
  const stored = await chrome.storage.local.get("tabMeta");
  return stored.tabMeta || {};
}

export async function saveTabMeta(meta) {
  await chrome.storage.local.set({ tabMeta: meta });
}

export async function updateTabMeta(tabId, data) {
  const meta = await getTabMeta();
  meta[tabId] = { ...(meta[tabId] || {}), ...data };
  await chrome.storage.local.set({ tabMeta: meta });
}

export async function removeTabMeta(tabId) {
  const meta = await getTabMeta();
  delete meta[tabId];
  await chrome.storage.local.set({ tabMeta: meta });
}