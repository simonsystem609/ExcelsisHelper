"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const vm = require("node:vm");
const { inspectGlb, makeCadExportNames, parseGlbBridgeResult, prepareCadExport, publishCadExport } = require("../cad-model-runtime/cad-model-export.cjs");

const mainSource = fsSync.readFileSync(path.join(__dirname, "..", "main.cjs"), "utf8");
const workflowSource = fsSync.readFileSync(path.join(__dirname, "..", "cad-model-runtime", "cad-model-workflow.cjs"), "utf8");
const projectStart = mainSource.indexOf("function splitPathSegmentsForProject(");
const projectEnd = mainSource.indexOf("function localDateKey(", projectStart);
assert.ok(projectStart >= 0 && projectEnd > projectStart);
assert.match(mainSource, /projectNameFromDocPath,/);
assert.match(workflowSource, /projectName:\s*projectNameFromDocPath\(source\.sourcePath\)/);
const projectContext = {
  path: path.win32,
  activeProjectNameRegex: /^ABC-\d{2}-\d{2,3}(?:[_\-\s].*)?$/i,
  activeProjectRootNames: ["CompanyProjects"],
};
vm.createContext(projectContext);
vm.runInContext(`${mainSource.slice(projectStart, projectEnd)}\nthis.projectNameFromDocPath = projectNameFromDocPath;`, projectContext);
assert.equal(projectContext.projectNameFromDocPath("C:\\CompanyProjects\\2026\\ABC-26-001 Example\\model.SLDASM"),
  "ABC-26-001 Example");
assert.equal(projectContext.projectNameFromDocPath("C:\\CompanyProjects\\Example Project\\model.SLDASM"),
  "Example Project");
assert.equal(projectContext.projectNameFromDocPath("C:\\Temp\\Loose folder\\model.SLDPRT"),
  "Loose folder");

function tinyGlb(draco = false, includeEmptyMesh = false) {
  const scene = Buffer.from(JSON.stringify({
    asset: { version: "2.0" }, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [draco
      ? { extensions: { KHR_draco_mesh_compression: { bufferView: 0, attributes: { POSITION: 0 } } } }
      : { attributes: { POSITION: 0 } }] }, ...(includeEmptyMesh ? [{ primitives: [] }] : [])],
    accessors: [{}],
  }), "utf8");
  const length = Math.ceil(scene.length / 4) * 4;
  const result = Buffer.alloc(20 + length, 0x20);
  result.write("glTF", 0, "ascii");
  result.writeUInt32LE(2, 4);
  result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(length, 12);
  result.write("JSON", 16, "ascii");
  scene.copy(result, 20);
  return result;
}

(async () => {
  const folder = path.join(os.tmpdir(), `excelsis-cad-export-test-${crypto.randomUUID()}`);
  await fs.mkdir(folder);
  const prepared = await prepareCadExport(folder);
  assert.equal((await prepareCadExport(folder)).staging, prepared.staging);
  await fs.writeFile(prepared.stagedGlb, tinyGlb(), { flag: "wx" });
  const info = await inspectGlb(prepared.stagedGlb);
  assert.equal(info.meshes, 1);
  const dracoPath = path.join(folder, "draco.glb");
  await fs.writeFile(dracoPath, tinyGlb(true));
  assert.equal((await inspectGlb(dracoPath)).meshes, 1);
  const emptyPath = path.join(folder, "empty-mesh.glb");
  await fs.writeFile(emptyPath, tinyGlb(false, true));
  await assert.rejects(inspectGlb(emptyPath), /empty mesh/);
  const sourcePath = "C:\\Projects\\P\u00e9lda Assembly.SLDASM";
  const sourceHex = Array.from(sourcePath, (character) =>
    character.charCodeAt(0).toString(16).padStart(4, "0")).join("");
  const configHex = Array.from("Default", (character) =>
    character.charCodeAt(0).toString(16).padStart(4, "0")).join("");
  const bridgeLines = [
    `SOURCE_PATH_HEX=${sourceHex}`, "SOURCE_TYPE=assembly", "SOURCE_UNCHANGED=True",
    "ACTIVE_UNCHANGED=True", `SOURCE_CONFIG_HEX=${configHex}`,
    "SOURCE_STAMP=156800", "EXPORT_MS=4800", "RESULT_STATUS=OK",
  ];
  const source = parseGlbBridgeResult(bridgeLines.join("\n"), "", 0);
  assert.equal(source.sourcePath, sourcePath);
  assert.equal(source.elapsedMs, 4800);
  assert.equal(source.configuration, "Default");
  assert.equal(source.updateStamp, 156800);
  assert.throws(() => parseGlbBridgeResult(bridgeLines.filter((line) =>
    !line.startsWith("SOURCE_STAMP=")).join("\n"), "", 0), /configuration or update stamp/);
  const names = makeCadExportNames(sourcePath, new Date("2026-09-24T12:00:00.000Z"), "abcd1234");
  assert.match(names.glb, /^P\u00e9lda Assembly_20260924T120000-000Z_abcd1234\.glb$/);
  const result = await publishCadExport(prepared, { ...source, projectName: "ABC-26-001 Example" }, info);
  const metadata = JSON.parse(await fs.readFile(result.metadataPath, "utf8"));
  assert.equal(metadata.glbFile, path.basename(result.glbPath));
  assert.deepEqual(metadata.source, {
    type: "assembly", name: "P\u00e9lda Assembly.SLDASM", root: "C:\\Projects",
  });
  assert.equal(metadata.projectName, "ABC-26-001 Example");
  assert.equal((await fs.readFile(result.glbPath)).equals(tinyGlb()), true);
  assert.equal(await fs.stat(prepared.stagedGlb).then(() => true, () => false), false);
  const fallback = await prepareCadExport(folder);
  await fs.writeFile(fallback.stagedGlb, tinyGlb(), { flag: "wx" });
  const fallbackResult = await publishCadExport(fallback, {
    sourcePath: "C:\\Temp\\Loose folder\\model.SLDPRT", documentType: "part",
  }, info);
  const fallbackMetadata = JSON.parse(await fs.readFile(fallbackResult.metadataPath, "utf8"));
  assert.equal(fallbackMetadata.projectName, "Loose folder");
  assert.throws(() => parseGlbBridgeResult("ERROR=Clear selections before exporting the full model.", "", 1), /Clear selections/);
  const badPath = path.join(folder, "bad.glb");
  const corrupt = tinyGlb();
  corrupt.writeUInt32LE(corrupt.length + 1, 8);
  await fs.writeFile(badPath, corrupt);
  await assert.rejects(inspectGlb(badPath), /header or declared length/);
  console.log("CAD GLB parsing, integrity checks and JSON-last delivery passed.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
