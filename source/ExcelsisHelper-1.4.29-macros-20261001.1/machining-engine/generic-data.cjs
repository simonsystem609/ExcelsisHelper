"use strict";

const { logInterpolate } = require("./formulas.cjs");

const DIAMETER_KNOTS_MM = Object.freeze([0.2, 0.5, 1, 2, 4, 8]);

const POLISHED_ALUMINUM_HMAX = Object.freeze([
  [0.004, 0.007], [0.007, 0.012], [0.012, 0.02],
  [0.02, 0.035], [0.03, 0.055], [0.045, 0.08],
]);

function scaledRanges(ranges, lowerFactor, upperFactor) {
  return ranges.map(([lower, upper]) => [lower * lowerFactor, upper * upperFactor]);
}

const GENERIC_SEEDS = Object.freeze({
  aluminum_wrought_polished: seed([250, 500], POLISHED_ALUMINUM_HMAX),
  aluminum_wrought_general: seed([150, 300], scaledRanges(POLISHED_ALUMINUM_HMAX, 0.6, 0.8)),
  brass_free_cutting: seed([220, 450], [
    [0.003, 0.006], [0.006, 0.011], [0.01, 0.018],
    [0.018, 0.03], [0.03, 0.05], [0.05, 0.08],
  ]),
  bronze_or_pure_copper_sharp: seed([100, 240], [
    [0.0025, 0.005], [0.005, 0.009], [0.008, 0.014],
    [0.014, 0.025], [0.024, 0.04], [0.035, 0.06],
  ]),
  aluminum_bronze: seed([70, 170], [
    [0.002, 0.004], [0.004, 0.007], [0.006, 0.011],
    [0.01, 0.02], [0.018, 0.032], [0.028, 0.05],
  ]),
  steel_mild_soft: seed([90, 180], [
    [0.0015, 0.003], [0.003, 0.0055], [0.0045, 0.0085],
    [0.008, 0.015], [0.015, 0.027], [0.026, 0.045],
  ]),
  steel_low_alloy_or_mold_annealed: seed([55, 150], [
    [0.0012, 0.0025], [0.0025, 0.0045], [0.0035, 0.007],
    [0.0065, 0.012], [0.012, 0.022], [0.02, 0.036],
  ]),
  steel_high_carbide_tool_or_hss_workpiece_annealed: seed([25, 100], [
    [0.0008, 0.002], [0.0018, 0.0035], [0.0028, 0.0055],
    [0.005, 0.0095], [0.009, 0.018], [0.016, 0.03],
  ]),
  steel_hardened_38_45: seed([60, 120], [
    [0.0008, 0.0018], [0.0015, 0.003], [0.0028, 0.0055],
    [0.005, 0.01], [0.01, 0.018], [0.018, 0.032],
  ], { requiresApplicationClass: "hard_milling" }),
  steel_hardened_45_55: seed([45, 100], [
    [0.0005, 0.0014], [0.001, 0.0024], [0.002, 0.0042],
    [0.004, 0.008], [0.008, 0.015], [0.014, 0.026],
  ], { requiresApplicationClass: "hard_milling_45_55_hrc", upperTrialAllowed: false }),
  steel_hardened_55_60: seed([40, 80], [
    null, [0.0007, 0.0017], [0.0013, 0.003],
    [0.0028, 0.006], [0.0055, 0.011], [0.01, 0.02],
  ], { requiresApplicationClass: "hard_milling_55_60_hrc", upperTrialAllowed: false }),
  plastic_unfilled_sharp: seed([80, 250], [
    [0.003, 0.007], [0.007, 0.015], [0.014, 0.028],
    [0.028, 0.055], [0.055, 0.11], [0.09, 0.18],
  ]),
  plastic_amorphous_or_high_temp: seed([60, 180], [
    [0.002, 0.005], [0.005, 0.012], [0.01, 0.022],
    [0.02, 0.045], [0.04, 0.085], [0.07, 0.14],
  ]),
  plastic_reinforced_or_thermoset: seed([60, 180], [
    [0.0015, 0.004], [0.004, 0.009], [0.008, 0.018],
    [0.016, 0.035], [0.03, 0.065], [0.05, 0.11],
  ], { abrasionWarning: true, upperTrialAllowed: false }),
});

const OPERATION_FACTORS = Object.freeze({
  full_slot: [0.7, 0.9],
  pocket: [0.65, 0.85],
  side_mill: [1, 1.15],
  adaptive: [1, 1.2],
  face: [0.8, 1],
  wall_finish: [0.85, 1.05],
  floor_finish: [0.8, 1],
  "3d_finish": [0.7, 0.95],
  rest_rough: [0.5, 0.9],
  chamfer: [0.5, 0.85],
  linear_ramp: [0.3, 0.6],
  helical_ramp: [0.3, 0.6],
});

