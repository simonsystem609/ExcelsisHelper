"use strict";

const updater = window.excelsisUpdater;
const refreshButton = document.getElementById("refresh");
const statusLine = document.getElementById("status");
const rows = new Map([...document.querySelectorAll("[data-product]")].map(row => [row.dataset.product, row]));
let active = null;
let refreshing = false;
let lastCheck = 0;
let lastCatalog = null;

function status(text, failed = false) {
  statusLine.textContent = String(text || "");
  statusLine.classList.toggle("error", failed);
}

function renderRow(key, info = {}) {
  const row = rows.get(key);
  const action = row.querySelector(".install");
  const progress = row.querySelector("progress");
  const version = row.querySelector(".version");
  const detail = row.querySelector(".detail");
  progress.classList.remove("active");
  progress.value = 0;
  const current = info.installedVersion || (info.installedVersionKnown === false ? "Unknown" : "Not installed");
  const descriptions = { "up-to-date": "Up to date", "update-available": "Update available", "not-installed": "Not installed",
    "newer-installed": "Installed version is newer than the public release", unknown: "Could not check safely" };
  if (key === "macros") {
    version.textContent = `Helper: ${current} | Macro revision: ${info.revision || "unavailable"}`;
    detail.textContent = info.error || info.detail || "No compatible public macro revision.";
    action.textContent = info.canInstall ? "Update macros" : info.status === "up-to-date" ? "Macros up to date" : "Unavailable";
  } else {
    version.textContent = `Installed: ${current} | Latest: ${info.latestVersion || "unavailable"}`;
    detail.textContent = info.error || [descriptions[info.status] || "Checking...", info.assetName,
      info.size ? `${(info.size / (1024 * 1024)).toFixed(1)} MiB` : ""].filter(Boolean).join(" | ");
    action.textContent = info.canInstall ? info.status === "not-installed" ? "Install" : "Update"
      : info.error ? "Unavailable" : "No update needed";
  }
  action.disabled = active !== null || Boolean(lastCatalog?.busyProduct) || !info.canInstall;
  action.onclick = () => install(key);
}

function render(catalog) {
  lastCatalog = catalog;
  for (const key of ["viewer", "helper"]) renderRow(key, catalog.products?.find(item => item.key === key));
  renderRow("macros", catalog.macros);
}

async function refresh(force = false, keepStatus = false) {
  if (active || refreshing) return;
  refreshing = true;
  refreshButton.disabled = true;
  if (!keepStatus) status("Checking public releases...");
  try {
    if (!updater?.getCatalog) throw new Error("The Update Center connection is unavailable.");
    render(await updater.getCatalog(force));
    if (!keepStatus) status("Release check complete.");
    lastCheck = Date.now();
  } catch (error) { status(error.message || "Update check failed.", true); }
  finally { refreshing = false; refreshButton.disabled = false; }
}

async function install(key) {
  if (active || refreshing) return;
  active = key;
  refreshButton.disabled = true;
  for (const row of rows.values()) row.querySelector(".install").disabled = true;
  status("Preparing update...");
  try {
    const result = await updater.install(key);
    if (result.cancelled) status("Update cancelled.");
    else if (result.deferred) status("Macro update deferred. Close SOLIDWORKS before retrying.");
    else if (key === "macros") status(result.alreadyCurrent ? "Macros are already current." : `Macro revision ${result.revision} installed. Restart SOLIDWORKS before use.`);
    else status(`Verified installer opened: ${result.path}`);
  } catch (error) { status(error.message || "Update failed.", true); }
  finally {
    active = null;
    refreshButton.disabled = false;
    if (lastCatalog) render(lastCatalog);
    await refresh(false, true);
  }
}

updater?.onProgress?.(event => {
  const row = rows.get(event?.productKey);
  if (!row || event.productKey !== active) return;
  const progress = row.querySelector("progress");
  progress.classList.add("active");
  progress.value = Math.max(0, Math.min(100, Number(event.percent) || 0));
  row.querySelector(".detail").textContent = String(event.message || "Working...");
});
refreshButton.addEventListener("click", () => refresh(true));
window.addEventListener("focus", () => { if (Date.now() - lastCheck > 60000) refresh(true); });
refresh();
