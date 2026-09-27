"use strict";

const crypto = require("node:crypto");
const { isReleaseOneToolType, validateRecommendationRequest } = require("./contracts.cjs");
const {
  effectiveDiameterRange,
  feedFromFz,
  fzFromFeed,
  mrrMm3Min,
  quantizeMachiningValue,
  radialChipThicknessFactor,
  rpmFromVc,
  vcFromRpm,
} = require("./formulas.cjs");
const {
  genericSeedAtDiameter,
  microFactor,
  operationFactor,
  profileFactor,
  selectRange,
} = require("./generic-data.cjs");
const { resolveMaterialSelection } = require("./materials.cjs");

const ENGINE_VERSION = "2.2-excelsis.1";
const SOURCE_DATABASE_VERSION = "generic-bootstrap-0.4";

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function requestHash(request) {
  return crypto.createHash("sha256").update(stableStringify(request)).digest("hex");
}

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

function materialFromRequest(request, supplied) {
  if (supplied && typeof supplied === "object") return supplied;
  return resolveMaterialSelection({
    family: request.workpiece.material_family || request.workpiece.material_id,
    grade: request.workpiece.grade || (request.workpiece.material_family ? "" : request.workpiece.material_id),
    hardness: request.workpiece.hardness,
  });
}

function coolingFactor(request, material, warnings) {
  const mode = request.cooling.mode;
  if (["aluminum", "copper_alloy"].includes(material.familyId)) {
    if (["air_plus_mql", "flood", "through_tool"].includes(mode)) return 1;
    if (mode === "mist") return 0.95;
    if (mode === "air") {
      warnings.push(warning("nonferrous-air-only", "Air-only nonferrous cutting has extra built-up-edge and lubrication risk."));
      return 0.85;
    }
    warnings.push(warning("nonferrous-dry", "Dry nonferrous cutting uses a conservative derating; verify chip evacuation and built-up edge."));
    return 0.7;
  }
  if (material.familyId === "plastic") {
    if (["air", "dry"].includes(mode)) return mode === "air" ? 1 : 0.95;
    if (request.cooling.polymer_compatibility !== "compatible") {
      warnings.push(warning("polymer-coolant-compatibility", "Liquid cooling was selected without confirmed polymer compatibility."));
      return 0.8;
    }
    return 0.9;
  }
  if (material.seedKey?.startsWith("steel_hardened")) {
    if (["mist", "flood", "through_tool"].includes(mode) && request.cooling.continuous !== true) {
      warnings.push(warning("hard-steel-intermittent-coolant", "Intermittent liquid cooling can thermally shock a hot hard-milling cutter.", "critical"));
      return 0.85;
    }
    return 1;
  }
  return 0.95;
}

function envelopeResult(request, material) {
  const apOverD = request.cut.ap_mm / request.tool.diameter_mm;
  const aeOverD = request.cut.ae_percent / 100;
  let insideAp = 1.5;
  let nearAp = 2;
  let insideAe = 0.2;
  let nearAe = 0.3;
  if (request.cut.operation === "full_slot") {
    insideAe = 1;
    nearAe = 1;
    if (material.familyId === "aluminum") insideAp = 0.25;
    else if (material.familyId === "plastic") insideAp = 0.5;
    else if (material.familyId === "copper_alloy") insideAp = 0.18;
    else if (material.seedKey === "steel_mild_soft") insideAp = 0.15;
    else if (material.seedKey?.startsWith("steel_hardened")) insideAp = 0.04;
    else insideAp = 0.12;
    nearAp = insideAp * 1.5;
  }
  if (["linear_ramp", "helical_ramp", "chamfer", "wall_finish", "floor_finish", "3d_finish"].includes(request.cut.operation)) {
    return { match: "unknown", apOverD, aeOverD };
  }
  if (apOverD <= insideAp && aeOverD <= insideAe + 1e-9) return { match: "inside", apOverD, aeOverD };
  if (apOverD <= nearAp && aeOverD <= nearAe + 1e-9) return { match: "near", apOverD, aeOverD };
  return { match: "outside", apOverD, aeOverD };
}

