"use strict";

const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const path = require("node:path");
const https = require("node:https");
const crypto = require("node:crypto");
const {
  APP_LIMIT, MACRO_LIMIT, MACRO_FILES, product, compareVersions, versionStatus, apiUrl,
  appRelease, latestMacros, macroTag, downloadHost,
} = require("./update-releases.cjs");

const JSON_LIMIT = 2 * 1024 * 1024;
const CACHE_MS = 6 * 60 * 60 * 1000;
const MARKER = ".bundled-macros.json";
const RECEIPT = ".verified-macro-update.json";
const digest = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const clone = value => JSON.parse(JSON.stringify(value));

function githubTransport(version) {
  const api = new Set([apiUrl("viewer"), apiUrl("helper"), apiUrl("helper", true)]);
  const headers = { "User-Agent": `Excelsis-Helper/${version}`, "Accept-Encoding": "identity" };
  function request(url, isApi) {
    if (isApi ? !api.has(url) : !downloadHost(url)) return Promise.reject(new Error("Unapproved update host or endpoint."));
    return new Promise((resolve, reject) => {
      const req = https.get(url, { headers: { ...headers, Accept: isApi ? "application/vnd.github+json" : "application/octet-stream",
        ...(isApi ? { "X-GitHub-Api-Version": "2022-11-28" } : {}) }, timeout: 30000 }, res => {
        const deadline = setTimeout(() => res.destroy(new Error("Update response exceeded its time limit.")), isApi ? 30000 : 20 * 60 * 1000);
        deadline.unref?.();
        res.once("close", () => clearTimeout(deadline));
        resolve(res);
      });
      req.once("timeout", () => req.destroy(new Error("Update request timed out.")));
      req.once("error", reject);
    });
  }
  return {
    async json(url) {
      const res = await request(url, true);
      if (res.statusCode !== 200) { res.resume(); throw new Error(`GitHub update lookup returned HTTP ${res.statusCode}.`); }
      const bytes = await boundedBody(res, JSON_LIMIT);
      try { return JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/, "")); }
      catch { throw new Error("GitHub returned invalid update metadata."); }
    },
    async stream(url) {
      for (let count = 0; count <= 5; count++) {
        const res = await request(url, false);
        if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
          const target = res.headers.location;
          res.resume();
          if (!target) throw new Error("GitHub returned an empty download redirect.");
          url = new URL(target, url).href;
        } else {
          if (res.statusCode !== 200) { res.resume(); throw new Error(`Update download returned HTTP ${res.statusCode}.`); }
          return res;
        }
      }
      throw new Error("Too many update download redirects.");
    },
  };
}

async function boundedBody(stream, maximum) {
  const length = stream.headers?.["content-length"];
  if (length !== undefined && (!/^\d+$/.test(String(length)) || Number(length) > maximum)) {
    stream.destroy(); throw new Error("Update response is larger than its allowed size.");
  }
  let size = 0;
  const chunks = [];
  try {
    for await (const value of stream) {
      const chunk = Buffer.from(value);
      size += chunk.length;
      if (size > maximum) throw new Error("Update response exceeded its allowed size.");
      chunks.push(chunk);
    }
  } catch (error) { stream.destroy(); throw error; }
  return Buffer.concat(chunks, size);
}

async function ordinaryDirectory(folder) {
  const stat = await fs.lstat(folder);
  if (!stat.isDirectory() || stat.isSymbolicLink() || path.resolve(await fs.realpath(folder)).toLowerCase() !== path.resolve(folder).toLowerCase()) {
    throw new Error("The update destination is redirected or is not a directory.");
  }
}

async function ordinaryFile(file, maximum) {
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maximum
    || path.resolve(await fs.realpath(file)).toLowerCase() !== path.resolve(file).toLowerCase()) {
    throw new Error("An update file is redirected or has an unsafe size.");
  }
  return stat;
}

async function jsonFile(file, maximum) {
  await ordinaryFile(file, maximum);
  return JSON.parse((await fs.readFile(file, "utf8")).replace(/^\uFEFF/, ""));
}

