"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const { constants } = require("node:fs");
const path = require("node:path");

const FILE_NAME = "date-assembly-files.exe";

async function regularFile(filePath) {
  const stat = await fs.lstat(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`Assembly-date runtime is not a regular file: ${filePath}`);
  }
}

async function ensureDateAssemblyRuntime(bundledFile, runtimeRoot) {
  if (!path.isAbsolute(bundledFile) || !path.isAbsolute(runtimeRoot)) {
    throw new Error("Assembly-date runtime paths must be absolute.");
  }
  await regularFile(bundledFile);
  await fs.mkdir(runtimeRoot, { recursive: true });
  const rootStat = await fs.lstat(runtimeRoot);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error("Assembly-date runtime folder is not a regular directory.");
  }
  const external = path.join(runtimeRoot, FILE_NAME);
  try {
    await regularFile(external);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    try {
      await fs.copyFile(bundledFile, external, constants.COPYFILE_EXCL);
    } catch (copyError) {
      if (copyError.code !== "EEXIST") throw copyError;
    }
    await regularFile(external);
  }
  return external;
}

async function fingerprintDateAssemblyRuntime(filePath) {
  await regularFile(filePath);
  return crypto.createHash("sha256").update(await fs.readFile(filePath)).digest("hex");
}

module.exports = { FILE_NAME, ensureDateAssemblyRuntime, fingerprintDateAssemblyRuntime };
