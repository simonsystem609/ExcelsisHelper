const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path").win32;
const vm = require("node:vm");

const main = fs.readFileSync(require("node:path").join(__dirname, "..", "main.cjs"), "utf8");
function between(start, end) {
  const a = main.indexOf(start);
  const b = main.indexOf(end, a);
  assert.ok(a >= 0 && b > a, `Source boundaries: ${start}`);
  return main.slice(a, b);
}

async function test() {
  // Exercise the production deployment and synchronization code with a virtual
  // filesystem: no installed app, user settings, or SOLIDWORKS instance is used.
  const root = "C:\\Fixture\\Macros";
  const sourceRoot = "C:\\Fixture\\Bundle";
  const sourceFile = path.join(sourceRoot, "DXF_v16.swp");
  const targetFile = path.join(root, "DXF_v16.swp");
  const settingsFile = path.join(root, "macro-settings.json");
  const files = new Map([[sourceFile, Buffer.from("macro-v1")]]);
  let appVersion = "1.0.0";
  let macroLocked = false;
  let settingsLocked = false;
  let corruptReadback = false;
  let macroCopies = 0;
  let uid = 0;
  const dialogs = [];
  let answerDialog = async () => { throw new Error("Unexpected setup dialog"); };
  const context = {
    path, Buffer,
    crypto: { randomUUID: () => String(++uid) },
    app: { getVersion: () => appVersion },
    dialog: { showMessageBox: async (options) => {
      dialogs.push(options);
      assert.match(options.detail, /Save your work and close SOLIDWORKS/);
      assert.deepEqual(Array.from(options.buttons), ["Retry", "Later"]);
      assert.equal(options.cancelId, 1);
      return answerDialog(options);
    } },
    readAutomationSettings: async () => structuredClone(settings),
    automationMacroRoot: () => root,
    automationMacroBackupRoot: () => "C:\\Fixture\\Backups",
    bundledMacroRoot: () => sourceRoot,
    migrateLegacyAutomationFolders: async () => {},
    RETIRED_BUNDLED_MACRO_FILES: [],
    mergeAutomationSettings: (settings) => structuredClone(settings),
    pathExists: async (file) => files.has(file),
    readJsonFileNoBom: async (file) => JSON.parse(files.get(file).toString("utf8")),
    logActivity: () => {},
    fs: {
      mkdir: async () => {},
      readFile: async (file, encoding) => {
        assert.ok(files.has(file), `Expected fixture file ${file}`);
        if (file === settingsFile && corruptReadback) return "{}";
        return encoding ? files.get(file).toString(encoding) : Buffer.from(files.get(file));
      },
      writeFile: async (file, content, options) => {
        if (options?.flag === "wx") assert.equal(files.has(file), false);
        files.set(file, Buffer.from(content));
      },
      copyFile: async (from, to) => {
        if (to === targetFile && macroLocked) throw Object.assign(new Error("SWP is locked"), { code: "EPERM" });
        if (to === targetFile) macroCopies++;
        files.set(to, Buffer.from(files.get(from)));
      },
      rename: async (from, to) => {
        if (to === settingsFile && settingsLocked) throw Object.assign(new Error("Settings are locked"), { code: "EPERM" });
        files.set(to, files.get(from));
        files.delete(from);
      },
    },
  };
  vm.createContext(context);
  vm.runInContext([
    between("function isInsideFolder(", "async function readMacroDescriptions"),
    between("async function retireObsoleteBundledMacroFiles", "function extractJsonResponse"),
    "findBundledCompiledMacros = async () => [bundledMacroRoot() + '\\\\DXF_v16.swp'];",
    "this.api = { applyMacroSettings, ensureBundledMacros, macroSettingsSyncStatus, finishInstallerMacroUpdate };",
  ].join("\n"), context);

  const settings = {
    bomExportLanguage: "en",
    cam: { outputRoot: "D:\\CAM" },
    macros: { drawingTemplate: "", dxfOutputPrefix: "", defaultMaterial: "Acier \u00e9tir\u00e9" },
    locations: { projectCodePrefixes: ["JOB"], projectRootNames: ["Projects"] },
  };
  let result = await context.api.applyMacroSettings(settings);
  assert.equal(result.synced, true);
  assert.equal(result.warnings.length, 0);
  assert.equal(macroCopies, 1);
  let payload = JSON.parse(files.get(settingsFile));
  assert.equal(payload.defaultMaterial, settings.macros.defaultMaterial);
  assert.equal(payload.dxfOutputPrefix, "");
  assert.equal(payload.projectCodePrefixesText, "JOB");

  settings.macros.defaultMaterial = "S235";
  settings.bomExportLanguage = "hu";
  await context.api.applyMacroSettings(settings);
  payload = JSON.parse(files.get(settingsFile));
  assert.equal(payload.defaultMaterial, "S235");
  assert.equal(payload.bomExportLanguage, "hu");
  assert.equal(macroCopies, 1, "Settings saves must not regenerate or rewrite an unchanged SWP");

  appVersion = "1.0.1";
  files.set(sourceFile, Buffer.from("macro-v2"));
  macroLocked = true;
  result = await context.api.applyMacroSettings(settings);
  assert.equal(result.synced, true, "The independent settings sidecar can still be saved");
  assert.match(result.warnings.join(" "), /restart SOLIDWORKS/);
  assert.equal(files.get(targetFile).toString(), "macro-v1");
  assert.equal(JSON.parse(files.get(path.join(root, ".bundled-macros.json"))).appVersion, "1.0.0");
  assert.ok([...files].some(([file, bytes]) => file.startsWith("C:\\Fixture\\Backups") && bytes.toString() === "macro-v1"));
  macroLocked = false;
  result = await context.api.applyMacroSettings(settings);
  assert.equal(result.warnings.length, 0);
  assert.equal(files.get(targetFile).toString(), "macro-v2");

  files.delete(targetFile);
  await context.api.ensureBundledMacros();
  assert.equal(files.get(targetFile).toString(), "macro-v2", "Repair missing same-version macros");

  const savedBytes = files.get(settingsFile).toString();
  settingsLocked = true;
  settings.macros.defaultMaterial = "ALUMINIUM";
  result = await context.api.applyMacroSettings(settings);
  assert.equal(result.synced, false);
  assert.equal(files.get(settingsFile).toString(), savedBytes, "A failed atomic replace must preserve prior settings");
  assert.match(context.api.macroSettingsSyncStatus().warnings.join(" "), /Settings are locked/);
  assert.ok([...files.keys()].some((file) => file.endsWith(".tmp")), "Failed staging file remains available");
  settingsLocked = false;
  result = await context.api.applyMacroSettings(settings);
  assert.equal(result.synced, true);
  assert.equal(result.warnings.length, 0);

  corruptReadback = true;
  assert.equal((await context.api.applyMacroSettings(settings)).synced, false);
  corruptReadback = false;
  const a = structuredClone(settings);
  const b = structuredClone(settings);
  a.macros.defaultMaterial = "FIRST";
  b.macros.defaultMaterial = "LAST";
  await Promise.all([context.api.applyMacroSettings(a), context.api.applyMacroSettings(b)]);
  assert.equal(JSON.parse(files.get(settingsFile)).defaultMaterial, "LAST");

  assert.equal((await context.api.finishInstallerMacroUpdate()).complete, true);
  assert.equal(dialogs.length, 0, "Successful deployment must not ask the user to close SOLIDWORKS");
  appVersion = "1.0.2";
  files.set(sourceFile, Buffer.from("macro-v3"));
  macroLocked = true;
  await context.api.applyMacroSettings(settings);
  answerDialog = async () => ({ response: 1 });
  result = await context.api.finishInstallerMacroUpdate();
  assert.equal(result.complete, false);
  assert.equal(dialogs.length, 1);
  assert.equal(files.get(targetFile).toString(), "macro-v2");
  assert.equal(JSON.parse(files.get(path.join(root, ".bundled-macros.json"))).appVersion, "1.0.1");
  assert.ok(context.api.macroSettingsSyncStatus().warnings.length, "Later must keep the pending update visible");

  answerDialog = async () => { macroLocked = false; return { response: 0 }; };
  result = await context.api.finishInstallerMacroUpdate();
  assert.equal(result.complete, true);
  assert.equal(files.get(targetFile).toString(), "macro-v3");
  assert.equal(JSON.parse(files.get(settingsFile)).defaultMaterial, settings.macros.defaultMaterial);
  assert.equal(dialogs.length, 2, "One user Retry resolves a released file lock");

  appVersion = "1.0.3";
  files.set(sourceFile, Buffer.from("macro-v4"));
  macroLocked = true;
  await context.api.applyMacroSettings(settings);
  let retries = 0;
  answerDialog = async () => ({ response: retries++ === 0 ? 0 : 1 });
  assert.equal((await context.api.finishInstallerMacroUpdate()).complete, false);
  assert.equal(retries, 2, "A still-locked Retry re-prompts, then Later stops without spinning");
  assert.equal(files.get(targetFile).toString(), "macro-v3");

  let dismissDialog;
  answerDialog = () => new Promise((resolve) => { dismissDialog = resolve; });
  const beforeDialogs = dialogs.length;
  const firstDialog = context.api.finishInstallerMacroUpdate();
  const secondDialog = context.api.finishInstallerMacroUpdate(true);
  assert.equal(dialogs.length, beforeDialogs + 1, "Installer reactivation must not create duplicate dialogs");
  dismissDialog({ response: 1 });
  assert.equal((await firstDialog).complete, false);
  assert.equal((await secondDialog).complete, false);
  macroLocked = false;
  assert.equal((await context.api.finishInstallerMacroUpdate(true)).complete, true);
  assert.equal(files.get(targetFile).toString(), "macro-v4");

  settingsLocked = true;
  answerDialog = async () => ({ response: 1 });
  result = await context.api.finishInstallerMacroUpdate(true);
  assert.equal(result.complete, false, "Setup also reports a failed settings sidecar update");
  assert.match(result.warnings.join(" "), /Settings are locked/);
  settingsLocked = false;
  assert.equal((await context.api.finishInstallerMacroUpdate(true)).complete, true);

  console.log("Macro settings sync, locks, backups, repair, installer Retry/Later and duplicate-dialog tests passed.");
}

test().catch((error) => { console.error(error); process.exitCode = 1; });