function riskAssessment(request, material, seed, envelope, warnings) {
  const components = {
    generic_source: 0.2,
    material_identity: material.confidence === "low" ? 0.18 : 0.08,
    engagement: envelope.match === "outside" ? 0.25 : (envelope.match === "near" ? 0.12 : 0.04),
    setup: 0,
    tool: 0,
    cooling: 0,
  };
  const reasons = ["Only provisional generic cutting data are available."];
  if (material.confidence === "low") reasons.push("The exact workpiece grade is unknown.");
  if (request.cut.operation === "full_slot") {
    components.engagement = Math.min(1, components.engagement + 0.12);
    reasons.push("Full slotting increases chip evacuation and tool-load risk.");
  }
  if (envelope.match === "outside") reasons.push("The requested ap/ae is outside the generic engagement envelope.");
  else if (envelope.match === "near") reasons.push("The requested ap/ae is near the generic engagement boundary.");
  if (request.tool.diameter_mm < 1) {
    components.tool += 0.15;
    reasons.push("Sub-1 mm tools are sensitive to runout, stickout, and acceleration.");
    if (request.machine.measured_runout_mm === null) components.setup += 0.12;
  }
  if (request.tool.stickout_mm === null) {
    components.setup += request.tool.diameter_mm < 1 ? 0.1 : 0.04;
    reasons.push("Tool stickout is unknown.");
  }
  if (/unknown|general/i.test(request.tool.application_class)) {
    components.tool += 0.1;
    reasons.push("The cutter application class is not known exactly.");
  }
  if (seed.abrasionWarning) {
    components.tool += 0.1;
    reasons.push("The material family can be abrasive.");
  }
  if (warnings.some((item) => item.code.includes("coolant") || item.code.includes("air-only") || item.code.includes("dry"))) {
    components.cooling += 0.08;
  }
  const score = Math.max(0, Math.min(1, Object.values(components).reduce((sum, value) => sum + value, 0)));
  const level = envelope.match === "outside" || score >= 0.72
    ? "high"
    : (score >= 0.4 ? "medium" : "low");
  return { level, score, reasons: [...new Set(reasons)], components };
}

function confidenceAssessment(request, material, envelope) {
  const sourceMatch = 0.25;
  const materialMatch = material.confidence === "low" ? 0.35 : 0.55;
  const engagementMatch = envelope.match === "inside" ? 0.7 : (envelope.match === "near" ? 0.5 : 0.25);
  const setupMatch = request.tool.stickout_mm !== null
    && (request.tool.diameter_mm >= 1 || request.machine.measured_runout_mm !== null) ? 0.7 : 0.4;
  const hardnessMatch = material.familyId !== "steel" ? 0.8 : (request.workpiece.hardness ? 0.8 : 0.35);
  const overall = Number((
    (sourceMatch * 0.25)
    + (materialMatch * 0.25)
    + (engagementMatch * 0.2)
    + (setupMatch * 0.15)
    + (hardnessMatch * 0.15)
  ).toFixed(3));
  return {
    overall,
    source_match: sourceMatch,
    material_match: materialMatch,
    engagement_match: engagementMatch,
    setup_match: setupMatch,
    hardness_match: hardnessMatch,
  };
}

function radialCompensationCap(request) {
  if (request.cut.contact_mode === "unknown" || request.cut.stock_model_quality === "unknown") return 1;
  if (request.cut.operation === "rest_rough" && request.cut.stock_model_quality === "previous_tool_only") return 1.2;
  if (request.tool.diameter_mm < 1) return 1.6;
  return 2.2;
}

