import { getSettings, saveSettings, removeTabMeta, updateTabMeta, pushUndo, pushCleanupHistory, getUndoStack } from "./lib/storage.js";
import { findDuplicates, findStaleTabs, categorizeWithRules, organizeIntoGroups, removeDuplicateTabs, removeStaleTabs, findSleepCandidates, sleepTabs } from "./lib/tab-manager.js";

chrome.runtime.onInstalled.addListener(async () => {
  const settings = await getSettings();
  await saveSettings(settings);
  chrome.alarms.create("autoCleanup", { periodInMinutes: 60 });
  chrome.alarms.create("autoSleep", { periodInMinutes: 15 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "autoCleanup") {
    const settings = await getSettings();
    if (settings.autoCleanupEnabled) {
      const result = await cleanupRulesOnly();
      const total = result.staleClosed + result.duplicatesRemoved;
      if (total > 0) {
        chrome.action.setBadgeText({ text: String(total) });
        chrome.action.setBadgeBackgroundColor({ color: "#7c5cfc" });
        setTimeout(() => chrome.action.setBadgeText({ text: "" }), 5000);
      }
    }
  }
  if (alarm.name === "autoSleep") {
    const settings = await getSettings();
    if (settings.enableSleep) {
      const tabs = await chrome.tabs.query({});
      const candidates = await findSleepCandidates(tabs);
      if (candidates.length) await sleepTabs(candidates);
    }
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  await removeTabMeta(tabId);
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    await updateTabMeta(tabId, { lastAccessed: Date.now() });
  } catch {}
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message).then(sendResponse).catch((e) => sendResponse({ error: e.message }));
  return true;
});

async function handleMessage(message) {
  switch (message.action) {
    case "findDuplicates": {
      const tabs = await chrome.tabs.query({});
      return await findDuplicates(tabs);
    }
    case "findStaleTabs": {
      const tabs = await chrome.tabs.query({});
      return await findStaleTabs(tabs);
    }
    case "removeDuplicates": {
      const tabs = await chrome.tabs.query({});
      const duplicates = await findDuplicates(tabs);
      const result = await removeDuplicateTabs(duplicates);
      if (result.closed > 0) await pushUndo("removeDuplicates", result.closedTabs);
      return result.closed;
    }
    case "removeStale": {
      const tabs = await chrome.tabs.query({});
      const staleTabs = await findStaleTabs(tabs);
      const result = await removeStaleTabs(staleTabs);
      if (result.closed > 0) await pushUndo("removeStale", result.closedTabs);
      return result.closed;
    }
    case "sweepAll": {
      const tabs = await chrome.tabs.query({});
      const dupResult = await removeDuplicateTabs(await findDuplicates(tabs));
      const staleResult = await removeStaleTabs(await findStaleTabs(tabs));
      const allClosed = [...dupResult.closedTabs, ...staleResult.closedTabs];
      if (allClosed.length > 0) await pushUndo("sweepAll", allClosed);
      const remaining = await chrome.tabs.query({});
      const categorized = categorizeWithRules(remaining);
      await organizeIntoGroups(remaining, categorized);
      await pushCleanupHistory({ duplicatesRemoved: dupResult.closed, staleClosed: staleResult.closed, totalBefore: tabs.length });
      return { duplicatesRemoved: dupResult.closed, staleClosed: staleResult.closed };
    }
    case "categorizeWithRules": {
      const tabs = await chrome.tabs.query({});
      return categorizeWithRules(tabs);
    }
    case "organizeGroups": {
      const tabs = await chrome.tabs.query({});
      const categorized = message.categorized || categorizeWithRules(tabs);
      return await organizeIntoGroups(tabs, categorized);
    }
    case "sleepTabs": {
      const tabs = await chrome.tabs.query({});
      const candidates = await findSleepCandidates(tabs);
      const slept = await sleepTabs(candidates);
      return { slept, candidates: candidates.length };
    }
    case "getSleepCandidates": {
      const tabs = await chrome.tabs.query({});
      return await findSleepCandidates(tabs);
    }
    case "getSettings":
      return await getSettings();
    case "saveSettings":
      await saveSettings(message.settings);
      return { success: true };
    case "getTabStats": {
      const tabs = await chrome.tabs.query({});
      const duplicates = await findDuplicates(tabs);
      const staleTabs = await findStaleTabs(tabs);
      const dupCount = duplicates.reduce((sum, group) => sum + group.length - 1, 0);
      return { totalTabs: tabs.length, duplicateGroups: duplicates.length, duplicateCount: dupCount, staleCount: staleTabs.length };
    }
    case "restoreTabs": {
      const restored = [];
      for (const t of message.tabs) {
        try {
          const tab = await chrome.tabs.create({ url: t.url, pinned: t.pinned, active: false });
          restored.push(tab);
        } catch {}
      }
      return restored;
    }
    case "focusTab": {
      try {
        await chrome.tabs.update(message.tabId, { active: true });
        await chrome.windows.update(message.windowId, { focused: true });
        return { success: true };
      } catch (e) {
        return { error: e.message };
      }
    }
    case "getUndoStack":
      return await getUndoStack();
    default:
      return { error: "Unknown action" };
  }
}

