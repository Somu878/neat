import { checkChromeAIAvailability } from "./lib/ai-provider.js";

async function send(action, data = {}) {
  return chrome.runtime.sendMessage({ action, ...data });
}

function toast(msg, type = "ok") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => t.classList.remove("show"), 2500);
}

async function checkAI() {
  const ai = await checkChromeAIAvailability();
  const dot = document.getElementById("aiDot");
  const title = document.getElementById("aiTitle");
  const desc = document.getElementById("aiDesc");
  const hint = document.getElementById("flagHint");

  if (ai.available) {
    dot.className = "ai-dot on";
    title.textContent = "Chrome AI is ready";
    desc.textContent = "Built-in model will categorize unknown tabs locally";
    hint.style.display = "none";
  } else if (ai.reason === "download_required") {
    dot.className = "ai-dot warn";
    title.textContent = "Chrome AI downloading";
    desc.textContent = "Model is being downloaded - rules handle categorization until ready";
    hint.style.display = "block";
  } else {
    dot.className = "ai-dot off";
    title.textContent = "Chrome AI not available";
    desc.textContent = "Using rules-only categorization (80+ known sites covered)";
    hint.style.display = "block";
  }
}

let whitelist = [];

function renderWhitelist() {
  const box = document.getElementById("whitelistBox");
  box.innerHTML = "";
  if (!whitelist.length) {
    box.innerHTML = `<div class="whitelist-empty">No protected domains yet</div>`;
    return;
  }
  whitelist.forEach((domain, idx) => {
    const row = document.createElement("div");
    row.className = "whitelist-item";
    row.innerHTML = `<span>${esc(domain)}</span><button data-idx="${idx}">&times;</button>`;
    row.querySelector("button").onclick = () => {
      whitelist.splice(idx, 1);
      renderWhitelist();
    };
    box.appendChild(row);
  });
}

function esc(s) {
  const d = document.createElement("span");
  d.textContent = s;
  return d.innerHTML;
}

async function load() {
  const s = await send("getSettings");
  document.getElementById("staleDays").value = s.staleThresholdDays;
  document.getElementById("staleVal").textContent = s.staleThresholdDays;

  const autoTog = document.getElementById("autoToggle");
  if (s.autoCleanupEnabled) autoTog.classList.add("on");
  document.getElementById("autoLabel").textContent = s.autoCleanupEnabled ? "Enabled" : "Disabled";

  const confirmTog = document.getElementById("confirmToggle");
  if (s.showConfirmModal !== false) confirmTog.classList.add("on");
  document.getElementById("confirmLabel").textContent = confirmTog.classList.contains("on") ? "Enabled" : "Disabled";

  const sleepTog = document.getElementById("sleepToggle");
  if (s.enableSleep) sleepTog.classList.add("on");
  document.getElementById("sleepLabel").textContent = s.enableSleep ? "Enabled" : "Disabled";

  document.getElementById("sleepMinutes").value = s.sleepAfterMinutes || 60;
  document.getElementById("sleepVal").textContent = s.sleepAfterMinutes || 60;

  whitelist = Array.isArray(s.whitelist) ? [...s.whitelist] : [];
  renderWhitelist();

  await checkAI();
}

async function save() {
  const settings = {
    staleThresholdDays: parseInt(document.getElementById("staleDays").value, 10),
    autoCleanupEnabled: document.getElementById("autoToggle").classList.contains("on"),
    showConfirmModal: document.getElementById("confirmToggle").classList.contains("on"),
    enableSleep: document.getElementById("sleepToggle").classList.contains("on"),
    sleepAfterMinutes: parseInt(document.getElementById("sleepMinutes").value, 10),
    categoryOrder: ["work","social","shopping","entertainment","news","docs","dev","finance","travel","learning","health","other"],
    excludedUrls: ["chrome://", "chrome-extension://", "about:"],
    whitelist,
  };
  await send("saveSettings", { settings });
  toast("Settings saved!");
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("staleDays").addEventListener("input", (e) => { document.getElementById("staleVal").textContent = e.target.value; });
  document.getElementById("sleepMinutes").addEventListener("input", (e) => { document.getElementById("sleepVal").textContent = e.target.value; });

  document.getElementById("autoToggle").addEventListener("click", function () {
    this.classList.toggle("on");
    document.getElementById("autoLabel").textContent = this.classList.contains("on") ? "Enabled" : "Disabled";
  });
  document.getElementById("confirmToggle").addEventListener("click", function () {
    this.classList.toggle("on");
    document.getElementById("confirmLabel").textContent = this.classList.contains("on") ? "Enabled" : "Disabled";
  });
  document.getElementById("sleepToggle").addEventListener("click", function () {
    this.classList.toggle("on");
    document.getElementById("sleepLabel").textContent = this.classList.contains("on") ? "Enabled" : "Disabled";
  });

  document.getElementById("btnAddWhitelist").addEventListener("click", () => {
    const input = document.getElementById("whitelistInput");
    const val = input.value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*/, "");
    if (!val) return;
    if (!whitelist.includes(val)) whitelist.push(val);
    input.value = "";
    renderWhitelist();
  });
  document.getElementById("whitelistInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("btnAddWhitelist").click();
  });

  document.getElementById("btnSave").addEventListener("click", save);
  load();
});
