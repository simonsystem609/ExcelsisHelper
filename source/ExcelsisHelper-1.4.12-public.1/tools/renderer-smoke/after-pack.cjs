const fs = require("node:fs/promises");
const path = require("node:path");

const removableRuntimeFiles = [
  "dxcompiler.dll",
  "dxil.dll",
  "vulkan-1.dll",
  "vk_swiftshader.dll",
  "vk_swiftshader_icd.json",
];

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "win32") return;
  await Promise.all(removableRuntimeFiles.map((name) => fs.rm(path.join(context.appOutDir, name), { force: true })));
};
