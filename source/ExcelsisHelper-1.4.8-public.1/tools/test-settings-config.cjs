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
const deploymentSidecarPath = path.join(__dirname, "..", "dist", "ExcelsisHelper-settings.json");

function sourceBetween(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0, `Missing start marker: ${startMarker}`);
  assert.ok(end > start, `Missing end marker: ${endMarker}`);
  return source.slice(start, end);
}

const settingsContext = {};
vm.createContext(settingsContext);
vm.runInContext(`${sourceBetween(
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
assert.throws(
  () => pathValidationContext.validateSettingsPaths({
    ...validPathSettings,
    erp: { ...validPathSettings.erp, worklogUserName: "" },
  }),
  /ERP worklog user name is required/,
);
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
}
assert.match(source, /async function findBundledCompiledMacros/);
assert.match(source, /path\.extname\(entry\.name\)\.toLowerCase\(\) !== "\.swp"/);
assert.match(source, /projectCodePrefixesText:\s*merged\.locations\.projectCodePrefixes\.join\(";"\)/);
assert.doesNotMatch(source, /automation:convert-swb-macros|replaceVbaStringConstant|findSwbMacros/);
assert.doesNotMatch(preloadSource, /convertSwbMacros/);
assert.doesNotMatch(rendererSource, /convertSwbMacros|settingsConvertMacros/);
assert.match(builderSource, /from: macros[\s\S]{0,100}\*\*\/\*\.swp/);
assert.equal(fs.existsSync(deploymentSidecarPath), false, "Public staging must not contain a settings sidecar");

console.log("Settings layering, Recent SW suppression, optional-prefix, and compiled-macro tests passed.");
