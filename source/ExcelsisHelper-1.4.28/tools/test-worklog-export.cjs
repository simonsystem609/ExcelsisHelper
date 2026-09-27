const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const main = fs.readFileSync(path.join(root, "main.cjs"), "utf8");
const renderer = fs.readFileSync(path.join(root, "automation.js"), "utf8");

function between(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0, `Missing start marker: ${startMarker}`);
  assert.ok(end > start, `Missing end marker: ${endMarker}`);
  return source.slice(start, end);
}

const context = {
  DEFAULT_WORKLOG_EXPORT_RULES: { cutoffMinutes: 9, multiplier: 2, roundToMinutes: 30 },
  projectActivityKey: (value) => String(value || "").trim().toLowerCase(),
};
vm.createContext(context);
vm.runInContext(`${between(main, "function drawingCamActivityTotals", "async function addProjectActivityDuration")}
${between(
  main,
  "function clampNumber",
  "function worklogExportExternalId",
)}\nthis.testApi = { sanitizeWorklogExportRules, persistentWorklogExportRules, computeProjectExportMinutes, isWeekendProjectActivityDate, projectActivityWithWeekendOvertime };`, context);

const {
  sanitizeWorklogExportRules,
  persistentWorklogExportRules,
  computeProjectExportMinutes,
  isWeekendProjectActivityDate,
  projectActivityWithWeekendOvertime,
} = context.testApi;
const projects = [
  { key: "alpha", name: "Alpha", totalMs: 40 * 60000, drawingCamMs: 20 * 60000 },
  { key: "beta", name: "Beta", totalMs: 65 * 60000 },
];
const rules = sanitizeWorklogExportRules({
  cutoffMinutes: 9,
  multiplier: 1,
  roundToMinutes: 30,
  defaultWorkType: "obsolete manual choice",
  splitByWorkType: true,
});
const computed = computeProjectExportMinutes(projects, rules);
assert.equal(computed.get("alpha").exportable, true);
assert.equal(computed.get("alpha").roundedMinutes, 60);
assert.deepEqual(Array.from(computed.get("alpha").timeBuckets, (bucket) => [bucket.category, bucket.roundedMinutes]), [
  ["design", 30], ["drawingCam", 30],
]);
assert.equal(computed.get("beta").exportable, true);
assert.equal(Object.hasOwn(rules, "defaultWorkType"), false);
assert.equal(Object.hasOwn(rules, "splitByWorkType"), false);

const storedSaturday = Object.freeze({
  key: "weekend", name: "Weekend", totalMs: 34 * 60000,
  overtimeMs: 24 * 60000, drawingCamMs: 0,
});
assert.equal(isWeekendProjectActivityDate("2026-09-26"), true);
assert.equal(isWeekendProjectActivityDate("2026-09-27"), true);
assert.equal(isWeekendProjectActivityDate("2026-09-28"), false);
assert.equal(isWeekendProjectActivityDate("2026-09-31"), false);
const projectedSaturday = projectActivityWithWeekendOvertime(storedSaturday, "2026-09-26");
assert.equal(projectedSaturday.overtimeMs, 34 * 60000);
assert.equal(storedSaturday.overtimeMs, 24 * 60000, "Stored work-log records stay untouched");
assert.equal(projectActivityWithWeekendOvertime(storedSaturday, "2026-09-28"), storedSaturday);
context.activeWorklogExportDocMinMs = 0;
context.projectActivityDocNames = () => [];
vm.runInContext(`${between(main, "function mapProjectActivityValues", "function listProjectActivityBackupsSync")}
this.mapProjectActivityValues = mapProjectActivityValues;`, context);
const saturdaySummary = context.mapProjectActivityValues([storedSaturday], "lastActive", 10000, "2026-09-26")[0];
assert.equal(saturdaySummary.overtimeMinutes, 34);
assert.equal(saturdaySummary.weekendOvertime, true);
const mondaySummary = context.mapProjectActivityValues([storedSaturday], "lastActive", 10000, "2026-09-28")[0];
assert.equal(mondaySummary.overtimeMinutes, 24);
assert.equal(mondaySummary.weekendOvertime, false);
assert.deepEqual(Array.from(
  computeProjectExportMinutes([projectedSaturday], rules).get("weekend").timeBuckets,
  (bucket) => [bucket.id, bucket.roundedMinutes],
), [["design-overtime", 30]]);

const mixedWeekend = projectActivityWithWeekendOvertime({
  totalMs: 60 * 60000, overtimeMs: 20 * 60000,
  drawingCamMs: 25 * 60000, drawingCamOvertimeMs: 5 * 60000,
}, "2026-09-27");
assert.equal(mixedWeekend.overtimeMs, 60 * 60000);
assert.equal(mixedWeekend.drawingCamOvertimeMs, 25 * 60000);