async function inspectMacros(documents, version, names) {
  const helper = path.join(await fs.realpath(documents), "Excelsis Helper");
  const root = path.join(helper, "Macros");
  await ordinaryDirectory(helper);
  await ordinaryDirectory(root);
  const marker = await jsonFile(path.join(root, MARKER), 65536);
  if (marker.schema !== "excelsis-bundled-macros-v2" || marker.appVersion !== version || !Array.isArray(marker.files)) {
    throw new Error("Finish Helper's bundled macro setup first. Close SOLIDWORKS and restart Helper if setup is pending.");
  }
  const allowed = new Set(MACRO_FILES.map(pair => pair[0]));
  const files = [];
  for (const name of names) {
    if (!allowed.has(name) || !marker.files.includes(name)) throw new Error("The revision names a macro outside this Helper installation.");
    const file = path.join(root, name);
    const stat = await ordinaryFile(file, MACRO_LIMIT);
    if (stat.size < 512) throw new Error("An installed macro is not a valid SWP project.");
    files.push({ name, sha256: digest(await fs.readFile(file)) });
  }
  let receipt = null;
  try { receipt = await jsonFile(path.join(root, RECEIPT), 65536); }
  catch (error) { if (error.code !== "ENOENT") throw new Error("The macro update receipt is unreadable; no macro was replaced."); }
  return { root, files, receipt };
}

async function installerMatches(file, asset) {
  try {
    const stat = await ordinaryFile(file, APP_LIMIT);
    if (stat.size !== asset.size) return false;
    const handle = await fs.open(file, "r");
    const hash = crypto.createHash("sha256");
    const buffer = Buffer.alloc(256 * 1024);
    let first = true, total = 0;
    try {
      for (;;) {
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
        if (!bytesRead) break;
        total += bytesRead;
        if (total > asset.size) return false;
        if (first && buffer.toString("ascii", 0, 2) !== "MZ") return false;
        first = false;
        hash.update(buffer.subarray(0, bytesRead));
      }
    } finally { await handle.close(); }
    return !first && total === asset.size && hash.digest("hex") === asset.sha256;
  } catch (error) { if (error.code === "ENOENT") return false; throw error; }
}

