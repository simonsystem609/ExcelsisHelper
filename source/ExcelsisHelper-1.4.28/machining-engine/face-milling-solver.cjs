"use strict";

const { validateRecommendationRequest } = require("./contracts.cjs");
const {
  feedFromFz,
  fzFromFeed,
  mrrMm3Min,
  quantizeMachiningValue,
  rpmFromVc,
  vcFromRpm,
} = require("./formulas.cjs");
const { resolveMaterialSelection } = require("./materials.cjs");
const { requestHash } = require("./solver.cjs");

const FACE_MILLING_ENGINE_VERSION = "2.2-excelsis.face.1";
const FACE_MILLING_DATABASE_VERSION = "indexable-face-bootstrap-0.1";

const FACE_MILLING_SOURCES = Object.freeze([
  Object.freeze({
    id: "kennametal-mill-1-14-starting-data",
    owner: "Kennametal",
    role: "indexable face-mill starting speed and engagement-specific feed bands",
    url: "https://www.kennametal.com/us/en/products/p.mill-1-14-shell-mill-inch.2624270.html",
    retrievedAt: "2026-07-17",
  }),
  Object.freeze({
    id: "sandvik-milling-formulas-metric",
    owner: "Sandvik Coromant",
    role: "metric milling RPM, table-feed, MRR, power, and torque formulas",
    url: "https://cdn.sandvik.coromant.com/files/sitecollectiondocuments/services/metal-cutting-e-learning/formulas-and-definitions/formulas-and-deinitions-for-milling-metric-enu.pdf",
    retrievedAt: "2026-07-17",
  }),
]);

// These are deliberately conservative subsets of the reviewed Mill 1-14
// starting-speed table. They are not a substitute for the actual insert grade.
const STEEL_SPEED_PROFILES = Object.freeze({
  steel_mild_soft: Object.freeze([150, 220]),
  steel_low_alloy_or_mold_annealed: Object.freeze([110, 170]),
  steel_high_carbide_tool_or_hss_workpiece_annealed: Object.freeze([80, 120]),
  steel_hardened_38_45: Object.freeze([70, 100]),
});

const NONFERROUS_SPEED_PROFILES = Object.freeze({
  aluminum_wrought_general: Object.freeze([760, 945]),
});

const LIGHT_FEED_BANDS = Object.freeze([
  Object.freeze({ maximumAePercent: 5, range: Object.freeze([0.12, 0.23]) }),
  Object.freeze({ maximumAePercent: 10, range: Object.freeze([0.08, 0.17]) }),
  Object.freeze({ maximumAePercent: 20, range: Object.freeze([0.06, 0.13]) }),
  Object.freeze({ maximumAePercent: 30, range: Object.freeze([0.06, 0.11]) }),
  Object.freeze({ maximumAePercent: 100, range: Object.freeze([0.05, 0.10]) }),
]);

function warning(code, message, severity = "warning") {
  return { code, message, severity };
}

function selectRange(range, percentile) {
  return range[0] + ((range[1] - range[0]) * Math.max(0, Math.min(1, percentile)));
}

function materialFromRequest(request, supplied) {
  if (supplied && typeof supplied === "object") return supplied;
  return resolveMaterialSelection({
    family: request.workpiece.material_family || request.workpiece.material_id,
    grade: request.workpiece.grade || (request.workpiece.material_family ? "" : request.workpiece.material_id),
    hardness: request.workpiece.hardness,
  });
}

function speedProfile(material) {
  if (material.familyId === "steel") return STEEL_SPEED_PROFILES[material.seedKey] || null;
  if (material.familyId === "aluminum") {
    return NONFERROUS_SPEED_PROFILES[material.seedKey] || null;
  }
  return null;
}

function feedBand(aePercent) {
  return LIGHT_FEED_BANDS.find((item) => aePercent <= item.maximumAePercent)?.range || null;
}

function currentGcodeComparison(request, levels) {
  const rpmValue = Number(request.gcode_context?.commanded_rpm);
  const feedValue = Number(request.gcode_context?.commanded_feed_mm_min);
  const rpm = Number.isFinite(rpmValue) && rpmValue >= 0 ? rpmValue : null;
  const feed = Number.isFinite(feedValue) && feedValue >= 0 ? feedValue : null;
  if (rpm === null && feed === null) return null;
  const currentFz = rpm > 0 && feed !== null
    ? fzFromFeed(feed, rpm, request.tool.effective_teeth) : null;
  return {
    rpm,
    feed_mm_min: feed,
    fz_mm_tooth: currentFz === null ? null : Number(currentFz.toFixed(6)),
    comparison: levels.target && feed !== null
      ? (feed <= levels.target.feed_mm_min ? "at_or_below_target" : "above_target") : null,
    rpm_change_percent: rpm > 0 && levels.target
      ? Number((((levels.target.rpm / rpm) - 1) * 100).toFixed(1)) : null,
    feed_change_percent: feed > 0 && levels.target
      ? Number((((levels.target.feed_mm_min / feed) - 1) * 100).toFixed(1)) : null,
  };
}

