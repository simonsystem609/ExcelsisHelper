"use strict";

const assert = require("node:assert/strict");
const { genericSeedAtDiameter } = require("../machining-engine/generic-data.cjs");
const { resolveMaterialSelection } = require("../machining-engine/materials.cjs");
const { recommendGeneric, requestHash } = require("../machining-engine/solver.cjs");

const clone = (value) => JSON.parse(JSON.stringify(value));

const baseRequest = {
  mode: "analyze_gcode",
  machine: { max_rpm: 14500, max_feed_mm_min: 10000, rigidity_class: "medium" },
  workpiece: {
    material_id: "aluminum.generic",
    grade: null,
    condition: null,
    material_family: "aluminum",
    hardness: null,
  },
  tool: {
    type: "square_endmill",
    diameter_mm: 8,
    flute_count: 2,
    effective_teeth: 2,
    substrate: "carbide",
    application_class: "general_unknown",
    stickout_mm: null,
  },
  cut: {
    operation: "side_mill",
    ap_mm: 4,
    ae_percent: 10,
    contact_mode: "side",
    stock_model_quality: "user_estimate",
  },
  cooling: { mode: "air", continuous: true, directed: true },
  objective: { aggressiveness: "balanced", priority: "balanced", unattended: false },
  gcode_context: {
    commanded_rpm: 8000,
    commanded_feed_mm_min: 500,
    tool_number: "T1",
    dialect: "SINUMERIK",
    units: "mm",
    commanded_feed_mode: "per_min",
  },
};

const seed = genericSeedAtDiameter("steel_mild_soft", 2);
assert.deepEqual(seed.vcRange, [90, 180]);
assert.deepEqual(seed.hmaxRange, [0.008, 0.015]);
assert.equal(seed.clampedAboveDiameter, false);
assert.equal(genericSeedAtDiameter("steel_mild_soft", 12).clampedAboveDiameter, true);

const broadAluminum = resolveMaterialSelection({ family: "aluminium" });
const first = recommendGeneric(baseRequest, { materialResolution: broadAluminum });
assert.equal(first.status, "provisional");
assert.equal(first.source.level, "generic");
assert.equal(first.source.record_ids[0], "aluminum_wrought_general");
assert.ok(first.levels.safe_start.feed_mm_min > 0);
assert.ok(first.levels.target.feed_mm_min >= first.levels.safe_start.feed_mm_min);
assert.equal(first.levels.target.rpm % 100, 0);
assert.equal(first.levels.target.feed_mm_min % 5, 0);
assert.ok(first.levels.target.rpm <= 14500);
assert.equal(first.levels.upper_trial, null);
assert.match(first.warnings.map((item) => item.code).join(" "), /upper-trial-withheld/);
assert.ok(first.current_gcode.feed_override_to_target_percent > 0);
assert.equal(first.calculations.effective_diameter_mm, 8);
assert.equal(first.calculations.ae_over_d, 0.1);
assert.equal(first.optimization.candidates_evaluated, 2);

const second = recommendGeneric(clone(baseRequest), { materialResolution: broadAluminum });
assert.equal(second.request_hash, first.request_hash);
assert.deepEqual(second.levels, first.levels);
assert.equal(requestHash({ b: 2, a: 1 }), requestHash({ a: 1, b: 2 }));

const lowRpm = clone(baseRequest);
lowRpm.machine.max_rpm = 3000;
const limited = recommendGeneric(lowRpm, { materialResolution: broadAluminum });
assert.ok(limited.levels.target.rpm <= 3000);
assert.equal(limited.calculations.rpm_limited, true);

const hardRequest = clone(baseRequest);
hardRequest.workpiece = {
  material_id: "steel.tool.d2",
  grade: "D2 / 1.2379",
  condition: "hardened",
  material_family: "steel",
  hardness: { value: 50, scale: "HRC", measured: true, source: "measured" },
};
hardRequest.tool.application_class = "hard_milling_45_55_hrc";
hardRequest.cut.ap_mm = 0.2;
hardRequest.cut.ae_percent = 5;
hardRequest.cooling = { mode: "air", continuous: true, directed: true };
const hardMaterial = resolveMaterialSelection({ family: "steel", grade: "D2", hardnessValue: 50, hardnessScale: "HRC" });
const hardResult = recommendGeneric(hardRequest, { materialResolution: hardMaterial });
assert.equal(hardResult.status, "provisional");
assert.equal(hardResult.source.record_ids[0], "steel_hardened_45_55");
assert.equal(hardResult.levels.upper_trial, null);

const wrongHardTool = clone(hardRequest);
wrongHardTool.tool.application_class = "general_unknown";
const rejectedHardTool = recommendGeneric(wrongHardTool, { materialResolution: hardMaterial });
assert.equal(rejectedHardTool.status, "unsupported");
assert.equal(rejectedHardTool.risk.level, "reject");

const drill = clone(baseRequest);
drill.tool.type = "drill";
const rejectedDrill = recommendGeneric(drill, { materialResolution: broadAluminum });
assert.equal(rejectedDrill.status, "unsupported");
assert.match(rejectedDrill.risk.reasons.join(" "), /outside the release-one/i);

const hssMill = clone(baseRequest);
hssMill.tool.substrate = "hss";
const rejectedHss = recommendGeneric(hssMill, { materialResolution: broadAluminum });
assert.equal(rejectedHss.status, "unsupported");
assert.match(rejectedHss.risk.reasons.join(" "), /Generic hss milling data/i);

const micro = clone(baseRequest);
micro.tool.diameter_mm = 0.2;
micro.cut.ap_mm = 0.02;
const rejectedMicro = recommendGeneric(micro, { materialResolution: broadAluminum });
assert.equal(rejectedMicro.status, "unsupported");
assert.match(rejectedMicro.risk.reasons.join(" "), /exact reviewed micro-tool data/i);

console.log("Machining generic provider, suitability, deterministic candidate, and quantization tests passed.");
