"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const STAGING_FOLDER = ".staging";

function parseGlbBridgeResult(stdout, stderr, exitCode) {
  const fields = new Map();
  for (const line of String(stdout || "").split(/\r?\n/)) {
    const equals = line.indexOf("=");
    if (equals > 0) fields.set(line.slice(0, equals), line.slice(equals + 1));
  }
  if (exitCode !== 0 || fields.get("RESULT_STATUS") !== "OK") {
    throw new Error(fields.get("ERROR") || String(stderr || "").trim() || "SOLIDWORKS GLB export failed.");
  }
  const sourceHex = fields.get("SOURCE_PATH_HEX") || "";
  if (!/^(?:[0-9A-F]{4})+$/i.test(sourceHex) || sourceHex.length > 32768) {
    throw new Error("SOLIDWORKS returned an invalid source document path.");
  }
  let sourcePath = "";
  for (let index = 0; index < sourceHex.length; index += 4) {
    sourcePath += String.fromCharCode(Number.parseInt(sourceHex.slice(index, index + 4), 16));
  }
  const documentType = fields.get("SOURCE_TYPE") || "";
  const extension = documentType === "assembly" ? ".sldasm" : ".sldprt";
  if (!["assembly", "part"].includes(documentType) || !path.isAbsolute(sourcePath)
    || path.extname(sourcePath).toLowerCase() !== extension
    || fields.get("SOURCE_UNCHANGED") !== "True"
    || fields.get("ACTIVE_UNCHANGED") !== "True") {
    throw new Error("SOLIDWORKS export did not verify the source document and active model.");
  }
  return { sourcePath, documentType, elapsedMs: Number(fields.get("EXPORT_MS")) || 0 };
}

async function inspectGlb(filePath) {
  const file = await fs.open(filePath, "r");
  try {
    const stat = await file.stat();
    if (stat.size < 24) throw new Error("GLB is empty or incomplete.");
    const header = Buffer.alloc(20);
    if ((await file.read(header, 0, 20, 0)).bytesRead !== 20
      || header.toString("ascii", 0, 4) !== "glTF"
      || header.readUInt32LE(4) !== 2
      || header.readUInt32LE(8) !== stat.size
      || header.toString("ascii", 16, 20) !== "JSON") {
      throw new Error("GLB header or declared length is invalid.");
    }
    const jsonLength = header.readUInt32LE(12);
    if (jsonLength < 2 || jsonLength > 64 * 1024 * 1024 || jsonLength + 20 > stat.size) {
      throw new Error("GLB scene data is invalid.");
    }
    const jsonBytes = Buffer.alloc(jsonLength);
    let read = 0;
    while (read < jsonLength) {
      const result = await file.read(jsonBytes, read, jsonLength - read, 20 + read);
      if (!result.bytesRead) throw new Error("GLB scene data is incomplete.");
      read += result.bytesRead;
    }
    const scene = JSON.parse(jsonBytes.toString("utf8"));
    if (scene.meshes?.some((mesh) => !Array.isArray(mesh.primitives)
      || mesh.primitives.length === 0)) {
      throw new Error("GLB contains an empty mesh and cannot be imported safely.");
    }
    if (scene.asset?.version !== "2.0" || !scene.scenes?.length
      || !scene.meshes?.some((mesh) => mesh.primitives?.some((primitive) =>
        Number.isInteger(primitive.attributes?.POSITION)
        || Number.isInteger(primitive.extensions?.KHR_draco_mesh_compression?.attributes?.POSITION)))) {
      throw new Error("GLB has no renderable 3D scene.");
    }
    if ([...(scene.buffers || []), ...(scene.images || [])].some((entry) =>
      entry.uri && !entry.uri.startsWith("data:"))) {
      throw new Error("GLB depends on external files and cannot be imported alone.");
    }
    return { bytes: stat.size, meshes: scene.meshes.length, nodes: scene.nodes?.length || 0 };
  } finally {
    await file.close();
  }
}

function makeCadExportNames(sourcePath, date = new Date(), id = crypto.randomUUID().slice(0, 8)) {
  const sourceName = path.basename(sourcePath);
  const base = path.basename(sourceName, path.extname(sourceName))
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/[. ]+$/g, "").slice(0, 96);
  if (!base || !/^[a-z0-9-]{8}$/i.test(id)) throw new Error("Invalid CAD export name.");
  const stamp = date.toISOString().replace(/[-:]/g, "").replace(/\.(\d{3})Z$/, "-$1Z");
  const stem = `${base}_${stamp}_${id}`;
  return { glb: `${stem}.glb`, metadata: `${stem}.json` };
}

async function prepareCadExport(inbox) {
  if (!path.isAbsolute(inbox)) throw new Error("CAD model drop folder must be an absolute path.");
  const root = path.resolve(inbox);
  if (!(await fs.stat(root)).isDirectory()) {
    throw new Error("CAD model drop folder is unavailable.");
  }
  const staging = path.join(root, STAGING_FOLDER);
  try { await fs.mkdir(staging); } catch (error) { if (error.code !== "EEXIST") throw error; }
  if (!(await fs.stat(staging)).isDirectory()) throw new Error("CAD export staging path is not a folder.");
  const id = crypto.randomUUID();
  return { root, staging, stagedGlb: path.join(staging, `pending-${id}.glb`) };
}

async function publishCadExport(prepared, source, glbInfo, exportedAt = new Date()) {
  const names = makeCadExportNames(source.sourcePath, exportedAt);
  const glbPath = path.join(prepared.root, names.glb);
  const metadataPath = path.join(prepared.root, names.metadata);
  const stagedMetadata = path.join(prepared.staging, names.metadata);
  const sourceName = path.basename(source.sourcePath);
  const metadata = {
    format: "excelsis-cadmodel",
    formatVersion: 1,
    glbFile: names.glb,
    source: {
      type: source.documentType,
      name: sourceName,
      root: path.dirname(source.sourcePath),
    },
    projectName: String(source.projectName || "").trim() || path.basename(path.dirname(source.sourcePath)),
    exportedAt: exportedAt.toISOString(),
    bytes: glbInfo.bytes,
  };
  for (const filePath of [glbPath, metadataPath]) {
    try { await fs.stat(filePath); throw new Error(`CAD export already exists: ${filePath}`); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  await fs.writeFile(stagedMetadata, `${JSON.stringify(metadata, null, 2)}\n`, { flag: "wx" });
  await fs.rename(prepared.stagedGlb, glbPath);
  await fs.rename(stagedMetadata, metadataPath);
  return { glbPath, metadataPath, metadata };
}

module.exports = { inspectGlb, makeCadExportNames, parseGlbBridgeResult, prepareCadExport, publishCadExport };
