"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const main = fs.readFileSync(path.join(root, "main.cjs"), "utf8");
const renderer = fs.readFileSync(path.join(root, "automation.js"), "utf8");
const preload = fs.readFileSync(path.join(root, "preload.cjs"), "utf8");
const html = fs.readFileSync(path.join(root, "automation.html"), "utf8");
function between(source, start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, start);
  return source.slice(a, b);
}

const context = {
  path: path.win32, os: { homedir: () => "C:\\Example" },
  DEFAULT_ERP_WORKLOG_INBOX: "C:\\Example\\ERP\\inbox",
  DEFAULT_ERP_WORKLOG_WORKTYPES: "C:\\Example\\ERP\\worktypes.json",
  DEFAULT_WORKLOG_DOC_MIN_MINUTES: 5, DEFAULT_ERP_WORKLOG_USER_NAME: "",
  DEFAULT_ERP_OVERTIME_START_TIME: "17:00", DEFAULT_SOLIDWORKS_ACTIVITY_PAUSE_MINUTES: 3,
  DEFAULT_RECENT_DOC_NEW_ENTRY_BURST_SECONDS: 4,
  DEFAULT_PROJECT_ROOT_NAMES: ["Projects"], DEFAULT_PROJECT_CODE_PREFIXES: [],
  DEFAULT_DOC_SEARCH_EXCLUSIONS: [], defaultDocSearchRoots: () => ["C:\\Example\\Projects"],
  clampWorklogDocMinMinutes: value => value, normalizeWorklogOvertimeStartTime: value => value,
  clampSolidWorksActivityPauseMinutes: value => value, clampRecentDocNewEntryBurstSeconds: value => value,
};
vm.createContext(context);
vm.runInContext([
  between(main, "function clampNumber", "function normalizeWorklogWorkTypeList"),
  between(main, "const DEFAULT_CAM_ROOT", "const SETTINGS_EXPORT_FORMAT"),
  between(main, "const SETTINGS_BLOCKED_KEYS", "async function readSettingsDocument"),
  "this.api = { mergeAutomationSettings, validateAutomationSettingsPaths, validateRecentDocsFolder, mergeSettingsLayers, settingsPayloadFromDocument };",
].join("\n"), context);
const { mergeAutomationSettings: merge, validateAutomationSettingsPaths: validate,
  validateRecentDocsFolder: validateFolder, mergeSettingsLayers: layer, settingsPayloadFromDocument: payload } = context.api;
const plain = value => JSON.parse(JSON.stringify(value));
const generic = merge();
assert.deepEqual(plain(generic.recentDocsFolder), { path: "", copyLabel: "Copy Folder Path", openLabel: "Open Folder" });
validate(generic);
validate({ ...generic, recentDocsFolder: undefined });
const preset = payload({ format: "excelsis-helper-settings", settings: {
  recentDocsFolder: { path: "C:\\Drawing Archive", copyLabel: "Copy drawings", openLabel: "Open drawings" },
} });
const defaults = merge(preset);
const existing = merge(layer(preset, { recentDocsFolder: { copyLabel: "My copy button" } }));
assert.equal(existing.recentDocsFolder.path, defaults.recentDocsFolder.path);
assert.equal(existing.recentDocsFolder.copyLabel, "My copy button");
assert.deepEqual(plain(merge(payload({ format: "excelsis-helper-settings", settings: existing }))), plain(existing));
assert.equal(merge(layer(preset, { recentDocsFolder: { path: "" } })).recentDocsFolder.path, "",
  "Clearing the path must not revive a private preset path");
