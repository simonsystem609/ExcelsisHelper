"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { performance } = require("node:perf_hooks");
const { inspectGlb, parseGlbBridgeResult, prepareCadExport, publishCadExport } = require("./cad-model-export.cjs");
const {
  auditMixedSourceMeshes, auditSelectedNodeBounds, selectedNodeSources,
  emptyMeshNodeSources, pruneUnreferencedEmptyMeshes,
  groupTessellatedReplacements, proposeStagedAssemblyGlb, repairMirroredAssemblyGlb,
  repairMisplacedAssemblyGroups, repairUnmatchedChildPlacements,
  repairMismatchedMeshes, repairStagedAssemblyGlb,
} = require("./cad-model-mirror.cjs");
const {
  startSwAssemblyCaptureSession, captureSwExactComponentBounds,
  captureSwComponentTessellations,
} = require("./cad-model-capture.cjs");

function runGlbBridge(target) {
  return new Promise((resolve, reject) => {
    execFile("cscript.exe", ["//NoLogo", path.join(__dirname, "export-active-glb.vbs"), target],
      { windowsHide: true, timeout: 5 * 60 * 1000, maxBuffer: 64 * 1024 },
      (error, stdout, stderr) => {
        if (error?.killed) return reject(new Error("SOLIDWORKS GLB export timed out."));
        try {
          resolve(parseGlbBridgeResult(stdout, stderr, error ? (Number(error.code) || 1) : 0));
        } catch (parseError) { reject(parseError); }
      });
  });
}

