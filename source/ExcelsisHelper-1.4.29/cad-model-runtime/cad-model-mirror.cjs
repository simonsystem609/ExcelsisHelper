"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const POSE_TOLERANCE = 0.0001;
const BOX_TOLERANCE = 0.002;
const ORIGIN_TOLERANCE = 0.001;
const MIN_IMPROVEMENT = 0.01;
const DIAGONAL_SUPPORT_DIRECTIONS = [
  [Math.SQRT1_2, Math.SQRT1_2, 0],
  [Math.SQRT1_2, -Math.SQRT1_2, 0],
  [Math.SQRT1_2, 0, Math.SQRT1_2],
  [Math.SQRT1_2, 0, -Math.SQRT1_2],
  [0, Math.SQRT1_2, Math.SQRT1_2],
  [0, Math.SQRT1_2, -Math.SQRT1_2],
  [1 / Math.sqrt(3), 1 / Math.sqrt(3), 1 / Math.sqrt(3)],
];

function readGlb(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 28 || bytes.toString("ascii", 0, 4) !== "glTF"
    || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length
    || bytes.toString("ascii", 16, 20) !== "JSON") {
    throw new Error("Unsupported GLB header.");
  }
  const jsonLength = bytes.readUInt32LE(12);
  const jsonEnd = 20 + jsonLength;
  if (jsonLength < 2 || jsonLength > 64 * 1024 * 1024 || jsonEnd + 8 > bytes.length
    || bytes.toString("ascii", jsonEnd + 4, jsonEnd + 8) !== "BIN\0") {
    throw new Error("Unsupported GLB chunk layout.");
  }
  const binLength = bytes.readUInt32LE(jsonEnd);
  if (jsonEnd + 8 + binLength !== bytes.length) throw new Error("Invalid GLB binary chunk length.");
  const json = JSON.parse(bytes.subarray(20, jsonEnd).toString("utf8"));
  if (json.asset?.version !== "2.0" || !Array.isArray(json.nodes)
    || !Array.isArray(json.meshes) || !Array.isArray(json.scenes)) {
    throw new Error("Unsupported GLB scene.");
  }
  return { bytes, json, binStart: jsonEnd + 8, binLength, tailStart: jsonEnd };
}

function writeGlb(glb) {
  const jsonBytes = Buffer.from(JSON.stringify(glb.json), "utf8");
  const paddedLength = Math.ceil(jsonBytes.length / 4) * 4;
  const tailLength = glb.bytes.length - glb.tailStart;
  const output = Buffer.alloc(20 + paddedLength + tailLength, 0x20);
  output.write("glTF", 0, "ascii");
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(paddedLength, 12);
  output.write("JSON", 16, "ascii");
  jsonBytes.copy(output, 20);
  glb.bytes.copy(output, 20 + paddedLength, glb.tailStart);
  return output;
}

function multiply(a, b) {
  const result = new Array(16);
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      let value = 0;
      for (let k = 0; k < 4; k++) value += a[k * 4 + row] * b[column * 4 + k];
      result[column * 4 + row] = value;
    }
  }
  return result;
}

function invertAffine(matrix) {
  const a = matrix[0], b = matrix[4], c = matrix[8];
  const d = matrix[1], e = matrix[5], f = matrix[9];
  const g = matrix[2], h = matrix[6], i = matrix[10];
  const determinant = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) {
    throw new Error("GLB parent transform is not invertible.");
  }
  const inverse = [
    (e * i - f * h) / determinant, (f * g - d * i) / determinant, (d * h - e * g) / determinant, 0,
    (c * h - b * i) / determinant, (a * i - c * g) / determinant, (b * g - a * h) / determinant, 0,
    (b * f - c * e) / determinant, (c * d - a * f) / determinant, (a * e - b * d) / determinant, 0,
    0, 0, 0, 1,
  ];
  const translation = matrix.slice(12, 15);
  for (let row = 0; row < 3; row++) {
    inverse[12 + row] = -inverse[row] * translation[0]
      - inverse[4 + row] * translation[1] - inverse[8 + row] * translation[2];
  }
  return inverse;
}

function nodeMatrix(node) {
  if (node.matrix) {
    if (!Array.isArray(node.matrix) || node.matrix.length !== 16
      || !node.matrix.every(Number.isFinite)) throw new Error("Invalid GLB node matrix.");
    return node.matrix;
  }
  const [x, y, z, w] = node.rotation || [0, 0, 0, 1];
  const [tx, ty, tz] = node.translation || [0, 0, 0];
  const scale = node.scale || [1, 1, 1];
  if (![x, y, z, w, tx, ty, tz, ...scale].every(Number.isFinite) || scale.length !== 3) {
    throw new Error("Invalid GLB node transform.");
  }
  const matrix = [
    1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0,
    2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0,
    2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0,
    tx, ty, tz, 1,
  ];
  for (let axis = 0; axis < 3; axis++) {
    for (let row = 0; row < 3; row++) matrix[axis * 4 + row] *= scale[axis];
  }
  return matrix;
}

function sceneTransforms(glb) {
  const worlds = new Map();
  const parents = new Map();
  const visiting = new Set();
  const roots = glb.json.scenes[glb.json.scene || 0]?.nodes;
  if (!Array.isArray(roots)) throw new Error("GLB has no active scene roots.");
  function visit(index, parent, parentWorld) {
    if (!Number.isInteger(index) || !glb.json.nodes[index] || visiting.has(index)
      || worlds.has(index)) throw new Error("GLB node hierarchy is ambiguous.");
    visiting.add(index);
    const world = multiply(parentWorld, nodeMatrix(glb.json.nodes[index]));
    worlds.set(index, world);
    parents.set(index, parent);
    for (const child of glb.json.nodes[index].children || []) visit(child, index, world);
    visiting.delete(index);
  }
  for (const root of roots) visit(root, null, IDENTITY);
  return { worlds, parents };
}

