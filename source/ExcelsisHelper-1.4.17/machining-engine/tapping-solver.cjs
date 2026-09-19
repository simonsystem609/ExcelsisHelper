"use strict";

const { validateTappingRequest } = require("./process-contracts.cjs");
const { pitchFromSynchronizedFeed, rpmFromVc, vcFromRpm } = require("./formulas.cjs");
const { resolveMaterialSelection } = require("./materials.cjs");
const { selectTappingProfile } = require("./tapping-data.cjs");
const { requestHash } = require("./solver.cjs");

const TAPPING_ENGINE_VERSION = "2.2-excelsis.tapping.1";
const TAPPING_DATABASE_VERSION = "reviewed-bootstrap-2026-07-16.1";
const PITCH_ABSOLUTE_TOLERANCE_MM = 0.01;
const PITCH_RELATIVE_TOLERANCE = 0.01;

function warning(code, message, severity = "warning") {
  return { code, message, severity };
}

function parseMetricPitch(label) {
  const clean = String(label || "").replace(/,/g, ".");
  const match = clean.match(/(?:^|[^A-Z0-9])M\s*\d+(?:\.\d+)?\s*[Xx]\s*(\d+(?:\.\d+)?)(?:$|[^0-9.])/i)
    || clean.match(/^M\s*\d+(?:\.\d+)?\s*[Xx]\s*(\d+(?:\.\d+)?)$/i);
  if (!match) return null;
  const pitch = Number(match[1]);
  return Number.isFinite(pitch) && pitch > 0 ? pitch : null;
}

function pitchTolerance(a, b) {
  return Math.max(PITCH_ABSOLUTE_TOLERANCE_MM, Math.max(a, b) * PITCH_RELATIVE_TOLERANCE);
}

function resolveTapPitch(request) {
  const evidence = [];
  const add = (source, value, priority) => {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) evidence.push({ source, value_mm: number, priority });
  };
  add("operator_confirmed", request.thread.operator_confirmed_pitch_mm, 0);
  add("cycle_explicit", request.thread.cycle_pitch_mm, 1);
  add("declared_pitch", request.thread.pitch_mm, 2);
  add("metric_thread_label", parseMetricPitch(request.thread.label), 3);

  const context = request.gcode_context;
  if (context?.synchronized_feed_mm_min > 0) {
    if (context.feed_mode === "mm_per_rev") {
      add("synchronized_feed_per_rev", context.synchronized_feed_mm_min, 4);
    } else if (context.commanded_rpm > 0) {
      add("synchronized_feed_over_rpm", pitchFromSynchronizedFeed(
        context.synchronized_feed_mm_min,
        context.commanded_rpm,
      ), 4);
    }
  }

  if (!evidence.length) {
    return {
      status: "missing",
      pitch_mm: null,
      evidence: [],
      conflicts: [],
    };
  }
  const conflicts = [];
  for (let left = 0; left < evidence.length; left += 1) {
    for (let right = left + 1; right < evidence.length; right += 1) {
      const a = evidence[left];
      const b = evidence[right];
      if (Math.abs(a.value_mm - b.value_mm) > pitchTolerance(a.value_mm, b.value_mm)) {
        conflicts.push({ left: a.source, right: b.source, left_mm: a.value_mm, right_mm: b.value_mm });
      }
    }
  }
  if (conflicts.length) {
    return { status: "conflict", pitch_mm: null, evidence, conflicts };
  }
  const selected = [...evidence].sort((a, b) => a.priority - b.priority)[0];
  return {
    status: "resolved",
    pitch_mm: selected.value_mm,
    selected_source: selected.source,
    evidence,
    conflicts: [],
  };
}

function baseResponse(request, status, options = {}) {
  const messages = options.messages || [];
  return {
    process: "tapping",
    status,
    request_hash: requestHash(request),
    engine_version: TAPPING_ENGINE_VERSION,
    source_database_version: TAPPING_DATABASE_VERSION,
    levels: { safe_start: null, target: null, upper_trial: null },
    source: { level: "none", record_ids: [], summary: "No tapping recommendation produced." },
    material: options.material || null,
    pitch: options.pitch || null,
    calculations: null,
    current_gcode: request.gcode_context || null,
    warnings: messages.map((message, index) => warning(`${status}-${index + 1}`, message, status === "needs_input" ? "warning" : "critical")),
    missing_inputs: options.missingInputs || [],
  };
}

function percentile(range, amount) {
  return range[0] + ((range[1] - range[0]) * Math.max(0, Math.min(1, amount)));
}

