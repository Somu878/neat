import { categorizeTabs, checkChromeAIAvailability } from "./lib/ai-provider.js";

const $ = (s) => document.querySelector(s);

async function send(action, data = {}) {
  return chrome.runtime.sendMessage({ action, ...data });
}

let undoEntryId = null;
let undoTimeout = null;
let appSettings = {};

function toast(msg, type = "ok", showUndo = false) {
  const t = $("#toast");
  $("#toastMsg").textContent = msg;
  const undoBtn = $("#btnUndo");
  undoBtn.style.display = showUndo ? "inline-block" : "none";
  t.className = `toast ${type} show`;

  if (undoTimeout) clearTimeout(undoTimeout);
  undoTimeout = setTimeout(() => {
    t.classList.remove("show");
    undoEntryId = null;
  }, showUndo ? 6000 : 2500);
}

async function doUndo() {
  if (!undoEntryId) return;
  try {
    const stack = await chrome.runtime.sendMessage({ action: "getUndoStack" });
    const entry = stack.find((e) => e.id === undoEntryId);
    if (entry && entry.tabs.length) {
      await send("restoreTabs", { tabs: entry.tabs });
      toast("Tabs restored", "ok");
      undoEntryId = null;
      await refresh();
    }
  } catch (e) {
    toast("Restore failed", "err");
  }
}

const CAT_TAG = {
  dev: "tag-dev", work: "tag-work", social: "tag-social", shopping: "tag-shopping",
  entertainment: "tag-entertainment", news: "tag-news", docs: "tag-docs",
  finance: "tag-finance", travel: "tag-travel", learning: "tag-learning",
  health: "tag-health", other: "tag-other",
};

function favicon(url) {
  try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=16`; } catch { return ""; }
}

function timeAgo(ms) {
  if (!ms || isNaN(ms)) return "unknown";
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function makeItem(tab, extra = "") {
  const d = document.createElement("div");
  d.className = "item";
  d.title = tab.title || tab.url;
  d.innerHTML = `
    <img src="${favicon(tab.url)}" onerror="this.style.display='none'">
    <span class="title">${esc(tab.title || tab.url)}</span>${extra}
    <button class="btn-x" data-id="${tab.id}">&times;</button>`;
  d.addEventListener("click", async (e) => {
    if (e.target.closest(".btn-x")) return;
    await send("focusTab", { tabId: tab.id, windowId: tab.windowId });
  });
  d.querySelector(".btn-x").onclick = async (e) => {
    e.stopPropagation();
    await chrome.tabs.remove(tab.id);
    d.remove();
  };
  return d;
}

function esc(s) { const d = document.createElement("span"); d.textContent = s; return d.innerHTML; }

async function updateAIStatus() {
  const ai = await checkChromeAIAvailability();
  if (ai.available) {
    $("#aiDot").classList.remove("off");
    $("#aiLabel").textContent = "Chrome AI + Rules \u00b7 Free";
    $("#catBadge").textContent = "AI + RULES";
    $("#catBadge").className = "section-badge ai";
  } else if (ai.reason === "download_required") {
    $("#aiDot").classList.add("off");
    $("#aiLabel").textContent = "Chrome AI downloading\u2026 using Rules";
    $("#catBadge").textContent = "RULES";
    $("#catBadge").className = "section-badge rule";
    const banner = document.getElementById("aiBanner");
    if (banner) banner.style.display = "block";
  } else {
    $("#aiDot").classList.add("off");
    $("#aiLabel").textContent = "Rules only (Chrome AI unavailable)";
    $("#catBadge").textContent = "RULES";
    $("#catBadge").className = "section-badge rule";
    const banner = document.getElementById("aiBanner");
    if (banner) banner.style.display = "block";
  }
}

async function loadStats() {
  const s = await send("getTabStats");
  $("#sTotal").textContent = s.totalTabs;
  $("#sDups").textContent = s.duplicateCount;
  $("#sStale").textContent = s.staleCount;
  await updateAIStatus();
}

async function loadDups() {
  const groups = await send("findDuplicates");
  const has = groups?.length > 0;
  $("#secDups").style.display = has ? "" : "none";
  $("#emptyDups").style.display = !has ? "" : "none";
  if (!has) return;
  const list = $("#listDups"); list.innerHTML = "";
  for (const g of groups) {
    for (const t of g) {
      const extra = `<span class="url">${new URL(t.url).hostname.replace("www.","")}</span>`;
      list.appendChild(makeItem(t, extra));
    }
  }
}

async function loadStale() {
  const tabs = await send("findStaleTabs");
  const has = tabs?.length > 0;
  $("#secStale").style.display = has ? "" : "none";
  $("#emptyStale").style.display = !has ? "" : "none";
  if (!has) return;
  const list = $("#listStale"); list.innerHTML = "";
  for (const t of tabs) {
    const extra = `<span class="meta">${timeAgo(t.lastAccessed)}</span>`;
    list.appendChild(makeItem(t, extra));
  }
}

async function loadCats() {
  const tabs = await chrome.tabs.query({});
  const result = await categorizeTabs(tabs);
  const filtered = result.filter((r) => r.tab && r.tab.url && !r.tab.url.startsWith("chrome://") && !r.tab.url.startsWith("chrome-extension://") && !r.tab.url.startsWith("about:"));
  const has = filtered.length > 0;
  $("#secCats").style.display = has ? "" : "none";
  $("#emptyCats").style.display = !has ? "" : "none";
  if (!has) return;
  const container = $("#listCats"); container.innerHTML = "";
  const grouped = {};
  for (const { tab, category } of filtered) {
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(tab);
  }
  for (const [cat, cTabs] of Object.entries(grouped)) {
    const div = document.createElement("div"); div.className = "cat-group";
    div.innerHTML = `<div class="cat-head"><span class="tag ${CAT_TAG[cat] || "tag-other"}">${cat}</span><span class="cat-count">${cTabs.length}</span></div>`;
    const list = document.createElement("div"); list.className = "list";
    for (const t of cTabs) list.appendChild(makeItem(t, `<span class="tag ${CAT_TAG[cat] || "tag-other"}">${cat}</span>`));
    div.appendChild(list);
    container.appendChild(div);
  }
}

/* Search */
async function loadSearch(query) {
  const q = query.trim().toLowerCase();
  const sec = $("#secSearch");
  if (!q) { sec.style.display = "none"; return; }
  const tabs = await chrome.tabs.query({});
  const matched = tabs.filter((t) => {
    const text = `${t.title || ""} ${t.url || ""}`.toLowerCase();
    return text.includes(q);
  });
  sec.style.display = matched.length ? "" : "none";
  $("#searchBadge").textContent = matched.length;
  const list = $("#listSearch"); list.innerHTML = "";
  for (const t of matched) list.appendChild(makeItem(t));
}

/* Modal */
let pendingAction = null;
function openModal(title, body, actionLabel, actionFn) {
  $("#modalOverlay").style.display = "flex";
  $("#modalTitle").textContent = title;
  $("#modalBody").textContent = body;
  $("#modalConfirm").textContent = actionLabel;
  pendingAction = actionFn;
}
function closeModal() {
  $("#modalOverlay").style.display = "none";
  pendingAction = null;
}

async function sweepAll() {
  const btn = $("#btnSweep"); btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Sweeping...';
  try {
    const result = await send("sweepAll");
    const total = result.duplicatesRemoved + result.staleClosed;
    const stack = await send("getUndoStack");
    undoEntryId = stack[0]?.id || null;
    toast(`Swept ${total} tabs`, "ok", total > 0);
    await refresh();
  } catch (e) { toast(e.message, "err"); }
  btn.disabled = false;
  btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M10 11v6M14 11v6"/></svg> Sweep All`;
}