function meshWorldExtrema(glb, nodeIndex, world, directions = []) {
  const mesh = glb.json.meshes[glb.json.nodes[nodeIndex].mesh];
  if (!mesh || !Array.isArray(mesh.primitives)) throw new Error("GLB mesh is invalid.");
  const low = [Infinity, Infinity, Infinity];
  const high = [-Infinity, -Infinity, -Infinity];
  const supports = directions.map(() => [Infinity, -Infinity]);
  let count = 0;
  for (const primitive of mesh.primitives) {
    const accessor = glb.json.accessors?.[primitive.attributes?.POSITION];
    if (!accessor || accessor.componentType !== 5126 || accessor.type !== "VEC3"
      || accessor.sparse || !Number.isInteger(accessor.count) || accessor.count < 1) {
      throw new Error("Unsupported GLB POSITION data.");
    }
    const view = glb.json.bufferViews?.[accessor.bufferView];
    const stride = view?.byteStride || 12;
    const offset = (view?.byteOffset || 0) + (accessor.byteOffset || 0);
    if (!view || view.buffer !== 0 || stride < 12 || stride % 4 !== 0
      || offset < 0 || offset + (accessor.count - 1) * stride + 12 > glb.binLength
      || (accessor.byteOffset || 0) + (accessor.count - 1) * stride + 12 > view.byteLength) {
      throw new Error("GLB POSITION data exceeds its buffer view.");
    }
    for (let vertex = 0; vertex < accessor.count; vertex++) {
      const address = glb.binStart + offset + vertex * stride;
      const x = glb.bytes.readFloatLE(address);
      const y = glb.bytes.readFloatLE(address + 4);
      const z = glb.bytes.readFloatLE(address + 8);
      if (![x, y, z].every(Number.isFinite)) throw new Error("Non-finite GLB vertex position.");
      for (let axis = 0; axis < 3; axis++) {
        const value = world[axis] * x + world[4 + axis] * y + world[8 + axis] * z + world[12 + axis];
        low[axis] = Math.min(low[axis], value);
        high[axis] = Math.max(high[axis], value);
      }
      if (directions.length) {
        const wx = world[0] * x + world[4] * y + world[8] * z + world[12];
        const wy = world[1] * x + world[5] * y + world[9] * z + world[13];
        const wz = world[2] * x + world[6] * y + world[10] * z + world[14];
        for (let i = 0; i < directions.length; i++) {
          const d = directions[i];
          const projection = d[0] * wx + d[1] * wy + d[2] * wz;
          supports[i][0] = Math.min(supports[i][0], projection);
          supports[i][1] = Math.max(supports[i][1], projection);
        }
      }
      count++;
    }
  }
  if (!count) throw new Error("GLB mesh has no positions.");
  return { box: [...low, ...high], supports };
}

function meshWorldBounds(glb, nodeIndex, world) {
  return meshWorldExtrema(glb, nodeIndex, world).box;
}

function poseError(component, matrix) {
  const sw = component.transform;
  if (!Array.isArray(sw) || sw.length !== 16) return Infinity;
  const glbOffsets = [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14];
  let error = 0;
  for (let i = 0; i < 12; i++) error = Math.max(error, Math.abs(sw[i] - matrix[glbOffsets[i]]));
  return error;
}

function boxError(a, b) {
  return Math.max(...a.map((value, index) => Math.abs(value - b[index])));
}

function shapeMatches(left, right) {
  if (!Number.isInteger(left?.bodyCount) || left.bodyCount < 1
    || left.bodyCount !== right?.bodyCount) return false;
  return ["shapeInvariant3", "shapeInvariant4"].every((key) => {
    const a = left?.[key];
    const b = right?.[key];
    return Number.isFinite(a) && a > 0 && Number.isFinite(b) && b > 0
      && Math.abs(a - b) <= Math.max(1e-12, 0.0001 * Math.max(a, b));
  });
}

function reflectedBox(box, axis, plane) {
  const result = box.slice();
  result[axis] = 2 * plane - box[axis + 3];
  result[axis + 3] = 2 * plane - box[axis];
  return result;
}

function reflectedMatrix(matrix, axis, plane) {
  const result = matrix.slice();
  for (let column = 0; column < 3; column++) result[column * 4 + axis] *= -1;
  result[12 + axis] = 2 * plane - matrix[12 + axis];
  return result;
}

function featureMirrorPlanes(capture) {
  if (!Array.isArray(capture.mirrorPlanes)) return [];
  return capture.mirrorPlanes.filter((plane) => Array.isArray(plane.point)
    && plane.point.length === 3 && plane.point.every(Number.isFinite)
    && Array.isArray(plane.normal) && plane.normal.length === 3
    && plane.normal.every(Number.isFinite)
    && Math.abs(plane.normal.reduce((sum, value) => sum + value * value, 0) - 1) < 0.00001);
}

function reflectAcrossPlane(matrix, plane) {
  const n = plane.normal;
  const distance = n[0] * plane.point[0] + n[1] * plane.point[1] + n[2] * plane.point[2];
  const reflection = IDENTITY.slice();
  for (let column = 0; column < 3; column++) {
    for (let row = 0; row < 3; row++) reflection[column * 4 + row] -= 2 * n[row] * n[column];
  }
  for (let row = 0; row < 3; row++) reflection[12 + row] = 2 * distance * n[row];
  return multiply(reflection, matrix);
}

function supportError(expected, actual) {
  if (!Array.isArray(expected) || expected.length !== DIAGONAL_SUPPORT_DIRECTIONS.length
    || !Array.isArray(actual) || actual.length !== expected.length) return Infinity;
  let error = 0;
  for (let i = 0; i < expected.length; i++) {
    if (!Array.isArray(expected[i]) || expected[i].length !== 2
      || !expected[i].every(Number.isFinite)) return Infinity;
    error = Math.max(error, Math.abs(expected[i][0] - actual[i][0]),
      Math.abs(expected[i][1] - actual[i][1]));
  }
  return error;
}

function stem(sourcePath) {
  return path.win32.basename(sourcePath, path.win32.extname(sourcePath)).toLowerCase();
}

function validateCapture(capture, sourcePath) {
  if (capture?.format !== "excelsis-sw-assembly-geometry" || capture.formatVersion !== 1
    || !Array.isArray(capture.components) || capture.componentCount !== capture.components.length
    || typeof capture.sourcePath !== "string" || typeof sourcePath !== "string"
    || path.win32.normalize(capture.sourcePath).toLowerCase()
      !== path.win32.normalize(sourcePath).toLowerCase()) {
    throw new Error("SOLIDWORKS assembly capture does not match the exported model.");
  }
}

