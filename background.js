import { getSettings, saveSettings, removeTabMeta } from "./lib/storage.js";
import { findDuplicates, findStaleTabs, categorizeWithRules, organizeIntoGroups, removeDuplicateTabs, removeStaleTabs } from "./lib/tab-manager.js";

chrome.runtime.onInstalled.addListener(async () => {
  const settings = await getSettings();
  await saveSettings(settings);
  chrome.alarms.create("autoCleanup", { periodInMinutes: 60 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "autoCleanup") {
    const settings = await getSettings();
    if (settings.autoCleanupEnabled) {
      const result = await cleanupRulesOnly();
      chrome.action.setBadgeText({ text: String(result.staleClosed + result.duplicatesRemoved) });
      setTimeout(() => chrome.action.setBadgeText({ text: "" }), 5000);
    }
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  await removeTabMeta(tabId);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message).then(sendResponse);
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
      return await removeDuplicateTabs(duplicates);
    }
    case "removeStale": {
      const tabs = await chrome.tabs.query({});
      const staleTabs = await findStaleTabs(tabs);
      return await removeStaleTabs(staleTabs);
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
    default:
      return { error: "Unknown action" };
  }
}

async function cleanupRulesOnly() {
  const tabs = await chrome.tabs.query({});
  const duplicates = await findDuplicates(tabs);
  const staleTabs = await findStaleTabs(tabs);
  const dupClosed = await removeDuplicateTabs(duplicates);
  const staleClosed = await removeStaleTabs(staleTabs);
  const remaining = await chrome.tabs.query({});
  const categorized = categorizeWithRules(remaining);
  await organizeIntoGroups(remaining, categorized);
  return { duplicatesRemoved: dupClosed, staleClosed, totalBefore: tabs.length, totalAfter: remaining.length - dupClosed - staleClosed };
}