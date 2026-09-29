"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DIAGONAL_SUPPORT_DIRECTIONS, auditMixedSourceMeshes, auditSelectedNodeBounds,
  selectedNodeSources, groupTessellatedReplacements,
  emptyMeshNodeSources, pruneUnreferencedEmptyMeshes,
  proposeStagedAssemblyGlb, repairMirroredAssemblyGlb, repairMisplacedAssemblyGroups,
  repairUnmatchedChildPlacements,
  repairMismatchedMeshes,
  repairStagedAssemblyGlb } = require("../cad-model-runtime/cad-model-mirror.cjs");

const SOURCE = "C:\\Projects\\Example.SLDASM";
const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1];

function transform(translation) {
  return [...IDENTITY, ...translation, 1, 0, 0, 0];
}

function glb(nodes, meshCopies = 1, emptyMeshIndices = new Set()) {
  const vertices = Buffer.alloc(8 * 12);
  let index = 0;
  for (const x of [0, 2]) for (const y of [0, 1]) for (const z of [0, 1]) {
    for (const value of [x, y, z]) vertices.writeFloatLE(value, index++ * 4);
  }
  const scene = {
    asset: { version: "2.0" }, scene: 0, scenes: [{ nodes: [0] }], nodes,
    meshes: Array.from({ length: meshCopies }, (_, index) => ({
      primitives: emptyMeshIndices.has(index) ? [] : [{ attributes: { POSITION: 0 } }] })),
    buffers: [{ byteLength: vertices.length }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: vertices.length }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 8, type: "VEC3" }],
  };
  const json = Buffer.from(JSON.stringify(scene));
  const paddedLength = Math.ceil(json.length / 4) * 4;
  const bytes = Buffer.alloc(20 + paddedLength + 8 + vertices.length, 0x20);
  bytes.write("glTF", 0, "ascii");
  bytes.writeUInt32LE(2, 4);
  bytes.writeUInt32LE(bytes.length, 8);
  bytes.writeUInt32LE(paddedLength, 12);
  bytes.write("JSON", 16, "ascii");
  json.copy(bytes, 20);
  const binHeader = 20 + paddedLength;
  bytes.writeUInt32LE(vertices.length, binHeader);
  bytes.write("BIN\0", binHeader + 4, "ascii");
  vertices.copy(bytes, binHeader + 8);
  return bytes;
}

function parse(bytes) {
  const jsonEnd = 20 + bytes.readUInt32LE(12);
  return {
    scene: JSON.parse(bytes.subarray(20, jsonEnd).toString("utf8")),
    binary: bytes.subarray(jsonEnd),
  };
}

function fixture(axis = 0, extraLeft = false) {
  const leftOrigin = [1, 2, 3];
  const rightOrigin = leftOrigin.slice();
  const dimensions = [2, 1, 1];
  const leftBox = [...leftOrigin, ...leftOrigin.map((x, i) => x + dimensions[i])];
  const plane = axis === 0 ? 5 : 7;
  rightOrigin[axis] = 2 * plane - leftOrigin[axis];
  const rightBox = leftBox.slice();
  rightBox[axis] = 2 * plane - leftBox[axis + 3];
  rightBox[axis + 3] = 2 * plane - leftBox[axis];
  const parentOrigin = [5, -2, 4];
  const local = (origin) => origin.map((x, i) => x - parentOrigin[i]);
  const nodes = [
    { name: "parent", translation: parentOrigin, children: extraLeft ? [1, 2, 3] : [1, 2] },
    { name: "part-1", translation: local(leftOrigin), mesh: 0 },
    { name: "Mirrorpart-1", translation: local(rightOrigin), mesh: 0 },
  ];
  const components = [
    { name: "part-1", sourcePath: "C:\\Projects\\part.SLDPRT", configuration: "Default",
      isMirrored: false, transform: transform(leftOrigin), box: leftBox },
    { name: "Mirrorpart-1", sourcePath: "C:\\Projects\\Mirrorpart.SLDPRT", configuration: "Default",
      isMirrored: true, transform: transform(rightOrigin), box: rightBox },
  ];
  if (extraLeft) {
    nodes.push({ name: "part-2", translation: local(leftOrigin), mesh: 0 });
    components.push({ ...components[0], name: "part-2" });
  }
  return {
    bytes: glb(nodes),
    capture: { format: "excelsis-sw-assembly-geometry", formatVersion: 1,
      sourcePath: SOURCE, componentCount: components.length, components },
  };
}

