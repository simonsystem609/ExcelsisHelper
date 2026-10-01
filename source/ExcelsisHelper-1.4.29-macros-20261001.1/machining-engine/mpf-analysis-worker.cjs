"use strict";

const fs = require("node:fs");
const { parentPort, workerData } = require("node:worker_threads");
const { parseMpfProgram } = require("./mpf-parser.cjs");
const {
  buildOptimizedText,
  decodeMpfBuffer,
  encodeMpfText,
  sha256Buffer,
} = require("./mpf-writer.cjs");

function readSource() {
  const buffer = workerData.sourceBuffer
    ? Buffer.from(workerData.sourceBuffer)
    : fs.readFileSync(String(workerData.filePath || ""));
  const maximum = Number(workerData.maxBytes || 64 * 1024 * 1024);
  if (!buffer.length || buffer.length > maximum) {
    throw new Error("The selected file is not readable as a G-code program.");
  }
  const decoded = decodeMpfBuffer(buffer);
  return {
    buffer,
    text: decoded.text,
    encoding: decoded.encoding,
    bom: decoded.bom,
    sha256: sha256Buffer(buffer),
  };
}

function compactMotionSegments(records) {
  const grouped = new Map();
  for (const motion of records || []) {
    if (motion.classification === "rapid" || !(motion.lengthMm > 0) || !(motion.feedMmMin > 0)) continue;
    const values = [
      motion.toolId || "",
      motion.classification || "unknown",
      motion.feedDefinitionId || "",
      Number(motion.feedMmMin),
      motion.feedMode || "mm_per_min",
      Number(motion.spindleRpm) || 0,
    ];
    const key = JSON.stringify(values);
    const existing = grouped.get(key);
    if (existing) {
      existing.lengthMm += Number(motion.lengthMm);
      existing.motionCount += 1;
    } else {
      grouped.set(key, {
        toolId: values[0],
        classification: values[1],
        feedDefinitionId: values[2] || null,
        feedMmMin: values[3],
        feedMode: values[4],
        spindleRpm: values[5] || null,
        lengthMm: Number(motion.lengthMm),
        motionCount: 1,
      });
    }
  }
  return [...grouped.values()];
}

function compactMpfAnalysis(analysis) {
  return {
    ...analysis,
    tools: (analysis.tools || []).map(({ motionRecordIds, ...tool }) => tool),
    definitions: {
      spindle: analysis.definitions?.spindle || [],
      feed: (analysis.definitions?.feed || []).map(({ usages, ...definition }) => ({
        ...definition,
        usageCount: (usages || []).reduce((sum, usage) => sum + Number(usage.count || 1), 0),
      })),
      cycles: analysis.definitions?.cycles || [],
    },
    motionRecords: [],
    motionTimeSegments: analysis.motionTimeSegments?.length
      ? analysis.motionTimeSegments : compactMotionSegments(analysis.motionRecords),
  };
}

function sourceSummary(source) {
  return {
    sha256: source.sha256,
    size: source.buffer.length,
    encoding: source.encoding,
    bom: source.bom,
  };
}

function run() {
  const source = readSource();
  const operation = String(workerData.operation || "parse");
  if (operation === "parse") {
    const analysis = compactMpfAnalysis(parseMpfProgram(source.text, {
      ...(workerData.parserOptions || {}),
      compact: true,
    }));
    parentPort.postMessage({ ok: true, source: sourceSummary(source), analysis });
    return;
  }
  if (operation !== "rewrite") throw new Error("Unknown MPF worker operation.");
  if (source.sha256 !== String(workerData.expectedSha256 || "")) {
    const error = new Error("The source MPF changed after analysis.");
    error.code = "SOURCE_CHANGED";
    throw error;
  }
  const built = buildOptimizedText(
    source.text,
    workerData.proposal,
    workerData.parserOptions || {},
    { expectedStructure: workerData.expectedStructure || null },
  );
  const output = encodeMpfText(built.text, source);
  const transferable = output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength);
  parentPort.postMessage({
    ok: true,
    source: sourceSummary(source),
    outputBuffer: transferable,
    outputSha256: sha256Buffer(output),
    edits: built.edits,
    editsTruncated: built.editsTruncated,
    editCount: built.editCount,
    editSummary: built.editSummary,
    verification: built.verification,
  }, [transferable]);
}

try {
  run();
} catch (error) {
  parentPort.postMessage({
    ok: false,
    code: String(error?.code || ""),
    error: String(error?.message || error),
  });
}
