"use strict";

const assert = require("node:assert/strict");
const { MachiningValidationError } = require("../machining-engine/contracts.cjs");
const { validateDrillingRequest } = require("../machining-engine/process-contracts.cjs");
const { recommendDrilling } = require("../machining-engine/drilling-solver.cjs");

function request(overrides = {}) {
  return {
    mode: "analyze_gcode",
    machine: { max_rpm: 10000, max_feed_mm_min: 8000, rigidity_class: "medium" },
    workpiece: { material_family: "steel", grade: null, hardness: null },
    tool: { type: "drill", diameter_mm: 6.8, flute_count: 2, substrate: "hss" },
    hole: { depth_mm: 22, kind: "blind", cycle: "CYCLE83", peck_depth_mm: 1 },
    cooling: { mode: "flood", continuous: true, directed: true },
    objective: { aggressiveness: "balanced", priority: "balanced" },
    gcode_context: { commanded_rpm: 950, commanded_feed_mm_min: 250, cycle_text: "CYCLE83(...)" },
    ...overrides,
  };
}

const normalized = validateDrillingRequest(request());
assert.equal(normalized.process, "drilling");
assert.equal(normalized.tool.flute_count, 2);
assert.equal(normalized.hole.peck_depth_mm, 1);

assert.throws(() => validateDrillingRequest(request({
  hole: { depth_mm: 5, kind: "blind", cycle: "CYCLE83", peck_depth_mm: 8 },
})), MachiningValidationError);

const broadSteel = recommendDrilling(request());
assert.equal(broadSteel.status, "provisional");
assert.equal(broadSteel.material.familyId, "steel");
assert.equal(broadSteel.material.confidence, "low");
assert.equal(broadSteel.levels.target.rpm % 100, 0);
assert.equal(broadSteel.levels.target.feed_mm_min % 5, 0);
assert.ok(broadSteel.levels.target.feed_per_revolution_mm > 0);
assert.ok(broadSteel.warnings.some((item) => item.code === "steel-hardness-unknown"));

const aluminum = recommendDrilling(request({
  workpiece: { material_family: "aluminium", grade: "6061" },
  tool: { type: "drill", diameter_mm: 10, flute_count: 2, substrate: "carbide", manufacturer: "DHF", series: "DAK" },
  hole: { depth_mm: 18, kind: "through", cycle: "CYCLE81" },
  cooling: { mode: "flood", continuous: true, directed: true },
  objective: { aggressiveness: "slightly_aggressive", priority: "cycle_time" },
  gcode_context: null,
}));
assert.equal(aluminum.status, "provisional");
assert.equal(aluminum.material.familyId, "aluminum");
assert.ok(aluminum.levels.upper_trial);
assert.equal(aluminum.levels.target.rpm % 100, 0);
assert.equal(aluminum.levels.target.feed_mm_min % 5, 0);

const plastic = recommendDrilling(request({
  workpiece: { material_family: "plastic", grade: "POM-C" },
  tool: { type: "drill", diameter_mm: 8, flute_count: 2, substrate: "hss" },
  hole: { depth_mm: 16, kind: "through", cycle: "plain_drilling" },
  cooling: { mode: "air", continuous: true, directed: true },
  gcode_context: null,
}));
assert.equal(plastic.status, "provisional");
assert.equal(plastic.material.familyId, "plastic");

const unsupportedHardHss = recommendDrilling(request({
  workpiece: { material_family: "steel", grade: "H13", hardness: { value: 50, scale: "HRC" } },
  tool: { type: "drill", diameter_mm: 6, flute_count: 2, substrate: "hss" },
}));
assert.equal(unsupportedHardHss.status, "unsupported");

const tooDeep = recommendDrilling(request({
  hole: { depth_mm: 100, kind: "blind", cycle: "CYCLE83", peck_depth_mm: 2 },
}));
assert.equal(tooDeep.status, "unsupported");

console.log("Machining drilling contract, provider, broad-material, and safety tests passed.");
