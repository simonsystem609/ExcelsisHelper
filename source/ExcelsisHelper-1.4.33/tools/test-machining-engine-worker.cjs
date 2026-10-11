"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { Worker } = require("node:worker_threads");
const { buildLocalProposal } = require("../machining-engine/local-analysis.cjs");
const { parseMpfProgram } = require("../machining-engine/mpf-parser.cjs");
const { decodeMpfBuffer, structureSignature } = require("../machining-engine/mpf-writer.cjs");

const workerPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(__dirname, "..", "machining-engine", "mpf-analysis-worker.cjs");

function runWorker(workerData) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerPath, { workerData });
    worker.once("message", resolve);
    worker.once("error", reject);
    worker.once("exit", (code) => {
      if (code !== 0) reject(new Error(`MPF worker exited with code ${code}.`));
    });
  });
}

(async () => {
  const text = [
    "; T1 END MILL D10 R0 ID:D10 - Zmin=-2.",
    "T=\"D10\"",
    "M6",
    "S3000 M3 M8",
    "G90 G0 X0 Y0 Z5",
    "G1 Z-1 F100",
    "G1 X10 F500",
    "G1 X20 F500",
  ].join("\r\n");
  const sourceBuffer = Buffer.from(text, "utf8");
  const parsed = await runWorker({
    operation: "parse",
    sourceBuffer,
    maxBytes: 1024 * 1024,
    parserOptions: { programName: "worker.MPF", defaultMillingToolMaterial: "Carbide" },
  });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.analysis.motionRecords.length, 0);
  assert.ok(parsed.analysis.motionTimeSegments.length > 0);
  assert.ok(parsed.analysis.definitions.feed.every((definition) => !Object.hasOwn(definition, "usages")));
  const cuttingClass = parsed.analysis.tools[0].feedClasses
    .find((feedClass) => feedClass.classification === "cutting");
  const cuttingDefinition = parsed.analysis.definitions.feed
    .find((definition) => definition.id === cuttingClass.id);
  assert.equal(cuttingDefinition.sourceDefinitionCount, 2);
  assert.equal(cuttingDefinition.tokenBatches.reduce((sum, batch) => sum + batch.lineIndexes.length, 0), 2);

  const localInput = {
    materialFamily: "aluminum",
    machineMaxRpm: 10000,
    machineMaxFeedMmMin: 8000,
    aggressiveness: "balanced",
    aePercent: 10,
    coolingMode: "flood",
    contactMode: "side",
    fluteCount: 2,
    toolOverrides: { "tool-1": { apMm: 1 } },
  };
  const proposal = buildLocalProposal(parsed.analysis, localInput);
  const fullProposal = buildLocalProposal(parseMpfProgram(text, {
    programName: "worker.MPF",
    defaultMillingToolMaterial: "Carbide",
  }), localInput);
  assert.deepEqual(proposal.timeEstimate, fullProposal.timeEstimate);
  const rewritten = await runWorker({
    operation: "rewrite",
    sourceBuffer,
    maxBytes: 1024 * 1024,
    expectedSha256: parsed.source.sha256,
    expectedStructure: structureSignature(parsed.analysis),
    parserOptions: { programName: "worker.MPF", defaultMillingToolMaterial: "Carbide" },
    proposal: { tools: proposal.tools },
  });
  assert.equal(rewritten.ok, true);
  assert.equal(rewritten.verification.structurePreserved, true);
  assert.equal(rewritten.editCount, rewritten.edits.length);
  assert.equal(rewritten.editsTruncated, false);
  assert.ok(rewritten.editSummary.length > 0);
  assert.ok(rewritten.edits.length > 0);
  assert.equal(rewritten.edits.filter((edit) => edit.kind === "feed"
    && edit.classification === "cutting").length, 2);
  const output = decodeMpfBuffer(Buffer.from(rewritten.outputBuffer)).text;
  assert.notEqual(output, text);

  const stale = await runWorker({
    operation: "rewrite",
    sourceBuffer,
    maxBytes: 1024 * 1024,
    expectedSha256: "0".repeat(64),
    parserOptions: { programName: "worker.MPF", defaultMillingToolMaterial: "Carbide" },
    proposal: { tools: proposal.tools },
  });
  assert.equal(stale.ok, false);
  assert.equal(stale.code, "SOURCE_CHANGED");

  console.log("MPF worker compaction, rewrite, transfer, and source-hash tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
