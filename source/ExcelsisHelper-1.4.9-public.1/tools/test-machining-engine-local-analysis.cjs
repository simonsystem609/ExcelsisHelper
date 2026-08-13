"use strict";

const assert = require("node:assert/strict");
const { parseMpfProgram } = require("../machining-engine/mpf-parser.cjs");
const {
  applyProposalSelections,
  buildLocalProposal,
  normalizeToolSubstrate,
} = require("../machining-engine/local-analysis.cjs");

const common = {
  materialFamily: "aluminium",
  materialGrade: "6061",
  machineMaxRpm: 10000,
  machineMaxFeedMmMin: 8000,
  aggressiveness: "balanced",
  aePercent: 10,
  coolingMode: "flood",
  coolingContinuous: true,
  contactMode: "side",
  fluteCount: 2,
};

const millingText = [
  "; SZAMITOTT MEGMUNK. IDO: 0 ORA : 1 PERC : 0 SEC",
  "; T1 END MILL D10 R0 ID:D10 - Zmin=-2.",
  "N1 T=\"D10\"",
  "N2 M6",
  "N3 S3000 M3 M8",
  "N4 G90 G0 X0 Y0 Z5",
  "N5 G1 Z-1 F100",
  "N6 G1 X10 F500",
  "N7 G1 X20",
  "N8 G0 Z5",
].join("\r\n");

const millingAnalysis = parseMpfProgram(millingText, {
  defaultMillingToolMaterial: "Carbide",
  defaultDrillToolMaterial: "HSS",
});
const inferredAp = buildLocalProposal(millingAnalysis, common);
assert.equal(inferredAp.tools[0].status, "needs_confirmation");
assert.equal(inferredAp.tools[0].controls.apMm, 6);
assert.equal(inferredAp.tools[0].controls.apSource, "cutting_entry_motion");
assert.equal(inferredAp.tools[0].controls.apConfidence, "low");
assert.match(inferredAp.tools[0].warnings.join(" "), /low-confidence estimate/);
assert.ok(inferredAp.tools[0].changeGroups.every((group) => group.requiresApConfirmation && !group.editable));
assert.equal(inferredAp.canWrite, false);

const clearedAp = buildLocalProposal(millingAnalysis, {
  ...common,
  toolOverrides: { "tool-1": { apMm: null } },
});
assert.equal(clearedAp.tools[0].status, "needs_input");
assert.ok(clearedAp.tools[0].missingInputs.includes("apMm"));

const milling = buildLocalProposal(millingAnalysis, {
  ...common,
  toolOverrides: { "tool-1": { apMm: 1 } },
});
assert.equal(milling.tools[0].status, "provisional");
assert.equal(milling.tools[0].controls.apSource, "operator");
const rpmGroup = milling.tools[0].changeGroups.find((item) => item.kind === "rpm");
const cuttingFeed = milling.tools[0].changeGroups.find((item) => item.kind === "feed" && item.classification === "cutting");
const plungeFeed = milling.tools[0].changeGroups.find((item) => item.kind === "feed" && item.classification === "plunge");
assert.ok(rpmGroup);
assert.ok(cuttingFeed);
assert.equal(cuttingFeed.proposedValue % 5, 0);
assert.equal(cuttingFeed.accepted, true);
assert.equal(plungeFeed.accepted, false);
assert.equal(plungeFeed.requiresManualValue, true);
assert.ok(milling.timeEstimate.oldSeconds > 0);

const faceMillingText = [
  "; T1 FACE MILL D63 R0.8 ID:D63R0.8, SUM: 0:03:55, - Zmin=0.",
  "T=\"D63R0.8\"",
  "M6",
  "S900 M3 M8",
  "G0 X-330 Y0 Z5",
  "G1 Z4.05 F300",
  "G1 X292 F1000",
  "G0 Z5",
  "G0 X-330",
  "G1 Z3.1 F300",
  "G1 X292 F1000",
  "G0 Z5",
].join("\n");
const faceAnalysis = parseMpfProgram(faceMillingText, {
  compact: true,
  defaultMillingToolMaterial: "Carbide",
});
const faceProposal = buildLocalProposal(faceAnalysis, {
  ...common,
  materialFamily: "aluminum",
  materialGrade: "6061-T6",
  aePercent: 100,
  contactMode: "floor_tip",
  fluteCount: 4,
  toolOverrides: { "tool-1": { apMm: 0.95 } },
});
const face = faceProposal.tools[0];
assert.equal(face.toolType, "face_mill");
assert.equal(face.status, "provisional");
assert.equal(face.missingInputs.includes("supportedToolType"), false);
assert.equal(face.controls.currentRpm, 900);
assert.equal(face.controls.currentFeed, 1000);
assert.ok(face.recommendation.levels.target.rpm > 0);
assert.ok(face.recommendation.levels.target.feed_mm_min > 0);
assert.ok(face.changeGroups.some((group) => group.kind === "feed" && group.classification === "cutting"));
assert.ok(face.changeGroups.every((group) => group.accepted === false));
assert.equal(faceProposal.canWrite, false, "generic indexable changes require explicit operator acceptance");

