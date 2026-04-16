import { getSettings, removeTabMeta } from "./storage.js";
import { ruleBasedCategorize } from "./ai-provider.js";

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.hash = "";
    u.searchParams.delete("utm_source");
    u.searchParams.delete("utm_medium");
    u.searchParams.delete("utm_campaign");
    u.searchParams.delete("ref");
    return u.toString().replace(/\/+$/, "");
  } catch {
    return url;
  }
}

function isExcluded(url) {
  return !url || url.startsWith("chrome://") || url.startsWith("chrome-extension://") || url.startsWith("about:");
}

export async function findDuplicates(tabs) {
  const seen = new Map();
  const groups = [];
  for (const tab of tabs) {
    if (isExcluded(tab.url)) continue;
    const key = normalizeUrl(tab.url);
    if (seen.has(key)) {
      seen.get(key).push(tab);
    } else {
      seen.set(key, [tab]);
    }
  }
  for (const [, group] of seen) {
    if (group.length > 1) groups.push(group);
  }
  return groups;
}

export async function findStaleTabs(tabs) {
  const settings = await getSettings();
  const threshold = settings.staleThresholdDays * 24 * 60 * 60 * 1000;
  const now = Date.now();
  return tabs.filter((tab) => {
    if (tab.active || tab.pinned) return false;
    if (isExcluded(tab.url)) return false;
    if (!tab.lastAccessed) return false;
    return now - tab.lastAccessed > threshold;
  });
}

export function categorizeWithRules(tabs) {
  return tabs
    .filter((t) => !isExcluded(t.url))
    .map((tab) => ({ tab, category: ruleBasedCategorize(tab.url) || "other" }));
}

export async function organizeIntoGroups(tabs, categorized) {
  const groups = {};
  for (const { tab, category } of categorized) {
    if (isExcluded(tab.url)) continue;
    if (!groups[category]) groups[category] = [];
    groups[category].push(tab);
  }
  const categoryColors = {
    dev: "cyan", work: "blue", social: "pink", shopping: "green",
    entertainment: "red", news: "yellow", docs: "purple",
    finance: "orange", travel: "grey", learning: "cyan",
    health: "green", other: "grey",
  };
  const results = [];
  const existingGroups = await chrome.tabGroups.query({});
  for (const [category, categoryTabs] of Object.entries(groups)) {
    try {
      const existingGroup = existingGroups.find((g) => g.title.toLowerCase() === category.toLowerCase());
      let groupId;
      if (existingGroup) {
        await chrome.tabs.group({ tabIds: categoryTabs.map((t) => t.id), groupId: existingGroup.id });
        groupId = existingGroup.id;
      } else {
        groupId = await chrome.tabs.group({ tabIds: categoryTabs.map((t) => t.id) });
        await chrome.tabGroups.update(groupId, {
          title: category.charAt(0).toUpperCase() + category.slice(1),
          color: categoryColors[category] || "grey",
        });
      }
      results.push({ category, count: categoryTabs.length, groupId });
    } catch (e) {
      results.push({ category, count: categoryTabs.length, error: e.message });
    }
  }
  return results;
}

export async function removeDuplicateTabs(duplicates) {
  let closed = 0;
  for (const group of duplicates) {
    const keep = group.find((t) => t.active) || group.find((t) => t.pinned) || group[0];
    for (const tab of group) {
      if (tab.id !== keep.id) {
        await chrome.tabs.remove(tab.id);
        await removeTabMeta(tab.id);
        closed++;
      }
    }
  }
  return closed;
}

export async function removeStaleTabs(staleTabs) {
  let closed = 0;
  for (const tab of staleTabs) {
    await chrome.tabs.remove(tab.id);
    await removeTabMeta(tab.id);
    closed++;
  }
  return closed;
}