for (const axis of [0, 1, 2]) {
  const { bytes, capture } = fixture(axis);
  const proposal = repairMirroredAssemblyGlb(bytes, capture, SOURCE, { dryRun: true });
  assert.equal(proposal.report.proposedNodes, 1);
  assert.equal(proposal.bytes, bytes);
  assert.throws(() => repairMirroredAssemblyGlb(bytes, capture, SOURCE), /Exact SOLIDWORKS/);
  const exactBoxes = new Map(capture.components.map((component, index) => [index, component.box]));
  const sourceTessellation = repairMirroredAssemblyGlb(bytes, capture, SOURCE,
    { exactBoxes, preferSourceTessellation: true });
  assert.equal(sourceTessellation.report.correctedNodes, 0);
  assert.deepEqual(sourceTessellation.report.sourceTessellationNodeIndices, [2]);
  assert.deepEqual(sourceTessellation.report.unresolvedNodeIndices, [2]);
  assert.equal(sourceTessellation.bytes, bytes);
  const result = repairMirroredAssemblyGlb(bytes, capture, SOURCE, { exactBoxes });
  assert.equal(result.report.correctedNodes, 1);
  assert.equal(result.report.unresolvedNodes, 0);
  assert.deepEqual(parse(result.bytes).scene.nodes[1], parse(bytes).scene.nodes[1]);
  assert.equal(parse(result.bytes).scene.nodes[2].matrix[axis * 4 + axis], -1);
  assert.equal(parse(result.bytes).binary.equals(parse(bytes).binary), true);
  const second = repairMirroredAssemblyGlb(result.bytes, capture, SOURCE, { exactBoxes });
  assert.equal(second.report.correctedNodes, 0);
  assert.equal(second.bytes, result.bytes);
}

const rotated = fixture(0);
const rotatedNodes = parse(rotated.bytes).scene.nodes;
rotatedNodes[0].rotation = [0, 0, Math.SQRT1_2, Math.SQRT1_2];
rotatedNodes[1].translation = [4, 4, -1];
rotatedNodes[2].translation = [4, -4, -1];
const rotatedBasis = [0, 1, 0, -1, 0, 0, 0, 0, 1];
rotated.capture.components[0].transform = [...rotatedBasis, 1, 2, 3, 1, 0, 0, 0];
rotated.capture.components[1].transform = [...rotatedBasis, 9, 2, 3, 1, 0, 0, 0];
rotated.capture.components[0].box = [0, 2, 3, 1, 4, 4];
rotated.capture.components[1].box = [9, 2, 3, 10, 4, 4];
const rotatedExact = new Map(rotated.capture.components.map((component, index) => [index, component.box]));
const rotatedResult = repairMirroredAssemblyGlb(glb(rotatedNodes), rotated.capture, SOURCE,
  { exactBoxes: rotatedExact });
assert.equal(rotatedResult.report.correctedNodes, 1);
assert.equal(parse(rotatedResult.bytes).binary.equals(parse(glb(rotatedNodes)).binary), true);

