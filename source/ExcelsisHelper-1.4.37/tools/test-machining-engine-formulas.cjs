"use strict";

const assert = require("node:assert/strict");
const {
  MachiningValidationError,
  isReleaseOneToolType,
  validateRecommendationRequest,
} = require("../machining-engine/contracts.cjs");
const formulas = require("../machining-engine/formulas.cjs");

function near(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);
}

const request = {
  mode: "recommend",
  machine: { max_rpm: 14500, max_feed_mm_min: 10000, rigidity_class: "medium" },
  workpiece: {
    material_id: "aluminum.wrought.heat_treatable.EN_AW_7075",
    grade: "EN AW-7075",
    condition: "T6",
    material_family: "aluminum",
    hardness: null,
  },
  tool: {
    type: "square_endmill",
    diameter_mm: 1,
    flute_count: 2,
    substrate: "carbide",
    application_class: "aluminum_specific_polished",
    polished_flutes: true,
  },
  cut: { operation: "full_slot", ap_mm: 0.1, ae_percent: 100, contact_mode: "side" },
  cooling: { mode: "air_plus_mql", continuous: true },
  objective: { aggressiveness: "balanced", priority: "balanced" },
};

const normalized = validateRecommendationRequest(request);
assert.equal(normalized.tool.effective_teeth, 2);
assert.equal(normalized.workpiece.hardness, null);
assert.equal(isReleaseOneToolType(normalized.tool.type), true);
assert.equal(isReleaseOneToolType("drill"), false);

assert.throws(() => validateRecommendationRequest({
  ...request,
  workpiece: { ...request.workpiece, hardness: { value: 50, scale: null } },
}), MachiningValidationError);
assert.throws(() => validateRecommendationRequest({
  ...request,
  cut: { ...request.cut, ae_percent: 0 },
}), /ae_percent/);
assert.throws(() => validateRecommendationRequest({
  ...request,
  tool: { ...request.tool, type: "ballnose", ball_radius_mm: null },
}), /ball_radius_mm/);

near(formulas.ballnoseEffectiveDiameterFromDepth(1, 0), 0);
near(formulas.ballnoseEffectiveDiameterFromDepth(1, 0.1), 0.6);
near(formulas.ballnoseEffectiveDiameterFromDepth(1, 0.5), 1);
near(formulas.ballnoseEffectiveDiameterFromAngle(10, 30), 5);
near(formulas.bullnoseEffectiveDiameter(20, 0.8, 0.8), 20);
assert.ok(formulas.bullnoseEffectiveDiameter(20, 0.8, 0.2) < 20);

const chamfer = formulas.chamferActiveDiameter({
  diameterMm: 12,
  tipDiameterMm: 0,
  includedAngleDeg: 90,
  featureDepthMm: 5,
  edgeUtilizationPercent: 80,
});
near(chamfer.outerMm, 10);
near(chamfer.innerMm, 2);
near(chamfer.midpointMm, 6);

near(formulas.radialChipThinningMultiplier(50), 1);
near(formulas.radialChipThinningMultiplier(25), 1.1547005383792517);
near(formulas.radialChipThinningMultiplier(10), 1.6666666666666667);
near(formulas.radialChipThinningMultiplier(5), 2.294157338705618);
near(formulas.radialChipThinningMultiplier(1, 1.8), 1.8);

near(formulas.feedFromFz(14500, 2, 0.012), 348);
near(formulas.fzFromFeed(348, 14500, 2), 0.012);
near(formulas.feedFromFn(950, 0.2631578947368421), 250);
near(formulas.fnFromFeed(250, 950), 0.2631578947368421);
near(formulas.pitchFromSynchronizedFeed(250, 200), 1.25);
near(formulas.vcFromRpm(formulas.rpmFromVc(100, 8), 8), 100);
near(formulas.mrrMm3Min(1, 0.5, 1000), 500);
near(formulas.estimatedPowerKw(60_000, 2000, 1), 2);
near(formulas.stepoverForScallop(5, formulas.scallopHeight(5, 1)), 1);
near(formulas.logInterpolate(2, 1, 4, 0.01, 0.04), 0.02);

assert.equal(formulas.quantizeMachiningValue(14549, 100, { maximum: 14500 }), 14500);
assert.equal(formulas.quantizeMachiningValue(14351, 100, { maximum: 14500 }), 14400);
assert.equal(formulas.quantizeMachiningValue(347, 5), 345);
assert.equal(formulas.quantizeMachiningValue(80, 100, { minimum: 100, maximum: 80 }), 80);

let seed = 0x12345678;
const random = () => {
  seed = ((seed * 1664525) + 1013904223) >>> 0;
  return seed / 0x100000000;
};
for (let index = 0; index < 2000; index += 1) {
  const diameter = 0.2 + (random() * 24.8);
  const depth = random() * (diameter / 2);
  const effective = formulas.ballnoseEffectiveDiameterFromDepth(diameter, depth);
  assert.ok(Number.isFinite(effective) && effective >= 0 && effective <= diameter + 1e-9);

  const ae = 0.1 + (random() * 99.9);
  const multiplier = formulas.radialChipThinningMultiplier(ae, 2.5);
  assert.ok(Number.isFinite(multiplier) && multiplier >= 1 && multiplier <= 2.5 + 1e-9);

  const vc = 10 + (random() * 500);
  const rpm = formulas.rpmFromVc(vc, diameter);
  assert.ok(Number.isFinite(rpm) && rpm > 0);
  near(formulas.vcFromRpm(rpm, diameter), vc, 1e-8);
}

console.log("Machining request-contract, formula, geometry, and property tests passed.");