function levelAtPercentile(request, material, seed, effectiveDiameter, percentile, coolingMultiplier) {
  const baseHmax = selectRange(seed.hmaxRange, percentile);
  const hmax = baseHmax
    * operationFactor(request.cut.operation, percentile)
    * profileFactor(request.tool, request.cut, percentile)
    * microFactor(request.tool.diameter_mm, percentile)
    * coolingMultiplier;
  const radialFactor = radialChipThicknessFactor(request.cut.ae_percent);
  const compensation = Math.min(1 / radialFactor, radialCompensationCap(request));
  const fzRequested = hmax * compensation;
  const vcRequested = selectRange(seed.vcRange, percentile);
  const rpmUncapped = rpmFromVc(vcRequested, effectiveDiameter.targetMm);
  const rpmCaps = [request.machine.max_rpm, request.tool.vendor_max_rpm, request.tool.holder_max_rpm]
    .filter((value) => Number.isFinite(value) && value > 0);
  const rpmCap = Math.min(...rpmCaps);
  const rpm = quantizeMachiningValue(Math.min(rpmUncapped, rpmCap), 100, { minimum: 100, maximum: rpmCap });
  const feedCaps = [request.machine.max_feed_mm_min, request.tool.vendor_max_feed_mm_min]
    .filter((value) => Number.isFinite(value) && value > 0);
  const feedCap = feedCaps.length ? Math.min(...feedCaps) : Number.POSITIVE_INFINITY;
  const feedUncapped = feedFromFz(rpm, request.tool.effective_teeth, fzRequested);
  const feedOptions = { minimum: Math.min(5, feedCap) };
  if (Number.isFinite(feedCap)) feedOptions.maximum = feedCap;
  const feed = quantizeMachiningValue(Math.min(feedUncapped, feedCap), 5, feedOptions);
  const actualFz = fzFromFeed(feed, rpm, request.tool.effective_teeth);
  return {
    rpm,
    feed_mm_min: feed,
    fz_mm_tooth: Number(actualFz.toFixed(6)),
    hmax_mm: Number((actualFz * radialFactor).toFixed(6)),
    _rpmUncapped: rpmUncapped,
    _vc: vcFromRpm(rpm, effectiveDiameter.targetMm),
  };
}

function publicLevel(level) {
  if (!level) return null;
  return {
    rpm: level.rpm,
    feed_mm_min: level.feed_mm_min,
    fz_mm_tooth: level.fz_mm_tooth,
    hmax_mm: level.hmax_mm,
  };
}

function currentGcodeComparison(request, levels) {
  const currentRpm = Number(request.gcode_context?.commanded_rpm);
  const currentFeed = Number(request.gcode_context?.commanded_feed_mm_min);
  const rpm = Number.isFinite(currentRpm) && currentRpm >= 0 ? currentRpm : null;
  const feed = Number.isFinite(currentFeed) && currentFeed >= 0 ? currentFeed : null;
  if (rpm === null && feed === null) return null;
  let comparison = null;
  if (feed !== null && levels.safe_start && levels.target) {
    if (feed < levels.safe_start.feed_mm_min) comparison = "below_safe";
    else if (feed <= levels.target.feed_mm_min) comparison = "within_safe_target";
    else if (levels.upper_trial && feed <= levels.upper_trial.feed_mm_min) comparison = "between_target_and_upper";
    else if (feed > (levels.upper_trial?.feed_mm_min || levels.target.feed_mm_min)) comparison = "above_upper";
  }
  const percent = (target) => feed > 0 && target ? Number(((target.feed_mm_min / feed) * 100).toFixed(1)) : null;
  return {
    rpm,
    feed_mm_min: feed,
    comparison,
    feed_override_to_safe_percent: percent(levels.safe_start),
    feed_override_to_target_percent: percent(levels.target),
  };
}

function unsupportedResponse(request, messages, material = null) {
  const reasons = messages.map((item) => typeof item === "string" ? item : item.message);
  const warnings = messages.map((item, index) => typeof item === "string"
    ? warning(`unsupported-${index + 1}`, item, "critical")
    : item);
  return {
    status: "unsupported",
    request_hash: requestHash(request),
    engine_version: ENGINE_VERSION,
    source_database_version: SOURCE_DATABASE_VERSION,
    levels: { safe_start: null, target: null, upper_trial: null },
    calculations: {
      effective_diameter_mm: 0,
      effective_diameter_range_mm: null,
      actual_vc_m_min: 0,
      active_vc_range_m_min: null,
      ap_over_d: request.cut.ap_mm / request.tool.diameter_mm,
      ae_over_d: request.cut.ae_percent / 100,
      radial_chip_factor: radialChipThicknessFactor(request.cut.ae_percent),
      axial_chip_factor: null,
      rpm_limited: false,
      mrr_mm3_min: null,
      estimated_power_kw: null,
      source_envelope_match: "unknown",
    },
    source: { level: "none", record_ids: [], summary: "No compatible reviewed or generic provider.", review_status: null },
    current_gcode: request.gcode_context ? {
      rpm: request.gcode_context.commanded_rpm,
      feed_mm_min: request.gcode_context.commanded_feed_mm_min,
      comparison: "unsupported",
      feed_override_to_safe_percent: null,
      feed_override_to_target_percent: null,
    } : null,
    risk: { level: "reject", score: 1, reasons, components: { unsupported: 1 } },
    confidence: {
      overall: 0,
      source_match: 0,
      material_match: material?.confidence === "provisional" ? 0.4 : 0,
      engagement_match: null,
      setup_match: null,
      hardness_match: null,
    },
    warnings: uniqueWarnings(warnings),
    explanation_trace: ["Request validated.", "Suitability gate rejected generic local calculation."],
    missing_inputs: [],
    optimization: {
      objective: request.objective.priority,
      candidates_evaluated: 0,
      candidates_feasible: 0,
      candidates_rejected: 0,
      selected_safe_candidate_id: null,
      selected_target_candidate_id: null,
      selected_upper_candidate_id: null,
      debug_trace_available: false,
    },
  };
}

