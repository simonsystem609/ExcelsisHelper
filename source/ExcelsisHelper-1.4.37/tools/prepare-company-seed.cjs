"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { FORMAT, withinRoots, thumbnailName, assertPortableSettings, validateCatalogue } = require("../company-seed.cjs");
const win = path.win32;
const sha256 = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const copyFields = (source, keys) => Object.fromEntries(keys.filter(key => source?.[key] !== undefined)
  .map(key => [key, source[key]]));

function portableSettings(raw, sharedRoots) {
  const source = raw.settings || raw;
  const omitted = new Set();
  const portablePath = (value, field, profileFolders = false) => {
    if (!value) return "";
    const clean = String(value).trim().replace(/\//g, "\\");
    if (profileFolders) {
      const match = clean.match(/^[A-Za-z]:\\Users\\[^\\]+\\(Documents|Desktop|Downloads)(?:\\(.*))?$/i);
      if (match && !/(?:^|\\)\.{1,2}(?:\\|$)/.test(match[2] || "")) {
        return `@${match[1].toLowerCase()}${match[2] ? `\\${match[2]}` : ""}`;
      }
    }
    if (withinRoots(clean, sharedRoots)) return clean;
    omitted.add(field);
    return "";
  };
  const paths = (values, field) => Array.isArray(values)
    ? [...new Set(values.map(value => portablePath(value, field, true)).filter(Boolean))] : [];
  const template = String(source.macros?.drawingTemplate || "").trim().replace(/\//g, "\\");
  const standardTemplate = /^[A-Za-z]:\\ProgramData\\SOLIDWORKS\\/i.test(template)
    && /\.drwdot$/i.test(template) && !/(?:^|\\)\.{1,2}(?:\\|$)/.test(template);
  const settings = {
    ...copyFields(source, ["uiLanguage", "bomExportLanguage"]),
    hotkeys: copyFields(source.hotkeys, ["enabled", "pasteProjectDate", "copyExplorerPath", "exportCadGlb",
      "macroShortcuts", "projectPrefix", "projectDateTemplate", "projectDateFormat"]),
    erp: {
      ...copyFields(source.erp, ["worklogDocMinMinutes", "overtimeStartTime"]),
      workLoggingEnabled: false, worklogUserName: "",
      worklogInbox: portablePath(source.erp?.worklogInbox, "erp.worklogInbox"),
      worklogWorktypes: portablePath(source.erp?.worklogWorktypes, "erp.worklogWorktypes"),
    },
    cadExport: { inbox: portablePath(source.cadExport?.inbox, "cadExport.inbox") },
    activity: copyFields(source.activity, ["solidWorksIdlePauseMinutes", "recentDocsNewEntryBurstSeconds"]),
    diagnostics: { enabled: false },
    recentDocsFolder: {
      ...copyFields(source.recentDocsFolder, ["copyLabel", "openLabel"]),
      path: portablePath(source.recentDocsFolder?.path, "recentDocsFolder.path"),
    },
    projectFolders: Object.fromEntries(["company", "tools"].map(id => [id, {
      ...copyFields(source.projectFolders?.[id], ["name", "prefix"]),
      root: portablePath(source.projectFolders?.[id]?.root, `projectFolders.${id}.root`),
    }])),
    cam: {
      ...copyFields(source.cam, ["folderMode"]),
      outputRoot: portablePath(source.cam?.outputRoot, "cam.outputRoot"),
      searchRoots: paths(source.cam?.searchRoots, "cam.searchRoots"),
    },
    macros: {
      ...copyFields(source.macros, ["dxfOutputPrefix", "defaultMaterial"]),
      drawingTemplate: standardTemplate ? template : portablePath(template, "macros.drawingTemplate"),
    },
    solidCam: { selectedDllPath: "", selectedTitle: "", selectedClsid: "" },
    locations: {
      ...copyFields(source.locations, ["projectRootNames", "projectCodePrefixes"]),
      searchRoots: paths(source.locations?.searchRoots, "locations.searchRoots"),
      exclusions: paths(source.locations?.exclusions, "locations.exclusions"),
    },
    gcode: {
      ...copyFields(source.gcode, ["materials", "toolMaterials", "defaultMillingToolMaterial", "defaultDrillToolMaterial",
        "defaultTapToolMaterial", "machineMaxRpm", "machineMaxFeedMmMin", "defaultAggressiveness", "defaultAePercent",
        "defaultCoolingMode", "defaultContactMode", "defaultFluteCount", "optimizedSuffix"]),
      searchRoot: portablePath(source.gcode?.searchRoot, "gcode.searchRoot"),
    },
  };
  assertPortableSettings(settings);
  return { settings, omitted: [...omitted].sort() };
}

async function stableJson(file) {
  if ((await fs.lstat(file)).isSymbolicLink()) throw new Error("Linked source data is not supported.");
  for (let attempt = 0; attempt < 4; attempt++) {
    const a = await fs.readFile(file);
    const b = await fs.readFile(file);
    if (!a.equals(b)) continue;
    try { return { value: JSON.parse(a.toString("utf8").replace(/^\uFEFF/, "")), sha256: sha256(a) }; }
    catch (error) { if (attempt === 3) throw error; }
  }
  throw new Error("Live catalogue changed during the snapshot; retry preparation.");
}

function catalogueEntry(entry, recent = false) {
  const file = win.normalize(entry.path);
  return {
    path: file,
    ...(recent ? { type: entry.type, title: entry.title || win.basename(file), lastSeen: Number(entry.lastSeen || 0) }
      : { name: win.basename(file), ext: win.extname(file).toLowerCase(), dir: win.dirname(file) }),
    size: Math.max(0, Number(entry.size || 0)), mtimeMs: Math.max(0, Number(entry.mtimeMs || 0)),
    fileId: String(entry.fileId || ""),
  };
}

async function prepareCompanySeed(options) {
  const destination = path.resolve(options.destination);
  // A fresh output is mandatory: it cannot accidentally retain a personal log,
  // setup file or thumbnail from a previous preparation attempt.
  await fs.mkdir(destination, { recursive: false });
  const settingsSource = await stableJson(options.settings);
  const recentSource = await stableJson(options.recents);
  const indexSource = await stableJson(options.index);
  if (indexSource.value.schemaVersion !== 4 || !Array.isArray(indexSource.value.entries)
    || recentSource.value.schema !== "excelsis-recent-docs-v1" || !Array.isArray(recentSource.value.entries)) {
    throw new Error("Unsupported source catalogue schema.");
  }
  const roots = options.roots;
  const profile = portableSettings(settingsSource.value, options.settingsRoots || roots);
  const exclusions = profile.settings.locations.exclusions.filter(value => !value.startsWith("@"))
    .flatMap(exclusion => [exclusion, ...roots.filter(root => withinRoots(exclusion, [root]))
      .flatMap(root => roots.map(alias => win.join(alias, win.relative(root, exclusion))))]);
  const keep = value => withinRoots(value, roots) && !exclusions.some(exclusion => withinRoots(value, [exclusion]));
  const recent = { schema: "excelsis-recent-docs-v1",
    entries: recentSource.value.entries.filter(entry => keep(entry.path)).map(entry => catalogueEntry(entry, true)) };
  const index = {
    schemaVersion: 4, generatedAt: Number(indexSource.value.generatedAt || 0), updatedAt: Number(indexSource.value.updatedAt || 0),
    roots: indexSource.value.roots.filter(keep),
    entries: indexSource.value.entries.filter(entry => keep(entry.path)).map(entry => catalogueEntry(entry)),
    dirs: Object.fromEntries(Object.values(indexSource.value.dirs || {}).filter(dir => keep(dir?.path))
      .map(dir => [win.normalize(dir.path).toLowerCase(), {
        path: win.normalize(dir.path), mtimeMs: Number(dir.mtimeMs || 0), checkedAt: Number(dir.checkedAt || 0),
      }])),
  };
  const manifest = { format: FORMAT, version: 1, audience: "company-internal",
    id: `company-${crypto.randomUUID()}`, createdAt: new Date().toISOString(), roots, files: {} };
  const write = async (name, bytes) => {
    await fs.mkdir(path.dirname(path.join(destination, name)), { recursive: true });
    await fs.writeFile(path.join(destination, name), bytes, { flag: "wx" });
    manifest.files[name] = { bytes: bytes.length, sha256: sha256(bytes) };
  };
  await write("settings.json", Buffer.from(JSON.stringify(profile.settings, null, 2) + "\n"));
  await write("recent-docs.json", Buffer.from(JSON.stringify(recent) + "\n"));
  await write("index.json", Buffer.from(JSON.stringify(index) + "\n"));
  let manualThumbnails = 0;
  const availableThumbnails = new Set(await fs.readdir(options.thumbnails));
  for (const name of new Set([...recent.entries, ...index.entries].map(entry => thumbnailName(entry.path)))) {
    let bytes;
    let manual = false;
    for (const candidate of [`${name}.manual.png`, name]) {
      if (!availableThumbnails.has(candidate)) continue;
      try {
        const file = path.join(options.thumbnails, candidate);
        const stat = await fs.lstat(file);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 33 || stat.size > 8 * 1024 * 1024) continue;
        bytes = await fs.readFile(file);
        if (bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") { bytes = null; continue; }
        manual = candidate !== name;
        break;
      } catch (error) { if (error.code !== "ENOENT") throw error; }
    }
    if (!bytes) continue;
    await write(`thumbnails/${name}`, bytes);
    if (manual) manualThumbnails++;
  }
  validateCatalogue(manifest, recent, index);
  manifest.counts = { recentDocuments: recent.entries.length, indexedFiles: index.entries.length,
    indexedDirectories: Object.keys(index.dirs).length, thumbnails: Object.keys(manifest.files).length - 3, manualThumbnails };
  await fs.writeFile(path.join(destination, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", { flag: "wx" });
  return { destination, id: manifest.id, counts: manifest.counts,
    bytes: Object.values(manifest.files).reduce((sum, item) => sum + item.bytes, 0),
    sourceHashes: { settings: settingsSource.sha256, recents: recentSource.sha256, index: indexSource.sha256 },
    omittedSettings: profile.omitted, personalLogsCopied: false, solidCamSetupCopied: false };
}

function argumentsFrom(argv) {
  const values = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, "");
    if (!argv[i].startsWith("--") || !argv[i + 1]) throw new Error("Expected --name value arguments.");
    if (["roots", "settingsRoots"].includes(key)) (values[key] ||= []).push(argv[i + 1]);
    else values[key] = argv[i + 1];
  }
  for (const name of ["settings", "recents", "index", "thumbnails", "destination", "roots"]) {
    if (!values[name]) throw new Error(`Missing --${name}.`);
  }
  return values;
}

if (require.main === module) {
  prepareCompanySeed(argumentsFrom(process.argv.slice(2))).then(value => console.log(JSON.stringify(value, null, 2)))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { portableSettings, prepareCompanySeed };
