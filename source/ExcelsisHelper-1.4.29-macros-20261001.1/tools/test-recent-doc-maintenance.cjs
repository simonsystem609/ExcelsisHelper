const assert = require("node:assert/strict");
const { evaluateRecentDocObservation } = require("../recent-doc-maintenance.cjs");

const policy = {
  requiredChecks: 2,
  minCheckGapMs: 60_000,
  minMissingAgeMs: 90_000,
};
const base = {
  path: "R:\\Engineering\\2026\\PRJ-001\\Part.SLDPRT",
  lastSeen: 123,
  fileId: "old-id",
  size: 10,
  mtimeMs: 20,
};

const first = evaluateRecentDocObservation(base, { kind: "missing" }, 1_000_000, policy);
assert.equal(first.action, "keep");
assert.equal(first.entry.missingChecks, 1);

const tooSoon = evaluateRecentDocObservation(first.entry, { kind: "missing" }, 1_030_000, policy);
assert.equal(tooSoon.action, "keep");
assert.equal(tooSoon.changed, false);
assert.equal(tooSoon.entry.missingChecks, 1);

const confirmed = evaluateRecentDocObservation(first.entry, { kind: "missing" }, 1_120_000, policy);
assert.equal(confirmed.action, "remove");
assert.equal(confirmed.entry.missingChecks, 2);

const offline = evaluateRecentDocObservation(first.entry, { kind: "unavailable" }, 1_500_000, policy);
assert.equal(offline.action, "keep");
assert.equal(offline.changed, false);
assert.equal(offline.entry.missingChecks, 1);

const restored = evaluateRecentDocObservation({ ...first.entry, missingSearchRequestedAt: 1_000_100 }, {
  kind: "present",
  fileId: "new-id",
  size: 30,
  mtimeMs: 40,
}, 1_500_000, policy);
assert.equal(restored.action, "keep");
assert.equal(restored.entry.fileId, "new-id");
assert.equal(restored.entry.size, 30);
assert.equal(restored.entry.mtimeMs, 40);
assert.equal("missingSince" in restored.entry, false);
assert.equal("missingChecks" in restored.entry, false);
assert.equal("lastMissingCheckAt" in restored.entry, false);
assert.equal("missingSearchRequestedAt" in restored.entry, false);

console.log("Recent document maintenance policy tests passed.");
