"use strict";

const assert = require("node:assert/strict");
const { parseMpfProgram } = require("../machining-engine/mpf-parser.cjs");
const { buildLocalProposal } = require("../machining-engine/local-analysis.cjs");
const {
  applyTokenEdits,
  buildOptimizedText,
  decodeMpfBuffer,
  encodeMpfText,
  normalizeOptimizedSuffix,
  optimizedPathFor,
  sha256Buffer,
  structureSignature,
  summarizeAcceptedEdits,
} = require("../machining-engine/mpf-writer.cjs");

const source = [
  "; legacy header byte follows: \u00e1",
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
const sourceBuffer = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(source, "utf8")]);
const decoded = decodeMpfBuffer(sourceBuffer);
assert.equal(decoded.encoding, "utf8");
assert.equal(decoded.bom, "utf8");
assert.deepEqual(encodeMpfText(decoded.text, decoded), sourceBuffer);

const analysis = parseMpfProgram(decoded.text, {
  programName: "writer-test.MPF",
  defaultMillingToolMaterial: "Carbide",
});
const proposal = buildLocalProposal(analysis, {
  materialFamily: "aluminum",
  materialGrade: "6061-T6",
  machineMaxRpm: 10000,
  machineMaxFeedMmMin: 8000,
  aggressiveness: "balanced",
  aePercent: 10,
  coolingMode: "flood",
  contactMode: "side",
  fluteCount: 2,
  toolOverrides: { "tool-1": { apMm: 1 } },
});
const built = buildOptimizedText(decoded.text, proposal, {
  programName: "writer-test.MPF",
  defaultMillingToolMaterial: "Carbide",
});
assert.equal(built.verification.structurePreserved, true);
assert.equal(built.text.split("\r\n").length, decoded.text.split("\r\n").length);
assert.ok(built.text.includes("\r\n"));
assert.ok(built.text.includes("; legacy header byte follows: \u00e1"));
assert.ok(built.edits.every((edit) => edit.newValue > 0));
assert.notEqual(sha256Buffer(encodeMpfText(built.text, decoded)), sha256Buffer(sourceBuffer));

const singleByte = Buffer.from([0x3b, 0x20, 0xe1, 0x0d, 0x0a, 0x53, 0x31, 0x30, 0x30]);
const legacy = decodeMpfBuffer(singleByte);
assert.equal(legacy.encoding, "single-byte");
assert.deepEqual(encodeMpfText(legacy.text, legacy), singleByte);

assert.throws(() => applyTokenEdits("S999", [{
  lineIndex: 0, lineNumber: 1, start: 1, end: 4, oldText: "100", newText: "200", groupId: "stale",
}]), /changed after analysis/);
assert.equal(normalizeOptimizedSuffix("_optimized"), "_optimized");
assert.throws(() => normalizeOptimizedSuffix("../optimized"), /invalid|cannot use/);
assert.ok(optimizedPathFor("C:\\CAM\\part.MPF", "_optimized").endsWith("part_optimized.MPF"));
assert.throws(() => optimizedPathFor("C:\\CAM\\part.txt", "_optimized"), /\.MPF/);

const repeatedLines = [
  "; T1 END MILL D10 R0 ID:D10 - Zmin=-1.",
  "T=\"D10\"",
  "M6",
  "S3000 M3",
  "G0 X0 Y0 Z1",
];
for (let index = 1; index <= 6005; index += 1) repeatedLines.push(`G1 X${index} F500`);
repeatedLines.push("G0 Z2");
const repeatedText = repeatedLines.join("\n");
const repeatedAnalysis = parseMpfProgram(repeatedText, {
  compact: true,
  programName: "repeated.MPF",
  defaultMillingToolMaterial: "Carbide",
});
const repeatedProposal = buildLocalProposal(repeatedAnalysis, {
  materialFamily: "aluminum",
  machineMaxRpm: 10000,
  machineMaxFeedMmMin: 8000,
  aggressiveness: "balanced",
  aePercent: 10,
  coolingMode: "flood",
  contactMode: "side",
  fluteCount: 2,
  toolOverrides: { "tool-1": { apMm: 1 } },
});
const repeatedSummary = summarizeAcceptedEdits(repeatedProposal);
assert.ok(repeatedSummary.editCount > 5000);
const repeatedBuilt = buildOptimizedText(
  repeatedText,
  repeatedProposal,
  { programName: "repeated.MPF", defaultMillingToolMaterial: "Carbide" },
  { expectedStructure: structureSignature(repeatedAnalysis) },
);
assert.equal(repeatedBuilt.editCount, repeatedSummary.editCount);
assert.equal(repeatedBuilt.edits.length, 5000);
assert.equal(repeatedBuilt.editsTruncated, true);
assert.equal(repeatedBuilt.verification.structurePreserved, true);

console.log("MPF encoding, token rewrite, stale-source, suffix, and structural-verification tests passed.");
