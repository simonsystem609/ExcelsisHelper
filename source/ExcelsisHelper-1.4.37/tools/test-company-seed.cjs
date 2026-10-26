"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const vm = require("node:vm");
const {
  RECEIPT, withinRoots, thumbnailName, assertPortableSettings, readManifest, readCompanySettings, importCompanyCatalogue,
} = require("../company-seed.cjs");
const { portableSettings, prepareCompanySeed } = require("./prepare-company-seed.cjs");
const root = path.resolve(__dirname, "..");
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aSYoAAAAASUVORK5CYII=", "base64");
const roots = ["Y:\\", "\\\\example\\share\\"];
const doc = "Y:\\Projects\\Plate.SLDPRT";
const other = "X:\\Other.SLDPRT";
const fixtureSettings = {
  uiLanguage: "hu", bomExportLanguage: "hu",
  hotkeys: { enabled: true, projectPrefix: "JOB-", projectDateTemplate: "JOB-[currentdate]",
    pasteProjectDate: "Ctrl+Space", copyExplorerPath: "F7,F7", exportCadGlb: "Alt+C", macroShortcuts: [] },
  erp: { workLoggingEnabled: true, worklogUserName: "PRIVATE OPERATOR", worklogInbox: "Y:\\ERP\\inbox",
    worklogWorktypes: "Y:\\ERP\\worktypes.json", overtimeStartTime: "17:00", worklogDocMinMinutes: 10 },
  solidCam: { selectedDllPath: "C:\\Program Files\\SolidCAM\\addin.dll", selectedTitle: "Local CAM", selectedClsid: "PRIVATE-CLSID" },
  locations: { searchRoots: ["C:\\Users\\Original\\Documents", "C:\\Users\\Original\\Desktop", "C:\\Users\\Original\\Downloads", "Y:\\", "X:\\"],
    exclusions: ["Y:\\ERP"], projectRootNames: ["Projects"], projectCodePrefixes: ["JOB"] },
  cam: { outputRoot: "X:\\", searchRoots: ["Y:\\Projects"], folderMode: "project-part" },
  macros: { defaultMaterial: "Steel", dxfOutputPrefix: "LV", drawingTemplate: "C:\\Users\\Original\\Secret.drwdot" },
  diagnostics: { enabled: true },
  recentDocsFolder: { path: "Y:\\Drawings", copyLabel: "Drawings path", openLabel: "Open drawings" },
  projectFolders: { company: { name: "Company", root: "Y:\\Projects", prefix: "JOB" },
    tools: { name: "Tools", root: "Y:\\Tools", prefix: "TOOL" } },
  gcode: { machineMaxRpm: 12000, searchRoot: "X:\\", materials: ["Steel"] },
  token: "DO-NOT-COPY", autoExportStatus: { fileName: "PRIVATE LOG" },
};

async function json(file, data) { await fs.writeFile(file, JSON.stringify(data), "utf8"); }
async function missing(file) { try { await fs.lstat(file); return false; } catch (e) { if (e.code === "ENOENT") return true; throw e; } }
const folders = { documents: "C:\\Users\\Coworker\\Documents", desktop: "C:\\Users\\Coworker\\Desktop", downloads: "C:\\Users\\Coworker\\Downloads" };

