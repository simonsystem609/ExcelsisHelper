"use strict";

const path = require("node:path");
const fs = require("node:fs/promises");
const { fileURLToPath } = require("node:url");
const { product, versionParts, compareVersions } = require("./update-releases.cjs");
const { CACHE_MS, createUpdateService } = require("./update-service.cjs");

function createUpdateCenterHost(options) {
  const { app, BrowserWindow, ipcMain, dialog, shell } = options;
  const entry = path.join(options.entryRoot, "update-center.html");
  let window = null;
  let firstTimer = null, repeatTimer = null;
  const run = (file, args, extra = {}) => new Promise((resolve, reject) => {
    options.execFile(file, args, { windowsHide: true, encoding: "utf8", maxBuffer: 65536, ...extra }, (error, stdout) => {
      if (error) reject(error); else resolve(String(stdout || ""));
    });
  });

  async function readInstalledVersion(key) {
    if (key !== "viewer") throw new Error("Only the companion Viewer's installed version is queried.");
    if (process.platform !== "win32") return null;
    const guid = product(key).registryId;
    const command = `$ErrorActionPreference='Stop'; [Console]::OutputEncoding=New-Object Text.UTF8Encoding($false); $versions=@();
foreach($hive in @([Microsoft.Win32.RegistryHive]::LocalMachine,[Microsoft.Win32.RegistryHive]::CurrentUser)) {
 foreach($view in @([Microsoft.Win32.RegistryView]::Registry64,[Microsoft.Win32.RegistryView]::Registry32)) {
  $base=$null; $key=$null;
  try { $base=[Microsoft.Win32.RegistryKey]::OpenBaseKey($hive,$view); $key=$base.OpenSubKey('Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${guid}',$false);
   if($key) { $value=[string]$key.GetValue('DisplayVersion'); if(-not $value) { throw 'Installed Viewer has no DisplayVersion.' }; $versions+=$value }
  } finally { if($key){$key.Dispose()}; if($base){$base.Dispose()} }
 }
}
@{versions=@($versions)} | ConvertTo-Json -Compress`;
    const result = JSON.parse((await run(options.powershell, options.powerShellArgs("-Command", command), { timeout: 15000 })).replace(/^\uFEFF/, ""));
    if (!Array.isArray(result.versions) || !result.versions.every(versionParts)) throw new Error("Could not safely compare the installed Viewer version.");
    return result.versions.reduce((best, version) => best === null || compareVersions(version, best) > 0 ? version : best, null);
  }

  const service = createUpdateService({
    version: app.getVersion(), documents: app.getPath("documents"), downloads: app.getPath("downloads"),
    stagingRoot: path.join(app.getPath("userData"), "update-staging"), readInstalledVersion,
    onCatalog: options.onAvailability,
    onProgress: progress => {
      if (window && !window.isDestroyed() && !window.webContents.isDestroyed()) window.webContents.send("updates:progress", progress);
    },
    isMacroBusy: options.isMacroBusy,
    openInstaller: file => shell.openPath(file),
    async confirm(request) {
      if (!window || window.isDestroyed()) return false;
      const macro = request.kind === "macros";
      const result = await dialog.showMessageBox(window, {
        type: "question", title: macro ? "Update Helper macros" : "Run verified installer",
        message: macro ? `Install macro revision ${request.revision}?` : `Download and run ${request.title} ${request.version}?`,
        detail: macro
          ? `These SWPs will be replaced after verified backups:\n\n${request.names.join("\n")}\n\nSave SOLIDWORKS work first. Settings, worklogs and other files are not replaced.`
          : "The installer is checked against the immutable GitHub release's SHA-256 digest before Windows opens it. Windows may show UAC or SmartScreen. Existing user settings and data are kept by normal installer upgrades.",
        buttons: [macro ? "Update macros" : "Download and run", "Cancel"], defaultId: 1, cancelId: 1, noLink: true,
      });
      return result.response === 0;
    },
    async retryLocked(error) {
      if (!window || window.isDestroyed()) return false;
      const result = await dialog.showMessageBox(window, {
        type: "warning", title: "SOLIDWORKS macro is locked",
        message: "Save your work and close SOLIDWORKS completely, including its VBA editor.",
        detail: `Neither a locked macro nor an unrelated file was overwritten. Choose Retry after closing SOLIDWORKS, or Later to keep your current macros.\n\n${String(error).slice(0, 1500)}`,
        buttons: ["Retry", "Later"], defaultId: 1, cancelId: 1, noLink: true,
      });
      return result.response === 0;
    },
    async applyMacros(request) {
      if (await options.isMacroBusy()) throw new Error("A SOLIDWORKS macro or capture is running; update deferred.");
      await options.beginMacroUpdate();
      try {
        const stdout = await run(options.powershell, options.powerShellArgs("-File", options.assetPath("scripts", "apply-macro-update.ps1"),
          "-RequestPath", request.requestPath, "-RequestSha256", request.requestSha256,
          "-DocumentsPath", await fs.realpath(app.getPath("documents"))));
        return JSON.parse(stdout.replace(/^\uFEFF/, ""));
      } finally { await options.endMacroUpdate(); }
    },
  });

  function trusted(event) {
    if (!window || window.isDestroyed() || event?.sender !== window.webContents || event.sender.isDestroyed()
      || event.senderFrame !== event.sender.mainFrame) return false;
    try {
      const url = new URL(event.senderFrame.url);
      return url.protocol === "file:" && !url.search && !url.hash
        && path.resolve(fileURLToPath(url)).toLowerCase() === path.resolve(entry).toLowerCase();
    } catch { return false; }
  }
  const handle = (channel, callback) => ipcMain.handle(channel, (event, ...args) => {
    if (!trusted(event)) throw new Error("Blocked untrusted Update Center request.");
    return callback(...args);
  });
  handle("updates:catalog", request => service.check({ force: request?.force === true }));
  handle("updates:install", async key => {
    const result = await service.install(key);
    service.check({ force: true }).catch(() => {});
    return result;
  });

  function open() {
    if (window && !window.isDestroyed()) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); return { ok: true }; }
    window = new BrowserWindow({
      title: "Excelsis Update Center", width: 780, height: 660, minWidth: 480, minHeight: 480,
      parent: options.mainWindow() || undefined, show: false, autoHideMenuBar: true,
      backgroundColor: "#f4f7fb", icon: options.assetPath("build", "icon.ico"),
      webPreferences: { preload: path.join(options.entryRoot, "update-center-preload.cjs"), contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    const created = window;
    options.scheduleEcoQos();
    created.setMenu(null);
    created.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    created.webContents.on("will-navigate", event => event.preventDefault());
    created.webContents.on("will-attach-webview", event => event.preventDefault());
    created.once("ready-to-show", () => created.show());
    created.on("closed", () => { if (window === created) { window = null; service.cancel(); } });
    created.loadFile(entry);
    return { ok: true };
  }

  function start() {
    if (firstTimer || repeatTimer) return;
    firstTimer = setTimeout(() => { firstTimer = null; service.check().catch(() => {}); }, 15000);
    repeatTimer = setInterval(() => service.check().catch(() => {}), CACHE_MS);
    firstTimer.unref?.(); repeatTimer.unref?.();
  }
  function stop() {
    clearTimeout(firstTimer); clearInterval(repeatTimer);
    firstTimer = null; repeatTimer = null;
    service.cancel();
  }
  return { open, start, stop, summary: service.snapshot, service };
}

module.exports = { createUpdateCenterHost };