function matchMeshRows(glb, capture) {
  const hierarchy = sceneTransforms(glb);
  const byName = new Map();
  for (const component of capture.components) {
    if (typeof component.name !== "string") continue;
    const named = byName.get(component.name) || [];
    named.push(component);
    byName.set(component.name, named);
  }
  const rows = [];
  let unmatched = 0;
  const unmatchedNodeIndices = [];
  for (const [index, matrix] of hierarchy.worlds) {
    const node = glb.json.nodes[index];
    if (!Number.isInteger(node.mesh)) continue;
    const named = byName.get(node.name) || [];
    const namedMatches = named.filter((component) => poseError(component, matrix) < POSE_TOLERANCE);
    const matches = namedMatches.length === 1 ? namedMatches
      : capture.components.filter((component) => poseError(component, matrix) < POSE_TOLERANCE);
    const exactNamed = matches.filter((component) => component.name === node.name);
    const suffixNamed = typeof node.name === "string" && node.name
      ? matches.filter((component) => typeof component.name === "string"
        && component.name.endsWith(`/${node.name}`)) : [];
    const resolved = matches.length === 1 ? matches : exactNamed.length === 1 ? exactNamed : suffixNamed;
    if (resolved.length !== 1) { unmatched++; unmatchedNodeIndices.push(index); continue; }
    rows.push({ index, mesh: node.mesh, component: resolved[0], matrix,
      sourceIndex: capture.components.indexOf(resolved[0]) });
  }
  return { hierarchy, rows, unmatched, unmatchedNodeIndices };
}

function emptyMeshNodeSources(bytes, capture, sourcePath) {
  validateCapture(capture, sourcePath);
  const glb = readGlb(bytes);
  const emptyMeshes = new Set();
  for (let index = 0; index < glb.json.meshes.length; index++) {
    const primitives = glb.json.meshes[index]?.primitives;
    if (!Array.isArray(primitives)) throw new Error(`GLB mesh ${index} is invalid.`);
    if (!primitives.length) emptyMeshes.add(index);
  }
  if (!emptyMeshes.size) return [];
  const { hierarchy, rows } = matchMeshRows(glb, capture);
  const byNode = new Map(rows.map((row) => [row.index, row]));
  const targets = [];
  for (let index = 0; index < glb.json.nodes.length; index++) {
    const node = glb.json.nodes[index];
    if (!emptyMeshes.has(node.mesh)) continue;
    const row = byNode.get(index);
    if (!hierarchy.worlds.has(index) || !row || node.children?.length
      || path.win32.extname(row.component.sourcePath || "").toLowerCase() !== ".sldprt") {
      throw new Error(`Empty GLB mesh node ${index} has no unique SOLIDWORKS part identity.`);
    }
    targets.push({ nodeIndex: index, sourceIndex: row.sourceIndex });
  }
  return targets;
}

function pruneUnreferencedEmptyMeshes(bytes) {
  const glb = readGlb(bytes);
  const empty = new Set(glb.json.meshes.flatMap((mesh, index) => {
    if (!Array.isArray(mesh?.primitives)) throw new Error(`GLB mesh ${index} is invalid.`);
    return mesh.primitives.length ? [] : [index];
  }));
  if (!empty.size) return bytes;
  if (glb.json.nodes.some((node) => empty.has(node.mesh))) {
    throw new Error("An empty GLB mesh is still referenced by a node.");
  }
  if (glb.json.extensions || glb.json.extensionsUsed?.length
    || glb.json.extensionsRequired?.length) {
    throw new Error("Cannot reindex empty GLB meshes with unknown extension references.");
  }
  const reindexed = new Map();
  const meshes = [];
  for (let index = 0; index < glb.json.meshes.length; index++) {
    if (empty.has(index)) continue;
    reindexed.set(index, meshes.length);
    meshes.push(glb.json.meshes[index]);
  }
  if (!meshes.length) throw new Error("GLB has no nonempty mesh after repair.");
  for (const node of glb.json.nodes) {
    if (!Number.isInteger(node.mesh)) continue;
    if (!reindexed.has(node.mesh)) throw new Error("GLB node refers to an invalid mesh.");
    node.mesh = reindexed.get(node.mesh);
  }
  glb.json.meshes = meshes;
  return writeGlb(glb);
}

function assemblyComponentMatrix(component) {
  const values = component.transform;
  if (!Array.isArray(values) || values.length !== 16 || !values.every(Number.isFinite)
    || Math.abs(values[12] - 1) > 0.00001) return null;
  return [values[0], values[1], values[2], 0,
    values[3], values[4], values[5], 0,
    values[6], values[7], values[8], 0,
    values[9], values[10], values[11], 1];
}

