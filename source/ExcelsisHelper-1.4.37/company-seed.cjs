"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { constants } = require("node:fs");

const FORMAT = "excelsis-helper-company-seed";
const RECEIPT = ".company-seed-receipt.json";
const FILE_LIMITS = { "settings.json": 1024 * 1024, "recent-docs.json": 16 * 1024 * 1024, "index.json": 128 * 1024 * 1024 };
const FLAGS = [".thumb-cache-icon-fix-applied", ".thumb-cache-drawing-color-fix-applied"];
const sha256 = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const win = path.win32;

function plain(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function networkPath(value) {
  if (typeof value !== "string" || value.includes("/") || /[<>"|?*\x00-\x1f]/.test(value)
    || /^\\\\[?.]\\/.test(value) || /(?:^|\\)\.{1,2}(?:\\|$)/.test(value)
    || value.slice(2).includes(":")) return "";
  if (!/^(?:[A-Za-z]:\\|\\\\[^\\]+\\[^\\]+(?:\\|$))/.test(value)) return "";
  return win.normalize(value);
}

function withinRoots(value, roots) {
  const clean = networkPath(value);
  return Boolean(clean) && roots.some(root => {
    const relative = win.relative(root.toLowerCase(), clean.toLowerCase());
    return !relative || (!win.isAbsolute(relative) && relative !== ".." && !relative.startsWith("..\\"));
  });
}

function thumbnailName(documentPath) {
  const ext = win.extname(documentPath).toLowerCase();
  const salt = [".dxf", ".dwg"].includes(ext) ? "|cad-render-thumb-v2"
    : ext === ".slddrw" ? "|drawing-thumb-v2-negative-preview-fix" : "|thumb-v1";
  return crypto.createHash("sha1").update(documentPath.toLowerCase() + salt).digest("hex").slice(0, 20) + ".png";
}

async function safeRead(root, relative, maxBytes) {
  const resolvedRoot = path.resolve(root);
  let current = resolvedRoot;
  for (const segment of ["", ...relative.split("/")]) {
    current = segment ? path.join(current, segment) : current;
    const stat = await fs.lstat(current);
    if (stat.isSymbolicLink()) throw new Error("Company package contains a linked path.");
  }
  const stat = await fs.stat(current);
  if (!stat.isFile() || stat.size > maxBytes) throw new Error("Invalid company package file size.");
  const bytes = await fs.readFile(current);
  if (bytes.length > maxBytes) throw new Error("Company package file grew past its size limit.");
  return bytes;
}

async function readManifest(root) {
  let bytes;
  try { bytes = await safeRead(root, "manifest.json", 4 * 1024 * 1024); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
  const manifest = JSON.parse(bytes.toString("utf8"));
  if (!plain(manifest) || manifest.format !== FORMAT || manifest.version !== 1
    || manifest.audience !== "company-internal" || !/^[a-zA-Z0-9_-]{8,100}$/.test(manifest.id)
    || !Array.isArray(manifest.roots) || !manifest.roots.length || manifest.roots.length > 16
    || !manifest.roots.every(rootPath => networkPath(rootPath)) || !plain(manifest.files)) {
    throw new Error("Unsupported company package manifest.");
  }
  const names = Object.keys(manifest.files);
  if (names.length > 30003 || Object.keys(FILE_LIMITS).some(name => !names.includes(name))) {
    throw new Error("Incomplete company package manifest.");
  }
  for (const [name, item] of Object.entries(manifest.files)) {
    const limit = FILE_LIMITS[name] || (/^thumbnails\/[a-f0-9]{20}\.png$/.test(name) ? 8 * 1024 * 1024 : 0);
    if (!limit || !plain(item) || !/^[a-f0-9]{64}$/.test(item.sha256)
      || !Number.isSafeInteger(item.bytes) || item.bytes <= 0 || item.bytes > limit) {
      throw new Error("Unexpected company package file.");
    }
  }
  if (Object.values(manifest.files).reduce((sum, item) => sum + item.bytes, 0) > 384 * 1024 * 1024) {
    throw new Error("Company package exceeds the total data limit.");
  }
  return manifest;
}

async function verifiedFile(root, manifest, name) {
  const item = manifest.files[name];
  const bytes = await safeRead(root, name, item.bytes);
  if (bytes.length !== item.bytes || sha256(bytes) !== item.sha256) throw new Error(`Company package integrity check failed: ${name}`);
  return bytes;
}

function assertPortableSettings(settings) {
  if (!plain(settings) || !plain(settings.erp) || settings.erp.workLoggingEnabled !== false
    || settings.erp.worklogUserName !== "" || !plain(settings.solidCam)
    || Object.values(settings.solidCam).some(value => value !== "") || settings.diagnostics?.enabled !== false) {
    throw new Error("Company settings must exclude personal identity, logging and SolidCAM configuration.");
  }
  const inspect = value => {
    if (typeof value === "string" && (/[A-Za-z]:[\\/]Users[\\/]/i.test(value)
      || /[\\/]AppData[\\/]/i.test(value) || /\.(?:dll|sldreg|reg)$/i.test(value))) {
      throw new Error("Company settings contain a machine-specific path.");
    }
    if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) {
        if (/^(?:__proto__|prototype|constructor|password|token|secret|licenseKey)$/i.test(key)) {
          throw new Error("Company settings contain an unsupported field.");
        }
        inspect(child);
      }
    }
  };
  inspect(settings);
  return settings;
}

function materializeSettings(settings, folders) {
  const replace = value => {
    if (typeof value === "string" && value.startsWith("@")) {
      const match = value.match(/^@(documents|desktop|downloads)(?:\\(.*))?$/);
      if (!match || !folders[match[1]] || (match[2] && /(?:^|\\)\.{1,2}(?:\\|$)/.test(match[2]))) {
        throw new Error("Invalid company profile folder placeholder.");
      }
      return win.join(folders[match[1]], match[2] || "");
    }
    if (Array.isArray(value)) return value.map(replace);
    if (plain(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replace(item)]));
    return value;
  };
  return replace(settings);
}

