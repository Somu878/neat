const DEFAULTS = {
  staleThresholdDays: 5,
  autoCleanupEnabled: false,
  autoCleanupIntervalHours: 24,
  categoryOrder: ["work", "social", "shopping", "entertainment", "news", "docs", "dev", "finance", "travel", "learning", "health", "other"],
  excludedUrls: ["chrome://", "chrome-extension://", "about:"],
  whitelist: [],
  sleepAfterMinutes: 60,
  enableSleep: false,
  showConfirmModal: true,
  maxUndoHistory: 20,
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

/* Undo / Recently Closed */
export async function getUndoStack() {
  const stored = await chrome.storage.local.get("undoStack");
  return stored.undoStack || [];
}

export async function pushUndo(action, tabs) {
  const stack = await getUndoStack();
  const entry = {
    id: crypto.randomUUID?.() || String(Date.now()),
    action,
    tabs: tabs.map((t) => ({ url: t.url, title: t.title, pinned: t.pinned || false })),
    timestamp: Date.now(),
  };
  stack.unshift(entry);
  const max = (await getSettings()).maxUndoHistory;
  while (stack.length > max) stack.pop();
  await chrome.storage.local.set({ undoStack: stack });
  return entry;
}

export async function removeUndoEntry(id) {
  const stack = await getUndoStack();
  const filtered = stack.filter((e) => e.id !== id);
  await chrome.storage.local.set({ undoStack: filtered });
}

/* Cleanup history */
export async function getCleanupHistory() {
  const stored = await chrome.storage.local.get("cleanupHistory");
  return stored.cleanupHistory || [];
}

export async function pushCleanupHistory(record) {
  const hist = await getCleanupHistory();
  hist.unshift({ ...record, timestamp: Date.now() });
  while (hist.length > 50) hist.pop();
  await chrome.storage.local.set({ cleanupHistory: hist });
}