function tiltedFixture(shiftOrigin = false) {
  const sample = fixture();
  const normal = [1 / Math.sqrt(5), 2 / Math.sqrt(5), 0];
  const point = [5, 5, 0];
  const reflect = (position) => {
    const distance = normal.reduce((sum, value, axis) =>
      sum + value * (position[axis] - point[axis]), 0);
    return position.map((value, axis) => value - 2 * distance * normal[axis]);
  };
  const leftOrigin = [1, 2, 3];
  const rightOrigin = reflect(leftOrigin);
  if (shiftOrigin) rightOrigin[0] += 0.1;
  const vertices = [];
  for (const x of [0, 2]) for (const y of [0, 1]) for (const z of [0, 1]) {
    vertices.push([leftOrigin[0] + x, leftOrigin[1] + y, leftOrigin[2] + z]);
  }
  const mirrored = vertices.map(reflect);
  const box = (points) => [0, 1, 2].map((axis) =>
    Math.min(...points.map((position) => position[axis]))).concat([0, 1, 2].map((axis) =>
    Math.max(...points.map((position) => position[axis]))));
  const supports = (points) => DIAGONAL_SUPPORT_DIRECTIONS.map((direction) => {
    const projections = points.map((position) => direction.reduce((sum, value, axis) =>
      sum + value * position[axis], 0));
    return [Math.min(...projections), Math.max(...projections)];
  });
  const parentOrigin = [5, -2, 4];
  const nodes = parse(sample.bytes).scene.nodes;
  nodes[2].translation = rightOrigin.map((value, axis) => value - parentOrigin[axis]);
  sample.bytes = glb(nodes);
  sample.capture.components[1].transform = transform(rightOrigin);
  sample.capture.components[1].box = box(mirrored);
  sample.capture.mirrorPlanes = [{ featureName: "TiltedMirror", point, normal }];
  return { ...sample, boxes: new Map([[0, box(vertices)], [1, box(mirrored)]]),
    supports: new Map([[0, supports(vertices)], [1, supports(mirrored)]]),
    shapes: new Map([[0, { bodyCount: 1, shapeInvariant3: 2, shapeInvariant4: 10 }],
      [1, { bodyCount: 1, shapeInvariant3: 2, shapeInvariant4: 10 }]]) };
}

for (const shifted of [false, true]) {
  const tilted = tiltedFixture(shifted);
  const proposal = repairMirroredAssemblyGlb(tilted.bytes, tilted.capture, SOURCE, { dryRun: true });
  assert.equal(proposal.report.proposedNodes, 1);
  assert.equal(proposal.report.proposedSources[0].mode, "feature");
  assert.deepEqual(proposal.report.supportInspectionSources, [0, 1]);
  const withoutSupports = repairMirroredAssemblyGlb(tilted.bytes, tilted.capture, SOURCE,
    { exactBoxes: tilted.boxes, exactShapes: tilted.shapes });
  assert.equal(withoutSupports.report.correctedNodes, 0);
  assert.equal(withoutSupports.report.unresolvedNodes, 1);
  const repaired = repairMirroredAssemblyGlb(tilted.bytes, tilted.capture, SOURCE,
    { exactBoxes: tilted.boxes, exactShapes: tilted.shapes, exactSupports: tilted.supports });
  assert.equal(repaired.report.correctedNodes, 1);
  assert.equal(parse(repaired.bytes).binary.equals(parse(tilted.bytes).binary), true);
  assert.notEqual(parse(repaired.bytes).scene.nodes[2].matrix[1], 0);
  assert.equal(repairMirroredAssemblyGlb(repaired.bytes, tilted.capture, SOURCE,
    { exactBoxes: tilted.boxes, exactShapes: tilted.shapes,
      exactSupports: tilted.supports }).report.correctedNodes, 0);
  const badSupports = new Map(tilted.supports);
  badSupports.set(1, tilted.supports.get(1).map(([min, max]) => [min + 0.02, max + 0.02]));
  assert.equal(repairMirroredAssemblyGlb(tilted.bytes, tilted.capture, SOURCE,
    { exactBoxes: tilted.boxes, exactShapes: tilted.shapes,
      exactSupports: badSupports }).report.correctedNodes, 0);
}
const customName = tiltedFixture(true);
customName.capture.components[1].sourcePath = "C:\\Projects\\OppositeHandPlate.SLDPRT";
customName.capture.components[1].name = "OppositeHandPlate-1";
const customNodes = parse(customName.bytes).scene.nodes;
customNodes[2].name = "OppositeHandPlate-1";
customName.bytes = glb(customNodes);
assert.equal(repairMirroredAssemblyGlb(customName.bytes, customName.capture, SOURCE,
  { dryRun: true }).report.proposedNodes, 1);