const quarterHourRules = sanitizeWorklogExportRules({
  cutoffMinutes: 1,
  multiplier: 1,
  roundToMinutes: 15,
});
assert.equal(computeProjectExportMinutes(projects, quarterHourRules).get("alpha").roundedMinutes, 60);

const persistent = persistentWorklogExportRules(rules);
assert.equal(Object.prototype.hasOwnProperty.call(persistent, "splitByWorkType"), false);
assert.equal(persistent.cutoffMinutes, 9);

const targetRules = sanitizeWorklogExportRules({
  cutoffMinutes: 9,
  targetHoursMode: true,
  targetHours: 2,
});
const targetComputed = computeProjectExportMinutes(projects, targetRules);
assert.equal(Array.from(targetComputed.values()).reduce((sum, entry) => sum + entry.roundedMinutes, 0), 120);

const mixedRules = sanitizeWorklogExportRules({
  cutoffMinutes: 9,
  multiplier: 1,
  roundToMinutes: 30,
});
const mixed = computeProjectExportMinutes([
  { key: "mixed", name: "Mixed", totalMs: 40 * 60000, overtimeMs: 20 * 60000 },
], mixedRules).get("mixed");
assert.equal(mixed.exportable, true);
assert.equal(mixed.roundedMinutes, 60);
assert.deepEqual(
  Array.from(mixed.timeBuckets, (bucket) => [bucket.id, bucket.exportable, bucket.roundedMinutes]),
  [["design-regular", true, 30], ["design-overtime", true, 30]],
);

const overtimeBelowCutoff = computeProjectExportMinutes([
  { key: "mostly-regular", name: "Mostly regular", totalMs: 40 * 60000, overtimeMs: 8 * 60000 },
], mixedRules).get("mostly-regular");
assert.equal(overtimeBelowCutoff.roundedMinutes, 30);
assert.deepEqual(
  Array.from(overtimeBelowCutoff.timeBuckets, (bucket) => [bucket.id, bucket.exportable, bucket.roundedMinutes]),
  [["design-regular", true, 30], ["design-overtime", false, 0]],
);

const bothBelowCutoff = computeProjectExportMinutes([
  { key: "too-short", name: "Too short", totalMs: 16 * 60000, overtimeMs: 8 * 60000 },
], mixedRules).get("too-short");
assert.equal(bothBelowCutoff.exportable, false);

const categorySplit = computeProjectExportMinutes([{
  key: "four", name: "Four", totalMs: 100 * 60000,
  overtimeMs: 30 * 60000, drawingCamMs: 40 * 60000, drawingCamOvertimeMs: 10 * 60000,
}], mixedRules).get("four");
assert.deepEqual(Array.from(categorySplit.timeBuckets, (bucket) => [bucket.id, bucket.totalMs / 60000, bucket.roundedMinutes]), [
  ["design-regular", 40, 30],
  ["drawing-cam-regular", 30, 30],
  ["design-overtime", 20, 30],
  ["drawing-cam-overtime", 10, 30],
]);
assert.equal(categorySplit.roundedMinutes, 120);

const legacyDrawing = computeProjectExportMinutes([{
  key: "legacy", name: "Legacy", totalMs: 40 * 60000,
  docs: {
    "sheet.slddrw": { name: "sheet.SLDDRW", totalMs: 20 * 60000 },
    "part.sldprt": { name: "part.SLDPRT", totalMs: 20 * 60000 },
  },
}], mixedRules).get("legacy");
assert.deepEqual(Array.from(legacyDrawing.timeBuckets, (bucket) => bucket.category), ["design", "drawingCam"]);

const categoryBelowCutoff = computeProjectExportMinutes([{
  key: "brief-cam", name: "Brief CAM", totalMs: 60 * 60000, drawingCamMs: 8 * 60000,
}], mixedRules).get("brief-cam");
assert.deepEqual(Array.from(categoryBelowCutoff.timeBuckets, (bucket) => [bucket.category, bucket.exportable]), [
  ["design", true], ["drawingCam", false],
]);

const mixedTargetRules = sanitizeWorklogExportRules({
  cutoffMinutes: 9,
  targetHoursMode: true,
  targetHours: 0.5,
});
const mixedTarget = computeProjectExportMinutes([
  { key: "mixed", name: "Mixed", totalMs: 40 * 60000, overtimeMs: 20 * 60000 },
], mixedTargetRules).get("mixed");
assert.equal(mixedTarget.roundedMinutes, 60);
assert.deepEqual(
  Array.from(mixedTarget.timeBuckets, (bucket) => [bucket.id, bucket.roundedMinutes]),
  [["design-regular", 30], ["design-overtime", 30]],
);

const smallStepRules = sanitizeWorklogExportRules({
  cutoffMinutes: 9,
  multiplier: 1,
  roundToMinutes: 5,
});
const smallStep = computeProjectExportMinutes([
  { key: "minimum", name: "Minimum", totalMs: 10 * 60000 },
], smallStepRules).get("minimum");
assert.equal(smallStep.roundedMinutes, 30);