function environmentFactors(request) {
  const warnings = [];
  let speedFactor = 1;
  const depthRatio = request.thread.depth_mm / request.tool.nominal_diameter_mm;
  if (request.thread.kind === "blind") {
    speedFactor *= 0.9;
    warnings.push(warning("blind-hole-tapping", "Blind-hole tapping is derated for chip/torque margin."));
  }
  if (depthRatio > 2) {
    speedFactor *= 0.85;
    warnings.push(warning("tap-depth-over-2d", `Thread depth is ${depthRatio.toFixed(1)}D; speed is derated.`));
  }
  if (depthRatio > 3) {
    speedFactor *= 0.8;
    warnings.push(warning("tap-depth-over-3d", "Generic tapping beyond 3D has elevated chip evacuation and torque risk.", "critical"));
  }
  if (request.cooling.mode === "mist" || request.cooling.continuous !== true) {
    speedFactor *= 0.85;
    warnings.push(warning("tapping-lubrication-margin", "Lubrication is not confirmed as continuous high-quality delivery; speed is derated."));
  }
  return { depthRatio, speedFactor, warnings };
}

function synchronizedCandidate(request, pitchMm, desiredVc) {
  const rpmCaps = [request.machine.max_rpm, request.tool.vendor_max_rpm]
    .filter((value) => Number.isFinite(value) && value > 0);
  const rpmCap = Math.min(...rpmCaps);
  const feedCap = Number.isFinite(request.machine.max_feed_mm_min)
    ? request.machine.max_feed_mm_min : Number.POSITIVE_INFINITY;
  const maxStepRpm = Math.floor(rpmCap / 100) * 100;
  if (maxStepRpm < 100) return null;
  const desiredRpm = Math.min(rpmFromVc(desiredVc, request.tool.nominal_diameter_mm), rpmCap);
  const candidates = [];
  for (let rpm = 100; rpm <= maxStepRpm; rpm += 100) {
    const feed = rpm * pitchMm;
    if (feed > feedCap + 1e-9) continue;
    const feedByFive = Math.abs((feed / 5) - Math.round(feed / 5)) < 1e-9;
    const relativeError = Math.abs(rpm - desiredRpm) / Math.max(desiredRpm, 100);
    candidates.push({ rpm, feed, feedByFive, score: relativeError + (feedByFive ? 0 : 0.02) });
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => a.score - b.score || Math.abs(a.rpm - desiredRpm) - Math.abs(b.rpm - desiredRpm));
  const selected = candidates[0];
  return {
    rpm: selected.rpm,
    retract_rpm: selected.rpm,
    feed_mm_min: Number(selected.feed.toFixed(6)),
    pitch_mm: pitchMm,
    feed_quantized_by_5: selected.feedByFive,
    synchronized: Math.abs(selected.feed - (selected.rpm * pitchMm)) < 1e-9,
    actual_vc_m_min: Number(vcFromRpm(selected.rpm, request.tool.nominal_diameter_mm).toFixed(3)),
    rpm_limited: desiredRpm >= rpmCap - 1e-9,
  };
}

function currentComparison(request, pitchMm, target) {
  const rpm = Number(request.gcode_context?.commanded_rpm);
  const feed = Number(request.gcode_context?.synchronized_feed_mm_min);
  const validRpm = Number.isFinite(rpm) && rpm > 0;
  const validFeed = Number.isFinite(feed) && feed > 0;
  if (!validRpm && !validFeed) return null;
  const derivedPitch = validRpm && validFeed ? pitchFromSynchronizedFeed(feed, rpm) : null;
  return {
    rpm: validRpm ? rpm : null,
    retract_rpm: Number.isFinite(request.gcode_context?.retract_rpm) ? request.gcode_context.retract_rpm : null,
    feed_mm_min: validFeed ? feed : null,
    derived_pitch_mm: derivedPitch === null ? null : Number(derivedPitch.toFixed(6)),
    synchronization_error_percent: derivedPitch === null
      ? null : Number((((derivedPitch / pitchMm) - 1) * 100).toFixed(3)),
    rpm_change_percent: validRpm ? Number((((target.rpm / rpm) - 1) * 100).toFixed(1)) : null,
    feed_change_percent: validFeed ? Number((((target.feed_mm_min / feed) - 1) * 100).toFixed(1)) : null,
  };
}

