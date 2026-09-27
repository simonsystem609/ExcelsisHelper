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
    worklogExportDocNote: () => "",
    worklogExportExternalId: (_project, _date, _rules, _minutes, segment) =>
      `fixture-${segment.category}-${segment.overtime ? "ot" : "reg"}`,
    worklogExportStamp: () => "fixture-stamp",
    WORKLOG_EXPORT_SOURCE: "excelsis-helper-worklogger",
    DESIGN_WORKLOG_EXPORT_WORKTYPE: "3D Tervezés",
    DRAWING_CAM_WORKLOG_EXPORT_WORKTYPE: "Rajzkészítés/CAM programozás",
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
    between("function drawingCamActivityTotals", "async function addProjectActivityDuration"),
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
  assert.equal(JSON.parse(published[1]).entries[0].workType, "3D Tervezés");

  files.clear();
  context.computeProjectExportMinutes = () => new Map([["demo", {
    exportable: true, originalMinutes: 100, roundedMinutes: 120, hours: 2,
    timeBuckets: [
      { exportable: true, category: "design", overtime: false, roundedMinutes: 30 },
      { exportable: true, category: "drawingCam", overtime: false, roundedMinutes: 30 },
      { exportable: true, category: "design", overtime: true, roundedMinutes: 30 },
      { exportable: true, category: "drawingCam", overtime: true, roundedMinutes: 30 },
    ],
  }]]);
  const split = await api.writeWorklogExportEntries([{ key: "demo", name: "Demo" }], "2026-09-08", {}, {});
  assert.equal(split.ok, true);
  const splitEntries = JSON.parse([...files].find(([file]) => file.endsWith(".json"))[1]).entries;
  assert.deepEqual(splitEntries.map(({ workType, overtime, minutes }) => [workType, overtime, minutes]), [
    ["3D Tervezés", false, 30],
    ["Rajzkészítés/CAM programozás", false, 30],
    ["3D Tervezés", true, 30],
    ["Rajzkészítés/CAM programozás", true, 30],
  ]);
  assert.equal(new Set(splitEntries.map((entry) => entry.externalId)).size, 4);

  files.clear();
  const storedSaturday = { key: "demo", name: "Demo", totalMs: 34 * 60000, overtimeMs: 24 * 60000 };
  context.computeProjectExportMinutes = (projects) => new Map([["demo", {
    exportable: true, originalMinutes: 34, roundedMinutes: 30, hours: 0.5,
    timeBuckets: [{ exportable: true, category: "design", overtime: projects[0].overtimeMs === projects[0].totalMs, roundedMinutes: 30 }],
  }]]);
  const weekendExport = await api.writeWorklogExportEntries([storedSaturday], "2026-09-26", {}, {});
  assert.equal(weekendExport.ok, true);
  assert.equal(storedSaturday.overtimeMs, 24 * 60000);
  const weekendEntries = JSON.parse([...files].find(([file]) => file.endsWith(".json"))[1]).entries;
  assert.equal(weekendEntries[0].overtime, true);

  files.clear();
  const missingType = await api.writeWorklogExportEntries(
    [{ key: "demo", name: "Demo" }], "2026-09-08", {},
    { ok: true, workTypes: ["3D Tervezés"] },
  );
  assert.equal(missingType.ok, false);
  assert.equal(files.size, 0);

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
