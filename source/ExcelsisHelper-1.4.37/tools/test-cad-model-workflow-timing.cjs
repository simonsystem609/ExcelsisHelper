"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const runtimeRoot = path.join(__dirname, "..", "cad-model-runtime");
const source = fs.readFileSync(path.join(runtimeRoot, "cad-model-workflow.cjs"), "utf8");

function fixture(failMirror = false, options = {}) {
  const logs = [];
  const calls = [];
  const bytes = Buffer.from("test GLB");
  let inspections = 0;
  const inventory = {
    componentCount: 1,
    componentListMs: 3,
    elapsedMs: 5,
    timingMs: { names: 1, paths: 1, configurations: 1, isMirrored: 1,
      transforms: 1, boxes: 0, mirrorPlanes: 0 },
    components: [{}],
  };
  const modules = {
    "node:fs/promises": {
      readFile: async () => { calls.push("read"); return bytes; },
      writeFile: async () => { calls.push("write"); },
      copyFile: async () => { calls.push("native-recovery"); },
    },
    "node:path": path,
    "node:child_process": {
      execFile: (_exe, _args, _options, callback) => {
        calls.push("bridge");
        callback(null, "RESULT_STATUS=OK", "");
      },
    },
    "node:perf_hooks": require("node:perf_hooks"),
    "./cad-model-export.cjs": {
      prepareCadExport: async () => ({ stagedGlb: "C:\\stage.glb" }),
      parseGlbBridgeResult: () => ({ sourcePath: options.part ? "C:\\part.SLDPRT" : "C:\\part.SLDASM",
        documentType: options.part ? "part" : "assembly", configuration: "Default", updateStamp: 101,
        elapsedMs: 7 }),
      inspectGlb: async () => {
        inspections++;
        if (options.invalidNative && inspections === 1) throw new Error("GLB binary geometry is missing.");
        if (options.invalidFinal && inspections > 1) throw new Error("Final GLB is invalid.");
        return { bytes: bytes.length };
      },
      publishCadExport: async () => { calls.push("publish"); return { glbPath: "C:\\model.glb" }; },
    },
    "./cad-model-capture.cjs": {
      captureSwPartInfo: async () => { calls.push("part-info"); return { bodyCount: options.bodies || 1 }; },
      captureSwPartTessellations: async (_exe, identity, count) => {
        assert.equal(identity.configuration, "Default");
        assert.equal(identity.updateStamp, 101);
        calls.push("part-tess");
        if (options.partFailure) throw new Error("Part body capture failed.");
        return { bodyCount: count };
      },
      startSwAssemblyCaptureSession: async (_exe, _eco, identity, onPinned) => {
        assert.equal(identity.configuration, "Default");
        assert.equal(identity.updateStamp, 101);
        calls.push("pin");
        onPinned();
        calls.push("inventory");
        return { inventory,
          end: async () => { calls.push("end"); },
          abort: async () => { calls.push("abort"); } };
      },
      captureSwExactComponentBounds: async (_session, _path, _capture, sources) => {
        calls.push("bounds");
        return { boxes: new Map(sources.map((index) => [index, [0, 0, 0, 1, 1, 1]])),
          shapes: new Map(), supports: new Map() };
      },
      captureSwComponentTessellations: async () => new Map(),
    },
    "./cad-model-mirror.cjs": {
      buildPartGlb: capture => ({ bytes, report: { bodyCount: capture.bodyCount, vertices: 36 * capture.bodyCount } }),
      repairMisplacedAssemblyGroups: () => ({ bytes, report: { correctedAssemblies: 0 } }),
      repairUnmatchedChildPlacements: () => ({ bytes,
        report: { remainingUnmatchedMeshNodes: 0, targets: [] } }),
      emptyMeshNodeSources: () => [],
      pruneUnreferencedEmptyMeshes: (value) => value,
      groupTessellatedReplacements: () => [],
      repairMismatchedMeshes: () => ({ bytes, report: { correctedNodes: 0 } }),
      proposeStagedAssemblyGlb: async () => ({ approxInspectionSources: [0],
        inspectionSources: [0], shapeInspectionSources: [], supportInspectionSources: [],
        originalSha256: "fixture" }),
      auditMixedSourceMeshes: () => ({ missingBoxSources: [], suspects: [], unmatchedMeshNodes: 0 }),
      repairStagedAssemblyGlb: async () => {
        if (failMirror) throw new Error("fixture mirror failure");
        return { correctedNodes: 0, unresolvedNodeIndices: [], sourceTessellationNodeIndices: [] };
      },
      selectedNodeSources: () => [],
      auditSelectedNodeBounds: () => [],
      repairMirroredAssemblyGlb: () => ({ bytes, report: { correctedNodes: 0, unresolvedNodes: 0 } }),
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(source, { module, Buffer, __dirname: runtimeRoot,
    require: (name) => modules[name] || require(name) }, { filename: "cad-model-workflow.cjs" });
  const run = () => module.exports.exportActiveCadModel({ inbox: "C:\\inbox",
    projectNameFromDocPath: () => "Project", applyBackgroundEcoQos: () => {},
    verifyUnchanged: async () => {}, onStatus: (message) => logs.push(message),
    onCaptureReady: () => calls.push("ready") });
  return { run, logs, calls };
}

(async () => {
  const success = fixture();
  assert.equal((await success.run()).glbPath, "C:\\model.glb");
  assert.ok(success.calls.indexOf("bridge") < success.calls.indexOf("inventory"));
  assert.ok(success.calls.indexOf("bridge") < success.calls.indexOf("pin"));
  assert.ok(success.calls.indexOf("pin") < success.calls.indexOf("ready"));
  assert.ok(success.calls.indexOf("ready") < success.calls.indexOf("inventory"));
  assert.ok(success.calls.indexOf("end") < success.calls.indexOf("publish"));
  assert.match(success.logs.join("\n"), /CAD timing \(complete\): total .*native SaveAs/);
  assert.match(success.logs.join("\n"), /CAD inventory: 1 components; list .*build .*other capture overhead/);
  assert.match(success.logs.join("\n"), /CAD capture requests: .*SW boxes .*SW exact basic/);
  assert.match(success.logs.join("\n"), /CAD processing: .*Mirror proposal/);
  assert.match(success.logs.join("\n"), /CAD staged I\/O: .*Stage read/);
  assert.match(success.logs.join("\n"), /CAD delivery: .*Publish/);

  const failure = fixture(true);
  await assert.rejects(failure.run(), /fixture mirror failure/);
  assert.ok(failure.calls.includes("abort"));
  assert.ok(!failure.calls.includes("publish"));
  assert.match(failure.logs.join("\n"), /CAD timing \(failed\): .*Mirror proposal \(partial\)/);
  const single = fixture(false, { part: true });
  await single.run();
  assert.ok(single.calls.includes("part-info"));
  assert.ok(!single.calls.includes("part-tess"));
  const multi = fixture(false, { part: true, bodies: 2 });
  assert.equal((await multi.run()).partRepair.bodyCount, 2);
  assert.ok(multi.calls.includes("part-tess"));
  assert.ok(!multi.calls.includes("inventory"));
  assert.match(multi.logs.join("\n"), /verified 2 visible part bodies/);
  const recovered = fixture(false, { part: true, invalidNative: true });
  await recovered.run();
  assert.ok(recovered.calls.includes("native-recovery"));
  for (const options of [{ partFailure: true }, { invalidFinal: true }]) {
    const blocked = fixture(false, { part: true, bodies: 2, ...options });
    await assert.rejects(blocked.run());
    assert.ok(!blocked.calls.includes("publish"));
    assert.match(blocked.logs.join("\n"), /CAD timing \(failed\)/);
  }
  console.log("CAD workflow timing and profiling success/failure smoke passed.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