async function run() {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "helper-company-seed-"));
  const source = path.join(temp, "source");
  await fs.mkdir(path.join(source, "thumbs"), { recursive: true });
  await json(path.join(source, "settings.json"), fixtureSettings);
  await json(path.join(source, "recents.json"), { schema: "excelsis-recent-docs-v1", entries: [
    { path: doc, type: "part", title: "Plate.SLDPRT", lastSeen: 40, size: 32, extraPrivateField: "excluded" },
    { path: "\\\\example\\share\\Projects\\Assembly.SLDASM", type: "assembly", title: "Assembly", lastSeen: 20 },
    { path: other, type: "part", title: "Local setup" },
    { path: "Y:\\ERP\\worklog.json", type: "other" },
    { path: "\\\\example\\share\\ERP\\worklog.json", type: "other" },
  ] });
  await json(path.join(source, "index.json"), { schemaVersion: 4, roots: ["Y:\\", "X:\\"], generatedAt: 1, updatedAt: 2,
    entries: [{ path: doc, size: 32 }, { path: other }, { path: "C:\\Users\\Original\\PRIVATE.SLDPRT" }],
    dirs: { "y:\\projects": { path: "Y:\\Projects", mtimeMs: 1, checkedAt: 2 },
      "x:\\": { path: "X:\\", mtimeMs: 3 } } });
  await fs.writeFile(path.join(source, "thumbs", thumbnailName(doc)), png);
  await fs.writeFile(path.join(source, "thumbs", `${thumbnailName(doc)}.manual.png`), Buffer.concat([png, Buffer.from("manual")]));
  await fs.writeFile(path.join(source, "thumbs", thumbnailName(other)), png);
  await json(path.join(source, "project-activity.json"), { user: "PRIVATE OPERATOR", hours: 500 });
  const snapshot = await prepareCompanySeed({ settings: path.join(source, "settings.json"), recents: path.join(source, "recents.json"),
    index: path.join(source, "index.json"), thumbnails: path.join(source, "thumbs"),
    roots, settingsRoots: [...roots, "X:\\"], destination: path.join(temp, "seed") });
  assert.deepEqual(snapshot.counts, { recentDocuments: 2, indexedFiles: 1, indexedDirectories: 1, thumbnails: 1, manualThumbnails: 1 });
  assert.deepEqual(snapshot.omittedSettings, ["macros.drawingTemplate"]);
  const manifest = await readManifest(snapshot.destination);
  assert.equal(manifest.audience, "company-internal");
  assert.equal(Object.keys(manifest.files).length, 4);
  const profile = await readCompanySettings(snapshot.destination, folders);
  assert.equal(profile.settings.erp.worklogUserName, "");
  assert.equal(profile.settings.erp.workLoggingEnabled, false);
  assert.deepEqual(profile.settings.solidCam, { selectedDllPath: "", selectedTitle: "", selectedClsid: "" });
  assert.equal(profile.settings.locations.searchRoots[0], folders.documents);
  assert.equal(profile.settings.locations.searchRoots[1], folders.desktop);
  assert.equal(profile.settings.locations.searchRoots[2], folders.downloads);
  assert.equal(profile.settings.cam.outputRoot, "X:\\");
  assert.equal(profile.settings.gcode.machineMaxRpm, 12000);
  const serialized = JSON.stringify(profile);
  for (const secret of ["Original", "PRIVATE OPERATOR", "PRIVATE-CLSID", "DO-NOT-COPY", "autoExportStatus", "addin.dll"]) assert.ok(!serialized.includes(secret));

  assert.equal(withinRoots("Y:\\Plate.SLDPRT", roots), true);
  assert.equal(withinRoots("y:\\Plate.SLDPRT", roots), true);
  assert.equal(withinRoots("Y:\\..\\Outside.SLDPRT", roots), false);
  assert.equal(withinRoots("Y:Relative.SLDPRT", roots), false);
  assert.equal(withinRoots("\\\\example\\share-extra\\Plate.SLDPRT", roots), false);
  assert.equal(withinRoots("\\\\?\\Y:\\Plate.SLDPRT", roots), false);
  assert.equal(withinRoots("Y:\\Plate.SLDPRT:stream", roots), false);
  assert.equal(withinRoots("C:\\Private.SLDPRT", roots), false);
  const seedless = await importCompanyCatalogue({ seedRoot: path.join(temp, "absent"), workdirRoot: path.join(temp, "untouched"), searchIndexRoot: path.join(temp, "untouched-index") });
  assert.equal(seedless.available, false);
  assert.equal(await missing(path.join(temp, "untouched")), true);

  const workdirRoot = path.join(temp, "fresh-documents");
  const searchIndexRoot = path.join(temp, "fresh-index");
  const result = await importCompanyCatalogue({ seedRoot: snapshot.destination, workdirRoot, searchIndexRoot });
  assert.equal(result.recentCreated, true);
  assert.equal(result.indexCreated, true);
  assert.equal(result.thumbnailsCreated, 1);
  assert.deepEqual((await fs.readdir(workdirRoot)).sort(), [RECEIPT, ".thumb-cache-drawing-color-fix-applied", ".thumb-cache-icon-fix-applied", "recent-doc-thumbs", "recent-docs.json"].sort());
  assert.ok((await fs.readFile(path.join(workdirRoot, "recent-doc-thumbs", thumbnailName(doc)))).includes(Buffer.from("manual")));
  assert.equal(await missing(path.join(workdirRoot, "project-activity.json")), true);
  assert.equal(await missing(path.join(workdirRoot, "worklog-export-rules.json")), true);

  await json(path.join(workdirRoot, "recent-docs.json"), { entries: [{ path: "Y:\\Coworker.SLDASM" }] });
  const next = await importCompanyCatalogue({ seedRoot: snapshot.destination, workdirRoot, searchIndexRoot });
  assert.equal(next.alreadyProcessed, true);
  assert.equal(JSON.parse(await fs.readFile(path.join(workdirRoot, "recent-docs.json"), "utf8")).entries.length, 1);

  const existing = path.join(temp, "existing");
  await fs.mkdir(path.join(existing, "recent-doc-thumbs"), { recursive: true });
  await json(path.join(existing, "recent-docs.json"), { private: "existing history" });
  await json(path.join(existing, "index.json"), { private: "existing index" });
  await fs.writeFile(path.join(existing, "recent-doc-thumbs", thumbnailName(doc)), Buffer.from("existing thumbnail"));
  const kept = await importCompanyCatalogue({ seedRoot: snapshot.destination, workdirRoot: existing, searchIndexRoot: existing });
  assert.equal(kept.recentCreated, false);
  assert.equal(kept.indexCreated, false);
  assert.equal(kept.thumbnailsCreated, 0);
  assert.equal(JSON.parse(await fs.readFile(path.join(existing, "recent-docs.json"), "utf8")).private, "existing history");
  assert.equal(JSON.parse(await fs.readFile(path.join(existing, "index.json"), "utf8")).private, "existing index");
  assert.equal((await fs.readFile(path.join(existing, "recent-doc-thumbs", thumbnailName(doc)), "utf8")), "existing thumbnail");
  assert.equal(await missing(path.join(existing, ".thumb-cache-icon-fix-applied")), true);

  // Corruption or foreign-share records fail before even creating a user folder.
  const corrupt = path.join(temp, "corrupt-seed");
  await fs.cp(snapshot.destination, corrupt, { recursive: true, errorOnExist: true, force: false });
  await fs.appendFile(path.join(corrupt, "index.json"), " ");
  await assert.rejects(importCompanyCatalogue({ seedRoot: corrupt, workdirRoot: path.join(temp, "corrupt-user"), searchIndexRoot: path.join(temp, "corrupt-user-index") }), /integrity|size/);
  assert.equal(await missing(path.join(temp, "corrupt-user")), true);
  const foreign = JSON.parse(await fs.readFile(path.join(corrupt, "index.json"), "utf8"));
  foreign.entries.push({ path: other });
  const foreignBytes = Buffer.from(JSON.stringify(foreign));
  await fs.writeFile(path.join(corrupt, "index.json"), foreignBytes);
  const foreignManifest = JSON.parse(await fs.readFile(path.join(corrupt, "manifest.json"), "utf8"));
  foreignManifest.files["index.json"] = { bytes: foreignBytes.length, sha256: crypto.createHash("sha256").update(foreignBytes).digest("hex") };
  await json(path.join(corrupt, "manifest.json"), foreignManifest);
  await assert.rejects(importCompanyCatalogue({ seedRoot: corrupt, workdirRoot: path.join(temp, "foreign-user"), searchIndexRoot: path.join(temp, "foreign-user-index") }), /outside/);
  assert.equal(await missing(path.join(temp, "foreign-user")), true);
  foreignManifest.files["../settings.json"] = foreignManifest.files["settings.json"];
  await json(path.join(corrupt, "manifest.json"), foreignManifest);
  await assert.rejects(readManifest(corrupt), /Unexpected/);
  const forged = portableSettings(fixtureSettings, [...roots, "X:\\"]).settings;
  forged.hotkeys.constructor = {};
  assert.throws(() => assertPortableSettings(forged), /unsupported/);

  const main = await fs.readFile(path.join(root, "main.cjs"), "utf8");
  const section = (a, b) => main.slice(main.indexOf(a), main.indexOf(b, main.indexOf(a)));
  const presetBody = section("async function readInstallSettingsPreset()", "async function readRawAutomationSettings()");
  const presetHost = (reader, externalReader) => {
    const host = {
      readCompanySettings: reader, app: { getPath: name => folders[name] },
      assetPath: () => snapshot.destination, installSettingsPresetPath: () => "personal-sidecar.json",
      cloneSettingsValue: value => JSON.parse(JSON.stringify(value)), pathExists: async () => true,
      readSettingsDocument: externalReader, settingsPayloadFromDocument: value => value, logActivity: () => {},
    };
    vm.createContext(host);
    vm.runInContext(`let installSettingsPresetCache = null;\n${presetBody}\nthis.read = readInstallSettingsPreset;`, host);
    return host;
  };
  const companyHost = presetHost(async () => profile, () => { throw new Error("Personal sidecar must not be read"); });
  assert.equal((await companyHost.read()).settings.erp.workLoggingEnabled, false);
  assert.equal((await companyHost.read()).settings.erp.worklogUserName, "");
  const damagedHost = presetHost(async () => { throw new Error("Corrupt company settings"); }, () => { throw new Error("Personal sidecar must not be read"); });
  assert.equal((await damagedHost.read()).settings.erp.workLoggingEnabled, false);
  const universalHost = presetHost(async () => null, async () => ({ erp: { worklogUserName: "Existing external preset" } }));
  assert.equal((await universalHost.read()).settings.erp.worklogUserName, "Existing external preset");
  const layeringHost = vm.createContext({});
  vm.runInContext(`${section("const SETTINGS_BLOCKED_KEYS", "function migrateSettingsAliases")}\nthis.merge = mergeSettingsLayers;`, layeringHost);
  const layered = layeringHost.merge(profile.settings, { erp: { workLoggingEnabled: true, worklogUserName: "Coworker" } });
  assert.equal(layered.erp.workLoggingEnabled, true);
  assert.equal(layered.erp.worklogUserName, "Coworker");
  assert.equal(layered.macros.defaultMaterial, "Steel");
  const startup = main.slice(main.indexOf("const automationStartup ="));
  assert.ok(startup.indexOf("await importCompanyCatalogue") < startup.indexOf("startDocSearchMaintenance()"));
  assert.ok(startup.indexOf("await migrateDocSearchIndexIfNeeded") < startup.indexOf("await importCompanyCatalogue"));
  assert.ok(startup.indexOf("await importCompanyCatalogue") < startup.indexOf(".thumb-cache-icon-fix-applied"));
  assert.match(main, /installSettingsPresetCache = company\s*\? \{ found: true, \.\.\.company \}/);
  const config = await fs.readFile(path.join(root, "electron-builder.yml"), "utf8");
  assert.ok(config.includes("  - company-seed.cjs"));
  assert.ok(!config.includes("to: company-seed"), "Universal builds must not embed company data");
  const installer = await fs.readFile(path.join(root, "installer.nsh"), "utf8");
  const companyGuard = installer.indexOf('IfFileExists "$INSTDIR\\resources\\company-seed\\manifest.json" company_preset_done 0');
  const personalCopy = installer.indexOf('CopyFiles /SILENT "$EXEDIR\\ExcelsisHelper-settings.json"');
  assert.ok(companyGuard > 0 && companyGuard < personalCopy, "Company setup must not stage a stray personal sidecar");
  console.log("Company seed passed: scoped Y/UNC catalogue, safe settings, per-user folders, disabled logging, no identity/setup/history, manual thumbnails, no-overwrite, one-time startup, corruption and traversal guards; universal builds stay data-free.");
}
run().catch(error => { console.error(error); process.exitCode = 1; });
