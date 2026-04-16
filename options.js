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

async function load() {
  const s = await send("getSettings");
  document.getElementById("staleDays").value = s.staleThresholdDays;
  document.getElementById("staleVal").textContent = s.staleThresholdDays;
  const tog = document.getElementById("autoToggle");
  if (s.autoCleanupEnabled) tog.classList.add("on");
  document.getElementById("autoLabel").textContent = s.autoCleanupEnabled ? "Enabled" : "Disabled";
  await checkAI();
}

async function save() {
  const settings = {
    staleThresholdDays: parseInt(document.getElementById("staleDays").value, 10),
    autoCleanupEnabled: document.getElementById("autoToggle").classList.contains("on"),
    categoryOrder: ["work","social","shopping","entertainment","news","docs","dev","finance","travel","learning","health","other"],
    excludedUrls: ["chrome://", "chrome-extension://", "about:"],
  };
  await send("saveSettings", { settings });
  toast("Settings saved!");
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("staleDays").addEventListener("input", e => { document.getElementById("staleVal").textContent = e.target.value; });
  document.getElementById("autoToggle").addEventListener("click", function () {
    this.classList.toggle("on");
    document.getElementById("autoLabel").textContent = this.classList.contains("on") ? "Enabled" : "Disabled";
  });
  document.getElementById("btnSave").addEventListener("click", save);
  load();
});