assert.equal(repairMirroredAssemblyGlb(customName.bytes, customName.capture, SOURCE,
  { exactBoxes: customName.boxes, exactShapes: customName.shapes,
    exactSupports: customName.supports }).report.correctedNodes, 1);
customName.capture.mirrorPlanes = [];
assert.equal(repairMirroredAssemblyGlb(customName.bytes, customName.capture, SOURCE,
  { dryRun: true }).report.proposedNodes, 0);
customName.capture.components[1].isMirrored = false;
assert.equal(repairMirroredAssemblyGlb(customName.bytes, customName.capture, SOURCE,
  { dryRun: true }).report.unresolvedNodes, 0);

const ambiguous = fixture(0, true);
const skipped = repairMirroredAssemblyGlb(ambiguous.bytes, ambiguous.capture, SOURCE);
assert.equal(skipped.report.correctedNodes, 0);
assert.equal(skipped.report.unresolvedNodes, 1);
assert.equal(skipped.bytes, ambiguous.bytes);
const nestedChoice = fixture(0, true);
const choiceNodes = parse(nestedChoice.bytes).scene.nodes;
choiceNodes[0].children = [1, 2, 4];
choiceNodes[3].translation = [-6, 4, -1];
choiceNodes.push({ name: "other-parent", translation: [2, 0, 0], children: [3] });
const choiceExact = new Map(nestedChoice.capture.components.map((component, index) =>
  [index, component.box]));
const chosen = repairMirroredAssemblyGlb(glb(choiceNodes), nestedChoice.capture, SOURCE,
  { exactBoxes: choiceExact });
assert.equal(chosen.report.correctedNodes, 1);
assert.equal(chosen.report.unresolvedNodes, 0);
const nestedNames = fixture();
nestedNames.capture.components[0].name = "Assembly-1/part-1";
nestedNames.capture.components[1].name = "MirrorAssembly-1/Mirrorpart-1";
nestedNames.capture.components.push({ name: "MirrorAssembly-1",
  sourcePath: "C:\\Projects\\MirrorAssembly.SLDASM", configuration: "Default",
  isMirrored: true, transform: nestedNames.capture.components[1].transform, box: null });
nestedNames.capture.componentCount++;
const nestedExact = new Map(nestedNames.capture.components.slice(0, 2)
  .map((component, index) => [index, component.box]));
const nestedResult = repairMirroredAssemblyGlb(nestedNames.bytes, nestedNames.capture, SOURCE,
  { exactBoxes: nestedExact });
assert.equal(nestedResult.report.correctedNodes, 1);
const missingExact = repairMirroredAssemblyGlb(fixture().bytes, fixture().capture, SOURCE,
  { exactBoxes: new Map() });
assert.equal(missingExact.report.correctedNodes, 0);
assert.equal(missingExact.report.unresolvedNodes, 1);
const inconsistent = fixture();
const incorrectRight = inconsistent.capture.components[1].box.map((value) => value + 0.2);
const rejected = repairMirroredAssemblyGlb(inconsistent.bytes, inconsistent.capture, SOURCE,
  { exactBoxes: new Map([[0, inconsistent.capture.components[0].box], [1, incorrectRight]]) });
assert.equal(rejected.report.correctedNodes, 0);
assert.equal(rejected.report.unresolvedNodes, 1);
assert.equal(rejected.bytes, inconsistent.bytes);

const numbered = fixture();
numbered.capture.components[1].sourcePath = "C:\\Projects\\Mirrorpart1.SLDPRT";
const numberedProposal = repairMirroredAssemblyGlb(numbered.bytes, numbered.capture, SOURCE,
  { dryRun: true });
assert.equal(numberedProposal.report.proposedNodes, 1);
assert.deepEqual(numberedProposal.report.shapeInspectionSources, [0, 1]);
const numberedBoxes = new Map(numbered.capture.components.map((component, index) =>
  [index, component.box]));
const withoutShapes = repairMirroredAssemblyGlb(numbered.bytes, numbered.capture, SOURCE,
  { exactBoxes: numberedBoxes });
