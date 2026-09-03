const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const lock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
const direct = new Set(Object.keys(packageJson.devDependencies || {}));

function packageName(packagePath, metadata) {
  if (metadata.name) return metadata.name;
  return packagePath.split("node_modules/").pop();
}

function cell(value) {
  return String(value || "").replaceAll("|", "\\|").replaceAll("\n", " ");
}

const rows = Object.entries(lock.packages || {})
  .filter(([packagePath]) => packagePath)
  .map(([packagePath, metadata]) => {
    const name = packageName(packagePath, metadata);
    if (!metadata.version) throw new Error(`Missing version for ${packagePath}`);
    if (!metadata.license) throw new Error(`Missing license for ${packagePath}`);
    const role = packagePath === `node_modules/${name}` && direct.has(name)
      ? "direct build dependency"
      : "transitive build dependency";
    return {
      packagePath,
      name,
      version: metadata.version,
      license: metadata.license,
      role,
      resolved: metadata.resolved || "package-lock entry",
    };
  })
  .sort((a, b) => a.packagePath.localeCompare(b.packagePath));

const lines = [
  "# Locked Dependency License Inventory",
  "",
  `Generated deterministically from package-lock.json for Excelsis Helper ${packageJson.version}.`,
  `The lockfile contains ${rows.length} package entries; all are build dependencies because the app has no npm runtime dependencies.`,
  "This table records every locked package's exact version, declared SPDX expression, role, and source archive. Not every installed package directory contains a standalone license file; complete applicable notices for redistributed runtime components are preserved separately in THIRD_PARTY_NOTICES.md and licenses/.",
  "",
  "| Package | Lockfile path | Version | License | Role | Source archive |",
  "|---|---|---:|---|---|---|",
  ...rows.map((row) => `| ${cell(row.name)} | ${cell(row.packagePath)} | ${cell(row.version)} | ${cell(row.license)} | ${cell(row.role)} | ${cell(row.resolved)} |`),
  "",
];

const output = path.join(root, "docs", "DEPENDENCY_LICENSES.md");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${lines.join("\n")}\n`, "utf8");
process.stdout.write(`Wrote ${output} with ${rows.length} entries.\n`);