const mismatchedFaceProposal = buildLocalProposal(faceAnalysis, {
  ...common,
  materialFamily: "steel",
  materialGrade: "6061-T6",
  aePercent: 100,
  contactMode: "floor_tip",
  fluteCount: 4,
  toolOverrides: { "tool-1": { apMm: 0.95 } },
});
assert.equal(mismatchedFaceProposal.tools[0].status, "unsupported");
assert.match(mismatchedFaceProposal.tools[0].warnings.join(" "), /belongs to Aluminium, not Steel/i);

const manual = applyProposalSelections(milling, [{
  id: rpmGroup.id,
  accepted: true,
  value: 5000,
}]);
assert.equal(manual.tools[0].changeGroups.find((item) => item.id === rpmGroup.id).source, "operator-override");
assert.throws(() => applyProposalSelections(milling, [{ id: rpmGroup.id, value: 5050 }]), /increments of 100/);

const drillingAndTappingText = [
  "; T8 DRILL D6.8 R118 ID:FURO_6.8 - Zmin=-22.",
  "; T9 TAP D8 R0 ID:M8menetfuro - Zmin=-10.",
  "N1 T=\"D6.8_FURO\"",
  "N2 M6",
  "N3 S950 M3 M8",
  "N4 F250",
  "N5 MCALL CYCLE83(25.,0.,2.,-22.,,,0.1,1.,0.1,0.1,1.,1)",
  "N6 X0. Y0.",
  "N7 MCALL",
  "N8 T=\"M8\"",
  "N9 M6",
  "N10 MCALL CYCLE84(25.,0.,2.,-10.,,0.,3.,,1.25,0.,200.,200.)",
  "N11 X0. Y0.",
].join("\n");
const processAnalysis = parseMpfProgram(drillingAndTappingText, {
  defaultMillingToolMaterial: "Carbide",
  defaultDrillToolMaterial: "HSS",
  defaultTapToolMaterial: "HSS-Co",
});
const processProposal = buildLocalProposal(processAnalysis, {
  ...common,
  materialFamily: "steel",
  materialGrade: "42CrMo4",
  hardnessValue: 28,
  hardnessScale: "HRC",
  toolOverrides: {
    "tool-2": { tapStyle: "cut", holeKind: "blind", preDrillDiameterMm: 6.8 },
  },
});
const drill = processProposal.tools.find((tool) => tool.process === "drilling");
const tap = processProposal.tools.find((tool) => tool.process === "tapping");
assert.equal(drill.status, "provisional");
assert.ok(drill.changeGroups.some((item) => item.kind === "feed" && item.classification === "canned_cycle"));
assert.equal(tap.status, "provisional");
const tapRpm = tap.changeGroups.find((item) => item.kind === "tap_rpm");
assert.ok(tapRpm);
assert.equal(tapRpm.tokens.length, 2);
assert.equal(tapRpm.proposedValue % 100, 0);
assert.equal(tapRpm.synchronizedFeedMmMin, tapRpm.proposedValue * 1.25);

function singleMillingProposal(header, label, override = {}) {
  const parsed = parseMpfProgram([
    `; T1 ${header} ID:${label} - Zmin=-1.`,
    `T=\"${label}\"`,
    "M6",
    "S3000 M3",
    "G0 X0 Y0 Z1",
    "G1 Z-1 F100",
    "G1 X20 F500",
    "G0 Z2",
  ].join("\n"), { defaultMillingToolMaterial: "Carbide" });
  return buildLocalProposal(parsed, {
    ...common,
    toolOverrides: { "tool-1": { apMm: 1, ...override } },
  }).tools[0];
}

const cornerRadius = singleMillingProposal("BULL NOSE MILL D10 R1", "D10R1");
const ballnose = singleMillingProposal("BALL NOSE D10 R5", "D10R5");
const chamfer = singleMillingProposal("CHAMFER MILL D12 R90", "D12R90", { featureDepthMm: 0.5 });
const centerAnalysis = parseMpfProgram([
  "; T1 CENTER DRILL D6 R118 ID:CENTER6 - Zmin=-2.",
  "T=\"CENTER6\"",
  "M6",
  "S1200 M3",
  "F100",
  "MCALL CYCLE81(5,0,2,-2)",
  "X0 Y0",
  "MCALL",
].join("\n"), { defaultDrillToolMaterial: "HSS" });
const centerDrill = buildLocalProposal(centerAnalysis, {
  ...common,
  materialFamily: "steel",
  materialGrade: "C45",
}).tools[0];

