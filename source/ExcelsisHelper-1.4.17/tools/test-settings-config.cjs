const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const mainPath = path.join(__dirname, "..", "main.cjs");
const source = fs.readFileSync(mainPath, "utf8");
const rendererSource = fs.readFileSync(path.join(__dirname, "..", "automation.js"), "utf8");
const rendererHtml = fs.readFileSync(path.join(__dirname, "..", "automation.html"), "utf8");
const preloadSource = fs.readFileSync(path.join(__dirname, "..", "preload.cjs"), "utf8");
const builderSource = fs.readFileSync(path.join(__dirname, "..", "electron-builder.yml"), "utf8");
const hotkeyHelperSource = fs.readFileSync(path.join(__dirname, "..", "scripts", "hotkey-helper.ps1"), "utf8");
const externalSettingsFixture = {
  format: "excelsis-helper-settings",
  settings: {
    erp: {
      worklogUserName: "Example User",
      overtimeStartTime: "17:00",
    },
  },
};

function sourceBetween(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0, `Missing start marker: ${startMarker}`);
  assert.ok(end > start, `Missing end marker: ${endMarker}`);
  return source.slice(start, end);
}

const settingsContext = {};
vm.createContext(settingsContext);
vm.runInContext(`${sourceBetween("const DEFAULT_MACRO_SHORTCUTS", "const DEFAULT_AUTOMATION_SETTINGS")}
${sourceBetween("function cleanString", "function normalizeGcodeOutputSuffix")}
${sourceBetween(
  "const SETTINGS_BLOCKED_KEYS",
  "async function readSettingsDocument",
)}\nthis.testApi = { mergeSettingsLayers, migrateSettingsAliases, settingsPayloadFromDocument };`, settingsContext);

