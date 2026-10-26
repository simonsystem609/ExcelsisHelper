"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const vm = require("node:vm");
const { createProjectFolderService, validateProjectName } = require("../project-folders.cjs");

const root = path.resolve(__dirname, "..");
const main = require("node:fs").readFileSync(path.join(root, "main.cjs"), "utf8");
function between(source, start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, start);
  return source.slice(a, b);
}

async function run() {
  // Keep all disposable evidence; never touch live project roots or delete it.
  const base = await fs.mkdtemp(path.join(root, "..", "tmp", "project-folders-"));
  const companyRoot = path.join(base, "Projects");
  const toolsRoot = path.join(base, "ToolProjects");
  await fs.mkdir(companyRoot);
  await fs.mkdir(toolsRoot);
  const settings = { projectFolders: {
    company: { name: "Company", root: companyRoot, prefix: "PRJ" },
    tools: { name: "Tools", root: toolsRoot, prefix: "PRT" },
  } };
  let time = new Date(2026, 11, 31, 23, 59);
  const calls = [];
  const io = new Proxy(fs, { get(target, key) {
    if (typeof target[key] !== "function") return target[key];
    return (...args) => { calls.push([key, ...args]); return target[key](...args); };
  } });
  const service = createProjectFolderService({ io, now: () => time });
  const preview = () => service.preview(settings, "company");
  let plan = await preview();
  assert.equal(plan.code, "PRJ-26-001");
  assert.equal(plan.suggestedName, "PRJ-26-001_");
  assert.deepEqual(await fs.readdir(companyRoot), [], "Preview/cancel must not create a year or project");
  assert.equal(calls.some(([key]) => ["mkdir", "rename", "writeFile"].includes(key)), false);

  const yearPath = path.join(companyRoot, "2026");
  await fs.mkdir(yearPath);
  for (const name of ["PRJ-26-01_Old", "prj-26-18_Old", "PRJ-25-999_Previous", "PRT-26-500_Other",
    "PRJ-26-999suffix", "Unnumbered"]) await fs.mkdir(path.join(yearPath, name));
  await fs.mkdir(path.join(yearPath, "Unnumbered", "PRJ-26-999_Nested"));
  const original = await fs.readdir(yearPath);
  plan = await preview();
  assert.equal(plan.code, "PRJ-26-019", "Take max, not count; recognize two-digit folders; no nested scan");
  assert.ok(calls.filter(([key]) => key === "opendir").every(([, folder]) => folder === yearPath));
  let result = await service.create(settings, { companyId: "company", token: plan.token, name: `${plan.code}_Fixture` });
  assert.equal(result.ok, true);
  assert.equal(result.name, "PRJ-26-019_Fixture");
  assert.deepEqual((await fs.readdir(yearPath)).sort(), [...original, result.name].sort());
  assert.equal((await preview()).code, "PRJ-26-020");
  result = await service.create(settings, { companyId: "company", token: plan.token, name: `${plan.code}_Other` });
  assert.equal(result.conflict, true, "Stale/repeated request must not create another project");
  assert.equal(result.preview.code, "PRJ-26-020");
  assert.equal((await fs.readdir(yearPath)).length, original.length + 1);

  plan = await service.preview(settings, "tools");
  assert.equal(plan.code, "PRT-26-001");
  result = await service.create(settings, { companyId: "tools", token: plan.token, name: plan.code });
  assert.equal(result.ok, true);
  assert.ok((await fs.stat(path.join(toolsRoot, "2026", "PRT-26-001"))).isDirectory());

  for (const name of ["../escape", "C:\\escape", "PRJ-26-020/sub", "PRJ-26-020:stream", "PRJ-26-020_bad\nname",
    "PRJ-26-020_bad.", " PRJ-26-020_title", "PRJ-26-020_title ", "PRJ-26-0200_wrong", "PRJ-26-019_wrong", "x".repeat(256)]) {
    assert.throws(() => validateProjectName(name, "PRJ-26-020"));
    const next = await preview();
    await assert.rejects(service.create(settings, { companyId: "company", token: next.token, name }));
  }
  validateProjectName("PRJ-26-020_M\u0171hely szersz\u00e1m", "PRJ-26-020");
  await assert.rejects(service.preview(settings, "constructor"), /Choose a company/);
  await assert.rejects(service.preview({ projectFolders: { company: { root: "relative", prefix: "PRJ" } } }, "company"), /company root/);
  await assert.rejects(service.preview({ projectFolders: { company: { root: companyRoot, prefix: "PRJ.*" } } }, "company"), /valid project prefix/);

  // Serialized double-clicks and independent service instances must not reuse a code.
  plan = await preview();
  const firstJob = service.create(settings, { companyId: "company", token: plan.token, name: `${plan.code}_A` });
  const secondJob = service.create(settings, { companyId: "company", token: plan.token, name: `${plan.code}_B` });
  const first = await firstJob;
  const second = await secondJob;
  assert.equal(first.ok, true);
  assert.equal(second.conflict, true);
  plan = await preview();
  const peer = createProjectFolderService({ now: () => time });
  const thirdJob = service.create(settings, { companyId: "company", token: plan.token, name: `${plan.code}_C` });
  const fourthJob = peer.create(settings, { companyId: "company", token: plan.token, name: `${plan.code}_D` });
  const third = await thirdJob;
  const fourth = await fourthJob;
  assert.equal([third, fourth].filter(value => value.ok).length, 1);
  assert.equal([third, fourth].filter(value => value.conflict).length, 1);
  assert.equal((await fs.readdir(yearPath)).filter(name => name.startsWith(plan.code)).length, 1);

  // Inject a project created between the final scan and code reservation.
  let race = false;
  const raceIo = Object.create(fs);
  raceIo.mkdir = async folder => {
    if (!race && path.basename(folder) === "PRJ-26-022") {
      race = true;
      await fs.mkdir(path.join(yearPath, "PRJ-26-022_External"));
    }
    return fs.mkdir(folder);
  };
  const racing = createProjectFolderService({ io: raceIo, now: () => time });
  plan = await racing.preview(settings, "company");
  assert.equal(plan.code, "PRJ-26-022");
  result = await racing.create(settings, { companyId: "company", token: plan.token, name: `${plan.code}_Ours` });
  assert.equal(result.ok, true);
  assert.equal(result.renumbered, true);
  assert.equal(result.name, "PRJ-26-023_Ours");
  assert.ok((await fs.stat(path.join(yearPath, "PRJ-26-022_External"))).isDirectory());

  plan = await preview();
  time = new Date(2027, 0, 1, 0, 1);
  result = await service.create(settings, { companyId: "company", token: plan.token, name: `${plan.code}_Rollover` });
  assert.equal(result.conflict, true);
  assert.equal(result.preview.code, "PRJ-27-001");
  assert.equal((await fs.readdir(companyRoot)).includes("2027"), false);
  plan = result.preview;
  result = await service.create(settings, { companyId: "company", token: plan.token, name: `${plan.code}_New year` });
  assert.equal(result.ok, true);
  assert.ok((await fs.stat(path.join(companyRoot, "2027", result.name))).isDirectory());

  const other = path.join(base, "Outside");
  await fs.mkdir(other);
  await fs.symlink(other, path.join(companyRoot, "2028"), process.platform === "win32" ? "junction" : "dir");
  time = new Date(2028, 0, 1);
  await assert.rejects(preview(), /linked or is not/);
  assert.deepEqual(await fs.readdir(other), []);
  time = new Date(2029, 0, 1);
  const missing = structuredClone(settings);
  missing.projectFolders.company.root = path.join(base, "MissingRoot");
  await assert.rejects(service.preview(missing, "company"), /ENOENT/);
  assert.equal((await fs.readdir(base)).includes("MissingRoot"), false);

  const failIo = Object.create(fs);
  failIo.rename = async () => { throw new Error("Simulated rename failure"); };
  const failing = createProjectFolderService({ io: failIo, now: () => time });
  plan = await failing.preview(settings, "company");
  result = await failing.create(settings, { companyId: "company", token: plan.token, name: `${plan.code}_Failure` });
  assert.equal(result.partial, true);
  assert.equal(result.created, true);
  assert.match(result.error, /Simulated rename failure/);
  assert.ok((await fs.stat(result.path)).isDirectory(), "Do not conceal/remove a partial creation");

  const preservationIo = Object.create(fs);
  let competingFolder = "";
  preservationIo.rename = async (from, to) => {
    competingFolder = to;
    await fs.mkdir(to);
    await fs.writeFile(path.join(to, "keep.txt"), "Existing project data", { flag: "wx" });
    return fs.rename(from, to);
  };
  const preservation = createProjectFolderService({ io: preservationIo, now: () => time });
  plan = await preservation.preview(settings, "company");
  result = await preservation.create(settings, { companyId: "company", token: plan.token, name: `${plan.code}_Competing` });
  assert.equal(result.partial, true);
  assert.equal(await fs.readFile(path.join(competingFolder, "keep.txt"), "utf8"), "Existing project data");
  assert.ok((await fs.stat(result.path)).isDirectory(), "Failed publication preserves our reservation too");

  let closedCappedScan = false;
  const cappedIo = Object.create(fs);
  cappedIo.opendir = async () => (async function* () {
    try { for (let index = 0; index <= 50000; index++) yield { name: `Other-${index}` }; }
    finally { closedCappedScan = true; }
  })();
  await assert.rejects(createProjectFolderService({ io: cappedIo, now: () => time }).preview(settings, "company"), /too many entries/);
  assert.equal(closedCappedScan, true, "Capped scans must close the directory iterator");
  await fs.mkdir(path.join(companyRoot, "2029", "PRJ-29-999999999_Limit"));
  await assert.rejects(preview(), /numbering has reached its limit/);

  const handlers = new Map();
  const effects = [];
  let openFails = false;
  const host = {
    trustedIpcHandle: (channel, fn) => handlers.set(channel, fn),
    readAutomationSettings: async options => { effects.push(["settings", options.force]); return settings; },
    validateProjectFolders: value => { assert.equal(value, settings.projectFolders); },
    projectFolders: {
      preview: async (saved, id) => { assert.equal(saved, settings); effects.push(["preview", id]); return { code: "PRJ-29-001" }; },
      create: async (saved, request) => { assert.equal(saved, settings); effects.push(["create", request]);
        return request.conflict ? { ok: false, conflict: true } : { ok: true, created: true, path: "C:\\Configured\\2029\\PRJ-29-001_Test" }; },
    },
    shell: { openPath: async folder => { effects.push(["open", folder]);
      if (openFails) throw new Error("Explorer unavailable"); return ""; } },
  };
  vm.createContext(host);
  vm.runInContext(between(main, 'trustedIpcHandle("automation:project-folder-preview"',
    'trustedIpcHandle("automation:recent-folder-action"'), host);
  assert.equal((await handlers.get("automation:project-folder-preview")({}, "tools")).ok, true);
  const untrusted = { companyId: "company", name: "PRJ-29-001_Test", root: "C:\\NotAuthorized" };
  result = await handlers.get("automation:project-folder-create")({}, untrusted);
  assert.equal(result.opened, true);
  assert.equal(effects.at(-1)[1], "C:\\Configured\\2029\\PRJ-29-001_Test");
  openFails = true;
  result = await handlers.get("automation:project-folder-create")({}, untrusted);
  assert.equal(result.ok, true, "Explorer failure must not invite duplicate creation");
  assert.equal(result.created, true);
  assert.equal(result.warning, "Explorer unavailable");
  effects.length = 0;
  await handlers.get("automation:project-folder-create")({}, { conflict: true });
  assert.equal(effects.some(([name]) => name === "open"), false);

  const preload = await fs.readFile(path.join(root, "preload.cjs"), "utf8");
  const builder = await fs.readFile(path.join(root, "electron-builder.yml"), "utf8");
  assert.match(preload, /previewProjectFolder:.*automation:project-folder-preview/);
  assert.match(preload, /createProjectFolder:.*automation:project-folder-create/);
  assert.match(builder, /- project-folders\.cjs/);
  const configContext = {
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
  vm.createContext(configContext);
  vm.runInContext([
    between(main, "function clampNumber", "function normalizeWorklogWorkTypeList"),
    between(main, "const DEFAULT_CAM_ROOT", "const SETTINGS_EXPORT_FORMAT"),
    between(main, "const SETTINGS_BLOCKED_KEYS", "async function readSettingsDocument"),
    "this.api = { mergeAutomationSettings, validateProjectFolders, validateAutomationSettingsPaths, mergeSettingsLayers, settingsPayloadFromDocument };",
  ].join("\n"), configContext);
  const config = configContext.api;
  const generic = config.mergeAutomationSettings();
  config.validateAutomationSettingsPaths(generic);
  assert.deepEqual(JSON.parse(JSON.stringify(generic.projectFolders)), {
    company: { name: "Company", root: "", prefix: "PRJ" }, tools: { name: "Tools", root: "", prefix: "PRT" },
  });
  const preset = { projectFolders: {
    company: { name: "Engineering", root: "C:\\Projects", prefix: "JOB" },
    tools: { name: "Tooling", root: "C:\\Tooling", prefix: "TOOL" },
  } };
  const layered = config.mergeAutomationSettings(config.mergeSettingsLayers(preset, {
    projectFolders: { company: { name: "My Company", prefix: "myjob" }, tools: { root: "" } },
  }));
  config.validateProjectFolders(layered.projectFolders);
  assert.equal(layered.projectFolders.company.name, "My Company");
  assert.equal(layered.projectFolders.company.prefix, "MYJOB");
  assert.equal(layered.projectFolders.company.root, "C:\\Projects");
  assert.equal(layered.projectFolders.tools.root, "", "Cleared root must not revive private preset value");
  assert.equal(JSON.stringify(config.mergeAutomationSettings(config.settingsPayloadFromDocument({
    format: "excelsis-helper-settings", settings: layered,
  }))), JSON.stringify(layered));
  for (const prefix of ["A-B", "_JOB", "1JOB", "JOB.*", "X".repeat(13)]) {
    assert.throws(() => config.validateProjectFolders({ ...generic.projectFolders,
      company: { ...generic.projectFolders.company, prefix } }), /Project prefixes/);
  }
  for (const folder of ["relative", "C:relative", "\\\\server", "\\\\?\\C:\\Projects", "C:\\path:stream", "C:\\bad\nname"]) {
    assert.throws(() => config.validateProjectFolders({ ...generic.projectFolders,
      company: { ...generic.projectFolders.company, root: folder } }), /absolute Windows/);
  }
  const duplicate = { company: { name: "A", root: "C:\\Projects", prefix: "JOB" },
    tools: { name: "B", root: "c:\\projects\\", prefix: "JOB" } };
  assert.throws(() => config.validateProjectFolders(duplicate), /different root or prefix/);
  for (const name of ["", "A".repeat(81), "two\nlines"]) {
    assert.throws(() => config.validateProjectFolders({ ...generic.projectFolders,
      company: { ...generic.projectFolders.company, name } }), /company names/);
  }
  console.log(`Project folders passed: shallow previews, numbering, rollover, names, conflicts, reservations, links, failures and IPC. Evidence: ${base}`);
}

run().catch(error => { console.error(error); process.exitCode = 1; });