function createUpdateService(options) {
  const transport = options.transport || githubTransport(options.version);
  const now = options.now || Date.now;
  let catalog = { checkedAt: null, products: [], macros: { status: "unchecked", canInstall: false }, hasUpdates: false };
  let checkTask = null;
  let job = null;
  let helperInstallerOpened = false;
  const snapshot = () => clone({ ...catalog, busyProduct: job?.key || null });
  const broadcast = () => { try { options.onCatalog?.(snapshot()); } catch {} };
  const progress = (key, percent, message) => { try { options.onProgress?.({ productKey: key, percent, message }); } catch {} };
  const ensureActive = () => { if (job?.cancelled) throw new Error("Update cancelled before installation."); };
  const readVersion = key => key === "helper" ? Promise.resolve(options.version) : options.readInstalledVersion(key);
  const fetchApp = async key => appRelease(key, await transport.json(apiUrl(key)));
  const fetchMacros = async version => latestMacros(await transport.json(apiUrl("helper", true)), version);

  async function macroInfo() {
    const installedVersion = options.version;
    const info = { installedVersion, status: "unknown", canInstall: false };
    try {
      if (helperInstallerOpened) return { ...info, status: "requires-restart", detail: "Finish the Helper installer and restart Helper before updating macros." };
      if (compareVersions(installedVersion, "1.4.19") === null || compareVersions(installedVersion, "1.4.19") < 0) {
        return { ...info, status: "requires-helper", detail: "Helper 1.4.19 or newer is required." };
      }
      const release = await fetchMacros(installedVersion);
      if (!release) return { ...info, status: "unavailable", detail: "No compatible public macro revision is published." };
      const installed = await inspectMacros(options.documents, installedVersion, release.files.map(file => file.name));
      const pending = release.files.filter(file => installed.files.find(local => local.name === file.name).sha256 !== file.sha256);
      const receiptTag = macroTag(installed.receipt?.tag);
      const alreadyNewer = installed.receipt?.helperVersion === installedVersion && receiptTag
        && (receiptTag.date > release.date || (receiptTag.date === release.date && receiptTag.sequence > release.sequence));
      if (alreadyNewer) return { ...info, status: "newer-installed", revision: installed.receipt.revision, detail: "A newer macro revision is already installed." };
      return { ...info, revision: release.revision, tag: release.tag, status: pending.length ? "update-available" : "up-to-date",
        canInstall: pending.length > 0, detail: pending.length ? `${pending.length} macro file(s) differ; originals will be backed up.` : "Installed macro hashes match the compatible revision." };
    } catch (error) { return { ...info, error: error.message }; }
  }

  async function check({ force = false } = {}) {
    if (job) return snapshot();
    if (checkTask) return checkTask;
    const age = catalog.checkedAt === null ? Infinity : now() - catalog.checkedAt;
    if (age >= 0 && age < (force ? 5000 : CACHE_MS)) return snapshot();
    checkTask = (async () => {
      const products = [];
      for (const key of ["viewer", "helper"]) {
        let installedVersion = null;
        let installedVersionKnown = false;
        try {
          installedVersion = await readVersion(key);
          installedVersionKnown = true;
          const update = await fetchApp(key);
          const status = versionStatus(installedVersion, update.version);
          products.push({ key, displayName: update.title, installedVersion, latestVersion: update.version, releaseLabel: update.label,
            tag: update.tag, assetName: update.asset.name, size: update.asset.size, status,
            canInstall: status === "update-available" || status === "not-installed" });
        } catch (error) { products.push({ key, displayName: product(key).title, installedVersion, installedVersionKnown, status: "unknown", canInstall: false, error: error.message }); }
      }
      const macros = await macroInfo();
      catalog = { products, macros, checkedAt: now(), hasUpdates: products.some(item => item.status === "update-available") || macros.status === "update-available" };
      broadcast();
      return snapshot();
    })();
    try { return await checkTask; } finally { checkTask = null; }
  }

  async function download(asset, target, key, start = 0, span = 90) {
    const res = await transport.stream(asset.url);
    const declared = res.headers?.["content-length"];
    if (declared !== undefined && (!/^\d+$/.test(String(declared)) || Number(declared) !== asset.size)) {
      res.destroy(); throw new Error("Download size disagrees with the immutable release.");
    }
    let file;
    try { file = await fs.open(target, "wx", 0o600); }
    catch (error) { res.destroy(); throw error; }
    const hash = crypto.createHash("sha256");
    let total = 0, last = -1;
    try {
      for await (const value of res) {
        ensureActive();
        const bytes = Buffer.from(value);
        total += bytes.length;
        if (total > asset.size) throw new Error("Download exceeded its verified size.");
        hash.update(bytes);
        let offset = 0;
        while (offset < bytes.length) {
          const { bytesWritten } = await file.write(bytes, offset, bytes.length - offset);
          if (!bytesWritten) throw new Error("The update staging file could not be written.");
          offset += bytesWritten;
        }
        const percent = Math.floor(start + total / asset.size * span);
        if (percent !== last) { progress(key, percent, `Downloading ${asset.name}`); last = percent; }
      }
      await file.sync();
      if (total !== asset.size || hash.digest("hex") !== asset.sha256) throw new Error("Downloaded update failed size or SHA-256 verification.");
    } catch (error) { res.destroy(); throw error; }
    finally { await file.close(); }
  }

  async function appInstall(key) {
    if (key === "helper" && helperInstallerOpened) throw new Error("The Helper installer was already opened. Finish setup and restart Helper first.");
    const release = await fetchApp(key);
    const installed = await readVersion(key);
    const state = versionStatus(installed, release.version);
    if (!["not-installed", "update-available"].includes(state)) throw new Error("The installed version is current, newer, or cannot be safely compared.");
    if (!await options.confirm({ kind: "app", key, title: release.title, version: release.version })) return { ok: false, cancelled: true };
    ensureActive();
    await fs.mkdir(options.downloads, { recursive: true });
    const directory = await fs.realpath(options.downloads);
    const numbered = index => path.join(directory, index ? `${release.asset.name.slice(0, -4)} (${index}).exe` : release.asset.name);
    let target;
    for (let i = 0; i <= 20; i++) {
      if (await installerMatches(numbered(i), release.asset)) { target = numbered(i); break; }
    }
    if (!target) {
      const staged = path.join(directory, `.excelsis-update-${crypto.randomUUID()}.part`);
      try {
        await download(release.asset, staged, key);
        if (!await installerMatches(staged, release.asset)) throw new Error("Downloaded file is not the verified Windows installer.");
        ensureActive();
        for (let i = 0; i <= 200; i++) {
          try { await fs.copyFile(staged, numbered(i), fsSync.constants.COPYFILE_EXCL); target = numbered(i); break; }
          catch (error) { if (error.code !== "EEXIST") throw error; }
        }
        if (!target) throw new Error("Too many conflicting installer filenames in Downloads.");
      } finally { await fs.unlink(staged).catch(() => {}); }
    }
    ensureActive();
    if (!await installerMatches(target, release.asset)) throw new Error("Installer changed before launch; it was not opened.");
    ensureActive();
    const error = await options.openInstaller(target);
    if (error) throw new Error(`Windows could not open the installer: ${error}`);
    if (key === "helper") helperInstallerOpened = true;
    progress(key, 100, "Verified installer opened.");
    return { ok: true, path: target, tag: release.tag };
  }

  async function macroInstall() {
    if (helperInstallerOpened) throw new Error("Finish the Helper installer and restart Helper before updating macros.");
    if (await options.isMacroBusy()) throw new Error("A SOLIDWORKS macro/capture is running. Wait for it to finish before updating macros.");
    const release = await fetchMacros(options.version);
    if (!release) throw new Error("No compatible public macro revision is published.");
    const installed = await inspectMacros(options.documents, options.version, release.files.map(file => file.name));
    const receiptTag = macroTag(installed.receipt?.tag);
    if (installed.receipt?.helperVersion === options.version && receiptTag
      && (receiptTag.date > release.date || (receiptTag.date === release.date && receiptTag.sequence > release.sequence))) {
      throw new Error("A newer macro revision is installed; downgrade refused.");
    }
    const pending = release.files.filter(asset => installed.files.find(file => file.name === asset.name).sha256 !== asset.sha256);
    if (!pending.length) return { ok: true, alreadyCurrent: true, revision: release.revision };
    if (!await options.confirm({ kind: "macros", revision: release.revision, names: pending.map(asset => asset.name) })) return { ok: false, cancelled: true };
    ensureActive();
    const staging = path.join(options.stagingRoot, crypto.randomUUID());
    await fs.mkdir(staging, { recursive: true });
    await ordinaryDirectory(staging);
    const files = [];
    try {
      const totalSize = pending.reduce((sum, asset) => sum + asset.size, 0);
      let downloadedSize = 0;
      for (const asset of pending) {
        const target = path.join(staging, asset.name);
        await download(asset, target, "macros", downloadedSize / totalSize * 90, asset.size / totalSize * 90);
        downloadedSize += asset.size;
        const bytes = await fs.readFile(target);
        if (bytes.length < 512 || bytes.subarray(0, 8).toString("hex") !== "d0cf11e0a1b11ae1") throw new Error("Downloaded macro is not a SWP compound project.");
        files.push({ name: asset.name, sha256: asset.sha256, size: asset.size,
          previousSha256: installed.files.find(file => file.name === asset.name).sha256 });
      }
      const request = { schema: "excelsis-helper-macro-request-v1", helperVersion: options.version,
        revision: release.revision, tag: release.tag, stagingRoot: await fs.realpath(staging), files };
      const requestPath = path.join(staging, "request.json");
      const requestBytes = Buffer.from(JSON.stringify(request));
      await fs.writeFile(requestPath, requestBytes, { flag: "wx", mode: 0o600 });
      for (;;) {
        ensureActive();
        if (await options.isMacroBusy()) throw new Error("A SOLIDWORKS macro/capture started; no macros were replaced.");
        progress("macros", 95, "Backing up and replacing verified macros...");
        const result = await options.applyMacros({ requestPath, requestSha256: digest(requestBytes) });
        if (result.ok) { progress("macros", 100, "Verified macros installed. Restart SOLIDWORKS before use."); return { ...result, revision: release.revision }; }
        if (result.code !== "locked") throw new Error(result.error || "Macro update failed; check the backup record.");
        if (!await options.retryLocked(result.error)) return { ok: false, deferred: true, revision: release.revision };
      }
    } finally {
      // Remove only files created by this job, never an installed macro or backup.
      for (const name of [...files.map(file => file.name), ...pending.map(file => file.name), "request.json"]) {
        await fs.unlink(path.join(staging, name)).catch(() => {});
      }
    }
  }

  async function install(key) {
    if (key !== "macros") product(key);
    if (job) throw new Error("An update is already in progress.");
    if (checkTask) await checkTask;
    if (job) throw new Error("An update is already in progress.");
    job = { key, cancelled: false };
    broadcast();
    try { return key === "macros" ? await macroInstall() : await appInstall(key); }
    finally { job = null; catalog.checkedAt = null; broadcast(); }
  }

  return { check, snapshot, install, cancel: () => { if (job) job.cancelled = true; }, isBusy: () => Boolean(job) };
}

module.exports = { CACHE_MS, RECEIPT, githubTransport, boundedBody, inspectMacros, installerMatches, createUpdateService };