const { mergeSettingsLayers, migrateSettingsAliases, settingsPayloadFromDocument } = settingsContext.testApi;
const preset = settingsPayloadFromDocument({
  format: "excelsis-helper-settings",
  settings: {
    hotkeys: { projectDateTemplate: "PRESET-[currentdate]" },
    macros: { dxfOutputPrefix: "PLATE" },
  },
});
const existing = migrateSettingsAliases({
  hotkeys: { sztTemplate: "EXISTING-[currentdate]" },
  gcode: {
    toolTypes: ["HSS-Co"],
    defaultMillingToolType: "Carbide",
    defaultDrillToolType: "HSS",
  },
});
const layered = mergeSettingsLayers(preset, existing);
assert.equal(layered.hotkeys.projectDateTemplate, "EXISTING-[currentdate]");
assert.equal(layered.macros.dxfOutputPrefix, "PLATE");
assert.equal(Object.prototype.hasOwnProperty.call(layered.hotkeys, "sztTemplate"), false);
assert.deepEqual(Array.from(existing.gcode.toolMaterials), ["HSS-Co"]);
assert.equal(existing.gcode.defaultMillingToolMaterial, "Carbide");
assert.equal(existing.gcode.defaultDrillToolMaterial, "HSS");
assert.equal(Object.prototype.hasOwnProperty.call(existing.gcode, "toolTypes"), false);
assert.match(source, /diagnostics:\s*\{\s*enabled:\s*false\s*,?\s*\}/);
assert.match(source, /enabled:\s*diagnostics\.enabled === true/);
assert.match(rendererHtml, /id="settingsDiagnosticsEnabled"[^>]*type="checkbox"/);
assert.match(rendererSource, /enabled:\s*ui\.settingsDiagnosticsEnabled\?\.checked === true/);
assert.match(source, /macro: "Radius_v9.swp", shortcut: "Alt\+R"/);
assert.match(source, /macro: "DXF_v16.swp", shortcut: "Alt\+D"/);
assert.match(source, /macroShortcuts:\s*normalizeMacroShortcuts\(/);
assert.match(source, /"-MacroShortcutsBase64", Buffer.from\(JSON.stringify\(macroShortcuts\)/);
assert.match(source, /EXCELSIS_HOTKEY_EVENT:macro:/);
assert.match(rendererHtml, /id="settingsMacroShortcuts"/);
assert.match(rendererHtml, /id="macroShortcutNotes"/);
assert.match(rendererSource, /macroShortcuts:\s*readMacroShortcutRows\(\)/);
assert.match(hotkeyHelperSource, /EVENT_SYSTEM_FOREGROUND/);
assert.match(hotkeyHelperSource, /ForegroundProcessIsSolidWorks/);
assert.match(hotkeyHelperSource, /EXCELSIS_HOTKEY_EVENT:macro:/);

const hotkeyContext = {};
vm.createContext(hotkeyContext);
vm.runInContext(`${sourceBetween("const DEFAULT_MACRO_SHORTCUTS", "const DEFAULT_AUTOMATION_SETTINGS")}
${sourceBetween(
  "function cleanString",
  "function normalizeGcodeOutputSuffix",
)}\nthis.api = { normalizeMacroHotkey, normalizeMacroShortcuts, validateMacroShortcuts };`, hotkeyContext);
const { normalizeMacroHotkey, normalizeMacroShortcuts, validateMacroShortcuts } = hotkeyContext.api;
assert.equal(normalizeMacroHotkey("Alt+R", "Alt+R"), "Alt+R");
assert.equal(normalizeMacroHotkey("control + shift + f8", "Alt+R"), "Ctrl+Shift+F8");
assert.equal(normalizeMacroHotkey("Windows+PageDown", "Alt+R"), "Win+PageDown");
assert.equal(normalizeMacroHotkey("shift+alt+d"), "Alt+Shift+D");
for (const invalid of ["R", "F7,F7", "R+Alt", "Alt+R,R", "Alt+F25", "Alt+NoSuchKey", "Alt+Alt+R"]) {
  assert.equal(normalizeMacroHotkey(invalid, "Alt+R"), "Alt+R", `${invalid} must use the fallback`);
}
const defaultShortcuts = normalizeMacroShortcuts();
assert.equal(defaultShortcuts.length, 2);
assert.equal(defaultShortcuts[1].macro, "DXF_v16.swp");
assert.equal(defaultShortcuts[1].shortcut, "Alt+D");
assert.equal(normalizeMacroShortcuts([]).length, 0, "Removing all bindings persists");
const migratedRadius = migrateSettingsAliases({ hotkeys: { autoRadius: "Ctrl+Shift+R" } });
assert.equal(migratedRadius.hotkeys.macroShortcuts[0].shortcut, "Ctrl+Shift+R");
assert.equal(migratedRadius.hotkeys.macroShortcuts[1].shortcut, "Alt+D");
assert.equal("autoRadius" in migratedRadius.hotkeys, false);
assert.equal(migrateSettingsAliases({ hotkeys: { autoRadius: "Alt+D" } }).hotkeys.macroShortcuts.length, 1);
assert.equal(migrateSettingsAliases({ hotkeys: { autoRadius: "Alt+R", macroShortcuts: [] } }).hotkeys.macroShortcuts.length, 0);
const validateBindings = (macroShortcuts, extra = {}) => validateMacroShortcuts({
  pasteProjectDate: "Ctrl+Space", copyExplorerPath: "F7,F7", ...extra, macroShortcuts,
});
validateBindings(defaultShortcuts);
validateBindings([{ macro: "custom\\User tool.swp", shortcut: "Ctrl+Alt+U" }]);
for (const macro of ["../out.swp", "C:\\out.swp", "\\server\\out.swp", "a\\..\\out.swp", "a\\bad:s.swp", "bad.dll", "a \\out.swp"]) {
  assert.throws(() => validateBindings([{ macro, shortcut: "Alt+D" }]), /SWP macro/);
}
assert.throws(() => validateBindings([{ macro: "DXF_v16.swp", shortcut: "D" }]), /Invalid shortcut/);
assert.throws(() => validateBindings([{ macro: "DXF_v16.swp", shortcut: "Ctrl+Space" }]), /assigned more than once/);
assert.throws(() => validateBindings([
  { macro: "A.swp", shortcut: "Shift+Alt+D" }, { macro: "B.swp", shortcut: "Alt+Shift+D" },
]), /assigned more than once/);
assert.throws(() => validateBindings(Array(33).fill({ macro: "A.swp", shortcut: "Alt+A" })), /at most 32/);
const importedBindings = settingsPayloadFromDocument({ format: "excelsis-helper-settings", settings: {
  hotkeys: { macroShortcuts: [{ macro: "BOM_v19.swp", shortcut: "Alt+B" }] },
} });
assert.equal(mergeSettingsLayers(migratedRadius, importedBindings).hotkeys.macroShortcuts.length, 1, "Imported array replaces old bindings");

const burstContext = {};
vm.createContext(burstContext);
vm.runInContext(`${sourceBetween(
  "const DEFAULT_RECENT_DOC_NEW_ENTRY_BURST_SECONDS",
  "const MACRO_RUN_MARKER_CACHE_MS",
)}\n${sourceBetween(
  "function clampRecentDocNewEntryBurstSeconds",
  "function recentDocNewEntryBurstMs",
)}\nthis.clampBurstSeconds = clampRecentDocNewEntryBurstSeconds;`, burstContext);
assert.equal(burstContext.clampBurstSeconds(undefined), 4);
assert.equal(burstContext.clampBurstSeconds(-1), 0);
assert.equal(burstContext.clampBurstSeconds(4.26), 4.3);
assert.equal(burstContext.clampBurstSeconds(999), 120);
assert.match(source, /recentDocsNewEntryBurstSeconds:\s*DEFAULT_RECENT_DOC_NEW_ENTRY_BURST_SECONDS/);
assert.match(source, /recentDocsNewEntryBurstSeconds:\s*clampRecentDocNewEntryBurstSeconds\(/);
assert.match(rendererHtml, /id="settingsRecentDocsNewEntryBurstSeconds"[^>]*min="0"[^>]*max="120"/);
assert.match(rendererSource, /recentDocsNewEntryBurstSeconds:\s*Number\(ui\.settingsRecentDocsNewEntryBurstSeconds/);
const recentDocBody = sourceBetween("async function noteRecentDoc(", "function clampSolidWorksActivityPauseMinutes");
const macroGuardAt = recentDocBody.indexOf("!existing && await isMacroRecentDocSuppressionActive()");
const burstGuardAt = recentDocBody.indexOf("if (!existing && !force)");
assert.ok(macroGuardAt > 0 && macroGuardAt < burstGuardAt, "Macro suppression must precede burst handling.");

const polluted = mergeSettingsLayers(JSON.parse('{"__proto__":{"polluted":true}}'));
assert.equal(polluted.polluted, undefined);
assert.equal({}.polluted, undefined);
const nestedPolluted = mergeSettingsLayers(JSON.parse(
  '{"hotkeys":{"constructor":{"prototype":{"polluted":true}},"enabled":true},"items":[{"__proto__":{"polluted":true},"ok":1}]}'
));
assert.equal(nestedPolluted.hotkeys.enabled, true);
assert.equal(Object.prototype.hasOwnProperty.call(nestedPolluted.hotkeys, "constructor"), false);
assert.equal(nestedPolluted.items[0].ok, 1);
assert.equal(Object.prototype.hasOwnProperty.call(nestedPolluted.items[0], "__proto__"), false);
assert.equal({}.polluted, undefined);

const prefixContext = {};
vm.createContext(prefixContext);
vm.runInContext(`${sourceBetween(
  "function escapeRegexLiteral",
  "let activeProjectRootNames",
)}\nthis.testApi = { buildProjectNameRegex, buildProjectFolderRegexes };`, prefixContext);
assert.equal(prefixContext.testApi.buildProjectNameRegex([]), null);
assert.deepEqual(Array.from(prefixContext.testApi.buildProjectFolderRegexes([])), []);
assert.equal(prefixContext.testApi.buildProjectNameRegex(["PRJ"]).test("PRJ-26-01 Example"), true);
assert.equal(prefixContext.testApi.buildProjectNameRegex(["PRJ"]).test("OTHER-26-01 Example"), false);

const pathValidationContext = { path };
vm.createContext(pathValidationContext);
vm.runInContext(`${sourceBetween(
  "function cleanString",
  "const SETTINGS_EXPORT_FORMAT",
)}\nthis.validateSettingsPaths = validateAutomationSettingsPaths;`, pathValidationContext);
const validPathSettings = {
  hotkeys: { macroShortcuts: defaultShortcuts },
  erp: {
    worklogInbox: "C:\\Data\\ERP\\inbox",
    worklogWorktypes: "C:\\Data\\ERP\\worktypes.json",
    worklogUserName: "Test User",
    overtimeStartTime: "17:00",
  },
  cam: {
    outputRoot: "D:\\CAM",
    searchRoots: ["C:\\Projects"],
  },
  locations: {
    projectCodePrefixes: [],
    searchRoots: ["C:\\Users\\Public\\Documents"],
    exclusions: [],
  },
  macros: { drawingTemplate: "" },
  solidCam: { selectedDllPath: "" },
  gcode: { searchRoot: "D:\\CAM" },
};
assert.doesNotThrow(() => pathValidationContext.validateSettingsPaths(validPathSettings));
assert.throws(
  () => pathValidationContext.validateSettingsPaths({
    ...validPathSettings,
    erp: { ...validPathSettings.erp, worklogInbox: "" },
  }),
  /ERP worklog inbox is required/,
);
assert.doesNotThrow(
  () => pathValidationContext.validateSettingsPaths({
    ...validPathSettings,
    erp: { ...validPathSettings.erp, worklogUserName: "" },
  }),
);
assert.doesNotThrow(() => pathValidationContext.validateSettingsPaths({
  ...validPathSettings, macros: { defaultMaterial: "S235", dxfOutputPrefix: "" },
}));
for (const field of ["defaultMaterial", "dxfOutputPrefix"]) {
  assert.throws(() => pathValidationContext.validateSettingsPaths({
    ...validPathSettings, macros: { [field]: "bad/path" },
  }), /Windows filename/);
}
assert.throws(
  () => pathValidationContext.validateSettingsPaths({
    ...validPathSettings,
    cam: { ...validPathSettings.cam, outputRoot: "relative\\cam" },
  }),
  /CAM destination root must be an absolute path/,
);
assert.throws(
  () => pathValidationContext.validateSettingsPaths({
    ...validPathSettings,
    locations: { ...validPathSettings.locations, searchRoots: [] },
  }),
  /document search locations require at least one path/,
);

const macroCases = [
  ["BOM_v19", ["bomExportLanguage"]],
  ["BOM_v19_ROfriendy", ["bomExportLanguage"]],
  ["CNCDXF_v1", ["projectCodePrefixesText", "projectRootNamesText"]],
  ["CrawlScrews_v1", []],
  ["DXF_v16", ["defaultMaterial", "dxfOutputPrefix"]],
  ["DXF_v16_ROfriendy", ["defaultMaterial", "dxfOutputPrefix"]],
  ["PDF_v1", []],
  ["Radius_v9", []],
];
for (const [baseName, settingNames] of macroCases) {
  const sourceName = baseName === "CNCDXF_v1" ? "CNCDXF_v1.swb" : `${baseName}.swb`;
  const compiledName = baseName === "CNCDXF_v1" ? "CNCDXF_final_v1.swp" : `${baseName}.swp`;
  const macroSource = fs.readFileSync(path.join(__dirname, "..", "macros", sourceName), "utf8");
  const compiled = fs.readFileSync(path.join(__dirname, "..", "macros", compiledName));
  assert.match(macroSource, /schema"":""excelsis-helper-macro-run-v1/);
  assert.match(macroSource, /Sub main\([\s\S]{0,500}ExcelsisStartMacroRunMarker[\s\S]{0,500}ExcelsisStopMacroRunMarker/);
  assert.match(macroSource, /Private Sub ExcelsisMacroMain\(/);
  assert.deepEqual(Array.from(compiled.subarray(0, 4)), [0xd0, 0xcf, 0x11, 0xe0], `${compiledName} is not an OLE macro container`);
  for (const settingName of settingNames) {
    assert.match(macroSource, new RegExp(`ExcelsisMacroSetting\\("${settingName}"`), `${settingName} missing from ${sourceName}`);
  }
  if (settingNames.length) {
    assert.match(macroSource, /On Error GoTo MacroFailed\s+ExcelsisResetMacroSettings/);
    assert.match(macroSource, /Private Sub ExcelsisResetMacroSettings\(\)[\s\S]*?gExcelsisMacroSettingsLoaded = False[\s\S]*?gExcelsisMacroSettingsJson = ""/);
    assert.match(macroSource, /Helper macro settings could not be read/);
    assert.match(macroSource, /stream\.Charset = "utf-8"/);
  }
  if (baseName.startsWith("DXF_v16")) {
    assert.match(macroSource, /candidate reject=toolbox route=part-export/);
    assert.match(macroSource, /ProcessAssemblyCandidateSnapshot swModel, dxfFolder, False/);
    assert.match(macroSource, /Optional mode As Integer = MODE_REGULAR/);
    assert.match(macroSource, /exportFolder = CandidateExportFolder\(dxfFolder, swModel, swComp\)/);
    assert.match(macroSource, /exported = ExportOnePart\(swPart, partPath, cfg, qty, exportFolder, mode, Nothing\)/);
    assert.match(macroSource, /okHigh = body\.GetExtremePoint\(planeN\(0\), planeN\(1\), planeN\(2\), highX, highY, highZ\)/);
    assert.match(macroSource, /okLow = body\.GetExtremePoint\(-planeN\(0\), -planeN\(1\), -planeN\(2\), lowX, lowY, lowZ\)/);
    assert.doesNotMatch(macroSource, /GetThicknessViaVertexProjection|ProjectVertexOntoPlane/);
    assert.match(macroSource, /Private Sub InitializeRunDiagnostics\(\)/);
    assert.match(macroSource, /WriteDxfRunResult "ERROR", errorNumber, errorSource, errorDescription/);
    assert.doesNotMatch(macroSource, /Err\.Raise errorNumber, errorSource, errorDescription/);
  }
}
assert.match(source, /"pdf_v1\.swp":\s*"DXF_v161"/i);
assert.match(source, /async function findBundledCompiledMacros/);
assert.match(source, /path\.extname\(entry\.name\)\.toLowerCase\(\) !== "\.swp"/);
assert.match(source, /projectCodePrefixesText:\s*merged\.locations\.projectCodePrefixes\.join\(";"\)/);
assert.doesNotMatch(source, /automation:convert-swb-macros|replaceVbaStringConstant|findSwbMacros/);
assert.doesNotMatch(preloadSource, /convertSwbMacros/);
assert.doesNotMatch(rendererSource, /convertSwbMacros|settingsConvertMacros/);
assert.doesNotMatch(rendererSource, /updated \$\{macro\.updated/);
assert.doesNotMatch(rendererHtml, /id="settingsMacroDrawingTemplate"/);
assert.match(rendererHtml, /id="settingsWorkLoggingEnabled"[^>]*role="switch"/);
assert.match(source, /workLoggingEnabled: erp\.workLoggingEnabled !== false/);
assert.match(rendererSource, /workLoggingEnabled: ui\.settingsWorkLoggingEnabled\?\.checked !== false/);
assert.match(builderSource, /from: macros[\s\S]{0,100}\*\*\/\*\.swp/);
const externalSettings = settingsPayloadFromDocument(externalSettingsFixture);
assert.equal(externalSettings.erp.worklogUserName, "Example User");
assert.equal(externalSettings.erp.overtimeStartTime, "17:00");

console.log("Settings layering, Recent SW suppression, optional-prefix, and compiled-macro tests passed.");