async function exportActiveCadModel(options) {
  const { inbox, projectNameFromDocPath, applyBackgroundEcoQos,
    onStatus = () => {}, verifyUnchanged = async () => {} } = options || {};
  if (typeof projectNameFromDocPath !== "function"
    || typeof applyBackgroundEcoQos !== "function"
    || typeof onStatus !== "function" || typeof verifyUnchanged !== "function") {
    throw new Error("CAD export host callbacks are invalid.");
  }
  const started = performance.now();
  const phases = [];
  const metrics = new Map();
  let phase = "Setup";
  let phaseStarted = started;
  let nativeSaveAsMs = 0;
  let inventoryProfile = null;
  const recordMetric = (name, since, items = 0, bytes = 0) => {
    const metric = metrics.get(name) || { ms: 0, calls: 0, items: 0, bytes: 0 };
    metric.ms += performance.now() - since;
    metric.calls++;
    metric.items += items;
    metric.bytes += bytes;
    metrics.set(name, metric);
  };
  const measured = (name, action, items = 0) => {
    const since = performance.now();
    try { return action(); }
    finally { recordMetric(name, since, items); }
  };
  const measuredAsync = async (name, action, items = 0, bytes = 0) => {
    const since = performance.now();
    let result;
    try { result = await action(); return result; }
    finally {
      recordMetric(name, since, items,
        typeof bytes === "function" && result !== undefined ? bytes(result) : Number(bytes) || 0);
    }
  };
  const nextPhase = (name, partial = false) => {
    const now = performance.now();
    phases.push({ name: phase, ms: now - phaseStarted, partial });
    phase = name;
    phaseStarted = now;
  };
  const reportTiming = (result) => {
    if (phase) nextPhase(null, result === "failed");
    const seconds = (ms) => ((Number(ms) || 0) / 1000).toFixed(1);
    const details = phases.map(({ name, ms, partial }) =>
      `${name}${partial ? " (partial)" : ""} ${seconds(ms)}s`).join("; ");
    const saveAs = nativeSaveAsMs > 0 ? `; native SaveAs ${seconds(nativeSaveAsMs)}s` : "";
    const formatMetric = ([name, item]) => `${name} ${seconds(item.ms)}s/${item.calls}x`
      + (item.items ? `/${item.items} items` : "")
      + (item.bytes ? `/${(item.bytes / 1048576).toFixed(1)} MiB` : "");
    const profile = (names) => [...metrics].filter(([name]) => names.includes(name))
      .sort((left, right) => right[1].ms - left[1].ms).map(formatMetric).join("; ");
    try {
      onStatus(`CAD timing (${result}): total ${seconds(performance.now() - started)}s; ${details}${saveAs}`);
      if (inventoryProfile?.timingMs) {
        const t = inventoryProfile.timingMs;
        const inventoryPhase = phases.find((item) => item.name === "Assembly inventory")?.ms || 0;
        const unaccounted = Math.max(0, inventoryPhase
          - (Number(inventoryProfile.componentListMs) || 0) - (Number(inventoryProfile.elapsedMs) || 0));
        onStatus(`CAD inventory: ${inventoryProfile.componentCount} components; list ${seconds(inventoryProfile.componentListMs)}s; build ${seconds(inventoryProfile.elapsedMs)}s; other capture overhead ${seconds(unaccounted)}s; names ${seconds(t.names)}s; paths ${seconds(t.paths)}s; configurations ${seconds(t.configurations)}s; mirrored ${seconds(t.isMirrored)}s; transforms ${seconds(t.transforms)}s; boxes ${seconds(t.boxes)}s; planes ${seconds(t.mirrorPlanes)}s`);
      }
      const capture = profile(["SW boxes", "SW exact basic", "SW exact supports",
        "SW exact shape", "SW exact shape+supports", "SW tessellation", "SW session close"]);
      if (capture) onStatus(`CAD capture requests: ${capture}`);
      const processing = profile(["Assembly group repair", "Child placement repair", "Empty mesh scan",
        "Mesh grouping", "Mesh rebuild", "Empty mesh prune", "Mirror proposal", "Mixed-source audit",
        "Mirror repair", "Node source match", "Node bounds audit", "Final mirror check"]);
      if (processing) onStatus(`CAD processing: ${processing}`);
      const io = profile(["Stage read", "Stage write"]);
      if (io) onStatus(`CAD staged I/O: ${io}; mirror proposal/repair include their own file I/O`);
      const delivery = profile(["GLB inspect", "Runtime integrity", "Publish"]);
      if (delivery) onStatus(`CAD delivery: ${delivery}`);
    } catch {}
  };
  let captureSession = null;
  try {
    const prepared = await prepareCadExport(inbox);
    const readStaged = () => measuredAsync("Stage read", () => fs.readFile(prepared.stagedGlb),
      0, (bytes) => bytes.length);
    const writeStaged = (bytes) => measuredAsync("Stage write",
      () => fs.writeFile(prepared.stagedGlb, bytes), 0, bytes.length);
    nextPhase("SOLIDWORKS GLB");
    const source = await runGlbBridge(prepared.stagedGlb);
    nativeSaveAsMs = source.elapsedMs;
    nextPhase(source.documentType === "assembly" ? "Assembly inventory" : "Delivery");
    let mirrorRepair = null;
    if (source.documentType === "assembly") {
      onStatus("GLB saved; validating assembly geometry.");
      captureSession = await startSwAssemblyCaptureSession(
        path.join(__dirname, "capture-sw-assembly-geometry.exe"), applyBackgroundEcoQos);
      const capture = captureSession.inventory;
      inventoryProfile = capture;
      const measureBounds = (sources, shapes = [], supports = [], approx = false) => {
        const kind = approx ? "SW boxes" : shapes.length && supports.length ? "SW exact shape+supports"
          : shapes.length ? "SW exact shape" : supports.length ? "SW exact supports" : "SW exact basic";
        return measuredAsync(kind, () => captureSwExactComponentBounds(
          captureSession, source.sourcePath, capture, sources, shapes, supports, approx), sources.length);
      };
      const measureTessellation = (sources) => measuredAsync("SW tessellation",
        () => captureSwComponentTessellations(captureSession, source.sourcePath, capture, sources),
        sources.length, (triangles) => [...triangles.values()].reduce((sum, part) => sum + part.length, 0));
      nextPhase("Placement and empty meshes");
      const groupBytes = await readStaged();
      const assemblyGroups = measured("Assembly group repair", () =>
        repairMisplacedAssemblyGroups(groupBytes, capture, source.sourcePath));
      if (assemblyGroups.report.correctedAssemblies) {
        await writeStaged(assemblyGroups.bytes);
        onStatus(`Corrected ${assemblyGroups.report.correctedAssemblies} mirrored assembly group(s).`);
      }
      const childBytes = await readStaged();
      const childPlacements = measured("Child placement repair", () =>
        repairUnmatchedChildPlacements(childBytes, capture, source.sourcePath));
      if (childPlacements.report.remainingUnmatchedMeshNodes) {
        throw new Error("Some GLB mesh nodes could not be matched uniquely to SOLIDWORKS; ERP delivery was withheld.");
      }
      let placedBytes = childPlacements.bytes;
      const emptyTargets = measured("Empty mesh scan", () =>
        emptyMeshNodeSources(placedBytes, capture, source.sourcePath));
      if (emptyTargets.length) {
        const sources = [...new Set(emptyTargets.map((item) => item.sourceIndex))];
        const exact = await measureBounds(sources, [], sources);
        if (exact.boxes.size !== sources.length || exact.supports.size !== sources.length) {
          throw new Error("SOLIDWORKS could not verify every empty GLB mesh source.");
        }
        const triangles = new Map();
        for (let start = 0; start < sources.length; start += 20) {
          const batch = await measureTessellation(sources.slice(start, start + 20));
          for (const [index, data] of batch) triangles.set(index, data);
        }
        const replacements = measured("Mesh grouping", () =>
          groupTessellatedReplacements(emptyTargets, capture, triangles));
        const repaired = measured("Mesh rebuild", () =>
          repairMismatchedMeshes(placedBytes, capture, source.sourcePath,
            replacements, exact, { allowEmptyTargets: new Set(
              emptyTargets.map((item) => item.nodeIndex)) }));
        placedBytes = repaired.bytes;
        onStatus(`Rebuilt ${repaired.report.correctedNodes} empty GLB mesh node(s) from SOLIDWORKS.`);
      }
      const pruned = measured("Empty mesh prune", () => pruneUnreferencedEmptyMeshes(placedBytes));
      if (pruned !== childPlacements.bytes) {
        placedBytes = pruned;
        await writeStaged(placedBytes);
      }
      nextPhase("Child mesh repair");
      let childMeshRepair = null;
      if (childPlacements.report.targets.length) {
        const sources = [...new Set(childPlacements.report.targets.map((item) => item.sourceIndex))];
        const exact = await measureBounds(sources, [], sources);
        if (exact.boxes.size !== sources.length || exact.supports.size !== sources.length) {
          throw new Error("SOLIDWORKS could not verify all corrected child geometry.");
        }
        const triangles = new Map();
        for (let start = 0; start < sources.length; start += 20) {
          const batch = await measureTessellation(sources.slice(start, start + 20));
          for (const [index, data] of batch) triangles.set(index, data);
        }
        const replacements = measured("Mesh grouping", () =>
          groupTessellatedReplacements(childPlacements.report.targets, capture, triangles));
        const repaired = measured("Mesh rebuild", () =>
          repairMismatchedMeshes(placedBytes, capture,
            source.sourcePath, replacements, exact, { allowVerifiedTargets: new Set(
              childPlacements.report.targets.map((item) => item.nodeIndex)) }));
        await writeStaged(repaired.bytes);
        childMeshRepair = repaired.report;
        onStatus(`Rebuilt ${repaired.report.correctedNodes} source-verified child mesh(es).`);
      }
      nextPhase("Mirror proposal");
      const initial = await measuredAsync("Mirror proposal", () =>
        proposeStagedAssemblyGlb(prepared.stagedGlb, capture, source.sourcePath));
      const firstAuditBytes = await readStaged();
      const firstAudit = measured("Mixed-source audit", () =>
        auditMixedSourceMeshes(firstAuditBytes, capture, source.sourcePath));
      const quickBoxSources = [...new Set([...initial.approxInspectionSources,
        ...firstAudit.missingBoxSources])];
      if (quickBoxSources.length) {
        const approx = await measureBounds(quickBoxSources, [], [], true);
        for (const [sourceIndex, box] of approx.boxes) capture.components[sourceIndex].box = box;
      }
      const proposal = await measuredAsync("Mirror proposal", () =>
        proposeStagedAssemblyGlb(prepared.stagedGlb, capture, source.sourcePath));
      const exactGeometry = proposal.inspectionSources.length
        ? await measureBounds(proposal.inspectionSources, proposal.shapeInspectionSources,
          proposal.supportInspectionSources)
        : { boxes: new Map(), shapes: new Map(), supports: new Map() };
      mirrorRepair = await measuredAsync("Mirror repair", () =>
        repairStagedAssemblyGlb(prepared.stagedGlb,
          capture, source.sourcePath, exactGeometry, proposal.originalSha256,
          { preferSourceTessellation: true }));
      nextPhase("Geometry audit and repair");
      let corrected = await readStaged();
      let meshAudit = measured("Mixed-source audit", () =>
        auditMixedSourceMeshes(corrected, capture, source.sourcePath));
      if (meshAudit.missingBoxSources.length) {
        const approx = await measureBounds(meshAudit.missingBoxSources, [], [], true);
        for (const [sourceIndex, box] of approx.boxes) capture.components[sourceIndex].box = box;
        meshAudit = measured("Mixed-source audit", () =>
          auditMixedSourceMeshes(corrected, capture, source.sourcePath));
      }
      if (meshAudit.missingBoxSources.length) {
        throw new Error("SOLIDWORKS could not verify all cross-part GLB mesh owners.");
      }
      const unresolvedTargets = measured("Node source match", () =>
        selectedNodeSources(corrected, capture, source.sourcePath,
          mirrorRepair.unresolvedNodeIndices));
      if (meshAudit.suspects.length || unresolvedTargets.length) {
        const suspectSources = [...new Set([...meshAudit.suspects.map((item) => item.sourceIndex),
          ...unresolvedTargets.map((item) => item.sourceIndex)])];
        const measuredBounds = await measureBounds(suspectSources, [], suspectSources);
        if (measuredBounds.boxes.size !== suspectSources.length
          || measuredBounds.supports.size !== suspectSources.length) {
          throw new Error("SOLIDWORKS could not verify a possible GLB mesh collision.");
        }
        for (const [index, box] of measuredBounds.boxes) {
          capture.components[index].box = box;
          exactGeometry.boxes.set(index, box);
        }
        for (const [index, supports] of measuredBounds.supports) exactGeometry.supports.set(index, supports);
        meshAudit = measured("Mixed-source audit", () =>
          auditMixedSourceMeshes(corrected, capture, source.sourcePath));
        const unresolvedSuspects = measured("Node bounds audit", () =>
          auditSelectedNodeBounds(corrected, capture,
            source.sourcePath, unresolvedTargets, exactGeometry.boxes));
        const forcedSources = measured("Node source match", () =>
          selectedNodeSources(corrected, capture, source.sourcePath,
            mirrorRepair.sourceTessellationNodeIndices));
        const confirmed = new Map([...meshAudit.suspects, ...unresolvedSuspects, ...forcedSources]
          .map((item) => [item.nodeIndex, item]));
        if (confirmed.size) {
          onStatus(`Rebuilding ${confirmed.size} source-verified mesh assignment(s).`);
          const affectedSources = [...new Set([...confirmed.values()]
            .map((item) => item.sourceIndex))];
          const triangles = new Map();
          for (let start = 0; start < affectedSources.length; start += 20) {
            const batch = await measureTessellation(affectedSources.slice(start, start + 20));
            for (const [index, data] of batch) triangles.set(index, data);
          }
          await measuredAsync("SW session close", () => captureSession.end());
          captureSession = null;
          const replacements = measured("Mesh grouping", () =>
            groupTessellatedReplacements([...confirmed.values()], capture, triangles));
          const repaired = measured("Mesh rebuild", () =>
            repairMismatchedMeshes(corrected, capture, source.sourcePath,
              replacements, exactGeometry, { allowVerifiedTargets: new Set(
                mirrorRepair.sourceTessellationNodeIndices) }));
          corrected = repaired.bytes;
          await writeStaged(corrected);
          mirrorRepair.meshRepair = repaired.report;
        }
      }
      nextPhase("Final validation");
      if (captureSession) {
        await measuredAsync("SW session close", () => captureSession.end());
        captureSession = null;
      }
      const lastMirror = measured("Final mirror check", () =>
        repairMirroredAssemblyGlb(corrected, capture, source.sourcePath,
          { exactBoxes: exactGeometry.boxes, exactShapes: exactGeometry.shapes,
            exactSupports: exactGeometry.supports, preferSourceTessellation: true }));
      corrected = lastMirror.bytes;
      const lastAudit = measured("Mixed-source audit", () =>
        auditMixedSourceMeshes(corrected, capture, source.sourcePath));
      if (lastMirror.report.unresolvedNodes || lastAudit.missingBoxSources.length
        || lastAudit.suspects.length || lastAudit.unmatchedMeshNodes) {
        throw new Error("CAD GLB still disagrees with SOLIDWORKS geometry; ERP delivery was withheld.");
      }
      if (lastMirror.report.correctedNodes) {
        await writeStaged(corrected);
      }
      mirrorRepair.correctedNodes += lastMirror.report.correctedNodes;
      mirrorRepair.unresolvedNodes = 0;
      mirrorRepair.assemblyGroupRepair = assemblyGroups.report;
      mirrorRepair.childPlacementRepair = childPlacements.report;
      mirrorRepair.childMeshRepair = childMeshRepair;
      mirrorRepair.unmatchedMeshNodes = lastAudit.unmatchedMeshNodes;
      nextPhase("Delivery");
    }
    const glbInfo = await measuredAsync("GLB inspect", () => inspectGlb(prepared.stagedGlb));
    await measuredAsync("Runtime integrity", () => verifyUnchanged());
    const published = await measuredAsync("Publish", () => publishCadExport(prepared, {
      ...source,
      projectName: projectNameFromDocPath(source.sourcePath),
    }, glbInfo));
    reportTiming("complete");
    return { ...published, mirrorRepair };
  } catch (error) {
    reportTiming("failed");
    throw error;
  } finally {
    if (captureSession) await captureSession.abort();
  }
}

module.exports = { exportActiveCadModel };