function repairMisplacedAssemblyGroups(bytes, capture, sourcePath) {
  validateCapture(capture, sourcePath);
  const glb = readGlb(bytes);
  const assemblySources = capture.components.map((component, sourceIndex) =>
    ({ component, sourceIndex })).filter(({ component }) =>
    path.win32.extname(component.sourcePath || "").toLowerCase() === ".sldasm"
    && assemblyComponentMatrix(component));
  const corrected = [];
  let baseline = matchMeshRows(glb, capture);
  for (let pass = 0; pass < 32; pass++) {
    let accepted = false;
    for (const [nodeIndex, world] of baseline.hierarchy.worlds) {
      const node = glb.json.nodes[nodeIndex];
      if (!node?.children?.length || Number.isInteger(node.mesh)
        || typeof node.name !== "string") continue;
      const label = node.name.split("/").pop().toLowerCase();
      const descendants = [];
      function collect(index) {
        for (const child of glb.json.nodes[index].children || []) {
          if (Number.isInteger(glb.json.nodes[child].mesh)) descendants.push(child);
          collect(child);
        }
      }
      collect(nodeIndex);
      if (descendants.length < 3) continue;
      const proposals = [];
      for (const { component, sourceIndex } of assemblySources) {
        const sourceStem = stem(component.sourcePath);
        if (!label.startsWith(sourceStem)
          || !/^(?:-?[1-9]\d{0,2})?$/.test(label.slice(sourceStem.length))
          || poseError(component, world) < 0.01) continue;
        const targetWorld = assemblyComponentMatrix(component);
        const correction = multiply(targetWorld, invertAffine(world));
        const prefix = `${component.name}/`;
        const children = capture.components.filter((item) =>
          typeof item.name === "string" && item.name.startsWith(prefix));
        let aligned = 0;
        let contradicted = false;
        for (const childIndex of descendants) {
          const childName = glb.json.nodes[childIndex].name;
          if (typeof childName !== "string") continue;
          const named = children.filter((item) => item.name.endsWith(`/${childName}`));
          if (named.length !== 1) continue;
          const oldWorld = baseline.hierarchy.worlds.get(childIndex);
          const oldError = poseError(named[0], oldWorld);
          const newError = poseError(named[0], multiply(correction, oldWorld));
          if (oldError < POSE_TOLERANCE && newError >= POSE_TOLERANCE
            || newError > oldError + 0.002) contradicted = true;
          if (oldError > 0.01 && newError < POSE_TOLERANCE) aligned++;
        }
        if (!contradicted && aligned >= 3)
          proposals.push({ sourceIndex, component, targetWorld, aligned });
      }
      proposals.sort((left, right) => right.aligned - left.aligned);
      if (!proposals.length || (proposals[1] && proposals[1].aligned >= 3)) continue;
      const candidate = proposals[0];
      const parent = baseline.hierarchy.parents.get(nodeIndex);
      const parentWorld = parent === null ? IDENTITY : baseline.hierarchy.worlds.get(parent);
      const local = multiply(invertAffine(parentWorld), candidate.targetWorld);
      const priorNode = node;
      glb.json.nodes[nodeIndex] = { ...node, matrix: local };
      delete glb.json.nodes[nodeIndex].rotation;
      delete glb.json.nodes[nodeIndex].translation;
      delete glb.json.nodes[nodeIndex].scale;
      const trial = matchMeshRows(glb, capture);
      const oldRows = new Map(baseline.rows.map((row) => [row.index, row.sourceIndex]));
      const newRows = new Map(trial.rows.map((row) => [row.index, row.sourceIndex]));
      const preservesMatches = [...oldRows].every(([index, source]) => newRows.get(index) === source);
      const gained = descendants.filter((index) => !oldRows.has(index) && newRows.has(index));
      const ownChildren = gained.every((index) =>
        capture.components[newRows.get(index)].name.startsWith(`${candidate.component.name}/`));
      if (!preservesMatches || gained.length < 3 || !ownChildren) {
        glb.json.nodes[nodeIndex] = priorNode;
        continue;
      }
      corrected.push({ nodeIndex, sourceIndex: candidate.sourceIndex,
        recoveredMeshNodes: gained.length });
      baseline = trial;
      accepted = true;
      break;
    }
    if (!accepted) break;
    if (pass === 31) throw new Error("Too many SOLIDWORKS assembly hierarchy corrections.");
  }
  return { bytes: corrected.length ? writeGlb(glb) : bytes,
    report: { correctedAssemblies: corrected.length,
      recoveredMeshNodes: corrected.reduce((sum, item) => sum + item.recoveredMeshNodes, 0),
      remainingUnmatchedMeshNodes: baseline.unmatched,
      corrected } };
}

function repairUnmatchedChildPlacements(bytes, capture, sourcePath) {
  validateCapture(capture, sourcePath);
  const glb = readGlb(bytes);
  let baseline = matchMeshRows(glb, capture);
  const corrected = [];
  if (baseline.unmatched > 200) return { bytes, report: {
    correctedNodes: 0, remainingUnmatchedMeshNodes: baseline.unmatched, targets: [] } };
  const assemblySources = capture.components.map((component, sourceIndex) =>
    ({ component, sourceIndex })).filter(({ component }) =>
    path.win32.extname(component.sourcePath || "").toLowerCase() === ".sldasm");
  const parentSources = new Map();
  for (const [nodeIndex, world] of baseline.hierarchy.worlds) {
    const node = glb.json.nodes[nodeIndex];
    if (!node?.children?.length || Number.isInteger(node.mesh)
      || typeof node.name !== "string") continue;
    const label = node.name.split("/").pop().toLowerCase();
    const candidates = assemblySources.filter(({ component }) => {
      const sourceStem = stem(component.sourcePath);
      return label.startsWith(sourceStem)
        && /^(?:-?[1-9]\d{0,2})?$/.test(label.slice(sourceStem.length))
        && poseError(component, world) < POSE_TOLERANCE;
    });
    if (candidates.length === 1) parentSources.set(nodeIndex, candidates[0]);
  }
  for (const nodeIndex of [...baseline.unmatchedNodeIndices]) {
    const node = glb.json.nodes[nodeIndex];
    if (!Number.isInteger(node?.mesh) || node.children?.length
      || typeof node.name !== "string") continue;
    let parent = baseline.hierarchy.parents.get(nodeIndex);
    while (parent !== null && !parentSources.has(parent))
      parent = baseline.hierarchy.parents.get(parent);
    if (parent === null) continue;
    const assembly = parentSources.get(parent).component;
    const prefix = `${assembly.name}/`;
    const matches = capture.components.map((component, sourceIndex) =>
      ({ component, sourceIndex })).filter(({ component }) =>
      path.win32.extname(component.sourcePath || "").toLowerCase() === ".sldprt"
      && typeof component.name === "string" && component.name.startsWith(prefix)
      && component.name.endsWith(`/${node.name}`));
    if (matches.length !== 1) continue;
    const { component, sourceIndex } = matches[0];
    if (baseline.rows.some((row) => row.sourceIndex === sourceIndex)) continue;
    const targetWorld = assemblyComponentMatrix(component);
    if (!targetWorld) continue;
    const directParent = baseline.hierarchy.parents.get(nodeIndex);
    const parentWorld = directParent === null ? IDENTITY : baseline.hierarchy.worlds.get(directParent);
    const local = multiply(invertAffine(parentWorld), targetWorld);
    const priorNode = node;
    glb.json.nodes[nodeIndex] = { ...node, matrix: local };
    delete glb.json.nodes[nodeIndex].rotation;
    delete glb.json.nodes[nodeIndex].translation;
    delete glb.json.nodes[nodeIndex].scale;
    const trial = matchMeshRows(glb, capture);
    const oldRows = new Map(baseline.rows.map((row) => [row.index, row.sourceIndex]));
    const newRows = new Map(trial.rows.map((row) => [row.index, row.sourceIndex]));
    const preservesMatches = [...oldRows].every(([index, source]) => newRows.get(index) === source);
    const singleTarget = trial.rows.filter((row) => row.sourceIndex === sourceIndex);
    if (!preservesMatches || newRows.get(nodeIndex) !== sourceIndex
      || singleTarget.length !== 1) {
      glb.json.nodes[nodeIndex] = priorNode;
      continue;
    }
    corrected.push({ nodeIndex, sourceIndex });
    baseline = trial;
  }
  return { bytes: corrected.length ? writeGlb(glb) : bytes,
    report: { correctedNodes: corrected.length,
      remainingUnmatchedMeshNodes: baseline.unmatched, targets: corrected } };
}