assert.equal(withoutShapes.report.correctedNodes, 0);
assert.equal(withoutShapes.report.unresolvedNodes, 1);
const matchingShapes = new Map([[0, { bodyCount: 1,
  shapeInvariant3: 0.0002, shapeInvariant4: 0.04 }],
  [1, { bodyCount: 1, shapeInvariant3: 0.00020001, shapeInvariant4: 0.040001 }]]);
const withShapes = repairMirroredAssemblyGlb(numbered.bytes, numbered.capture, SOURCE,
  { exactBoxes: numberedBoxes, exactShapes: matchingShapes });
assert.equal(withShapes.report.correctedNodes, 1);
const mismatchedShapes = new Map(matchingShapes);
mismatchedShapes.set(1, { bodyCount: 1, shapeInvariant3: 0.0003, shapeInvariant4: 0.04 });
const withWrongShape = repairMirroredAssemblyGlb(numbered.bytes, numbered.capture, SOURCE,
  { exactBoxes: numberedBoxes, exactShapes: mismatchedShapes });
assert.equal(withWrongShape.report.correctedNodes, 0);
assert.equal(withWrongShape.report.unresolvedNodes, 1);
const mismatchedBodyCount = new Map(matchingShapes);
mismatchedBodyCount.set(1, { ...matchingShapes.get(1), bodyCount: 2 });
assert.equal(repairMirroredAssemblyGlb(numbered.bytes, numbered.capture, SOURCE,
  { exactBoxes: numberedBoxes, exactShapes: mismatchedBodyCount }).report.correctedNodes, 0);
const unpairedGeometry = fixture();
unpairedGeometry.capture.components[1].box = [7, 8, 3, 9, 9, 4];
const noAxisMirror = repairMirroredAssemblyGlb(unpairedGeometry.bytes, unpairedGeometry.capture,
  SOURCE, { dryRun: true });
assert.equal(noAxisMirror.report.proposedNodes, 0);
assert.equal(noAxisMirror.report.unresolvedNodes, 1);
const unrelatedName = fixture();
unrelatedName.capture.components[1].sourcePath = "C:\\Projects\\Mirrorpart_extra.SLDPRT";
assert.equal(repairMirroredAssemblyGlb(unrelatedName.bytes, unrelatedName.capture, SOURCE,
  { dryRun: true }).report.proposedNodes, 0);
for (const suffix of ["01", "1234", "-1"]) {
  const lookalike = fixture();
  lookalike.capture.components[1].sourcePath = `C:\\Projects\\Mirrorpart${suffix}.SLDPRT`;
  assert.equal(repairMirroredAssemblyGlb(lookalike.bytes, lookalike.capture, SOURCE,
    { dryRun: true }).report.proposedNodes, 0);
}
assert.throws(() => repairMirroredAssemblyGlb(ambiguous.bytes, ambiguous.capture,
  "C:\\Projects\\Other.SLDASM"), /does not match/);

const collision = fixture();
const collisionNodes = parse(collision.bytes).scene.nodes;
collisionNodes[0].children.push(3);
collisionNodes.push({ name: "bearing-1", translation: [5, 2, -4], mesh: 0 });
collision.capture.components.push({ name: "bearing-1", sourcePath: "C:\\Projects\\bearing.SLDPRT",
  configuration: "Default", isMirrored: false, transform: transform([10, 0, 0]),
  box: [10, 0, 0, 11, 1, 1] });
collision.capture.componentCount++;
const collisionExact = new Map(collision.capture.components.map((component, index) =>
  [index, component.box]));
const placed = repairMirroredAssemblyGlb(glb(collisionNodes), collision.capture, SOURCE,
  { exactBoxes: collisionExact }).bytes;
