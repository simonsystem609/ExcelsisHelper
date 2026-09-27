"use strict";

const { validateDrillingRequest } = require("./process-contracts.cjs");
const {
  feedFromFn,
  feedFromFz,
  fnFromFeed,
  fzFromFeed,
  quantizeMachiningValue,
  rpmFromVc,
  vcFromRpm,
} = require("./formulas.cjs");
const { resolveMaterialSelection } = require("./materials.cjs");
const { selectDrillingProfile } = require("./drilling-data.cjs");
const { requestHash } = require("./solver.cjs");

const DRILLING_ENGINE_VERSION = "2.2-excelsis.drilling.1";
const DRILLING_DATABASE_VERSION = "reviewed-bootstrap-2026-07-16.1";

function warning(code, message, severity = "warning") {
  return { code, message, severity };
}

function uniqueWarnings(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.code}\u0000${item.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function resolveMaterial(request, supplied) {
  if (supplied && typeof supplied === "object") return supplied;
  return resolveMaterialSelection({
    family: request.workpiece.material_family,
    grade: request.workpiece.grade,
    hardness: request.workpiece.hardness,
  });
}

function unsupportedResponse(request, reasons, material = null) {
  return {
    process: "drilling",
    status: "unsupported",
    request_hash: requestHash(request),
    engine_version: DRILLING_ENGINE_VERSION,
    source_database_version: DRILLING_DATABASE_VERSION,
    levels: { safe_start: null, target: null, upper_trial: null },
    source: { level: "none", record_ids: [], summary: "No compatible reviewed drilling provider." },
    material,
    calculations: null,
    current_gcode: request.gcode_context || null,
    warnings: reasons.map((message, index) => warning(`unsupported-${index + 1}`, message, "critical")),
    missing_inputs: [],
  };
}

function percentile(range, amount) {
  return range[0] + ((range[1] - range[0]) * Math.max(0, Math.min(1, amount)));
}

function drillingEnvironment(request, material, profile) {
  const warnings = [];
  const depthRatio = request.hole.depth_mm / request.tool.diameter_mm;
  let speedFactor = 1;
  let feedFactor = 1;
  if (depthRatio > 3) {
    speedFactor *= 0.92;
    feedFactor *= 0.88;
    warnings.push(warning("deep-hole-over-3d", `Hole depth is ${depthRatio.toFixed(1)}D; speed/feed are derated.`));
  }
  if (depthRatio > 5) {
    speedFactor *= 0.85;
    feedFactor *= 0.8;
    warnings.push(warning("deep-hole-over-5d", "Generic drilling above 5D needs especially reliable chip evacuation."));
  }
  if (depthRatio > 8) {
    speedFactor *= 0.8;
    feedFactor *= 0.75;
    warnings.push(warning("deep-hole-over-8d", "The request is beyond the reviewed standard-depth envelope; only a conservative start is returned.", "critical"));
  }
  if (request.tool.type !== "drill") {
    speedFactor *= 0.75;
    feedFactor *= 0.5;
    warnings.push(warning("spotting-tool-transfer", `${request.tool.type} uses a conservatively transferred twist-drill envelope.`));
  }

  const cooling = request.cooling.mode;
  if (profile.requiresWetCoolant && !["mist", "air_plus_mql", "flood", "through_tool"].includes(cooling)) {
    speedFactor *= 0.7;
    feedFactor *= 0.72;
    warnings.push(warning("wet-source-dry-request", "The carbide source assumes wet cutting; the selected cooling mode is strongly derated.", "critical"));
  }
  if (material.familyId === "aluminum" && ["dry", "air"].includes(cooling)) {
    speedFactor *= 0.8;
    feedFactor *= 0.85;
    warnings.push(warning("aluminum-lubrication", "Air-only or dry aluminium drilling increases built-up-edge risk."));
  }
  if (material.familyId === "plastic" && !["dry", "air"].includes(cooling)
      && request.cooling.polymer_compatibility !== "compatible") {
    speedFactor *= 0.8;
    warnings.push(warning("plastic-coolant-compatibility", "Liquid coolant compatibility with the selected polymer is not confirmed."));
  }
  if (depthRatio > 3 && request.hole.cycle !== "CYCLE83" && cooling !== "through_tool") {
    feedFactor *= 0.85;
    warnings.push(warning("chip-evacuation-unconfirmed", "A hole deeper than 3D has neither a parsed peck cycle nor through-tool cooling."));
  }
  if (request.hole.cycle === "CYCLE83" && request.hole.peck_depth_mm === null) {
    warnings.push(warning("peck-depth-unparsed", "CYCLE83 was detected, but no operator-confirmed peck depth is available.", "info"));
  }
  return { depthRatio, speedFactor, feedFactor, warnings };
}

function createLevel(request, profile, environment, amount) {
  const vc = percentile(profile.vcRange, amount) * environment.speedFactor;
  const rpmCaps = [request.machine.max_rpm, request.tool.vendor_max_rpm]
    .filter((value) => Number.isFinite(value) && value > 0);
  const rpmCap = Math.min(...rpmCaps);
  const rpmUncapped = rpmFromVc(vc, request.tool.diameter_mm);
  const rpm = quantizeMachiningValue(Math.min(rpmUncapped, rpmCap), 100, {
    minimum: Math.min(100, rpmCap),
    maximum: rpmCap,
  });
  const feedParameter = percentile(profile.feedRange, amount) * environment.feedFactor;
  const feedUncapped = profile.feedBasis === "per_tooth"
    ? feedFromFz(rpm, request.tool.flute_count, feedParameter)
    : feedFromFn(rpm, feedParameter);
  const feedCaps = [request.machine.max_feed_mm_min, request.tool.vendor_max_feed_mm_min]
    .filter((value) => Number.isFinite(value) && value > 0);
  const feedCap = feedCaps.length ? Math.min(...feedCaps) : Number.POSITIVE_INFINITY;
  const cappedFeed = Math.min(feedUncapped, feedCap);
  const feedOptions = { minimum: Math.min(5, cappedFeed) };
  if (Number.isFinite(feedCap)) feedOptions.maximum = feedCap;
  const feed = quantizeMachiningValue(cappedFeed, 5, feedOptions);
  return {
    rpm,
    feed_mm_min: feed,
    feed_per_revolution_mm: Number(fnFromFeed(feed, rpm).toFixed(5)),
    feed_per_tooth_mm: Number(fzFromFeed(feed, rpm, request.tool.flute_count).toFixed(5)),
    actual_vc_m_min: Number(vcFromRpm(rpm, request.tool.diameter_mm).toFixed(2)),
    rpm_limited: rpmUncapped > rpm + 50,
  };
}

function currentComparison(request, target) {
  const rpm = Number(request.gcode_context?.commanded_rpm);
  const feed = Number(request.gcode_context?.commanded_feed_mm_min);
  if ((!Number.isFinite(rpm) || rpm <= 0) && (!Number.isFinite(feed) || feed < 0)) return null;
  return {
    rpm: Number.isFinite(rpm) ? rpm : null,
    feed_mm_min: Number.isFinite(feed) ? feed : null,
    feed_per_revolution_mm: Number.isFinite(rpm) && rpm > 0 && Number.isFinite(feed)
      ? Number(fnFromFeed(feed, rpm).toFixed(5)) : null,
    rpm_change_percent: Number.isFinite(rpm) && rpm > 0 ? Number((((target.rpm / rpm) - 1) * 100).toFixed(1)) : null,
    feed_change_percent: Number.isFinite(feed) && feed > 0 ? Number((((target.feed_mm_min / feed) - 1) * 100).toFixed(1)) : null,
  };
}

function recommendDrilling(input, options = {}) {
  const request = validateDrillingRequest(input);
  const material = resolveMaterial(request, options.materialResolution);
  if (!material.supported) {
    return unsupportedResponse(request, material.warnings || ["The selected material is unsupported."], material);
  }
  if (request.hole.depth_mm / request.tool.diameter_mm > 12) {
    return unsupportedResponse(request, ["Generic drilling beyond 12D requires an exact deep-hole drill family and reviewed cycle data."], material);
  }
  const profile = selectDrillingProfile(request, material);
  if (!profile) {
    return unsupportedResponse(request, [
      `No reviewed ${request.tool.substrate} drilling profile covers ${material.materialLabel}.`,
    ], material);
  }
  const environment = drillingEnvironment(request, material, profile);
  const targetAmount = {
    conservative: 0.35,
    balanced: 0.5,
    slightly_aggressive: 0.65,
  }[request.objective.aggressiveness];
  const safe = createLevel(request, profile, environment, Math.max(0.15, targetAmount - 0.22));
  const target = createLevel(request, profile, environment, targetAmount);
  const upperAllowed = request.objective.aggressiveness === "slightly_aggressive"
    && profile.upperTrialAllowed
    && material.upperTrialAllowed
    && material.confidence !== "low"
    && environment.depthRatio <= 5
    && request.hole.kind !== "unknown"
    && !profile.sourceTransfer;
  const upper = upperAllowed ? createLevel(request, profile, environment, Math.min(0.82, targetAmount + 0.15)) : null;
  const warnings = [
    ...(material.warnings || []).map((message, index) => warning(`material-${index + 1}`, message)),
    ...profile.warnings.map((message, index) => warning(`source-${index + 1}`, message)),
    ...environment.warnings,
  ];
  if (profile.sourceTransfer) warnings.push(warning("source-transfer", "The reviewed source is transferred to a compatible broad family and is therefore provisional."));
  if (!upper) warnings.push(warning("upper-trial-withheld", "Upper trial is withheld until material, tool family, hole type, and setup confidence are sufficient.", "info"));
  if (request.workpiece.material_family === "steel" && !request.workpiece.hardness && material.confidence === "low") {
    warnings.push(warning("steel-hardness-unknown", "Broad steel was accepted, but grade and hardness are unknown."));
  }
  return {
    process: "drilling",
    status: "provisional",
    request_hash: requestHash(request),
    engine_version: DRILLING_ENGINE_VERSION,
    source_database_version: DRILLING_DATABASE_VERSION,
    levels: { safe_start: safe, target, upper_trial: upper },
    source: {
      level: profile.sourceTransfer ? "compatible-family" : "reviewed-family",
      record_ids: [profile.key, profile.source.id],
      summary: `${profile.source.owner} ${profile.source.title}; normalized conservative provider.`,
      review_status: profile.source.reviewStatus,
      sha256: profile.source.sha256,
    },
    material,
    calculations: {
      depth_over_diameter: Number(environment.depthRatio.toFixed(3)),
      source_vc_range_m_min: profile.vcRange.map((value) => Number(value.toFixed(3))),
      source_feed_basis: profile.feedBasis,
      source_feed_range: profile.feedRange.map((value) => Number(value.toFixed(6))),
      speed_derating: Number(environment.speedFactor.toFixed(4)),
      feed_derating: Number(environment.feedFactor.toFixed(4)),
      rpm_limited: target.rpm_limited,
    },
    current_gcode: currentComparison(request, target),
    warnings: uniqueWarnings(warnings),
    missing_inputs: [],
    explanation_trace: [
      `Resolved workpiece to ${material.materialLabel}.`,
      `Selected drilling profile ${profile.key} using ${profile.feedBasis === "per_tooth" ? "feed per cutting edge" : "feed per revolution"}.`,
      `Applied depth, tool-geometry, cooling, and chip-evacuation deratings once.`,
      "Calculated RPM from Vc, then feed from RPM and the normalized drill feed basis.",
      "Clamped to machine/tool limits and quantized RPM by 100 and feed by 5 mm/min where feasible.",
    ],
  };
}

module.exports = {
  DRILLING_DATABASE_VERSION,
  DRILLING_ENGINE_VERSION,
  recommendDrilling,
};