function mixedSourceMeshes(rows) {
  const meshOwners = new Map();
  for (const row of rows) {
    if (path.win32.extname(row.component.sourcePath || "").toLowerCase() !== ".sldprt") continue;
    const owners = meshOwners.get(row.mesh) || [];
    owners.push(row);
    meshOwners.set(row.mesh, owners);
  }
  return [...meshOwners].flatMap(([mesh, owners]) => {
    const keys = new Set(owners.map(({ component }) =>
      `${path.win32.normalize(component.sourcePath).toLowerCase()}\0${component.configuration}`));
    return keys.size < 2 ? [] : [{ mesh,
      nodes: owners.map((row) => ({ nodeIndex: row.index, sourceIndex: row.sourceIndex })) }];
  });
}

function auditMixedSourceMeshes(bytes, capture, sourcePath) {
  validateCapture(capture, sourcePath);
  const glb = readGlb(bytes);
  const { rows, unmatched, unmatchedNodeIndices } = matchMeshRows(glb, capture);
  const rowByIndex = new Map(rows.map((row) => [row.index, row]));
  const groups = mixedSourceMeshes(rows);
  const missingBoxSources = new Set();
  const suspects = [];
  for (const group of groups) {
    for (const { nodeIndex, sourceIndex } of group.nodes) {
      const row = rowByIndex.get(nodeIndex);
      const box = row.component.box;
      if (!Array.isArray(box) || box.length !== 6 || !box.every(Number.isFinite)) {
        missingBoxSources.add(sourceIndex);
        continue;
      }
      const error = boxError(box, meshWorldBounds(glb, nodeIndex, row.matrix));
      if (error > 0.005) suspects.push({ nodeIndex, sourceIndex, mesh: group.mesh,
        approximateBoxError: error });
    }
  }
  return { groupCount: groups.length, matchedMeshNodes: rows.length, unmatchedMeshNodes: unmatched,
    unmatchedNodeIndices,
    missingBoxSources: [...missingBoxSources], suspects };
}

function selectedNodeSources(bytes, capture, sourcePath, nodeIndices) {
  validateCapture(capture, sourcePath);
  const glb = readGlb(bytes);
  const rows = new Map(matchMeshRows(glb, capture).rows.map((row) => [row.index, row]));
  return [...new Set(nodeIndices)].map((nodeIndex) => {
    const row = rows.get(nodeIndex);
    if (!row || path.win32.extname(row.component.sourcePath || "").toLowerCase() !== ".sldprt") {
      throw new Error("Unresolved GLB node has no unique SOLIDWORKS part identity.");
    }
    return { nodeIndex, sourceIndex: row.sourceIndex };
  });
}

function auditSelectedNodeBounds(bytes, capture, sourcePath, targets, exactBoxes) {
  validateCapture(capture, sourcePath);
  const glb = readGlb(bytes);
  const rows = new Map(matchMeshRows(glb, capture).rows.map((row) => [row.index, row]));
  return targets.flatMap(({ nodeIndex, sourceIndex }) => {
    const row = rows.get(nodeIndex);
    const box = exactBoxes?.get(sourceIndex);
    if (!row || row.sourceIndex !== sourceIndex || !Array.isArray(box)
      || box.length !== 6 || !box.every(Number.isFinite)) {
      throw new Error("Unresolved GLB node has no exact source geometry.");
    }
    const error = boxError(box, meshWorldBounds(glb, nodeIndex, row.matrix));
    return error > 0.005 ? [{ nodeIndex, sourceIndex, exactBoxError: error }] : [];
  });
}

function decodeTessellation(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 36
    || bytes.toString("ascii", 0, 6) !== "SWTRI1"
    || bytes.readUInt16LE(6) !== 0) throw new Error("Invalid SOLIDWORKS tessellation header.");
  const count = bytes.readUInt32LE(8);
  if (count < 3 || count > 2000000 || count % 3 !== 0 || bytes.length !== 12 + count * 24) {
    throw new Error("Invalid SOLIDWORKS tessellation length.");
  }
  const low = [Infinity, Infinity, Infinity];
  const high = [-Infinity, -Infinity, -Infinity];
  for (let vertex = 0; vertex < count; vertex++) {
    const offset = 12 + vertex * 24;
    for (let axis = 0; axis < 3; axis++) {
      const position = bytes.readFloatLE(offset + axis * 4);
      const normal = bytes.readFloatLE(offset + 12 + axis * 4);
      if (!Number.isFinite(position) || !Number.isFinite(normal)) {
        throw new Error("Non-finite SOLIDWORKS tessellation value.");
      }
      low[axis] = Math.min(low[axis], position);
      high[axis] = Math.max(high[axis], position);
    }
  }
  return { vertices: bytes.subarray(12), count, low, high };
}

function groupTessellatedReplacements(suspects, capture, triangles) {
  if (!Array.isArray(suspects) || !(triangles instanceof Map)) {
    throw new Error("Invalid tessellation grouping request.");
  }
  const groups = new Map();
  for (const suspect of suspects) {
    const component = capture.components?.[suspect.sourceIndex];
    const data = triangles.get(suspect.sourceIndex);
    if (!component || path.win32.extname(component.sourcePath || "").toLowerCase() !== ".sldprt"
      || !Buffer.isBuffer(data)) {
      throw new Error("SOLIDWORKS omitted a required component tessellation.");
    }
    const digest = crypto.createHash("sha256").update(data).digest("hex");
    const key = `${path.win32.normalize(component.sourcePath).toLowerCase()}\0`
      + `${component.configuration}\0${digest}`;
    const group = groups.get(key) || { targets: [], triangles: data };
    if (!group.triangles.equals(data)) {
      throw new Error("SOLIDWORKS tessellation identity is inconsistent.");
    }
    group.targets.push({ nodeIndex: suspect.nodeIndex, sourceIndex: suspect.sourceIndex });
    groups.set(key, group);
  }
  return [...groups.values()];
}

function writeGlbWithAddedBin(glb, chunks) {
  const jsonBytes = Buffer.from(JSON.stringify(glb.json), "utf8");
  const paddedJsonLength = Math.ceil(jsonBytes.length / 4) * 4;
  const extraLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const binLength = Math.ceil((glb.binLength + extraLength) / 4) * 4;
  const output = Buffer.alloc(20 + paddedJsonLength + 8 + binLength, 0x20);
  output.write("glTF", 0, "ascii");
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(paddedJsonLength, 12);
  output.write("JSON", 16, "ascii");
  jsonBytes.copy(output, 20);
  const binHeader = 20 + paddedJsonLength;
  output.writeUInt32LE(binLength, binHeader);
  output.write("BIN\0", binHeader + 4, "ascii");
  glb.bytes.copy(output, binHeader + 8, glb.binStart, glb.binStart + glb.binLength);
  let offset = binHeader + 8 + glb.binLength;
  for (const chunk of chunks) { chunk.copy(output, offset); offset += chunk.length; }
  return output;
}