const rendererContext = {
  MIN_WORKLOG_EXPORT_ENTRY_MINUTES: 30,
  TARGET_HOURS_STEP_MINUTES: 30,
  worklogProjectExportKey: (entry) => String(entry?.key || entry?.name || "unknown project").trim().toLowerCase(),
};
vm.createContext(rendererContext);
vm.runInContext(`${between(
  renderer,
  "function worklogProjectTimeBucketsJs",
  "function updateWorklogExportPreview",
)}\nthis.previewWorklogExport = previewWorklogExport;`, rendererContext);
const rendererPreview = rendererContext.previewWorklogExport([
  { key: "four", name: "Four", totalMs: 100 * 60000,
    overtimeMs: 30 * 60000, drawingCamMs: 40 * 60000, drawingCamOvertimeMs: 10 * 60000 },
], {
  cutoffMinutes: 9,
  multiplier: 1,
  roundToMinutes: 30,
  targetHoursMode: false,
  targetHours: 8,
});
assert.equal(rendererPreview.exported, 1);
assert.equal(rendererPreview.entryCount, 4);
assert.equal(rendererPreview.exportedMinutes, 120);
assert.equal(rendererPreview.overtimeMinutes, 60);
assert.equal(rendererPreview.designMinutes, 60);
assert.equal(rendererPreview.drawingCamMinutes, 60);

const renderWorkLogger = between(renderer, "function renderWorkLogger", "function renderAutoExportStatus");
assert.doesNotMatch(renderWorkLogger, /updateWorklogExportControls/);
assert.match(renderer, /exportDraftEntries/);
assert.doesNotMatch(renderer, /worklogExportSplitByWorkType|worklogExportPerProjectWorkTypes/);
const preview = between(renderer, "function previewWorklogExport", "function updateWorklogExportPreview");
assert.match(preview, /worklogProjectTimeBucketsJs/);
assert.match(preview, /roundedOvertimeMinutes/);
assert.match(renderer, /MIN_WORKLOG_EXPORT_ENTRY_MINUTES = 30/);
assert.match(renderer, /if \(entry\.weekendOvertime\) \{\s*entry\.overtimeMs = entry\.totalMs;/);
assert.doesNotMatch(main, /splitWorklogMinutesByOvertime/);

const camContext = { lastSolidCamActivity: { at: 0, documentKey: "" } };
vm.createContext(camContext);
vm.runInContext(`${between(main, "function isSolidWorksForegroundActivity", "function shouldCountSolidWorksActivity")}
this.camApi = { isSolidCamForegroundActivity, isDrawingCamWorklogActivity };`, camContext);
const part = { path: "C:\\Projects\\Part.SLDPRT", type: "1" };
const otherPart = { path: "C:\\Projects\\Other.SLDPRT", type: "1" };
const counting = { shouldCount: true, solidWorksForeground: true };
assert.equal(camContext.camApi.isDrawingCamWorklogActivity(
  { path: "C:\\Projects\\Drawing.SLDDRW", type: "3" }, {}, counting, 1000,
), true);
assert.equal(camContext.camApi.isDrawingCamWorklogActivity(part, {
  foregroundProcessName: "SLDWORKS", camTreeActive: true,
}, counting, 1000), true);
assert.equal(camContext.camApi.isDrawingCamWorklogActivity(part, {
  foregroundProcessName: "SLDWORKS", camTreeActive: false,
}, counting, 181000), true, "The CAM cooldown includes its three-minute boundary");
assert.equal(camContext.camApi.isDrawingCamWorklogActivity(part, {
  foregroundProcessName: "SLDWORKS", camTreeActive: false,
}, counting, 181001), false);
assert.equal(camContext.camApi.isDrawingCamWorklogActivity(part, {
  foregroundProcessName: "Solidcam", foregroundTitle: "HSM Constant Z machining operation",
}, counting, 200000), true);
assert.equal(camContext.camApi.isDrawingCamWorklogActivity(otherPart, {}, counting, 200100), false,
  "CAM time must not carry to another document");
assert.equal(camContext.camApi.isDrawingCamWorklogActivity(part, {}, { ...counting, shouldCount: false }, 200200), false,
  "Idle time must not refresh the CAM cooldown");

const activityWatcher = fs.readFileSync(path.join(root, "scripts", "activity-watcher.ps1"), "utf8");
assert.match(activityWatcher, /IsSolidCamTabActive\(IntPtr foreground\)/);
assert.match(activityWatcher, /EnumChildWindows\(foreground/);
assert.match(activityWatcher, /camTreeActive = \[bool\]\$camTreeActive/);

console.log("Work Logger automatic design/CAM split, overtime, and preview tests passed.");