async function readCompanySettings(root, folders) {
  const manifest = await readManifest(root);
  if (!manifest) return null;
  const settings = JSON.parse((await verifiedFile(root, manifest, "settings.json")).toString("utf8"));
  assertPortableSettings(settings);
  return { path: path.join(root, "settings.json"), settings: materializeSettings(settings, folders) };
}

function validateCatalogue(manifest, recent, index) {
  const validEntry = (entry, isRecent) => {
    const fields = isRecent ? ["path", "type", "title", "lastSeen", "size", "mtimeMs", "fileId"]
      : ["path", "name", "ext", "dir", "size", "mtimeMs", "fileId"];
    return plain(entry) && withinRoots(entry.path, manifest.roots)
      && Object.keys(entry).every(key => fields.includes(key))
      && (isRecent || (entry.dir === win.dirname(entry.path) && entry.name === win.basename(entry.path)
        && entry.ext === win.extname(entry.path).toLowerCase()));
  };
  if (recent.schema !== "excelsis-recent-docs-v1" || !Array.isArray(recent.entries)
    || !recent.entries.every(entry => validEntry(entry, true)) || !Array.isArray(index.entries)
    || !index.entries.every(entry => validEntry(entry, false))
    || index.schemaVersion !== 4 || !Array.isArray(index.roots) || !index.roots.every(root => withinRoots(root, manifest.roots))
    || !plain(index.dirs) || !Object.entries(index.dirs).every(([key, dir]) => plain(dir)
      && withinRoots(key, manifest.roots) && withinRoots(dir.path, manifest.roots)
      && networkPath(key).toLowerCase() === networkPath(dir.path).toLowerCase())) {
    throw new Error("Company catalogue contains records outside its approved share.");
  }
  const thumbnails = new Set([...recent.entries, ...index.entries].map(entry => `thumbnails/${thumbnailName(entry.path)}`));
  if (Object.keys(manifest.files).some(name => name.startsWith("thumbnails/") && !thumbnails.has(name))) {
    throw new Error("Company catalogue contains an unrelated thumbnail.");
  }
}