function repairMismatchedMeshes(bytes, capture, sourcePath, replacements, exactGeometry,
  options = {}) {
  validateCapture(capture, sourcePath);
  if (!Array.isArray(replacements) || !replacements.length) {
    return { bytes, report: { correctedNodes: 0, addedMeshes: 0 } };
  }
  const glb = readGlb(bytes);
  const { rows } = matchMeshRows(glb, capture);
  const rowByIndex = new Map(rows.map((row) => [row.index, row]));
  if (!Array.isArray(glb.json.buffers) || glb.json.buffers.length !== 1
    || !Array.isArray(glb.json.bufferViews) || !Array.isArray(glb.json.accessors)
    || !Number.isInteger(glb.json.buffers[0].byteLength)
    || glb.json.buffers[0].byteLength > glb.binLength) {
    throw new Error("Unsupported GLB binary layout for source mesh correction.");
  }
  const seenNodes = new Set();
  const chunks = [];
  const checks = [];
  let offset = glb.binLength;
  for (const replacement of replacements) {
    const targets = replacement.targets;
    if (!Array.isArray(targets) || !targets.length) throw new Error("Missing mesh replacement targets.");
    const sourceKey = (sourceIndex) => {
      const component = capture.components[sourceIndex];
      if (!component || path.win32.extname(component.sourcePath || "").toLowerCase() !== ".sldprt") {
        throw new Error("Replacement source is not a SOLIDWORKS part.");
      }
      return `${path.win32.normalize(component.sourcePath).toLowerCase()}\0${component.configuration}`;
    };
    const key = sourceKey(targets[0].sourceIndex);
    const triangles = decodeTessellation(replacement.triangles);
    for (const target of targets) {
      const row = rowByIndex.get(target.nodeIndex);
      if (!row || row.sourceIndex !== target.sourceIndex || sourceKey(target.sourceIndex) !== key
        || seenNodes.has(target.nodeIndex) || glb.json.nodes[target.nodeIndex].children?.length) {
        throw new Error("Mesh replacement target has an ambiguous source identity.");
      }
      const exactBox = exactGeometry?.boxes?.get(target.sourceIndex);
      const exactSupports = exactGeometry?.supports?.get(target.sourceIndex);
      if (!Array.isArray(exactBox) || exactBox.length !== 6 || !exactBox.every(Number.isFinite)
        || !Array.isArray(exactSupports)
        || exactSupports.length !== DIAGONAL_SUPPORT_DIRECTIONS.length) {
        throw new Error("Mesh replacement needs exact body bounds and directional extents.");
      }
      const oldMesh = glb.json.meshes[row.mesh];
      const isEmpty = Array.isArray(oldMesh?.primitives) && oldMesh.primitives.length === 0;
      if (isEmpty && !options.allowEmptyTargets?.has(target.nodeIndex)) {
        throw new Error("Empty GLB mesh replacement needs an explicit source-verified target.");
      }
      if (!isEmpty && boxError(exactBox, meshWorldBounds(glb, target.nodeIndex,
        row.matrix)) <= 0.005 && !options.allowVerifiedTargets?.has(target.nodeIndex)) {
        throw new Error("Mesh replacement target does not have a confirmed geometry mismatch.");
      }
      seenNodes.add(target.nodeIndex);
      checks.push({ nodeIndex: target.nodeIndex, sourceIndex: target.sourceIndex,
        exactBox, exactSupports });
    }
    const view = glb.json.bufferViews.length;
    glb.json.bufferViews.push({ buffer: 0, byteOffset: offset,
      byteLength: triangles.vertices.length, byteStride: 24 });
    const positionAccessor = glb.json.accessors.length;
    glb.json.accessors.push({ bufferView: view, byteOffset: 0, componentType: 5126,
      count: triangles.count, type: "VEC3", min: triangles.low, max: triangles.high });
    const normalAccessor = glb.json.accessors.length;
    glb.json.accessors.push({ bufferView: view, byteOffset: 12, componentType: 5126,
      count: triangles.count, type: "VEC3" });
    if (!Array.isArray(glb.json.materials)) glb.json.materials = [];
    const material = glb.json.materials.length;
    glb.json.materials.push({ name: "SOLIDWORKS source geometry",
      pbrMetallicRoughness: { baseColorFactor: [0.7, 0.72, 0.75, 1],
        metallicFactor: 0.1, roughnessFactor: 0.65 }, doubleSided: true });
    const mesh = glb.json.meshes.length;
    glb.json.meshes.push({ name: "SOLIDWORKS source geometry", primitives: [{ attributes: {
      POSITION: positionAccessor, NORMAL: normalAccessor }, material, mode: 4 }] });
    for (const target of targets) glb.json.nodes[target.nodeIndex].mesh = mesh;
    chunks.push(triangles.vertices);
    offset += triangles.vertices.length;
  }
  glb.json.buffers[0].byteLength = offset;
  const repaired = writeGlbWithAddedBin(glb, chunks);
  const verified = readGlb(repaired);
  const worlds = sceneTransforms(verified).worlds;
  let maxBoxError = 0;
  let maxSupportError = 0;
  for (const check of checks) {
    const measured = meshWorldExtrema(verified, check.nodeIndex,
      worlds.get(check.nodeIndex), DIAGONAL_SUPPORT_DIRECTIONS);
    const boundError = boxError(check.exactBox, measured.box);
    const directionalError = supportError(check.exactSupports, measured.supports);
    if (boundError > BOX_TOLERANCE || directionalError > BOX_TOLERANCE) {
      throw new Error(`Replacement mesh for node ${check.nodeIndex} disagrees with SOLIDWORKS geometry.`);
    }
    maxBoxError = Math.max(maxBoxError, boundError);
    maxSupportError = Math.max(maxSupportError, directionalError);
  }
  return { bytes: repaired, report: { correctedNodes: seenNodes.size,
    addedMeshes: replacements.length, maxBoxError, maxSupportError } };
}