function recommendGeneric(input, options = {}) {
  const request = validateRecommendationRequest(input);
  const material = materialFromRequest(request, options.materialResolution);
  const rejects = [];
  if (!material.supported) rejects.push(...(material.warnings || ["The material is unsupported by the local method."]));
  if (!isReleaseOneToolType(request.tool.type)) rejects.push(`Tool type ${request.tool.type} is outside the release-one solid rotary milling solver.`);
  if (request.tool.substrate !== "carbide") rejects.push(`Generic ${request.tool.substrate} milling data are not enabled; use reviewed tool-family data or AI review.`);
  if (request.tool.diameter_mm <= 0.2) rejects.push("Tools at or below 0.2 mm require exact reviewed micro-tool data.");
  if (rejects.length) return unsupportedResponse(request, rejects, material);

  const seed = genericSeedAtDiameter(material.seedKey, request.tool.diameter_mm);
  if (!seed || !seed.hmaxRange) return unsupportedResponse(request, ["No complete generic seed range covers this material and diameter."], material);
  if (seed.requiresApplicationClass && !String(request.tool.application_class).toLowerCase().includes(seed.requiresApplicationClass)) {
    return unsupportedResponse(request, [`${material.seedKey} requires a cutter explicitly identified for ${seed.requiresApplicationClass}.`], material);
  }
  if (["steel_hardened_45_55", "steel_hardened_55_60"].includes(material.seedKey)
      && request.cut.operation === "full_slot") {
    return unsupportedResponse(request, ["Generic full-slot roughing above 45 HRC is unsupported without exact tool-family data."], material);
  }

  const warnings = (material.warnings || []).map((message, index) => warning(`material-${index + 1}`, message));
  if (seed.clampedAboveDiameter) warnings.push(warning("diameter-above-seed-knots", "Diameter is above the 8 mm generic knot range; chip thickness is held at the largest reviewed bootstrap knot."));
  if (seed.abrasionWarning) warnings.push(warning("abrasive-material", "The generic material seed is abrasive; verify cutter suitability and dust/chip control."));
  if (material.familyId === "steel" && !request.workpiece.hardness) {
    warnings.push(warning("steel-hardness-unknown", "Steel hardness/condition is unknown, reducing confidence."));
  }
  if (request.cut.operation === "full_slot" && request.cut.ae_percent < 90) {
    warnings.push(warning("slot-engagement-mismatch", "The operation is marked full slot but ae is below 90%; verify the operation input."));
  }

  const coolingMultiplier = coolingFactor(request, material, warnings);
  const effectiveDiameter = effectiveDiameterRange(request.tool, request.cut);
  const envelope = envelopeResult(request, material);
  if (envelope.match === "outside") warnings.push(warning("engagement-outside-envelope", "Requested ap/ae is outside the provisional generic envelope.", "critical"));
  else if (envelope.match === "near") warnings.push(warning("engagement-near-envelope", "Requested ap/ae is near the provisional generic envelope."));

  const risk = riskAssessment(request, material, seed, envelope, warnings);
  const confidence = confidenceAssessment(request, material, envelope);
  const targetPercentile = {
    conservative: 0.35,
    balanced: 0.52,
    slightly_aggressive: 0.7,
  }[request.objective.aggressiveness];
  const safePercentile = Math.max(0.2, targetPercentile - 0.2);
  const upperPercentile = Math.min(0.8, targetPercentile + 0.12);
  const safe = levelAtPercentile(request, material, seed, effectiveDiameter, safePercentile, coolingMultiplier);
  const target = levelAtPercentile(request, material, seed, effectiveDiameter, targetPercentile, coolingMultiplier);
  const allowUpper = request.objective.aggressiveness === "slightly_aggressive"
    && material.upperTrialAllowed
    && seed.upperTrialAllowed
    && risk.score < 0.55
    && envelope.match === "inside"
    && request.tool.stickout_mm !== null
    && (request.tool.diameter_mm >= 1 || request.machine.measured_runout_mm !== null)
    && request.cut.contact_mode !== "unknown"
    && request.cut.stock_model_quality !== "unknown";
  const upper = allowUpper
    ? levelAtPercentile(request, material, seed, effectiveDiameter, upperPercentile, coolingMultiplier)
    : null;
  if (!upper) warnings.push(warning("upper-trial-withheld", "The generic provider withheld an upper-trial value because setup/source confidence is insufficient.", "info"));

  const levels = {
    safe_start: publicLevel(safe),
    target: publicLevel(target),
    upper_trial: publicLevel(upper),
  };
  const aeMm = request.tool.diameter_mm * (request.cut.ae_percent / 100);
  const actualVc = vcFromRpm(target.rpm, effectiveDiameter.targetMm);
  const result = {
    status: "provisional",
    request_hash: requestHash(request),
    engine_version: ENGINE_VERSION,
    source_database_version: SOURCE_DATABASE_VERSION,
    levels,
    calculations: {
      effective_diameter_mm: Number(effectiveDiameter.targetMm.toFixed(6)),
      effective_diameter_range_mm: [
        Number(effectiveDiameter.minimumMm.toFixed(6)),
        Number(effectiveDiameter.maximumMm.toFixed(6)),
      ],
      actual_vc_m_min: Number(actualVc.toFixed(3)),
      active_vc_range_m_min: seed.vcRange.map((value) => Number(value.toFixed(3))),
      ap_over_d: Number(envelope.apOverD.toFixed(4)),
      ae_over_d: Number(envelope.aeOverD.toFixed(4)),
      radial_chip_factor: Number(radialChipThicknessFactor(request.cut.ae_percent).toFixed(6)),
      axial_chip_factor: null,
      rpm_limited: target._rpmUncapped > target.rpm + 50,
      mrr_mm3_min: Number(mrrMm3Min(request.cut.ap_mm, aeMm, target.feed_mm_min).toFixed(3)),
      estimated_power_kw: null,
      source_envelope_match: envelope.match,
    },
    source: {
      level: "generic",
      record_ids: [material.seedKey],
      summary: `Provisional generic v2.2 bootstrap for ${material.materialLabel}.`,
      review_status: "provisional-generic",
    },
    current_gcode: currentGcodeComparison(request, levels),
    risk,
    confidence,
    warnings: uniqueWarnings(warnings),
    explanation_trace: [
      `Resolved workpiece to ${material.materialLabel} (${material.confidence} identity confidence).`,
      `Selected generic seed ${material.seedKey}; exact manufacturer data were not used.`,
      `Used ${effectiveDiameter.method} effective diameter ${effectiveDiameter.targetMm.toFixed(3)} mm.`,
      `Applied operation, profile, micro-tool, cooling, and bounded radial-chip factors once.`,
      `Clamped RPM to machine/tool limits and quantized RPM by 100 and feed by 5 mm/min.`,
    ],
    missing_inputs: [],
    optimization: {
      objective: request.objective.priority,
      candidates_evaluated: upper ? 3 : 2,
      candidates_feasible: upper ? 3 : 2,
      candidates_rejected: 0,
      selected_safe_candidate_id: "generic-safe",
      selected_target_candidate_id: "generic-target",
      selected_upper_candidate_id: upper ? "generic-upper" : null,
      debug_trace_available: false,
    },
  };
  return result;
}

module.exports = {
  ENGINE_VERSION,
  SOURCE_DATABASE_VERSION,
  recommendGeneric,
  requestHash,
  stableStringify,
};
