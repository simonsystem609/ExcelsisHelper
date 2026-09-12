const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "main.cjs"), "utf8");
function between(start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, start);
  return source.slice(a, b);
}

async function test() {
  let settings = { erp: { workLoggingEnabled: true, worklogUserName: "", worklogInbox: "D:\\Shop\\Inbox" } };
  const effects = [];
  const files = new Map();
  let disableDuringWrite = false;
  const context = {
    Date, path: path.win32,
    os: { userInfo: () => ({ username: "Windows User" }) },
    cleanString: (v) => typeof v === "string" ? v.trim() : "",
    readAutomationSettings: async () => structuredClone(settings),
    resetProjectActivitySample: () => effects.push("sample-reset"),
    clearRememberedWorkLoggerDocument: () => effects.push("document-reset"),
    unsavedWorkTracker: { pause: () => effects.push("unsaved-pause"), observe: () => { throw new Error("Disabled tracker sampled"); } },
    scheduleProjectActivityMidnightReset: () => effects.push("midnight-schedule"),
    lastWorkLoggerCounterStatus: { updatedAt: 1, isCounting: true },
    setTimeout: () => { effects.push("timer-start"); return { unref() {} }; },
    clearTimeout: () => effects.push("timer-stop"),
    shouldCountSolidWorksActivity: () => { throw new Error("Disabled logger inspected activity"); },
    ensureProjectActivityToday: async () => { throw new Error("Disabled export touched history"); },
    loadProjectActivity: async () => { throw new Error("Disabled logger loaded history"); },
    readLatestProjectActivityBackup: async () => { throw new Error("Disabled export read a backup"); },
    loadSavedWorklogExportRules: async () => { throw new Error("Disabled scheduler read rules"); },
    localDateKey: () => "2026-09-08",
    crypto: { randomBytes: () => Buffer.from("test") },
    erpWorklogInbox: (v) => v.erp.worklogInbox,
    computeProjectExportMinutes: () => new Map([["demo", {
      exportable: true, originalMinutes: 40, roundedMinutes: 60, hours: 1,
      timeBuckets: [{ exportable: true, roundedMinutes: 60, overtime: false }],
    }]]),
    worklogProjectExportKey: (p) => p.key,
    worklogProjectExportWorkTypes: () => ["Design"],
    worklogExportDocNote: () => "",
    splitWorklogExportMinutes: (minutes) => [minutes],
    worklogExportExternalId: () => "fixture-id",
    worklogExportStamp: () => "fixture-stamp",
    WORKLOG_EXPORT_SOURCE: "excelsis-helper-worklogger",
    fs: {
      mkdir: async () => {},
      writeFile: async (file, bytes) => {
        files.set(file, bytes);
        if (disableDuringWrite) context.api.applyWorkLoggingSettings({ erp: { workLoggingEnabled: false } });
      },
      rename: async (from, to) => { files.set(to, files.get(from)); files.delete(from); },
      unlink: async () => { throw new Error("Unexpected export cleanup"); },
    },
  };
  vm.createContext(context);
  vm.runInContext([
    between("const DEFAULT_ERP_WORKLOG_USER_NAME", "const DEFAULT_ERP_OVERTIME_START_TIME"),
    between("const AUTO_EXPORT_START", "async function noteRecentDoc("),
    between("function currentWorkLoggerCounterStatus", "function rememberWorkLoggerCountableDocument"),
    between("async function addProjectActivityDuration", "async function addProjectActivityTime"),
    between("async function trackProjectActivityFromStatus", "const DEFAULT_CAM_ROOT"),
    between("async function writeWorklogExportEntries", "// --- Midnight auto-export"),
    "this.api = { isWorkLoggingEnabled, erpWorklogUserName, applyWorkLoggingSettings, trackProjectActivityFromStatus, addProjectActivityDuration, exportProjectActivityToErp, exportLastDayWorklogs, writeWorklogExportEntries, attemptMidnightAutoExport, scheduleMidnightAutoExport, currentWorkLoggerCounterStatus };",
  ].join("\n"), context);
  const api = context.api;
  assert.equal(api.isWorkLoggingEnabled({}), true, "Existing settings retain enabled behavior");
  assert.equal(api.erpWorklogUserName(settings), "Windows User");
  assert.equal(api.erpWorklogUserName({ erp: { worklogUserName: "Custom ERP User" } }), "Custom ERP User");

  settings.erp.workLoggingEnabled = false;
  api.applyWorkLoggingSettings(settings);
  assert.equal(api.currentWorkLoggerCounterStatus().code, "disabled");
  assert.equal((await api.trackProjectActivityFromStatus({ activeDocument: { path: "C:\\Part.SLDPRT" } })).counted, false);
  assert.equal(await api.addProjectActivityDuration("C:\\Part.SLDPRT", 2000, 10000), null);
  assert.equal((await api.exportProjectActivityToErp()).disabled, true);
  assert.equal((await api.exportLastDayWorklogs()).disabled, true);
  assert.equal((await api.writeWorklogExportEntries([], "2026-09-08", {}, {})).disabled, true);
  await api.attemptMidnightAutoExport("2026-09-08");
  api.scheduleMidnightAutoExport();
  assert.equal(effects.filter((e) => e === "timer-start").length, 0);
  assert.equal(effects.filter((e) => e === "unsaved-pause").length, 1);
  assert.equal(files.size, 0);

  settings.erp.workLoggingEnabled = true;
  api.applyWorkLoggingSettings(settings);
  assert.equal(effects.filter((e) => e === "timer-start").length, 1);
  assert.equal(effects.filter((e) => e === "unsaved-pause").length, 2);
  const result = await api.writeWorklogExportEntries([{ key: "demo", name: "Demo" }], "2026-09-08", {
    defaultWorkType: "Design", roundToMinutes: 30,
  }, {});
  assert.equal(result.ok, true);
  const published = [...files].find(([file]) => file.endsWith(".json"));
  assert.ok(published[0].startsWith(settings.erp.worklogInbox));
  assert.equal(JSON.parse(published[1]).defaults.userName, "Windows User");
  assert.equal(JSON.parse(published[1]).entries[0].minutes, 60);

  files.clear();
  disableDuringWrite = true;
  const interrupted = await api.writeWorklogExportEntries([{ key: "demo", name: "Demo" }], "2026-09-08", {
    defaultWorkType: "Design", roundToMinutes: 30,
  }, {});
  assert.equal(interrupted.disabled, true);
  assert.equal([...files.keys()].some((file) => file.endsWith(".json")), false);
  assert.equal([...files.keys()].some((file) => file.endsWith(".tmp")), true);
  console.log("Work Logger enable/disable gates, timer cancellation, optional username, export paths, and in-flight cancellation tests passed.");
}

test().catch((error) => { console.error(error); process.exitCode = 1; });