async function cleanupRulesOnly() {
  const tabs = await chrome.tabs.query({});
  const dupResult = await removeDuplicateTabs(await findDuplicates(tabs));
  const staleResult = await removeStaleTabs(await findStaleTabs(tabs));
  const allClosed = [...dupResult.closedTabs, ...staleResult.closedTabs];
  if (allClosed.length > 0) await pushUndo("autoCleanup", allClosed);
  const remaining = await chrome.tabs.query({});
  const categorized = categorizeWithRules(remaining);
  await organizeIntoGroups(remaining, categorized);
  return { duplicatesRemoved: dupResult.closed, staleClosed: staleResult.closed, totalBefore: tabs.length, totalAfter: remaining.length };
}

/* Keyboard shortcuts */
chrome.commands.onCommand.addListener(async (command) => {
  switch (command) {
    case "sweep-all": {
      const tabs = await chrome.tabs.query({});
      const dupResult = await removeDuplicateTabs(await findDuplicates(tabs));
      const staleResult = await removeStaleTabs(await findStaleTabs(tabs));
      const allClosed = [...dupResult.closedTabs, ...staleResult.closedTabs];
      if (allClosed.length > 0) await pushUndo("sweepAll", allClosed);
      const remaining = await chrome.tabs.query({});
      const categorized = categorizeWithRules(remaining);
      await organizeIntoGroups(remaining, categorized);
      const total = dupResult.closed + staleResult.closed;
      if (total > 0) {
        chrome.action.setBadgeText({ text: String(total) });
        chrome.action.setBadgeBackgroundColor({ color: "#7c5cfc" });
        setTimeout(() => chrome.action.setBadgeText({ text: "" }), 4000);
      }
      break;
    }
    case "remove-duplicates": {
      const tabs = await chrome.tabs.query({});
      const result = await removeDuplicateTabs(await findDuplicates(tabs));
      if (result.closed > 0) {
        await pushUndo("removeDuplicates", result.closedTabs);
        chrome.action.setBadgeText({ text: String(result.closed) });
        setTimeout(() => chrome.action.setBadgeText({ text: "" }), 3000);
      }
      break;
    }
    case "close-stale": {
      const tabs = await chrome.tabs.query({});
      const result = await removeStaleTabs(await findStaleTabs(tabs));
      if (result.closed > 0) {
        await pushUndo("removeStale", result.closedTabs);
        chrome.action.setBadgeText({ text: String(result.closed) });
        setTimeout(() => chrome.action.setBadgeText({ text: "" }), 3000);
      }
      break;
    }
    case "organize-groups": {
      const tabs = await chrome.tabs.query({});
      const categorized = categorizeWithRules(tabs);
      await organizeIntoGroups(tabs, categorized);
      break;
    }

  }
});
