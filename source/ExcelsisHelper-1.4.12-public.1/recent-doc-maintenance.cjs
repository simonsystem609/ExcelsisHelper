const MISSING_FIELDS = ["missingSince", "missingChecks", "lastMissingCheckAt", "missingSearchRequestedAt"];

function sameValue(left, right) {
  return String(left ?? "") === String(right ?? "");
}

function presentEntry(entry, observation) {
  const next = { ...entry };
  let changed = false;
  const metadata = {
    fileId: observation.fileId ? String(observation.fileId) : String(entry?.fileId || ""),
    size: Number(observation.size || 0),
    mtimeMs: Number(observation.mtimeMs || 0),
  };
  for (const [key, value] of Object.entries(metadata)) {
    if (!sameValue(next[key], value)) {
      next[key] = value;
      changed = true;
    }
  }
  for (const key of MISSING_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(next, key)) {
      delete next[key];
      changed = true;
    }
  }
  return { action: "keep", entry: next, changed, reason: "present" };
}

function missingEntry(entry, now, policy) {
  const minCheckGapMs = Math.max(0, Number(policy?.minCheckGapMs || 0));
  const minMissingAgeMs = Math.max(0, Number(policy?.minMissingAgeMs || 0));
  const requiredChecks = Math.max(1, Number(policy?.requiredChecks || 1));
  const previousCheckAt = Number(entry?.lastMissingCheckAt || 0);
  if (previousCheckAt && now - previousCheckAt < minCheckGapMs) {
    return { action: "keep", entry, changed: false, reason: "confirmation-gap" };
  }

  const missingSince = Number(entry?.missingSince || 0) || now;
  const missingChecks = Math.max(0, Number(entry?.missingChecks || 0)) + 1;
  const next = {
    ...entry,
    missingSince,
    missingChecks,
    lastMissingCheckAt: now,
  };
  const oldEnough = now - missingSince >= minMissingAgeMs;
  if (missingChecks >= requiredChecks && oldEnough) {
    return { action: "remove", entry: next, changed: true, reason: "confirmed-missing" };
  }
  return { action: "keep", entry: next, changed: true, reason: "awaiting-confirmation" };
}

function evaluateRecentDocObservation(entry, observation, now = Date.now(), policy = {}) {
  if (observation?.kind === "present") return presentEntry(entry, observation);
  if (observation?.kind === "missing") return missingEntry(entry, Number(now || 0), policy);
  return { action: "keep", entry, changed: false, reason: "storage-unavailable" };
}

module.exports = { evaluateRecentDocObservation };
