"use strict";

const assert = require("node:assert/strict");
const { resolveMaterialSelection } = require("../machining-engine/materials.cjs");
const {
  FACE_MILLING_SOURCES,
  recommendFaceMilling,
} = require("../machining-engine/face-milling-solver.cjs");

const clone = (value) => JSON.parse(JSON.stringify(value));

const baseRequest = {
  mode: "analyze_gcode",
  machine: { max_rpm: 10000, max_feed_mm_min: 8000, rigidity_class: "unknown" },
  workpiece: {
    material_id: "aluminum.wrought.6061",
    grade: "6061-T6",
    condition: null,
    material_family: "aluminum",
    hardness: null,
  },
  tool: {
    type: "face_mill",
    diameter_mm: 63,
    flute_count: 4,
    effective_teeth: 4,
    substrate: "carbide",
    application_class: "indexable_unknown_geometry",
    stickout_mm: null,
  },
  cut: {
    operation: "face",
    ap_mm: 0.95,
    ae_percent: 100,
    contact_mode: "floor_tip",
    stock_model_quality: "unknown",
  },
  cooling: { mode: "flood", continuous: true, directed: true },
  objective: { aggressiveness: "balanced", priority: "balanced", unattended: false },
  gcode_context: {
    commanded_rpm: 900,
    commanded_feed_mm_min: 1000,
    tool_number: "T1",
    operation_comment: "FACE MILL D63 R0.8",
    dialect: "siemens_solidcam",
    units: "mm",
    commanded_feed_mode: "mm_per_min",
  },
};

const aluminum = resolveMaterialSelection({ family: "aluminum", grade: "6061-T6" });
const proposal = recommendFaceMilling(baseRequest, { materialResolution: aluminum });
assert.equal(proposal.status, "provisional");
assert.equal(proposal.process, "face_milling");
assert.equal(proposal.source.level, "reviewed-family-bootstrap");
assert.deepEqual(proposal.source.record_ids, FACE_MILLING_SOURCES.map((source) => source.id));
assert.equal(proposal.levels.target.rpm % 100, 0);
assert.equal(proposal.levels.target.feed_mm_min % 5, 0);
assert.ok(proposal.levels.target.rpm <= 10000);
assert.ok(proposal.levels.target.feed_mm_min > 0);
assert.equal(proposal.levels.upper_trial, null);
assert.equal(proposal.current_gcode.rpm, 900);
assert.equal(proposal.current_gcode.feed_mm_min, 1000);
assert.equal(proposal.current_gcode.fz_mm_tooth, 0.277778);
assert.match(proposal.warnings.map((item) => item.code).join(" "), /face-mill-power-unverified/);

const broadSteelRequest = clone(baseRequest);
broadSteelRequest.workpiece = {
  material_id: "steel.generic",
  grade: null,
  condition: null,
  material_family: "steel",
  hardness: null,
};
const broadSteel = resolveMaterialSelection({ family: "steel" });
const wetSteel = recommendFaceMilling(broadSteelRequest, { materialResolution: broadSteel });
assert.equal(wetSteel.status, "provisional");
assert.match(wetSteel.warnings.map((item) => item.code).join(" "), /face-mill-wet-speed/);

const drySteelRequest = clone(broadSteelRequest);
drySteelRequest.cooling.mode = "dry";
const drySteel = recommendFaceMilling(drySteelRequest, { materialResolution: broadSteel });
assert.ok(drySteel.levels.target.rpm > wetSteel.levels.target.rpm);

const hardRequest = clone(broadSteelRequest);
hardRequest.workpiece.hardness = { value: 50, scale: "HRC", measured: true, source: "operator" };
const hardMaterial = resolveMaterialSelection({
  family: "steel",
  hardnessValue: 50,
  hardnessScale: "HRC",
});
const hardResult = recommendFaceMilling(hardRequest, { materialResolution: hardMaterial });
assert.equal(hardResult.status, "unsupported");
assert.match(hardResult.risk.reasons.join(" "), /above 45 HRC/i);

const plasticRequest = clone(baseRequest);
plasticRequest.workpiece = {
  material_id: "plastic.generic",
  grade: null,
  condition: null,
  material_family: "plastic",
  hardness: null,
};
const plastic = resolveMaterialSelection({ family: "plastic" });
const plasticResult = recommendFaceMilling(plasticRequest, { materialResolution: plastic });
assert.equal(plasticResult.status, "unsupported");
assert.match(plasticResult.risk.reasons.join(" "), /No reviewed face-mill speed profile/i);

const copperRequest = clone(baseRequest);
copperRequest.workpiece = {
  material_id: "copper.generic",
  grade: null,
  condition: null,
  material_family: "copper_alloy",
  hardness: null,
};
const copper = resolveMaterialSelection({ family: "copper" });
const copperResult = recommendFaceMilling(copperRequest, { materialResolution: copper });
assert.equal(copperResult.status, "unsupported");
assert.match(copperResult.risk.reasons.join(" "), /No reviewed face-mill speed profile/i);

const endMillRequest = clone(baseRequest);
endMillRequest.tool.type = "square_endmill";
const wrongRoute = recommendFaceMilling(endMillRequest, { materialResolution: aluminum });
assert.equal(wrongRoute.status, "unsupported");
assert.match(wrongRoute.risk.reasons.join(" "), /face mills only/i);

console.log("Indexable face-milling source envelope, safety gates, formulas, and quantization tests passed.");
