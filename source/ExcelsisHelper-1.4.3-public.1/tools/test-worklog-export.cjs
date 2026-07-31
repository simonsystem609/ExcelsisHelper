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
)}\nthis.testApi = { sanitizeWorklogExportRules, persistentWorklogExportRules, computeProjectExportMinutes };`, context);

const { sanitizeWorklogExportRules, persistentWorklogExportRules, computeProjectExportMinutes } = context.testApi;
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

const renderWorkLogger = between(renderer, "function renderWorkLogger", "function renderAutoExportStatus");
assert.doesNotMatch(renderWorkLogger, /updateWorklogExportControls/);
assert.match(renderer, /exportDraftEntries/);
assert.match(renderer, /exportExcludedProjectKeys/);
assert.match(renderer, /exportProjectMinuteOverrides/);
assert.match(renderer, /readWorklogExportRules\(\{ includeTransient: false \}\)/);
assert.match(renderer, /previousScrollTop/);
const preview = between(renderer, "function previewWorklogExport", "function createWorklogProjectWorkTypeSelect");
assert.match(preview, /Math\.round/);
assert.doesNotMatch(preview, /Math\.ceil/);

console.log("Work Logger transient export-control tests passed.");
