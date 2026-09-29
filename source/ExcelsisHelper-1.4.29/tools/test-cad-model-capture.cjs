"use strict";

const assert = require("node:assert/strict");
const { DIAGONAL_SUPPORT_DIRECTIONS } = require("../cad-model-runtime/cad-model-mirror.cjs");
const { captureSwExactComponentBounds, captureSwComponentTessellations } = require(
  "../cad-model-runtime/cad-model-capture.cjs");

const sourcePath = "C:\\Models\\Assembly.SLDASM";
const capture = { components: [{ name: "Part-1", sourcePath: "C:\\Models\\Part.SLDPRT",
  configuration: "Default", transform: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0] }] };
const box = [0, 0, 0, 1, 1, 1];

async function test() {
  const calls = [];
  const session = { async command(request, timeout, binary) {
    calls.push({ request, timeout, binary });
    if (request.op === "boxes") return { format: "excelsis-sw-approx-component-bounds",
      formatVersion: 1, sourcePath, items: [{ sourceIndex: 0, matchedCount: 1, box }] };
    if (request.op === "exact") return { format: "excelsis-sw-exact-component-bounds",
      formatVersion: 1, sourcePath, items: [{ sourceIndex: 0, matchedCount: 1,
        bodyCount: 1, box, shapeInvariant3: 2, shapeInvariant4: 3,
        supports: DIAGONAL_SUPPORT_DIRECTIONS.map(() => [0, 1]) }] };
    const record = Buffer.alloc(36);
    const result = Buffer.alloc(12 + 8 + record.length);
    result.write("SWBTCH1\0", 0, "ascii");
    result.writeUInt32LE(1, 8);
    result.writeInt32LE(0, 12);
    result.writeUInt32LE(record.length, 16);
    record.copy(result, 20);
    return result;
  } };
  const approx = await captureSwExactComponentBounds(session, sourcePath, capture,
    [0], [], [], true);
  assert.deepEqual(approx.boxes.get(0), box);
  assert.equal(calls[0].request.op, "boxes");
  assert.equal(calls[0].request.requests[0].name, "Part-1");
  const exact = await captureSwExactComponentBounds(session, sourcePath, capture,
    [0], [0], [0]);
  assert.deepEqual(exact.boxes.get(0), box);
  assert.equal(exact.shapes.get(0).shapeInvariant3, 2);
  assert.equal(exact.supports.get(0).length, DIAGONAL_SUPPORT_DIRECTIONS.length);
  assert.equal(calls[1].request.requests[0].includeShape, true);
  assert.equal(calls[1].request.requests[0].supportDirections.length,
    DIAGONAL_SUPPORT_DIRECTIONS.length);
  const tess = await captureSwComponentTessellations(session, sourcePath, capture, [0]);
  assert.equal(tess.get(0).length, 36);
  assert.equal(calls[2].request.op, "tess");
  assert.equal(calls[2].binary, true);

  await assert.rejects(captureSwExactComponentBounds({ command: async () => ({
    format: "excelsis-sw-approx-component-bounds", formatVersion: 1,
    sourcePath: "C:\\Wrong.SLDASM", items: [{ sourceIndex: 0, matchedCount: 1, box }],
  }) }, sourcePath, capture, [0], [], [], true), /does not match/);
  await assert.rejects(captureSwExactComponentBounds({ command: async () => ({
    format: "excelsis-sw-approx-component-bounds", formatVersion: 1,
    sourcePath, items: [{ sourceIndex: 1, matchedCount: 1, box }],
  }) }, sourcePath, capture, [0], [], [], true), /ambiguous component identity/);
  await assert.rejects(captureSwComponentTessellations({ command: async () => Buffer.alloc(12) },
    sourcePath, capture, [0]), /batch header/);
  console.log("CAD capture session contract tests passed.");
}

test().catch((error) => { console.error(error); process.exitCode = 1; });
