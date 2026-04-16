import { categorizeTabs, checkChromeAIAvailability } from "./lib/ai-provider.js";

const $ = (s) => document.querySelector(s);

async function send(action, data = {}) {
  return chrome.runtime.sendMessage({ action, ...data });
}

function toast(msg, type = "ok") {
  const t = $("#toast");
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => t.classList.remove("show"), 2500);
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

function makeItem(tab, extra = "") {
  const d = document.createElement("div");
  d.className = "item";
  d.innerHTML = `
    <img src="${favicon(tab.url)}" onerror="this.style.display='none'">
    <span class="title">${esc(tab.title || tab.url)}</span>${extra}
    <button class="btn-x" data-id="${tab.id}">&times;</button>`;
  d.querySelector(".btn-x").onclick = async () => { await chrome.tabs.remove(tab.id); d.remove(); };
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
  if (!groups?.length) { $("#secDups").style.display = "none"; return; }
  $("#secDups").style.display = "";
  const list = $("#listDups"); list.innerHTML = "";
  for (const g of groups) {
    for (const t of g) list.appendChild(makeItem(t, `<span class="url">${new URL(t.url).hostname.replace("www.","")}</span>`));
  }
}

async function loadStale() {
  const tabs = await send("findStaleTabs");
  if (!tabs?.length) { $("#secStale").style.display = "none"; return; }
  $("#secStale").style.display = "";
  const list = $("#listStale"); list.innerHTML = "";
  for (const t of tabs) list.appendChild(makeItem(t));
}

async function loadCats() {
  const tabs = await chrome.tabs.query({});
  const result = await categorizeTabs(tabs);
  if (!result?.length) return;
  $("#secCats").style.display = "";
  const container = $("#listCats"); container.innerHTML = "";
  const grouped = {};
  for (const { tab, category } of result) {
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

async function sweepAll() {
  const btn = $("#btnSweep"); btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Sweeping...';
  try {
    const dupResult = await send("removeDuplicates");
    const staleResult = await send("removeStale");
    const remaining = await chrome.tabs.query({});
    const categorized = await categorizeTabs(remaining);
    await send("organizeGroups", { categorized });
    toast(`Swept ${dupResult} dupes + ${staleResult} stale`);
    await refresh();
  } catch (e) { toast(e.message, "err"); }
  btn.disabled = false; btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M10 11v6M14 11v6"/></svg> Sweep All`;
}

async function dedup() {
  const n = await send("removeDuplicates");
  toast(`Removed ${n} duplicates`); await refresh();
}

async function closeStale() {
  const n = await send("removeStale");
  toast(`Closed ${n} stale tabs`); await refresh();
}

async function organize() {
  const btn = $("#btnGroup"); btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Organizing...';
  try {
    const tabs = await chrome.tabs.query({});
    const categorized = await categorizeTabs(tabs);
    const r = await send("organizeGroups", { categorized });
    const cats = r.map(c => `${c.category}(${c.count})`).join(", ");
    toast(`Grouped: ${cats}`); await refresh();
  } catch (e) { toast(e.message, "err"); }
  btn.disabled = false; btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> Organize by Category`;
}

async function refresh() {
  await loadStats(); await loadDups(); await loadStale(); await loadCats();
}

document.addEventListener("DOMContentLoaded", () => {
  $("#btnSweep").onclick = sweepAll;
  $("#btnDedup").onclick = dedup;
  $("#btnStale").onclick = closeStale;
  $("#btnGroup").onclick = organize;
  $("#openSettings").onclick = () => chrome.runtime.openOptionsPage();
  $("#refresh").onclick = refresh;
  refresh();
});