const collisionAudit = auditMixedSourceMeshes(placed, collision.capture, SOURCE);
assert.deepEqual(collisionAudit.missingBoxSources, []);
assert.deepEqual(collisionAudit.suspects.map((item) => item.nodeIndex), [3]);
const tetra = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]];
const triangles = Buffer.alloc(12 + 12 * 24);
triangles.write("SWTRI1", 0, "ascii");
triangles.writeUInt32LE(12, 8);
let vertexIndex = 0;
for (const face of [[0, 2, 1], [0, 1, 3], [0, 3, 2], [1, 2, 3]]) {
  for (const pointIndex of face) {
    const point = tetra[pointIndex];
    const offset = 12 + vertexIndex * 24;
    for (let axis = 0; axis < 3; axis++) {
      triangles.writeFloatLE(point[axis], offset + axis * 4);
      triangles.writeFloatLE(axis === 2 ? 1 : 0, offset + 12 + axis * 4);
    }
    vertexIndex++;
  }
}
const collisionSupports = DIAGONAL_SUPPORT_DIRECTIONS.map((direction) => {
  const values = tetra.map((point) => direction[0] * (point[0] + 10)
    + direction[1] * point[1] + direction[2] * point[2]);
  return [Math.min(...values), Math.max(...values)];
});
const emptySample = fixture();
const emptyNodes = parse(emptySample.bytes).scene.nodes;
emptyNodes[1].mesh = 1;
emptySample.bytes = glb(emptyNodes, 2, new Set([1]));
emptySample.capture.components[0].box = [1, 2, 3, 2, 3, 4];
const emptyTargets = emptyMeshNodeSources(emptySample.bytes, emptySample.capture, SOURCE);
assert.deepEqual(emptyTargets, [{ nodeIndex: 1, sourceIndex: 0 }]);
const emptySupports = DIAGONAL_SUPPORT_DIRECTIONS.map((direction) => {
  const values = tetra.map((point) => direction[0] * (point[0] + 1)
    + direction[1] * (point[1] + 2) + direction[2] * (point[2] + 3));
  return [Math.min(...values), Math.max(...values)];
});
const emptyGeometry = { boxes: new Map([[0, emptySample.capture.components[0].box]]),
  supports: new Map([[0, emptySupports]]) };
const emptyReplacement = [{ targets: emptyTargets, triangles }];
assert.throws(() => repairMismatchedMeshes(emptySample.bytes, emptySample.capture,
  SOURCE, emptyReplacement, emptyGeometry), /explicit source-verified target/);
assert.throws(() => pruneUnreferencedEmptyMeshes(emptySample.bytes), /still referenced/);
const rebuiltEmpty = repairMismatchedMeshes(emptySample.bytes, emptySample.capture,
  SOURCE, emptyReplacement, emptyGeometry, { allowEmptyTargets: new Set([1]) });
const sealedEmpty = pruneUnreferencedEmptyMeshes(rebuiltEmpty.bytes);
assert.equal(parse(sealedEmpty).scene.meshes.length, 2);
assert.equal(parse(sealedEmpty).scene.nodes[1].mesh, 1);
assert.ok(parse(sealedEmpty).scene.meshes.every((mesh) => mesh.primitives.length > 0));
assert.deepEqual(emptyMeshNodeSources(sealedEmpty, emptySample.capture, SOURCE), []);
const ambiguousEmpty = { ...emptySample.capture,
  components: [...emptySample.capture.components, { ...emptySample.capture.components[0] }],
  componentCount: emptySample.capture.componentCount + 1 };
assert.throws(() => emptyMeshNodeSources(emptySample.bytes, ambiguousEmpty, SOURCE),
  /no unique SOLIDWORKS part identity/);
const unusedEmpty = pruneUnreferencedEmptyMeshes(glb(parse(fixture().bytes).scene.nodes,
  2, new Set([1])));
assert.equal(parse(unusedEmpty).scene.meshes.length, 1);
const geometry = { boxes: new Map([[2, [10, 0, 0, 11, 1, 1]]]),
  supports: new Map([[2, collisionSupports]]) };
const correctedMesh = repairMismatchedMeshes(placed, collision.capture, SOURCE,
  [{ targets: [{ nodeIndex: 3, sourceIndex: 2 }], triangles }], geometry);
assert.equal(correctedMesh.report.correctedNodes, 1);
assert.equal(correctedMesh.report.addedMeshes, 1);
assert.equal(correctedMesh.report.maxBoxError, 0);
assert.deepEqual(auditMixedSourceMeshes(correctedMesh.bytes, collision.capture,
  SOURCE).suspects, []);