async function dedup() {
  const n = await send("removeDuplicates");
  if (n > 0) {
    const stack = await send("getUndoStack");
    undoEntryId = stack[0]?.id || null;
  }
  toast(`Removed ${n} duplicates`, n > 0 ? "ok" : "ok", n > 0);
  await refresh();
}

async function closeStale() {
  const n = await send("removeStale");
  if (n > 0) {
    const stack = await send("getUndoStack");
    undoEntryId = stack[0]?.id || null;
  }
  toast(`Closed ${n} stale tabs`, n > 0 ? "ok" : "ok", n > 0);
  await refresh();
}

async function organize() {
  const btn = $("#btnGroup"); btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Organizing...';
  try {
    const tabs = await chrome.tabs.query({});
    const categorized = await categorizeTabs(tabs);
    const r = await send("organizeGroups", { categorized });
    const cats = r.map((c) => `${c.category}(${c.count})`).join(", ");
    toast(`Grouped: ${cats}`, "ok"); await refresh();
  } catch (e) { toast(e.message, "err"); }
  btn.disabled = false;
  btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> Organize by Category`;
}

async function sleepAll() {
  const result = await send("sleepTabs");
  toast(`Slept ${result.slept} tabs`, result.slept > 0 ? "ok" : "ok");
  await refresh();
}

async function refresh() {
  await loadStats(); await loadDups(); await loadStale(); await loadCats();
  const q = $("#tabSearch").value;
  if (q) await loadSearch(q);
}

document.addEventListener("DOMContentLoaded", async () => {
  appSettings = await send("getSettings");

  $("#btnSweep").onclick = () => {
    if (appSettings.showConfirmModal === false) {
      sweepAll();
      return;
    }
    const sTotal = $("#sTotal").textContent;
    const sDups = $("#sDups").textContent;
    const sStale = $("#sStale").textContent;
    openModal(
      "Confirm Sweep",
      `This will remove ${sDups} duplicates, close ${sStale} stale tabs, and organize the remaining ${sTotal} tabs into groups.`,
      "Sweep All",
      sweepAll
    );
  };
  $("#btnDedup").onclick = dedup;
  $("#btnStale").onclick = closeStale;
  $("#btnGroup").onclick = organize;
  $("#btnSleepAll").onclick = sleepAll;
  $("#openSettings").onclick = () => chrome.runtime.openOptionsPage();
  $("#refresh").onclick = refresh;
  $("#btnUndo").onclick = doUndo;

  $("#modalCancel").onclick = closeModal;
  $("#modalOverlay").onclick = (e) => { if (e.target === $("#modalOverlay")) closeModal(); };
  $("#modalConfirm").onclick = () => { if (pendingAction) pendingAction(); closeModal(); };

  $("#tabSearch").addEventListener("input", (e) => loadSearch(e.target.value));
  $("#tabSearch").addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.target.value = ""; loadSearch(""); }
  });

  refresh();
});