function repairMirroredAssemblyGlb(bytes, capture, sourcePath, options = {}) {
  validateCapture(capture, sourcePath);
  const glb = readGlb(bytes);
  const { hierarchy, rows, unmatched } = matchMeshRows(glb, capture);
  if (!rows.length && capture.components.some((component) => component.isMirrored
    && stem(component.sourcePath || "").startsWith("mirror")
    && glb.json.nodes.some((node) => node.name === component.name && Number.isInteger(node.mesh)))) {
    throw new Error("GLB component poses cannot be reconciled with SOLIDWORKS.");
  }

  const mixedMeshes = mixedSourceMeshes(rows);

  const bounds = new Map();
  const getBounds = (row) => {
    if (!bounds.has(row.index)) bounds.set(row.index, meshWorldBounds(glb, row.index, row.matrix));
    return bounds.get(row.index);
  };
  const changes = [];
  const proposals = [];
  const inspectionSources = new Set();
  const shapeInspectionSources = new Set();
  const supportInspectionSources = new Set();
  const approxInspectionSources = new Set();
  const planes = featureMirrorPlanes(capture);
  let unresolved = 0;
  const unresolvedNodeIndices = [];
  const sourceTessellationNodeIndices = [];
  let supportedMirrored = 0;
  for (const right of rows) {
    const source = right.component;
    if (source.isMirrored && !Array.isArray(source.box)
      && path.win32.extname(source.sourcePath || "").toLowerCase() === ".sldprt"
      && planes.length && rows.some((left) => left.index !== right.index
        && left.mesh === right.mesh
        && hierarchy.parents.get(left.index) === hierarchy.parents.get(right.index)
        && left.component.configuration === source.configuration)) {
      approxInspectionSources.add(capture.components.indexOf(source));
    }
    if (!source.isMirrored || !Array.isArray(source.box) || source.box.length !== 6
      || !source.box.every(Number.isFinite)
      || path.win32.extname(source.sourcePath || "").toLowerCase() !== ".sldprt") continue;
    const sourceStem = stem(source.sourcePath || "");
    const namedMirror = sourceStem.startsWith("mirror") && sourceStem.length > 6;
    supportedMirrored++;
    const rightBounds = getBounds(right);
    const originalError = boxError(source.box, rightBounds);
    if (originalError <= MIN_IMPROVEMENT) continue;
    const rightSourceIndex = capture.components.indexOf(right.component);
    inspectionSources.add(rightSourceIndex);
    const measuredRight = options.exactBoxes?.get(rightSourceIndex);
    if (Array.isArray(measuredRight) && measuredRight.length === 6
      && measuredRight.every(Number.isFinite)
      && boxError(measuredRight, rightBounds) <= MIN_IMPROVEMENT) continue;
    if (glb.json.nodes[right.index].children?.length) {
      unresolved++;
      unresolvedNodeIndices.push(right.index);
      continue;
    }
    const featureEligible = [];
    const axisEligible = [];
    for (const left of rows) {
      const leftStem = stem(left.component.sourcePath || "");
      const ordinaryStem = sourceStem.slice(6);
      const exactName = namedMirror && leftStem === ordinaryStem;
      const numberedName = namedMirror && !exactName && leftStem && ordinaryStem.startsWith(leftStem)
        && /^[1-9]\d{0,2}$/.test(ordinaryStem.slice(leftStem.length));
      const namedPair = exactName || numberedName;
      if (left.index === right.index || left.mesh !== right.mesh
        || glb.json.nodes[left.index].children?.length
        || hierarchy.parents.get(left.index) !== hierarchy.parents.get(right.index)
        || (!namedPair && !planes.length)
        || left.component.configuration !== source.configuration
        || (namedPair && (!Array.isArray(left.component.box)
          || left.component.box.length !== 6 || !left.component.box.every(Number.isFinite)))) continue;
      const leftBounds = Array.isArray(left.component.box) ? getBounds(left) : null;
      const leftError = leftBounds ? boxError(left.component.box, leftBounds) : null;
      if (leftError !== null && leftError >= MIN_IMPROVEMENT) continue;
      for (const featurePlane of planes) {
        const reflected = reflectAcrossPlane(left.matrix, featurePlane);
        const correctedBounds = meshWorldBounds(glb, left.index, reflected);
        const correctedError = boxError(source.box, correctedBounds);
        const originError = Math.max(...[0, 1, 2].map((item) =>
          Math.abs(reflected[12 + item] - right.matrix[12 + item])));
        if (correctedError >= BOX_TOLERANCE
          || correctedError + MIN_IMPROVEMENT >= originalError) continue;
        const axisAligned = featurePlane.normal.some((value) => Math.abs(value) > 0.99999);
        const requiresSupport = !namedPair || !axisAligned || originError >= ORIGIN_TOLERANCE;
        featureEligible.push({ left, reflected, featureName: featurePlane.featureName,
          requiresShape: numberedName || requiresSupport, requiresSupport, mode: "feature" });
      }
      if (!namedPair) continue;
      for (let axis = 0; axis < 3; axis++) {
        const plane = (left.component.box[axis] + source.box[axis + 3]) / 2;
        const sourceError = boxError(source.box, reflectedBox(left.component.box, axis, plane));
        const correctedBounds = reflectedBox(leftBounds, axis, plane);
        const correctedError = boxError(source.box, correctedBounds);
        const reflected = reflectedMatrix(left.matrix, axis, plane);
        const originError = Math.max(...[0, 1, 2].map((item) =>
          Math.abs(reflected[12 + item] - right.matrix[12 + item])));
        if (sourceError < BOX_TOLERANCE && originError < ORIGIN_TOLERANCE
          && correctedError < Math.max(0.005, leftError + 0.005)
          && correctedError + MIN_IMPROVEMENT < originalError) {
          axisEligible.push({ left, axis, requiresShape: numberedName, mode: "axis" });
        }
      }
    }
    const distinctFeatures = featureEligible.filter((candidate, index) =>
      !featureEligible.slice(0, index).some((earlier) => earlier.left.index === candidate.left.index
        && Math.max(...candidate.reflected.map((value, offset) =>
          Math.abs(value - earlier.reflected[offset]))) < 0.000001));
    const eligible = distinctFeatures.length ? distinctFeatures : axisEligible;
    if (eligible.length !== 1) {
      unresolved++;
      unresolvedNodeIndices.push(right.index);
      continue;
    }
    const candidate = eligible[0];
    const leftSourceIndex = capture.components.indexOf(candidate.left.component);
    inspectionSources.add(leftSourceIndex);
    if (candidate.requiresShape) {
      shapeInspectionSources.add(leftSourceIndex);
      shapeInspectionSources.add(rightSourceIndex);
    }
    if (candidate.requiresSupport) {
      supportInspectionSources.add(leftSourceIndex);
      supportInspectionSources.add(rightSourceIndex);
    }
    proposals.push({ leftSourceIndex, rightSourceIndex, requiresShape: candidate.requiresShape,
      requiresSupport: !!candidate.requiresSupport, mode: candidate.mode,
      ...(candidate.featureName ? { featureName: candidate.featureName } : {}) });
    if (options.dryRun) continue;
    if (options.preferSourceTessellation) {
      unresolved++;
      unresolvedNodeIndices.push(right.index);
      sourceTessellationNodeIndices.push(right.index);
      continue;
    }
    if (!(options.exactBoxes instanceof Map)) {
      throw new Error("Exact SOLIDWORKS body bounds are required before GLB correction.");
    }
    const leftExact = options.exactBoxes.get(leftSourceIndex);
    const rightExact = options.exactBoxes.get(rightSourceIndex);
    if (!Array.isArray(leftExact) || leftExact.length !== 6 || !leftExact.every(Number.isFinite)
      || !Array.isArray(rightExact) || rightExact.length !== 6 || !rightExact.every(Number.isFinite)) {
      unresolved++;
      unresolvedNodeIndices.push(right.index);
      continue;
    }
    if (candidate.requiresShape && !shapeMatches(options.exactShapes?.get(leftSourceIndex),
      options.exactShapes?.get(rightSourceIndex))) {
      unresolved++;
      unresolvedNodeIndices.push(right.index);
      continue;
    }
    const exactPlane = candidate.mode === "axis"
      ? (leftExact[candidate.axis] + rightExact[candidate.axis + 3]) / 2 : null;
    const leftExactError = boxError(leftExact, getBounds(candidate.left));
    const originalExactError = boxError(rightExact, rightBounds);
    const exactWorld = candidate.mode === "feature" ? candidate.reflected
      : reflectedMatrix(candidate.left.matrix, candidate.axis, exactPlane);
    const correctedBounds = candidate.mode === "feature"
      ? meshWorldBounds(glb, candidate.left.index, exactWorld)
      : reflectedBox(getBounds(candidate.left), candidate.axis, exactPlane);
    const correctedExactError = boxError(rightExact, correctedBounds);
    if ((candidate.mode === "axis"
      && boxError(rightExact, reflectedBox(leftExact, candidate.axis, exactPlane)) >= BOX_TOLERANCE)
      || leftExactError >= MIN_IMPROVEMENT
      || correctedExactError >= Math.max(0.005, leftExactError + 0.005)
      || correctedExactError + MIN_IMPROVEMENT >= originalExactError) {
      unresolved++;
      unresolvedNodeIndices.push(right.index);
      continue;
    }
    if (candidate.requiresSupport) {
      const sourceSupports = options.exactSupports?.get(leftSourceIndex);
      const targetSupports = options.exactSupports?.get(rightSourceIndex);
      if (supportError(sourceSupports, meshWorldExtrema(glb, candidate.left.index,
        candidate.left.matrix, DIAGONAL_SUPPORT_DIRECTIONS).supports) >= BOX_TOLERANCE
        || supportError(targetSupports, meshWorldExtrema(glb, candidate.left.index,
          exactWorld, DIAGONAL_SUPPORT_DIRECTIONS).supports) >= BOX_TOLERANCE) {
        unresolved++;
        unresolvedNodeIndices.push(right.index);
        continue;
      }
    }
    const parent = hierarchy.parents.get(right.index);
    const parentWorld = parent === null ? IDENTITY : hierarchy.worlds.get(parent);
    const local = multiply(invertAffine(parentWorld), exactWorld);
    changes.push({ right, local, correctedError: correctedExactError, exactBox: rightExact });
  }

  if (changes.length) {
    for (const change of changes) {
      const node = glb.json.nodes[change.right.index];
      node.matrix = change.local;
      delete node.rotation;
      delete node.translation;
      delete node.scale;
    }
    const verified = sceneTransforms(glb);
    for (const change of changes) {
      const world = verified.worlds.get(change.right.index);
      const actual = meshWorldBounds(glb, change.right.index, world);
      if (boxError(change.exactBox, actual) > change.correctedError + 0.00001) {
        throw new Error("Corrected GLB geometry did not pass source-bound verification.");
      }
    }
  }
  return {
    bytes: changes.length ? writeGlb(glb) : bytes,
    report: {
      componentCount: capture.componentCount,
      matchedMeshNodes: rows.length,
      unmatchedMeshNodes: unmatched,
      supportedMirroredNodes: supportedMirrored,
      proposedNodes: proposals.length,
      correctedNodes: changes.length,
      unresolvedNodes: unresolved,
      unresolvedNodeIndices,
      sourceTessellationNodeIndices,
      ...(options.dryRun ? { proposedSources: proposals,
        inspectionSources: [...inspectionSources],
        shapeInspectionSources: [...shapeInspectionSources],
        supportInspectionSources: [...supportInspectionSources],
        approxInspectionSources: [...approxInspectionSources],
        mixedSourceMeshes: mixedMeshes } : {}),
    },
  };
}

