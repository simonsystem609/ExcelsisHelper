"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const { constants } = require("node:fs");
const path = require("node:path");

const RUNTIME_FILES = Object.freeze([
  "cad-model-workflow.cjs",
  "cad-model-export.cjs",
  "cad-model-mirror.cjs",
  "cad-model-capture.cjs",
  "sw-assembly-capture-session.cjs",
  "export-active-glb.vbs",
  "capture-sw-assembly-geometry.exe",
  "README.md",
]);

async function regularFile(filePath) {
  const stat = await fs.lstat(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`CAD export runtime file is not a regular file: ${filePath}`);
  }
}

async function ensureCadModelRuntime(bundledRoot, runtimeRoot) {
  if (!path.isAbsolute(bundledRoot) || !path.isAbsolute(runtimeRoot)) {
    throw new Error("CAD export runtime folders must be absolute paths.");
  }
  await fs.mkdir(runtimeRoot, { recursive: true });
  const rootStat = await fs.lstat(runtimeRoot);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error("CAD export runtime folder is not a regular directory.");
  }
  for (const fileName of RUNTIME_FILES) {
    const bundled = path.join(bundledRoot, fileName);
    const external = path.join(runtimeRoot, fileName);
    await regularFile(bundled);
    let present = false;
    try {
      await regularFile(external);
      present = true;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (!present) {
      try {
        await fs.copyFile(bundled, external, constants.COPYFILE_EXCL);
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
      }
    }
    await regularFile(external);
  }
  return runtimeRoot;
}

async function fingerprintRuntime(runtimeRoot) {
  const hashes = new Map();
  for (const fileName of RUNTIME_FILES) {
    if (fileName === "README.md") continue;
    const filePath = path.join(runtimeRoot, fileName);
    await regularFile(filePath);
    hashes.set(fileName, crypto.createHash("sha256")
      .update(await fs.readFile(filePath)).digest("hex"));
  }
  return hashes;
}

async function loadCadModelRuntime(runtimeRoot) {
  const initial = await fingerprintRuntime(runtimeRoot);
  const prefix = `${path.resolve(runtimeRoot).toLowerCase()}${path.sep}`;
  for (const loadedPath of Object.keys(require.cache)) {
    if (loadedPath.toLowerCase().startsWith(prefix)) delete require.cache[loadedPath];
  }
  const implementation = require(path.join(runtimeRoot, "cad-model-workflow.cjs"));
  if (typeof implementation.exportActiveCadModel !== "function") {
    throw new Error("CAD export workflow does not provide exportActiveCadModel().");
  }
  return {
    exportActiveCadModel: implementation.exportActiveCadModel,
    verifyUnchanged: async () => {
      const current = await fingerprintRuntime(runtimeRoot);
      for (const [fileName, hash] of initial) {
        if (current.get(fileName) !== hash) {
          throw new Error(`CAD export runtime changed during export: ${fileName}`);
        }
      }
    },
  };
}

module.exports = { RUNTIME_FILES, ensureCadModelRuntime, loadCadModelRuntime };