assert.throws(() => repairMismatchedMeshes(correctedMesh.bytes, collision.capture, SOURCE,
  [{ targets: [{ nodeIndex: 3, sourceIndex: 2 }], triangles }], geometry),
/confirmed geometry mismatch/);
const verifiedReplacement = repairMismatchedMeshes(correctedMesh.bytes, collision.capture,
  SOURCE, [{ targets: [{ nodeIndex: 3, sourceIndex: 2 }], triangles }], geometry,
  { allowVerifiedTargets: new Set([3]) });
assert.equal(verifiedReplacement.report.correctedNodes, 1);
const oldBin = parse(placed).binary.subarray(8);
const newBin = parse(correctedMesh.bytes).binary.subarray(8);
assert.equal(newBin.subarray(0, oldBin.length).equals(oldBin), true);
const badGeometry = { ...geometry,
  supports: new Map([[2, collisionSupports.map((pair) => pair.map((value) => value + 0.01))]]) };
assert.throws(() => repairMismatchedMeshes(placed, collision.capture, SOURCE,
  [{ targets: [{ nodeIndex: 3, sourceIndex: 2 }], triangles }], badGeometry), /disagrees/);
assert.throws(() => repairMismatchedMeshes(placed, collision.capture, SOURCE,
  [{ targets: [{ nodeIndex: 3, sourceIndex: 2 }], triangles: triangles.subarray(0, -1) }],
  geometry), /length/);
assert.throws(() => repairMismatchedMeshes(placed, collision.capture, SOURCE,
  [{ targets: [{ nodeIndex: 1, sourceIndex: 2 }], triangles }], geometry), /ambiguous/);
const repeatedSource = { ...collision.capture, components: [...collision.capture.components,
  { ...collision.capture.components[2], name: "bearing-2" }] };
const repeatedTargets = [{ nodeIndex: 3, sourceIndex: 2 }, { nodeIndex: 4, sourceIndex: 3 }];
const identical = groupTessellatedReplacements(repeatedTargets, repeatedSource,
  new Map([[2, triangles], [3, Buffer.from(triangles)]]));
assert.equal(identical.length, 1);
assert.equal(identical[0].targets.length, 2);
const assemblyCut = Buffer.from(triangles);
assemblyCut.writeFloatLE(0.8, 12);
assert.equal(groupTessellatedReplacements(repeatedTargets, repeatedSource,
  new Map([[2, triangles], [3, assemblyCut]])).length, 2);
assert.throws(() => groupTessellatedReplacements(repeatedTargets, repeatedSource,
  new Map([[2, triangles]])), /omitted/);
assert.deepEqual(selectedNodeSources(placed, collision.capture, SOURCE, [3]),
  [{ nodeIndex: 3, sourceIndex: 2 }]);
assert.deepEqual(auditSelectedNodeBounds(placed, collision.capture, SOURCE,
  [{ nodeIndex: 3, sourceIndex: 2 }], geometry.boxes).map((item) => item.nodeIndex), [3]);
const uniqueMirror = fixture();
const uniqueNodes = parse(uniqueMirror.bytes).scene.nodes;
uniqueNodes[2].mesh = 1;
uniqueMirror.bytes = glb(uniqueNodes, 2);
const uniqueReport = repairMirroredAssemblyGlb(uniqueMirror.bytes, uniqueMirror.capture,
  SOURCE, { dryRun: true }).report;
assert.equal(uniqueReport.unresolvedNodes, 1);
assert.deepEqual(uniqueReport.unresolvedNodeIndices, [2]);
assert.deepEqual(auditMixedSourceMeshes(uniqueMirror.bytes, uniqueMirror.capture,
  SOURCE).suspects, []);
const uniqueTargets = selectedNodeSources(uniqueMirror.bytes, uniqueMirror.capture,
  SOURCE, uniqueReport.unresolvedNodeIndices);