async function proposeStagedAssemblyGlb(filePath, capture, sourcePath) {
  const original = await fs.readFile(filePath);
  return {
    ...repairMirroredAssemblyGlb(original, capture, sourcePath, { dryRun: true }).report,
    originalSha256: crypto.createHash("sha256").update(original).digest("hex"),
  };
}

async function repairStagedAssemblyGlb(filePath, capture, sourcePath, exactGeometry,
  expectedSha256, options = {}) {
  const original = await fs.readFile(filePath);
  if (crypto.createHash("sha256").update(original).digest("hex") !== expectedSha256) {
    throw new Error("Staged GLB changed during SOLIDWORKS geometry validation.");
  }
  const result = repairMirroredAssemblyGlb(original, capture, sourcePath,
    { exactBoxes: exactGeometry.boxes, exactShapes: exactGeometry.shapes,
      exactSupports: exactGeometry.supports, ...options });
  if (result.bytes !== original) await fs.writeFile(filePath, result.bytes);
  return result.report;
}

module.exports = { DIAGONAL_SUPPORT_DIRECTIONS, auditMixedSourceMeshes,
  auditSelectedNodeBounds, selectedNodeSources, emptyMeshNodeSources,
  pruneUnreferencedEmptyMeshes, groupTessellatedReplacements,
  repairMisplacedAssemblyGroups, repairUnmatchedChildPlacements,
  repairMismatchedMeshes,
  proposeStagedAssemblyGlb, repairMirroredAssemblyGlb, repairStagedAssemblyGlb };
