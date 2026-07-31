const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const mainPath = path.join(__dirname, "..", "main.cjs");
const source = fs.readFileSync(mainPath, "utf8");
const rendererSource = fs.readFileSync(path.join(__dirname, "..", "automation.js"), "utf8");
const rendererHtml = fs.readFileSync(path.join(__dirname, "..", "automation.html"), "utf8");

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

const macroContext = {};
vm.createContext(macroContext);
vm.runInContext(`${sourceBetween(
  "function escapeRegexLiteral",
  "function projectPrefixAlternation",
)}\n${sourceBetween(
  "function replaceVbaStringConstant",
  "async function backupMacroForSettingsSync",
)}\nthis.replaceConstant = replaceVbaStringConstant;`, macroContext);
const macroCases = [
  ["BOM_v19.swb", ["BOM_EXPORT_LANGUAGE"]],
  ["BOM_v19_ROfriendy.swb", ["BOM_EXPORT_LANGUAGE"]],
  ["CNCDXF_v1.swb", ["OUTPUT_ROOT", "PROJECT_PREFIXES", "PROJECT_ROOT_NAMES"]],
  ["DXF_v16.swb", ["DEFAULT_MATERIAL", "DRAW_TEMPLATE", "DXF_OUTPUT_PREFIX"]],
  ["DXF_v16_ROfriendy.swb", ["DEFAULT_MATERIAL", "DRAW_TEMPLATE", "DXF_OUTPUT_PREFIX"]],
];
for (const [fileName, constants] of macroCases) {
  let text = fs.readFileSync(path.join(__dirname, "..", "macros", fileName), "utf8");
  for (const constantName of constants) {
    const result = macroContext.replaceConstant(text, constantName, 'A"B');
    assert.equal(result.found, true, `${constantName} missing from ${fileName}`);
    assert.match(result.text, /"A""B"/);
    text = result.text;
  }
}

console.log("Settings layering, optional-prefix, and macro-sync tests passed.");
