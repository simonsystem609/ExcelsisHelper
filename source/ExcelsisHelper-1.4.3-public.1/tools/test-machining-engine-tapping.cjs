"use strict";

const assert = require("node:assert/strict");
const { validateTappingRequest } = require("../machining-engine/process-contracts.cjs");
const {
  parseMetricPitch,
  recommendTapping,
  resolveTapPitch,
} = require("../machining-engine/tapping-solver.cjs");

function request(overrides = {}) {
  return {
    mode: "analyze_gcode",
    machine: { max_rpm: 10000, max_feed_mm_min: 8000, rigidity_class: "medium" },
    workpiece: { material_family: "steel", grade: "42CrMo4", hardness: { value: 28, scale: "HRC" } },
    tool: { type: "tap", nominal_diameter_mm: 8, substrate: "hss_co", style: "cut" },
    thread: { label: "M8", cycle_pitch_mm: 1.25, depth_mm: 10, kind: "blind", pre_drill_diameter_mm: 6.8 },
    cooling: { mode: "flood", continuous: true, directed: true, lubrication_score: 0.9 },
    objective: { aggressiveness: "balanced", priority: "tool_life" },
    gcode_context: {
      cycle: "CYCLE84",
      commanded_rpm: 200,
      retract_rpm: 200,
      synchronized_feed_mm_min: 250,
      feed_mode: "mm_per_min",
      cycle_text: "CYCLE84(25.,0.,2.,-10.,,0.,3.,,1.25,0.,200.,200.)",
    },
    ...overrides,
  };
}

assert.equal(parseMetricPitch("M8x1.25"), 1.25);
assert.equal(parseMetricPitch("tap M 10 X 1,5 RH"), 1.5);
assert.equal(parseMetricPitch("M8"), null);

const normalized = validateTappingRequest(request());
const pitch = resolveTapPitch(normalized);
assert.equal(pitch.status, "resolved");
assert.equal(pitch.pitch_mm, 1.25);
assert.ok(pitch.evidence.some((item) => item.source === "cycle_explicit"));
assert.ok(pitch.evidence.some((item) => item.source === "synchronized_feed_over_rpm"));

const m8 = recommendTapping(request());
assert.equal(m8.status, "provisional");
assert.equal(m8.pitch.pitch_mm, 1.25);
assert.equal(m8.levels.target.rpm % 100, 0);
assert.equal(m8.levels.target.feed_mm_min % 5, 0);
assert.equal(m8.levels.target.retract_rpm, m8.levels.target.rpm);
assert.equal(m8.levels.target.feed_mm_min, m8.levels.target.rpm * 1.25);
assert.equal(m8.levels.target.synchronized, true);

const ratioOnly = recommendTapping(request({
  thread: { label: "M8", depth_mm: 10, kind: "blind", pre_drill_diameter_mm: 6.8 },
}));
assert.equal(ratioOnly.status, "provisional");
assert.equal(ratioOnly.pitch.selected_source, "synchronized_feed_over_rpm");
assert.equal(ratioOnly.pitch.pitch_mm, 1.25);

const conflict = recommendTapping(request({
  gcode_context: {
    cycle: "CYCLE84",
    commanded_rpm: 200,
    retract_rpm: 200,
    synchronized_feed_mm_min: 300,
    feed_mode: "mm_per_min",
  },
}));
assert.equal(conflict.status, "conflict");
assert.ok(conflict.pitch.conflicts.length > 0);

const missingStyle = recommendTapping(request({
  tool: { type: "tap", nominal_diameter_mm: 8, substrate: "hss_co", style: "unknown" },
}));
assert.equal(missingStyle.status, "needs_input");
assert.ok(missingStyle.missing_inputs.includes("tool.style"));

const formNeedsPilot = recommendTapping(request({
  tool: { type: "tap", nominal_diameter_mm: 8, substrate: "pm_hss", style: "form" },
  thread: { label: "M8x1.25", depth_mm: 10, kind: "through" },
}));
assert.equal(formNeedsPilot.status, "needs_input");
assert.ok(formNeedsPilot.missing_inputs.includes("thread.pre_drill_diameter_mm"));

const formTap = recommendTapping(request({
  tool: { type: "tap", nominal_diameter_mm: 8, substrate: "pm_hss", style: "form" },
  thread: { label: "M8x1.25", depth_mm: 10, kind: "through", pre_drill_diameter_mm: 7.45 },
  gcode_context: null,
}));
assert.equal(formTap.status, "provisional");
assert.equal(formTap.levels.target.feed_mm_min, formTap.levels.target.rpm * 1.25);

const broadSteel = recommendTapping(request({
  workpiece: { material_family: "steel" },
}));
assert.equal(broadSteel.status, "provisional");
assert.equal(broadSteel.material.confidence, "low");

const dry = recommendTapping(request({ cooling: { mode: "air", continuous: true } }));
assert.equal(dry.status, "unsafe");

const nonFivePitch = recommendTapping(request({
  thread: { label: "M8x1.27", cycle_pitch_mm: 1.27, depth_mm: 10, kind: "blind", pre_drill_diameter_mm: 6.8 },
  gcode_context: null,
}));
assert.equal(nonFivePitch.status, "provisional");
assert.equal(nonFivePitch.levels.target.feed_mm_min, nonFivePitch.levels.target.rpm * 1.27);

console.log("Machining tapping pitch, synchronization, provider, and refusal tests passed.");