const corpusRoutes = [milling.tools[0], cornerRadius, ballnose, chamfer, face, centerDrill, drill, tap];
assert.deepEqual(
  new Set(corpusRoutes.map((tool) => tool.toolType)),
  new Set(["square_endmill", "corner_radius", "ballnose", "chamfer", "face_mill", "center_drill", "drill", "tap"]),
);
for (const routedTool of corpusRoutes) {
  assert.notEqual(routedTool.status, "unsupported", `${routedTool.toolType} must have a local solver route`);
  assert.notEqual(routedTool.status, "error", `${routedTool.toolType} local route must not throw`);
  assert.equal(routedTool.missingInputs.includes("supportedToolType"), false);
}

assert.equal(normalizeToolSubstrate("Carbide"), "carbide");
assert.equal(normalizeToolSubstrate("HSS-Co"), "hss_co");
assert.equal(normalizeToolSubstrate("PM HSS"), "pm_hss");

const sharedModalText = [
  "; T1 END MILL D10 R0 ID:A - Zmin=-1.",
  "; T2 END MILL D8 R0 ID:B - Zmin=-1.",
  "T=\"A\"",
  "M6",
  "S3000 M3",
  "G1 X10 F500",
  "T=\"B\"",
  "M6",
  "S3000 M3",
  "G1 X20",
].join("\n");
const sharedAnalysis = parseMpfProgram(sharedModalText, { defaultMillingToolMaterial: "Carbide" });
const sharedProposal = buildLocalProposal(sharedAnalysis, {
  ...common,
  toolOverrides: { "tool-1": { apMm: 1 }, "tool-2": { apMm: 1 } },
});
const sharedGroups = sharedProposal.tools.flatMap((tool) => tool.changeGroups)
  .filter((group) => group.source === "shared-modal-source-token");
assert.equal(sharedGroups.length, 2);
assert.ok(sharedGroups.every((group) => group.accepted === false && group.editable === false));

const unidentifiedAnalysis = parseMpfProgram([
  "T=\"LETORO\"",
  "M6",
  "S3000 M3",
  "G1 X1 F500",
  "G1 X2",
].join("\n"), { defaultMillingToolMaterial: "Carbide" });
const unidentified = buildLocalProposal(unidentifiedAnalysis, {
  ...common,
  toolOverrides: { "tool-1": { diameterMm: 10, apMm: 1 } },
});
assert.equal(unidentified.tools[0].classificationConfidence, "low");
assert.equal(unidentified.tools[0].status, "unsupported");
assert.equal(unidentified.canWrite, false);

const inchAnalysis = parseMpfProgram([
  "T=\"D10\"",
  "M6",
  "G20 G1 X1 F20",
].join("\n"), { defaultMillingToolMaterial: "Carbide" });
const inchProposal = buildLocalProposal(inchAnalysis, {
  ...common,
  toolOverrides: { "tool-1": { apMm: 1 } },
});
assert.equal(inchProposal.tools[0].status, "unsupported");
assert.match(inchProposal.tools[0].warnings.join(" "), /Inch-unit MPFs/);
assert.equal(inchProposal.canWrite, false);

const perRevolutionAnalysis = parseMpfProgram([
  "T=\"D10\"",
  "M6",
  "S1000 M3",
  "G95 G1 X1 F0.1",
  "G1 X2",
  "G0 Z1",
].join("\n"), { defaultMillingToolMaterial: "Carbide" });
const perRevolution = buildLocalProposal(perRevolutionAnalysis, {
  ...common,
  toolOverrides: { "tool-1": { apMm: 1 } },
});
assert.ok(perRevolution.tools[0].changeGroups
  .filter((group) => group.kind === "feed")
  .every((group) => group.editable === false && group.programmedUnit === "mm/rev"));

const variableFeedLines = [
  "T=\"D10\"",
  "M6",
  "S3000 M3",
  "G0 X0 Y0 Z1",
];
for (let index = 1; index <= 70; index += 1) variableFeedLines.push(`G1 X${index} F${100 + index}`);
variableFeedLines.push("G0 Z2");
const variableFeedAnalysis = parseMpfProgram(variableFeedLines.join("\n"), {
  compact: true,
  defaultMillingToolMaterial: "Carbide",
});
const variableFeedProposal = buildLocalProposal(variableFeedAnalysis, {
  ...common,
  toolOverrides: { "tool-1": { apMm: 1 } },
});
assert.equal(variableFeedProposal.tools[0].changeGroups.some((group) => group.kind === "feed"), false);
assert.match(variableFeedProposal.tools[0].warnings.join(" "), /CAM-feed-optimized/);

console.log("Local MPF process routing, change-group, manual override, and time tests passed.");