async function safeDestination(root, relative) {
  const absolute = path.resolve(root);
  const parent = path.dirname(path.join(absolute, relative));
  await fs.mkdir(absolute, { recursive: true });
  let current = absolute;
  for (const segment of ["", ...path.relative(absolute, parent).split(path.sep).filter(Boolean)]) {
    current = segment ? path.join(current, segment) : current;
    if (segment) await fs.mkdir(current).catch(error => { if (error.code !== "EEXIST") throw error; });
    if ((await fs.lstat(current)).isSymbolicLink()) throw new Error("Company import destination is linked.");
  }
  return path.join(absolute, relative);
}

async function createOnly(root, relative, bytes) {
  const target = await safeDestination(root, relative);
  try { await fs.lstat(target); return false; }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  // Exclusive creation never replaces an existing coworker's history or cache.
  // COPYFILE_EXCL also rejects linked destination files.
  const staged = path.join(path.dirname(target), `.company-stage-${crypto.randomUUID()}`);
  await fs.writeFile(staged, bytes, { flag: "wx" });
  try {
    await fs.copyFile(staged, target, constants.COPYFILE_EXCL);
    if (sha256(await fs.readFile(target)) !== sha256(bytes)) throw new Error("Company import verification failed.");
    return true;
  } catch (error) {
    if (error.code === "EEXIST") return false;
    throw error;
  } finally {
    // Only the importer's own temporary file is removed, never existing data.
    await fs.unlink(staged).catch(() => {});
  }
}

async function importCompanyCatalogue({ seedRoot, workdirRoot, searchIndexRoot }) {
  const manifest = await readManifest(seedRoot);
  if (!manifest) return { available: false, imported: false };
  try {
    // This is a new-profile starter, not a sync service. Never re-inject deleted
    // recents or reset a coworker's index when they update or restart Helper.
    await fs.lstat(path.join(workdirRoot, RECEIPT));
    return { available: true, imported: false, alreadyProcessed: true };
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  const recentBytes = await verifiedFile(seedRoot, manifest, "recent-docs.json");
  const indexBytes = await verifiedFile(seedRoot, manifest, "index.json");
  const recent = JSON.parse(recentBytes.toString("utf8"));
  const index = JSON.parse(indexBytes.toString("utf8"));
  validateCatalogue(manifest, recent, index);
  assertPortableSettings(JSON.parse((await verifiedFile(seedRoot, manifest, "settings.json")).toString("utf8")));
  const thumbs = [];
  for (const name of Object.keys(manifest.files).filter(name => name.startsWith("thumbnails/"))) {
    const bytes = await verifiedFile(seedRoot, manifest, name);
    if (bytes.length < 33 || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") throw new Error("Invalid company thumbnail.");
    thumbs.push({ name: name.slice("thumbnails/".length), bytes });
  }
  // Validate the entire bundle before changing any per-user files.
  const recentCreated = await createOnly(workdirRoot, "recent-docs.json", recentBytes);
  const indexCreated = await createOnly(searchIndexRoot, "index.json", indexBytes);
  let thumbnailsCreated = 0;
  for (const thumb of thumbs) {
    if (await createOnly(workdirRoot, path.join("recent-doc-thumbs", thumb.name), thumb.bytes)) thumbnailsCreated++;
  }
  if (recentCreated) {
    for (const flag of FLAGS) await createOnly(workdirRoot, flag, Buffer.from(new Date().toISOString()));
  }
  const receipt = { format: FORMAT, version: 1, id: manifest.id, importedAt: new Date().toISOString(),
    recentCreated, indexCreated, thumbnailsCreated };
  await createOnly(workdirRoot, RECEIPT, Buffer.from(JSON.stringify(receipt, null, 2) + "\n"));
  return { available: true, imported: recentCreated || indexCreated || thumbnailsCreated > 0, ...receipt };
}

module.exports = { FORMAT, RECEIPT, withinRoots, thumbnailName, assertPortableSettings,
  readManifest, readCompanySettings, validateCatalogue, importCompanyCatalogue };
