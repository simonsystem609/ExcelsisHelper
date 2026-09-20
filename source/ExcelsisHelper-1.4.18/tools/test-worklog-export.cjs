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
  DEFAULT_WORKLOG_EXPORT_WORKTYPE: "Default work",
  projectActivityKey: (value) => String(value || "").trim().toLowerCase(),
};
vm.createContext(context);
vm.runInContext(`${between(
  main,
  "function clampNumber",
  "function worklogExportExternalId",
)}\nthis.testApi = { sanitizeWorklogExportRules, persistentWorklogExportRules, computeProjectExportMinutes, splitWorklogExportMinutes };`, context);

const {
  sanitizeWorklogExportRules,
  persistentWorklogExportRules,
  computeProjectExportMinutes,
  splitWorklogExportMinutes,
} = context.testApi;
const projects = [
  { key: "alpha", name: "Alpha", totalMs: 40 * 60000 },
  { key: "beta", name: "Beta", totalMs: 65 * 60000 },
];
const rules = sanitizeWorklogExportRules({
  cutoffMinutes: 9,
  multiplier: 1,
  roundToMinutes: 30,
  defaultWorkType: "Default work",
  excludedProjectKeys: ["BETA"],
  projectMinuteOverrides: { ALPHA: 90 },
});
const computed = computeProjectExportMinutes(projects, rules);
assert.equal(computed.get("alpha").exportable, true);
assert.equal(computed.get("alpha").roundedMinutes, 90);
assert.equal(computed.get("beta").exportable, false);
assert.equal(computed.get("beta").reason, "removed from this export");

const quarterHourRules = sanitizeWorklogExportRules({
  cutoffMinutes: 1,
  multiplier: 1,
  roundToMinutes: 15,
  projectMinuteOverrides: { alpha: 45 },
});
assert.equal(computeProjectExportMinutes(projects, quarterHourRules).get("alpha").roundedMinutes, 45);

const persistent = persistentWorklogExportRules(rules);
assert.equal(Object.prototype.hasOwnProperty.call(persistent, "excludedProjectKeys"), false);
assert.equal(Object.prototype.hasOwnProperty.call(persistent, "projectMinuteOverrides"), false);
assert.equal(persistent.cutoffMinutes, 9);

const targetRules = sanitizeWorklogExportRules({
  cutoffMinutes: 9,
  targetHoursMode: true,
  targetHours: 2,
  excludedProjectKeys: ["beta"],
  projectMinuteOverrides: { alpha: 60 },
});
const targetComputed = computeProjectExportMinutes(projects, targetRules);
assert.equal(targetComputed.get("alpha").roundedMinutes, 60);
assert.equal(targetComputed.get("beta").reason, "removed from this export");

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
  [["regular", true, 30], ["overtime", true, 30]],
);

const overtimeBelowCutoff = computeProjectExportMinutes([
  { key: "mostly-regular", name: "Mostly regular", totalMs: 40 * 60000, overtimeMs: 8 * 60000 },
], mixedRules).get("mostly-regular");
assert.equal(overtimeBelowCutoff.roundedMinutes, 30);
assert.deepEqual(
  Array.from(overtimeBelowCutoff.timeBuckets, (bucket) => [bucket.id, bucket.exportable, bucket.roundedMinutes]),
  [["regular", true, 30], ["overtime", false, 0]],
);

const bothBelowCutoff = computeProjectExportMinutes([
  { key: "too-short", name: "Too short", totalMs: 16 * 60000, overtimeMs: 8 * 60000 },
], mixedRules).get("too-short");
assert.equal(bothBelowCutoff.exportable, false);

const mixedOverrideRules = sanitizeWorklogExportRules({
  cutoffMinutes: 9,
  multiplier: 1,
  roundToMinutes: 30,
  projectMinuteOverrides: { mixed: 30 },
});
assert.equal(computeProjectExportMinutes([
  { key: "mixed", name: "Mixed", totalMs: 40 * 60000, overtimeMs: 20 * 60000 },
], mixedOverrideRules).get("mixed").roundedMinutes, 60);

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
  [["regular", 30], ["overtime", 30]],
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
assert.deepEqual(Array.from(splitWorklogExportMinutes(45, true, 15)), [45]);
assert.deepEqual(Array.from(splitWorklogExportMinutes(60, true, 15)), [30, 30]);

const rendererContext = {
  MIN_WORKLOG_EXPORT_ENTRY_MINUTES: 30,
  TARGET_HOURS_STEP_MINUTES: 30,
  worklogProjectExportKey: (entry) => String(entry?.key || entry?.name || "unknown project").trim().toLowerCase(),
};
vm.createContext(rendererContext);
vm.runInContext(`${between(
  renderer,
  "function worklogProjectTimeBucketsJs",
  "function createWorklogProjectWorkTypeSelect",
)}\nthis.previewWorklogExport = previewWorklogExport;`, rendererContext);
const rendererPreview = rendererContext.previewWorklogExport([
  { key: "mixed", name: "Mixed", totalMs: 40 * 60000, overtimeMs: 20 * 60000 },
], {
  cutoffMinutes: 9,
  multiplier: 1,
  roundToMinutes: 30,
  splitByWorkType: false,
  targetHoursMode: false,
  targetHours: 8,
  excludedProjectKeys: [],
  projectMinuteOverrides: {},
});
assert.equal(rendererPreview.exported, 1);
assert.equal(rendererPreview.entryCount, 2);
assert.equal(rendererPreview.exportedMinutes, 60);
assert.equal(rendererPreview.overtimeMinutes, 30);
assert.equal(rendererPreview.exportableEntries[0].minimumRoundedMinutes, 60);

const renderWorkLogger = between(renderer, "function renderWorkLogger", "function renderAutoExportStatus");
assert.doesNotMatch(renderWorkLogger, /updateWorklogExportControls/);
assert.match(renderer, /exportDraftEntries/);
assert.match(renderer, /exportExcludedProjectKeys/);
assert.match(renderer, /exportProjectMinuteOverrides/);
assert.match(renderer, /readWorklogExportRules\(\{ includeTransient: false \}\)/);
assert.match(renderer, /previousScrollTop/);
const preview = between(renderer, "function previewWorklogExport", "function createWorklogProjectWorkTypeSelect");
assert.match(preview, /worklogProjectTimeBucketsJs/);
assert.match(preview, /roundedOvertimeMinutes/);
assert.match(renderer, /MIN_WORKLOG_EXPORT_ENTRY_MINUTES = 30/);
assert.doesNotMatch(main, /splitWorklogMinutesByOvertime/);

console.log("Work Logger transient export-control tests passed.");
