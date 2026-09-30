"use strict";

const path = require("node:path");
const { DIAGONAL_SUPPORT_DIRECTIONS } = require("./cad-model-mirror.cjs");
const { startSwAssemblyCaptureSession } = require("./sw-assembly-capture-session.cjs");

function componentRequest(capture, sourceIndex) {
  const component = capture.components[sourceIndex];
  if (!component || !Array.isArray(component.transform) || component.transform.length !== 16)
    throw new Error("SOLIDWORKS capture source has no component identity.");
  return { sourceIndex, name: component.name, sourcePath: component.sourcePath,
    configuration: component.configuration, transform: component.transform };
}

function sameSourcePath(left, right) {
  return typeof left === "string" && typeof right === "string"
    && path.win32.normalize(left).toLowerCase() === path.win32.normalize(right).toLowerCase();
}

async function captureSwExactComponentBounds(session, sourcePath, capture,
  inspectionSources, shapeInspectionSources, supportInspectionSources, approxOnly = false) {
  const indices = [...new Set(inspectionSources)];
  const shapeIndices = new Set(shapeInspectionSources);
  const supportIndices = new Set(supportInspectionSources);
  if (indices.length > 2000) throw new Error("Too many SOLIDWORKS geometry candidates.");
  const requests = indices.map((sourceIndex) => ({
    ...componentRequest(capture, sourceIndex),
    includeShape: !approxOnly && shapeIndices.has(sourceIndex),
    supportDirections: !approxOnly && supportIndices.has(sourceIndex)
      ? DIAGONAL_SUPPORT_DIRECTIONS : null,
  }));
  const boxes = new Map(), shapes = new Map(), supports = new Map();
  if (!requests.length) return { boxes, shapes, supports };
  const result = await session.command({ op: approxOnly ? "boxes" : "exact",
    sourcePath, requests }, 90000);
  if (result?.format !== (approxOnly ? "excelsis-sw-approx-component-bounds"
    : "excelsis-sw-exact-component-bounds") || result.formatVersion !== 1
    || !sameSourcePath(result.sourcePath, sourcePath)
    || !Array.isArray(result.items) || result.items.length !== requests.length) {
    throw new Error("SOLIDWORKS geometry response does not match the exported assembly.");
  }
  const requested = new Set(indices);
  const seen = new Set();
  for (const item of result.items) {
    if (!requested.has(item.sourceIndex) || seen.has(item.sourceIndex))
      throw new Error("SOLIDWORKS geometry response has an ambiguous component identity.");
    seen.add(item.sourceIndex);
    if (item.matchedCount !== 1 || (!approxOnly && item.bodyCount <= 0)
      || !Array.isArray(item.box) || item.box.length !== 6
      || !item.box.every(Number.isFinite)) continue;
    boxes.set(item.sourceIndex, item.box);
    if (Number.isFinite(item.shapeInvariant3) && Number.isFinite(item.shapeInvariant4)) {
      shapes.set(item.sourceIndex, { bodyCount: item.bodyCount,
        shapeInvariant3: item.shapeInvariant3,
        shapeInvariant4: item.shapeInvariant4 });
    }
    if (supportIndices.has(item.sourceIndex) && Array.isArray(item.supports)
      && item.supports.length === DIAGONAL_SUPPORT_DIRECTIONS.length
      && item.supports.every((pair) => Array.isArray(pair) && pair.length === 2
        && pair.every(Number.isFinite))) supports.set(item.sourceIndex, item.supports);
  }
  return { boxes, shapes, supports };
}

async function captureSwComponentTessellations(session, sourcePath, capture, sourceIndices) {
  if (!sourceIndices.length || sourceIndices.length > 100)
    throw new Error("Unsupported SOLIDWORKS tessellation batch size.");
  const requests = sourceIndices.map((index) => componentRequest(capture, index));
  const bytes = await session.command({ op: "tess", sourcePath, requests }, 150000, true);
  if (!Buffer.isBuffer(bytes) || bytes.length < 12 || bytes.toString("ascii", 0, 8) !== "SWBTCH1\0"
    || bytes.readUInt32LE(8) !== requests.length)
    throw new Error("Invalid SOLIDWORKS tessellation batch header.");
  let offset = 12;
  const triangles = new Map();
  for (const request of requests) {
    if (offset + 8 > bytes.length || bytes.readInt32LE(offset) !== request.sourceIndex)
      throw new Error("SOLIDWORKS tessellation source order changed.");
    const length = bytes.readUInt32LE(offset + 4);
    offset += 8;
    if (length < 36 || offset + length > bytes.length)
      throw new Error("Invalid SOLIDWORKS tessellation record length.");
    triangles.set(request.sourceIndex, bytes.subarray(offset, offset + length));
    offset += length;
  }
  if (offset !== bytes.length) throw new Error("Unexpected SOLIDWORKS tessellation data.");
  return triangles;
}

module.exports = { startSwAssemblyCaptureSession,
  captureSwExactComponentBounds, captureSwComponentTessellations };