assert.deepEqual(uniqueTargets, [{ nodeIndex: 2, sourceIndex: 1 }]);
assert.deepEqual(auditSelectedNodeBounds(uniqueMirror.bytes, uniqueMirror.capture,
  SOURCE, uniqueTargets, new Map([[1, uniqueMirror.capture.components[1].box]])).length, 1);
assert.throws(() => selectedNodeSources(uniqueMirror.bytes, uniqueMirror.capture, SOURCE, [99]),
  /unique SOLIDWORKS part/);

const groupNodes = [
  { name: "root", children: [1] },
  { name: "MirrorGroup1", translation: [10, 0, 0], children: [2, 3, 4] },
  ...[0, 2, 4].map((x, index) => ({ name: `item-${index + 1}`,
    translation: [x, 0, 0], mesh: 0 })),
];
const groupCapture = { format: "excelsis-sw-assembly-geometry", formatVersion: 1,
  sourcePath: SOURCE, componentCount: 4, components: [
    { name: "MirrorGroup-2", sourcePath: "C:\\Models\\MirrorGroup.SLDASM",
      configuration: "Default", transform: transform([0, 0, 0]) },
    ...[0, 2, 4].map((x, index) => ({ name: `MirrorGroup-2/item-${index + 1}`,
      sourcePath: "C:\\Models\\item.SLDPRT", configuration: "Default",
      transform: transform([x, 0, 0]) })),
  ] };
const misplacedGroup = glb(groupNodes);
const groupRepair = repairMisplacedAssemblyGroups(misplacedGroup, groupCapture, SOURCE);
assert.equal(groupRepair.report.correctedAssemblies, 1);
assert.equal(groupRepair.report.recoveredMeshNodes, 3);
assert.equal(auditMixedSourceMeshes(groupRepair.bytes, groupCapture, SOURCE).unmatchedMeshNodes, 0);
assert.equal(repairMisplacedAssemblyGroups(groupRepair.bytes, groupCapture,
  SOURCE).report.correctedAssemblies, 0);
const insufficientGroup = { ...groupCapture, componentCount: 3,
  components: groupCapture.components.slice(0, 3) };
assert.equal(repairMisplacedAssemblyGroups(misplacedGroup, insufficientGroup,
  SOURCE).report.correctedAssemblies, 0);
const childWrongNodes = JSON.parse(JSON.stringify(groupNodes));
childWrongNodes[1].translation = [0, 0, 0];
childWrongNodes[2].translation = [1, 0, 0];
const childWrongBytes = glb(childWrongNodes);
const childPlacement = repairUnmatchedChildPlacements(childWrongBytes, groupCapture, SOURCE);
assert.deepEqual(childPlacement.report.targets, [{ nodeIndex: 2, sourceIndex: 1 }]);
assert.equal(childPlacement.report.remainingUnmatchedMeshNodes, 0);
assert.equal(auditMixedSourceMeshes(childPlacement.bytes, groupCapture, SOURCE).matchedMeshNodes, 3);
assert.equal(repairUnmatchedChildPlacements(childPlacement.bytes, groupCapture,
  SOURCE).report.correctedNodes, 0);

(async () => {
  const staged = fixture();
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "excelsis-mirror-test-"));
  const filePath = path.join(folder, "pending.glb");
  fs.writeFileSync(filePath, staged.bytes);
  const proposal = await proposeStagedAssemblyGlb(filePath, staged.capture, SOURCE);
  const exactBoxes = new Map(staged.capture.components.map((component, index) =>
    [index, component.box]));
  await assert.rejects(repairStagedAssemblyGlb(filePath, staged.capture, SOURCE,
    { boxes: exactBoxes, shapes: new Map() }, "0".repeat(64)), /changed during/);
  const report = await repairStagedAssemblyGlb(filePath, staged.capture, SOURCE,
    { boxes: exactBoxes, shapes: new Map() }, proposal.originalSha256);
  assert.equal(report.correctedNodes, 1);
  assert.notEqual(fs.readFileSync(filePath).equals(staged.bytes), true);
  console.log("Source-verified GLB mirror, assembly-group and child-placement repair, ambiguity, nested transforms, binary preservation and staged identity passed.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
