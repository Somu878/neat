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

function setHidden(element, hidden) {
  element.hidden = hidden;
}

async function checkAI() {
  const ai = await checkChromeAIAvailability();
  const dot = document.getElementById("aiDot");
  const title = document.getElementById("aiTitle");
  const desc = document.getElementById("aiDesc");
  const hint = document.getElementById("flagHint");

  if (ai.available) {
    dot.className = "ai-dot on";
    title.textContent = "Neat's AI nose is ready";
    desc.textContent = "Unknown tabs get sorted locally, without sending data away";
    setHidden(hint, true);
  } else if (ai.reason === "download_required") {
    dot.className = "ai-dot warn";
    title.textContent = "Neat is learning new flavors";
    desc.textContent = "Chrome AI is downloading - rules sort tabs until it is ready";
    setHidden(hint, false);
  } else {
    dot.className = "ai-dot off";
    title.textContent = "Neat is sorting by rules";
    desc.textContent = "Chrome AI is unavailable, but 80+ known sites are still covered";
    setHidden(hint, false);
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
    row.innerHTML = `<span>${esc(domain)}</span><button data-idx="${idx}" aria-label="Remove ${esc(domain)}">&times;</button>`;
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
  autoTog.setAttribute("aria-checked", String(autoTog.classList.contains("on")));
  document.getElementById("autoLabel").textContent = s.autoCleanupEnabled ? "Enabled" : "Disabled";

  const confirmTog = document.getElementById("confirmToggle");
  if (s.showConfirmModal !== false) confirmTog.classList.add("on");
  confirmTog.setAttribute("aria-checked", String(confirmTog.classList.contains("on")));
  document.getElementById("confirmLabel").textContent = confirmTog.classList.contains("on") ? "Enabled" : "Disabled";

  const sleepTog = document.getElementById("sleepToggle");
  if (s.enableSleep) sleepTog.classList.add("on");
  sleepTog.setAttribute("aria-checked", String(sleepTog.classList.contains("on")));
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
  toast("Neat's snack rules saved!");
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("staleDays").addEventListener("input", (e) => { document.getElementById("staleVal").textContent = e.target.value; });
  document.getElementById("sleepMinutes").addEventListener("input", (e) => { document.getElementById("sleepVal").textContent = e.target.value; });

  const wireSwitch = (toggleId, labelId) => {
    const toggle = document.getElementById(toggleId);
    const setState = () => {
      toggle.classList.toggle("on");
      toggle.setAttribute("aria-checked", String(toggle.classList.contains("on")));
      document.getElementById(labelId).textContent = toggle.classList.contains("on") ? "Enabled" : "Disabled";
    };
    toggle.addEventListener("click", setState);
    toggle.addEventListener("keydown", (e) => {
      if (e.key !== " " && e.key !== "Enter") return;
      e.preventDefault();
      setState();
    });
  };

  wireSwitch("autoToggle", "autoLabel");
  wireSwitch("confirmToggle", "confirmLabel");
  wireSwitch("sleepToggle", "sleepLabel");

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
