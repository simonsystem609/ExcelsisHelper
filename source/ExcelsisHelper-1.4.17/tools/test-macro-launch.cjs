"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const main = fs.readFileSync(path.join(root, "main.cjs"), "utf8");
const bridge = fs.readFileSync(path.join(root, "scripts", "solidworks-bridge.ps1"), "utf8");
function between(source, start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, `Missing source boundary: ${start}`);
  return source.slice(a, b);
}
function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", windowsHide: true, timeout: 30000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

async function test() {
  const calls = [];
  const handlers = new Map();
  const macroRoot = "C:\\Fixture\\Macros";
  const files = fs.readdirSync(path.join(root, "macros"), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".swp"));
  const context = {
    path: path.win32, crypto,
    LISTED_MACRO_EXTENSIONS: new Set([".swp"]),
    bundledMacroDeploymentWarnings: [],
    fs: {
      readdir: async () => files,
      stat: async () => ({ mtime: new Date(0), size: 1 }),
      realpath: async (file) => file,
    },
    ensureBundledMacros: async () => macroRoot,
    readMacroDescriptions: async () => ({}),
    descriptionKeyForMacro: (file) => file.toLowerCase(),
    automationMacroRoot: () => macroRoot,
    pathExists: async () => true,
    isInsideFolderOrEqual: (file, folder) => file === folder || file.startsWith(`${folder}\\`),
    isMacroPath: (file) => /\.(swp|dll)$/i.test(file),
    validatedVbaIdentifier: (value, blank = false) =>
      (blank && value === "") || /^[A-Za-z][A-Za-z0-9_]{0,127}$/.test(value) ? value : null,
    logActivity: () => {},
    isQuitting: false,
    isMacroRecentDocSuppressionActive: async () => false,
    runSolidWorksMacroBridge: async (args) => { calls.push(Array.from(args)); return { ok: true }; },
    trustedIpcHandle: (name, handler) => handlers.set(name, handler),
  };
  vm.createContext(context);
  vm.runInContext([
    between(main, "const DEFAULT_MACRO_SHORTCUTS", "const DEFAULT_AUTOMATION_SETTINGS"),
    between(main, "function cleanString", "function normalizeGcodeOutputSuffix"),
    between(main, "const COMPILED_MACRO_MODULE_NAMES", "const VBA_IDENTIFIER"),
    between(main, "async function listSolidWorksMacros()", "function solidWorksBridgePath()"),
    between(main, "const HOTKEY_HELPER_EVENT_MACRO", "const solidWorksWatcherHelper"),
    between(main, 'trustedIpcHandle("automation:run-macro"', 'trustedIpcHandle("automation:list-macro-tiles"'),
    "this.api = { listSolidWorksMacros, runMacroFromHotkey, configureMacroHotkeyBindings, handleHotkeyHelperLine };",
  ].join("\n"), context);

  const tiles = (await context.api.listSolidWorksMacros()).macros;
  const radius = tiles.find((tile) => tile.name === "Radius_v9.swp");
  assert.equal(radius.moduleName, "Test11", "Radius tile must use its actual compiled module, not its filename");
  const runMacro = handlers.get("automation:run-macro");
  const moduleArg = (args) => args[args.indexOf("-ModuleName") + 1];
  for (const options of [{}, { moduleName: "" }, { moduleName: radius.moduleName }]) {
    assert.equal((await runMacro({}, { filePath: radius.path, ...options })).ok, true);
    // Empty explicit names are also covered by the standalone bridge fallback below.
    if (options.moduleName !== "") assert.equal(moduleArg(calls.at(-1)), "Test11");
  }
  await runMacro({}, { filePath: radius.path, moduleName: "CustomModule" });
  assert.equal(moduleArg(calls.at(-1)), "CustomModule", "Keep explicit custom module support");
  const count = calls.length;
  assert.equal((await runMacro({}, { filePath: radius.path, moduleName: "bad.name" })).ok, false);
  assert.equal(calls.length, count);
  const radiusBinding = { macro: "Radius_v9.swp", shortcut: "Alt+R" };
  const dxfBinding = { macro: "DXF_v16.swp", shortcut: "Alt+D" };
  await context.api.runMacroFromHotkey(radiusBinding);
  assert.equal(moduleArg(calls.at(-1)), "Test11", "Shortcut must use the same compiled module");
  context.isMacroRecentDocSuppressionActive = async () => true;
  await context.api.runMacroFromHotkey(dxfBinding);
  assert.equal(calls.length, count + 1, "Active macro gate must suppress the shortcut");
  context.isMacroRecentDocSuppressionActive = async () => false;
  await Promise.all([context.api.runMacroFromHotkey(radiusBinding), context.api.runMacroFromHotkey(dxfBinding)]);
  assert.equal(calls.length, count + 2, "Different macro shortcuts must not overlap either");
  await context.api.runMacroFromHotkey(dxfBinding);
  assert.equal(moduleArg(calls.at(-1)), "DXF_v161");
  assert.ok(calls.at(-1).includes(`${macroRoot}\\DXF_v16.swp`), "Regular DXF, never RO or CNC DXF");
  await context.api.runMacroFromHotkey({ macro: "Custom\\User.swp", shortcut: "Alt+U" });
  assert.equal(moduleArg(calls.at(-1)), "", "Custom macros use bridge method discovery");
  let before = calls.length;
  await context.api.runMacroFromHotkey({ macro: "..\\Outside.swp", shortcut: "Alt+U" });
  context.pathExists = async () => false;
  await context.api.runMacroFromHotkey(dxfBinding);
  context.pathExists = async () => true;
  context.fs.realpath = async (file) => /DXF_v16/.test(file) ? "C:\\Outside\\DXF_v16.swp" : file;
  await context.api.runMacroFromHotkey(dxfBinding);
  assert.equal(calls.length, before, "Traversal, missing macros and symlink escape must not run");
  context.fs.realpath = async (file) => file;
  const ids = context.api.configureMacroHotkeyBindings({ macroShortcuts: [radiusBinding, dxfBinding] });
  await context.api.handleHotkeyHelperLine(`EXCELSIS_HOTKEY_EVENT:macro:${ids[1].id}`);
  assert.equal(moduleArg(calls.at(-1)), "DXF_v161");
  before = calls.length;
  context.api.configureMacroHotkeyBindings({ macroShortcuts: [{ macro: "BOM_v19.swp", shortcut: "Alt+D" }] });
  await context.api.handleHotkeyHelperLine(`EXCELSIS_HOTKEY_EVENT:macro:${ids[1].id}`);
  await context.api.handleHotkeyHelperLine("EXCELSIS_HOTKEY_EVENT:macro:unknown");
  await context.api.handleHotkeyHelperLine("EXCELSIS_HOTKEY_EVENT:auto-radius");
  assert.equal(calls.length, before, "Unknown, stale and retired events are ignored");
  context.api.configureMacroHotkeyBindings({ enabled: false, macroShortcuts: [radiusBinding, dxfBinding] });
  await context.api.handleHotkeyHelperLine(`EXCELSIS_HOTKEY_EVENT:macro:${ids[0].id}`);
  context.isQuitting = true;
  await context.api.runMacroFromHotkey(radiusBinding);
  context.isQuitting = false;
  assert.equal(calls.length, before, "Disabled and quitting states do not launch");
  assert.doesNotMatch(between(main, "async function runMacroFromHotkey", "function handleHotkeyHelperLine"),
    /\.show\(|\.focus\(|showMainWindow|createWindow/);

  if (process.platform === "win32") {
    const projects = JSON.parse(run("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
      "-File", path.join(__dirname, "read-macro-projects.ps1")]));
    assert.equal(projects.length, files.length);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "excelsis-macro-launch-tests-"));
    const scriptPath = path.join(dir, "candidates.vbs");
    // Run the production fallback block in isolation. GetMacroMethods supplies
    // nothing, as in the reported failure. No SOLIDWORKS object is created.
    fs.writeFileSync(scriptPath, `Option Explicit
Dim moduleCandidates, procedureCandidates, extensionName, fileBase, moduleName, procedureName
Set moduleCandidates = CreateObject("Scripting.Dictionary")
Set procedureCandidates = CreateObject("Scripting.Dictionary")
moduleCandidates.CompareMode = 1
procedureCandidates.CompareMode = 1
fileBase = WScript.Arguments(0)
moduleName = ""
If WScript.Arguments.Count > 1 Then moduleName = WScript.Arguments(1)
extensionName = "swp"
procedureName = "main"
${between(bridge, "Sub AddUnique(dict, value)", "Sub WriteUtf8")}
${between(bridge, "Dim optionsValue", "Dim attemptsJson")}
WScript.Echo Join(moduleCandidates.Items, "|")
`, "utf8");
    for (const project of projects) {
      const tile = tiles.find((entry) => entry.name === project.fileName);
      assert.ok(tile, project.fileName);
      for (const moduleName of [tile.moduleName, ""]) {
        const candidates = run("cscript.exe", ["//NoLogo", scriptPath,
          path.basename(project.fileName, ".swp"), moduleName]).split("|");
        assert.ok(project.modules.some((name) => candidates.includes(name)),
          `${project.fileName}: no launcher candidate matches the compiled PROJECT modules`);
      }
    }
    const unknown = run("cscript.exe", ["//NoLogo", scriptPath, "CustomMacro", ""]);
    assert.equal(unknown.includes("Test11"), false, "Template exception must not affect unrelated macros");
    console.log(`Actual PROJECT modules matched for ${projects.length} SWPs, with and without enumeration.`);
  }
  console.log("Macro button, shortcut, custom-module, input validation and overlap-gate tests passed.");
}
test().catch((error) => { console.error(error); process.exitCode = 1; });