function recommendTapping(input, options = {}) {
  const request = validateTappingRequest(input);
  const material = options.materialResolution || resolveMaterialSelection({
    family: request.workpiece.material_family,
    grade: request.workpiece.grade,
    hardness: request.workpiece.hardness,
  });
  if (!material.supported) {
    return baseResponse(request, "unsupported", { material, messages: material.warnings || ["The selected material is unsupported."] });
  }

  const missingInputs = [];
  if (request.tool.style === "unknown") missingInputs.push("tool.style");
  if (request.thread.kind === "unknown") missingInputs.push("thread.kind");
  if (request.tool.style === "form" && request.thread.pre_drill_diameter_mm === null) {
    missingInputs.push("thread.pre_drill_diameter_mm");
  }
  if (missingInputs.length) {
    return baseResponse(request, "needs_input", {
      material,
      missingInputs,
      messages: ["Tap style, hole type, and any form-tap pilot diameter must be confirmed rather than inferred."],
    });
  }

  const pitch = resolveTapPitch(request);
  if (pitch.status === "missing") {
    return baseResponse(request, "needs_input", {
      material,
      pitch,
      missingInputs: ["thread.pitch_mm"],
      messages: ["No pitch was found in the cycle, thread label, operator input, or synchronized feed/RPM."],
    });
  }
  if (pitch.status === "conflict") {
    return baseResponse(request, "conflict", {
      material,
      pitch,
      messages: ["Independent pitch sources disagree by more than max(0.01 mm, 1%); automatic tap editing is refused."],
    });
  }
  if (["dry", "air"].includes(request.cooling.mode)) {
    return baseResponse(request, "unsafe", {
      material,
      pitch,
      messages: ["Local tapping requires a confirmed lubricating mode; dry or air-only tapping is not recommended automatically."],
    });
  }
  if (request.thread.depth_mm / request.tool.nominal_diameter_mm > 4) {
    return baseResponse(request, "unsupported", {
      material,
      pitch,
      messages: ["Generic tapping beyond 4D requires exact tap-family and machine-cycle data."],
    });
  }

  const profile = selectTappingProfile(request, material);
  if (!profile.supported) {
    return baseResponse(request, "unsupported", { material, pitch, messages: profile.reasons });
  }
  const environment = environmentFactors(request);
  const targetAmount = {
    conservative: 0.3,
    balanced: 0.45,
    slightly_aggressive: 0.6,
  }[request.objective.aggressiveness];
  const makeLevel = (amount) => synchronizedCandidate(
    request,
    pitch.pitch_mm,
    percentile(profile.vcRange, amount) * environment.speedFactor,
  );
  const safe = makeLevel(Math.max(0.12, targetAmount - 0.2));
  const target = makeLevel(targetAmount);
  if (!safe || !target) {
    return baseResponse(request, "unsupported", {
      material,
      pitch,
      messages: ["Machine RPM/feed limits do not permit a synchronized candidate on the required 100 RPM grid."],
    });
  }
  const upperAllowed = request.objective.aggressiveness === "slightly_aggressive"
    && profile.upperTrialAllowed
    && material.upperTrialAllowed
    && material.confidence !== "low"
    && environment.depthRatio <= 2
    && request.cooling.continuous === true
    && !profile.sourceTransfer;
  const upper = upperAllowed ? makeLevel(Math.min(0.78, targetAmount + 0.14)) : null;
  const warnings = [
    ...(material.warnings || []).map((message, index) => warning(`material-${index + 1}`, message)),
    ...profile.warnings.map((message, index) => warning(`source-${index + 1}`, message)),
    ...environment.warnings,
  ];
  if (!target.feed_quantized_by_5) {
    warnings.push(warning("feed-grid-overridden", "Feed cannot be independently rounded to 5 mm/min without breaking pitch synchronization; exact RPM x pitch feed is preserved."));
  }
  if (profile.sourceTransfer) warnings.push(warning("source-transfer", "The reviewed table is conservatively transferred to a broader material identity."));
  if (!upper) warnings.push(warning("upper-trial-withheld", "Upper trial is withheld until tap, material, lubrication, and hole confidence are sufficient.", "info"));
  if (request.tool.style === "cut" && request.thread.pre_drill_diameter_mm === null) {
    warnings.push(warning("cut-tap-pilot-unconfirmed", "Cut-tap pilot diameter was not confirmed; the speed recommendation does not validate thread percentage or torque."));
  }
  return {
    process: "tapping",
    status: "provisional",
    request_hash: requestHash(request),
    engine_version: TAPPING_ENGINE_VERSION,
    source_database_version: TAPPING_DATABASE_VERSION,
    levels: { safe_start: safe, target, upper_trial: upper },
    source: {
      level: profile.sourceTransfer ? "compatible-family" : "reviewed-family",
      record_ids: [profile.key, profile.source.id],
      summary: `${profile.source.owner} ${profile.source.title}; normalized ${request.tool.style}-tap provider.`,
      review_status: profile.source.reviewStatus,
      sha256: profile.source.sha256,
    },
    material,
    pitch,
    calculations: {
      depth_over_diameter: Number(environment.depthRatio.toFixed(3)),
      source_vc_range_m_min: profile.vcRange.map((value) => Number(value.toFixed(3))),
      speed_derating: Number(environment.speedFactor.toFixed(4)),
      synchronization_rule: "feed_mm_min = rpm * pitch_mm",
      rpm_increment: 100,
      preferred_feed_increment_mm_min: 5,
    },
    current_gcode: currentComparison(request, pitch.pitch_mm, target),
    warnings,
    missing_inputs: [],
    explanation_trace: [
      `Resolved pitch ${pitch.pitch_mm} mm from ${pitch.selected_source}; all available pitch evidence agreed within tolerance.`,
      `Resolved workpiece to ${material.materialLabel} and selected ${profile.key}.`,
      "Calculated tap RPM from Vc and nominal diameter, then searched the 100 RPM grid within machine limits.",
      "Derived feed from RPM x pitch without independent rounding and proposed the same synchronized retract RPM.",
    ],
  };
}

module.exports = {
  PITCH_ABSOLUTE_TOLERANCE_MM,
  PITCH_RELATIVE_TOLERANCE,
  TAPPING_DATABASE_VERSION,
  TAPPING_ENGINE_VERSION,
  parseMetricPitch,
  recommendTapping,
  resolveTapPitch,
};