assert.equal(merge({ recentDocsFolder: { path: "  C:\\Drawings  ", copyLabel: "   " } }).recentDocsFolder.path, "C:\\Drawings");
assert.equal(merge({ recentDocsFolder: { copyLabel: "   " } }).recentDocsFolder.copyLabel, "Copy Folder Path");
for (const folderPath of ["C:\\Drawings", "X:\\", "C:/Drawings", "\\\\server\\share", "\\\\server\\share\\Drawings"]) {
  validateFolder({ ...plain(generic.recentDocsFolder), path: folderPath });
}
for (const folderPath of ["relative", "C:Drawings", "\\Drawings", "https://example.test", "file:///C:/Drawings",
  "\\\\server", "\\\\?\\C:\\Drawings", "\\\\.\\pipe\\test", "C:\\file:stream", 'C:\\bad"name', "C:\\bad\nname"]) {
  assert.throws(() => validateFolder({ ...plain(generic.recentDocsFolder), path: folderPath }), /absolute Windows folder/);
}
for (const copyLabel of ["", "a".repeat(81), "two\nlines", "bad\x00label"]) {
  assert.throws(() => validateFolder({ ...plain(generic.recentDocsFolder), copyLabel }), /1 to 80 characters/);
}
validateFolder({ ...plain(generic.recentDocsFolder), copyLabel: "a".repeat(80) });
assert.match(preload, /recentFolderAction: \(action\) => ipcRenderer\.invoke\("automation:recent-folder-action", action\)/);
assert.match(html, /data-settings-reset="recent-folder"/);
assert.match(html, /class="recent-folder-button-label" data-no-i18n/);
assert.match(renderer, /el\.hasAttribute\("data-no-i18n"\)/);
assert.match(renderer, /recentDocsFolder:\s*\{\s*path: \(ui\.settingsRecentFolderPath/);
assert.match(renderer, /case "recent-folder":/);

async function run() {
  const effects = [];
  let settings = plain(defaults);
  let statResult = "folder";
  let openError = "";
  const handlers = new Map();
  const host = {
    validateRecentDocsFolder: validateFolder,
    trustedIpcHandle: (channel, fn) => handlers.set(channel, fn),
    readAutomationSettings: async () => { effects.push("settings"); return structuredClone(settings); },
    clipboard: { writeText: value => effects.push(["clipboard", value]) },
    fs: { stat: async value => {
      effects.push(["stat", value]);
      if (statResult === "missing") throw new Error("Folder not found.");
      return { isDirectory: () => statResult === "folder" };
    } },
    shell: { openPath: async value => { effects.push(["open", value]); return openError; } },
  };
  vm.createContext(host);
  vm.runInContext(between(main, 'trustedIpcHandle("automation:recent-folder-action"',
    'trustedIpcHandle("automation:open-containing-folder"'), host);
  const handler = handlers.get("automation:recent-folder-action");
  assert.equal((await handler({}, "copy")).clipboardText, settings.recentDocsFolder.path);
  assert.deepEqual(effects, ["settings", ["clipboard", "C:\\Drawing Archive"]], "Copy must not access storage or SW");
  effects.length = 0;
  assert.equal((await handler({}, "open", "C:\\untrusted.exe")).ok, true);
  assert.deepEqual(effects, ["settings", ["stat", "C:\\Drawing Archive"], ["open", "C:\\Drawing Archive"]]);
  for (statResult of ["file", "missing"]) {
    effects.length = 0;
    assert.equal((await handler({}, "open")).ok, false);
    assert.equal(effects.some(effect => Array.isArray(effect) && effect[0] === "open"), false);
  }
  statResult = "folder";
  openError = "Windows could not open this folder.";
  assert.equal((await handler({}, "open")).error, openError);
  settings.recentDocsFolder.path = "";
  effects.length = 0;
  assert.equal((await handler({}, "copy")).ok, false);
  assert.deepEqual(effects, ["settings"]);
  effects.length = 0;
  assert.equal((await handler({}, "delete")).ok, false);
  assert.deepEqual(effects, []);
  settings.recentDocsFolder.path = "C:\\example.exe:stream";
  effects.length = 0;
  assert.equal((await handler({}, "open")).ok, false);
  assert.deepEqual(effects, ["settings"]);

  const button = () => ({ text: { textContent: "" }, attributes: {},
    querySelector() { return this.text; }, setAttribute(key, value) { this.attributes[key] = value; } });
  let resolve;
  let calls = 0;
  const logs = [];
  const view = { state: { settings: plain(defaults), recentFolderActionRunning: false },
    ui: { copyRecentFolderPathBtn: button(), openRecentFolderBtn: button() },
    t: value => value, log: (...args) => logs.push(args),
    api: { recentFolderAction: () => { calls++; return new Promise(done => { resolve = done; }); } },
  };
  vm.createContext(view);
  vm.runInContext(between(renderer, "function renderRecentFolderButtons", "function renderSettings")
    + "\nthis.render = renderRecentFolderButtons; this.action = recentFolderAction;", view);
  view.render(view.state.settings);
  assert.equal(view.ui.copyRecentFolderPathBtn.text.textContent, "Copy drawings");
  assert.equal(view.ui.openRecentFolderBtn.disabled, false);
  const running = view.action("open");
  await view.action("open");
  assert.equal(calls, 1, "Repeated clicks must not spam Explorer");
  assert.equal(view.ui.copyRecentFolderPathBtn.disabled, true);
  resolve({ ok: false, error: "offline share" });
  await running;
  assert.equal(view.ui.copyRecentFolderPathBtn.disabled, false);
  assert.equal(logs[0][1].error, "offline share");
  view.state.settings.recentDocsFolder.path = "";
  view.render(view.state.settings);
  assert.equal(view.ui.copyRecentFolderPathBtn.disabled, true);
  assert.equal(view.ui.openRecentFolderBtn.disabled, true);
  console.log("Recent folder shortcut settings, trusted IPC and renderer checks passed.");
}

run().catch(error => { console.error(error); process.exitCode = 1; });