const PROFILE_FACTORS = Object.freeze({
  square_side: [1, 1],
  corner_radius_side: [0.9, 1],
  ball_wall: [0.75, 0.95],
  ball_mixed_3d: [0.6, 0.8],
  ball_tip_heavy: [0.45, 0.65],
  chamfer_short_edge: [0.5, 0.85],
  chamfer_long_edge: [0.35, 0.65],
});

function seed(vcRange, hmaxRanges, options = {}) {
  return Object.freeze({
    vcRange: Object.freeze([...vcRange]),
    hmaxRanges: Object.freeze(hmaxRanges.map((range) => range ? Object.freeze([...range]) : null)),
    requiresApplicationClass: options.requiresApplicationClass || null,
    abrasionWarning: options.abrasionWarning === true,
    upperTrialAllowed: options.upperTrialAllowed !== false,
  });
}

function selectRange(range, percentile) {
  const p = Math.max(0, Math.min(1, Number(percentile)));
  return range[0] + ((range[1] - range[0]) * p);
}

function interpolateRange(diameterMm, ranges) {
  const diameter = Number(diameterMm);
  if (!Number.isFinite(diameter) || diameter <= 0) throw new TypeError("diameterMm must be positive.");
  const exactIndex = DIAMETER_KNOTS_MM.findIndex((knot) => Math.abs(knot - diameter) < 1e-12);
  if (exactIndex >= 0) return ranges[exactIndex] ? [...ranges[exactIndex]] : null;
  if (diameter <= DIAMETER_KNOTS_MM[0]) return ranges[0] ? [...ranges[0]] : null;
  const lastIndex = DIAMETER_KNOTS_MM.length - 1;
  if (diameter >= DIAMETER_KNOTS_MM[lastIndex]) return ranges[lastIndex] ? [...ranges[lastIndex]] : null;
  for (let index = 0; index < lastIndex; index += 1) {
    const lowerD = DIAMETER_KNOTS_MM[index];
    const upperD = DIAMETER_KNOTS_MM[index + 1];
    if (diameter < lowerD || diameter > upperD) continue;
    const lower = ranges[index];
    const upper = ranges[index + 1];
    if (!lower || !upper) return null;
    return [
      logInterpolate(diameter, lowerD, upperD, lower[0], upper[0]),
      logInterpolate(diameter, lowerD, upperD, lower[1], upper[1]),
    ];
  }
  return null;
}

function genericSeedAtDiameter(seedKey, diameterMm) {
  const source = GENERIC_SEEDS[seedKey];
  if (!source) return null;
  return {
    key: seedKey,
    vcRange: [...source.vcRange],
    hmaxRange: interpolateRange(diameterMm, source.hmaxRanges),
    clampedAboveDiameter: Number(diameterMm) > DIAMETER_KNOTS_MM.at(-1),
    requiresApplicationClass: source.requiresApplicationClass,
    abrasionWarning: source.abrasionWarning,
    upperTrialAllowed: source.upperTrialAllowed,
  };
}

function operationFactor(operation, percentile) {
  return selectRange(OPERATION_FACTORS[operation] || [0.65, 0.85], percentile);
}

function profileKey(tool, cut) {
  if (["ballnose", "tapered_ballnose"].includes(tool.type)) {
    if (cut.contact_mode === "wall_side") return "ball_wall";
    if (cut.contact_mode === "mixed_3d") return "ball_mixed_3d";
    return "ball_tip_heavy";
  }
  if (["chamfer", "engraver_vbit"].includes(tool.type)) {
    return Number(cut.edge_utilization_percent || 100) > 60 ? "chamfer_long_edge" : "chamfer_short_edge";
  }
  if (tool.type === "corner_radius") return "corner_radius_side";
  return "square_side";
}

function profileFactor(tool, cut, percentile) {
  return selectRange(PROFILE_FACTORS[profileKey(tool, cut)], percentile);
}

function microFactor(diameterMm, percentile) {
  const diameter = Number(diameterMm);
  if (diameter <= 0.2) return null;
  if (diameter < 0.5) return selectRange([0.55, 0.75], percentile);
  if (diameter < 1) return selectRange([0.75, 0.9], percentile);
  return selectRange([0.9, 1], percentile);
}

module.exports = {
  DIAMETER_KNOTS_MM,
  GENERIC_SEEDS,
  OPERATION_FACTORS,
  PROFILE_FACTORS,
  genericSeedAtDiameter,
  interpolateRange,
  microFactor,
  operationFactor,
  profileFactor,
  profileKey,
  selectRange,
};