function unsupportedResponse(request, material, messages) {
  const warnings = messages.map((message, index) => warning(
    `face-mill-unsupported-${index + 1}`,
    String(message),
    "critical",
  ));
  const levels = { safe_start: null, target: null, upper_trial: null };
  return {
    process: "face_milling",
    status: "unsupported",
    request_hash: requestHash(request),
    engine_version: FACE_MILLING_ENGINE_VERSION,
    source_database_version: FACE_MILLING_DATABASE_VERSION,
    levels,
    source: {
      level: "none",
      record_ids: [],
      summary: "No compatible indexable face-milling fallback.",
      review_status: null,
    },
    material,
    calculations: null,
    current_gcode: currentGcodeComparison(request, levels),
    risk: { level: "reject", score: 1, reasons: messages.map(String), components: { unsupported: 1 } },
    confidence: { overall: 0, source_match: 0, material_match: 0, engagement_match: 0, setup_match: 0 },
    warnings,
    explanation_trace: ["Request validated.", "The indexable face-milling suitability gate rejected the request."],
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

function publicLevel(rpm, feed, fz) {
  return {
    rpm,
    feed_mm_min: feed,
    fz_mm_tooth: Number(fz.toFixed(6)),
    hmax_mm: null,
  };
}

function recommendFaceMilling(input, options = {}) {
  const request = validateRecommendationRequest(input);
  const material = materialFromRequest(request, options.materialResolution);
  const rejects = [];
  if (request.tool.type !== "face_mill") rejects.push("This solver accepts indexable face mills only.");
  if (!material.supported) rejects.push(...(material.warnings || ["The selected material is unsupported."]));
  if (request.tool.substrate !== "carbide") rejects.push("The generic face-mill fallback requires carbide inserts.");
  if (request.cut.operation !== "face") rejects.push("The generic indexable route supports face milling only.");
  if (request.tool.diameter_mm < 20 || request.tool.diameter_mm > 160) {
    rejects.push("Generic indexable face-mill diameter coverage is 20-160 mm.");
  }
  if (request.cut.ap_mm > 5) rejects.push("Axial depth above 5 mm requires exact insert-family and machine power data.");
  if (request.cut.ae_percent < 5) rejects.push("Radial engagement below 5% is outside the reviewed starting-feed table.");
  if (material.familyId === "steel"
      && ["steel_hardened_45_55", "steel_hardened_55_60"].includes(material.seedKey)) {
    rejects.push("Generic indexable face milling above 45 HRC requires an exact insert grade and family source.");
  }
  const vcRange = speedProfile(material);
  const fzRange = feedBand(request.cut.ae_percent);
  if (!vcRange) rejects.push(`No reviewed face-mill speed profile covers ${material.materialLabel || material.familyLabel || "this material"}.`);
  if (!fzRange) rejects.push("No reviewed face-mill feed band covers this radial engagement.");
  if (rejects.length) return unsupportedResponse(request, material, rejects);

  const warnings = (material.warnings || []).map((message, index) => warning(`material-${index + 1}`, message));
  warnings.push(warning(
    "unknown-indexable-insert-family",
    "The insert family, grade, edge preparation, and entering angle are unknown; this is a conservative starting proposal, not an insert-specific optimum.",
  ));
  warnings.push(warning(
    "face-mill-power-unverified",
    "Machine power and torque were not supplied. Review spindle load and accept face-mill edits manually.",
  ));
  warnings.push(warning(
    "face-mill-upper-withheld",
    "The upper trial is withheld until the exact insert family and machine power are known.",
    "info",
  ));

  let coolingMultiplier = 1;
  const wet = ["mist", "air_plus_mql", "flood", "through_tool"].includes(request.cooling.mode);
  if (material.familyId === "steel" && wet) {
    coolingMultiplier = 0.8;
    warnings.push(warning("face-mill-wet-speed", "The reviewed steel table calls for a 20% cutting-speed reduction for wet machining."));
  }
  if (["aluminum", "copper_alloy"].includes(material.familyId) && !wet) {
    coolingMultiplier = 0.75;
    warnings.push(warning(
      "face-mill-nonferrous-cooling",
      "The reviewed nonferrous indexable data are wet-machining data; a conservative derating was applied because liquid/MQL cooling is not selected.",
      "critical",
    ));
  }

  const percentile = {
    conservative: 0.2,
    balanced: 0.5,
    slightly_aggressive: 0.8,
  }[request.objective.aggressiveness];
  const rpmCap = Math.min(
    request.machine.max_rpm,
    request.tool.vendor_max_rpm || Number.POSITIVE_INFINITY,
    request.tool.holder_max_rpm || Number.POSITIVE_INFINITY,
  );
  const feedCap = Math.min(
    request.machine.max_feed_mm_min || Number.POSITIVE_INFINITY,
    request.tool.vendor_max_feed_mm_min || Number.POSITIVE_INFINITY,
  );

  const level = (vcPercentile, fzPercentile) => {
    const vc = selectRange(vcRange, vcPercentile) * coolingMultiplier;
    const uncappedRpm = rpmFromVc(vc, request.tool.diameter_mm);
    const rpm = quantizeMachiningValue(Math.min(uncappedRpm, rpmCap), 100, { minimum: 100, maximum: rpmCap });
    const requestedFz = selectRange(fzRange, fzPercentile);
    const uncappedFeed = feedFromFz(rpm, request.tool.effective_teeth, requestedFz);
    const feedOptions = { minimum: Math.min(5, feedCap) };
    if (Number.isFinite(feedCap)) feedOptions.maximum = feedCap;
    const feed = quantizeMachiningValue(Math.min(uncappedFeed, feedCap), 5, feedOptions);
    const actualFz = fzFromFeed(feed, rpm, request.tool.effective_teeth);
    return { rpm, feed, fz: actualFz, uncappedRpm };
  };

  const safe = level(0.15, 0);
  const target = level(percentile, percentile);
  const levels = {
    safe_start: publicLevel(safe.rpm, safe.feed, safe.fz),
    target: publicLevel(target.rpm, target.feed, target.fz),
    upper_trial: null,
  };
  const aeMm = request.tool.diameter_mm * (request.cut.ae_percent / 100);
  const mrr = mrrMm3Min(request.cut.ap_mm, aeMm, target.feed);
  const riskScore = Number((0.64 + (material.confidence === "low" ? 0.1 : 0)).toFixed(2));

  return {
    process: "face_milling",
    status: "provisional",
    request_hash: requestHash(request),
    engine_version: FACE_MILLING_ENGINE_VERSION,
    source_database_version: FACE_MILLING_DATABASE_VERSION,
    levels,
    source: {
      level: "reviewed-family-bootstrap",
      record_ids: FACE_MILLING_SOURCES.map((source) => source.id),
      summary: "Conservative indexable face-milling start derived from reviewed Mill 1-14 data and standard metric milling formulas.",
      review_status: "provisional-cross-family",
    },
    material,
    calculations: {
      effective_diameter_mm: request.tool.diameter_mm,
      effective_diameter_range_mm: [request.tool.diameter_mm, request.tool.diameter_mm],
      actual_vc_m_min: Number(vcFromRpm(target.rpm, request.tool.diameter_mm).toFixed(3)),
      active_vc_range_m_min: vcRange.map((value) => Number((value * coolingMultiplier).toFixed(3))),
      ap_over_d: Number((request.cut.ap_mm / request.tool.diameter_mm).toFixed(4)),
      ae_over_d: Number((request.cut.ae_percent / 100).toFixed(4)),
      radial_chip_factor: null,
      axial_chip_factor: null,
      rpm_limited: target.uncappedRpm > target.rpm + 50,
      mrr_mm3_min: Number(mrr.toFixed(3)),
      estimated_power_kw: null,
      source_envelope_match: "inside",
    },
    current_gcode: currentGcodeComparison(request, levels),
    risk: {
      level: riskScore >= 0.72 ? "high" : "medium",
      score: riskScore,
      reasons: [
        "The exact insert family and machine power are unknown.",
        "Only conservative reviewed starting data are used.",
      ],
      components: { source: 0.3, tool: 0.2, machine: 0.14, material: material.confidence === "low" ? 0.1 : 0 },
    },
    confidence: {
      overall: material.confidence === "low" ? 0.28 : 0.36,
      source_match: 0.45,
      material_match: material.confidence === "low" ? 0.3 : 0.5,
      engagement_match: 0.75,
      setup_match: 0.2,
    },
    warnings,
    explanation_trace: [
      `Resolved workpiece to ${material.materialLabel} (${material.confidence} identity confidence).`,
      `Selected the ${request.cut.ae_percent}% engagement light-machining feed band.`,
      "Applied the reviewed cooling rule before converting cutting speed to RPM.",
      "Calculated feed from RPM, effective teeth, and feed per tooth.",
      "Quantized RPM by 100 and table feed by 5 mm/min; no upper trial was generated.",
    ],
    missing_inputs: [],
    optimization: {
      objective: request.objective.priority,
      candidates_evaluated: 2,
      candidates_feasible: 2,
      candidates_rejected: 0,
      selected_safe_candidate_id: "face-mill-safe",
      selected_target_candidate_id: "face-mill-target",
      selected_upper_candidate_id: null,
      debug_trace_available: false,
    },
  };
}

module.exports = {
  FACE_MILLING_DATABASE_VERSION,
  FACE_MILLING_ENGINE_VERSION,
  FACE_MILLING_SOURCES,
  recommendFaceMilling,
};
