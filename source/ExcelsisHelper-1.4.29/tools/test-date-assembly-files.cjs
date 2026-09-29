"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { ensureDateAssemblyRuntime, fingerprintDateAssemblyRuntime } = require("../date-assembly-runtime-host.cjs");

const helper = process.env.DATE_ASSEMBLY_HELPER || path.resolve(__dirname, "..", "scripts", "date-assembly-files.exe");
const result = spawnSync(helper, ["invalid"], {
  encoding: "utf8",
  timeout: 10000,
  windowsHide: true,
});
assert.ifError(result.error);
assert.equal(result.status, 1, result.stderr);
assert.equal(result.stderr, "", "The one-file helper must not require adjacent interop DLLs.");
const response = JSON.parse(result.stdout.trim());
assert.equal(response.ok, false);
assert.match(response.error, /Usage: DateAssemblyFiles\.exe/);

function scope(assembly, hints, candidate) {
  const args = ["scope", assembly, JSON.stringify(hints)];
  if (candidate) args.push(candidate);
  const check = spawnSync(helper, args, {
    encoding: "utf8",
    timeout: 10000,
    windowsHide: true,
  });
  assert.ifError(check.error);
  assert.equal(check.status, 0, check.stderr || check.stdout);
  return JSON.parse(check.stdout.trim());
}

const project = String.raw`Y:\CompanyProjects\2026\ABC-26-076_Example`;
const assembly = path.win32.join(project, "nested", "machine.SLDASM");
const hints = { projectCodePrefixes: ["ABC"], projectRootNames: ["CompanyProjects"] };
const part = path.win32.join(project, "components", "plate.SLDPRT");
assert.deepEqual(scope(assembly, hints, part), {
  ok: true,
  scope: `${project}\\`,
  candidateInside: true,
});
assert.equal(scope(assembly, hints, String.raw`Y:\CompanyProjects\2026\ABC-26-077_Other\part.SLDPRT`).candidateInside, false);
assert.equal(scope(assembly, hints, `${project}_other\\part.SLDPRT`).candidateInside, false);
assert.equal(scope(assembly, { projectCodePrefixes: ["ABC"], projectRootNames: [] }).scope, `${project}\\`);
assert.equal(scope(assembly, { projectCodePrefixes: [], projectRootNames: ["CompanyProjects"] }).scope, `${project}\\`);
assert.equal(scope(assembly, { locations: hints }).scope, `${project}\\`);
assert.equal(scope(assembly, { projectCodePrefixes: [], projectRootNames: [] }).scope,
  `${path.win32.dirname(assembly)}\\`);

const csc = path.join(process.env.WINDIR || String.raw`C:\Windows`,
  "Microsoft.NET", "Framework", "v4.0.30319", "csc.exe");
const snapshotFixture = fs.mkdtempSync(path.join(os.tmpdir(), "excelsis-date-snapshot-"));
const snapshotTest = path.join(snapshotFixture, "test-date-assembly-snapshot.exe");
const compile = spawnSync(csc, ["/nologo", "/target:exe", `/out:${snapshotTest}`,
  path.join(__dirname, "test-date-assembly-snapshot.cs")], {
  encoding: "utf8", timeout: 30000, windowsHide: true,
});
assert.ifError(compile.error);
assert.equal(compile.status, 0, compile.stdout + compile.stderr);
const snapshotResult = spawnSync(snapshotTest, [helper, snapshotFixture], {
  encoding: "utf8", timeout: 10000, windowsHide: true,
});
assert.ifError(snapshotResult.error);
assert.equal(snapshotResult.status, 0, snapshotResult.stdout + snapshotResult.stderr);
assert.match(snapshotResult.stdout, /post-close file checks passed/);

const mainSource = fs.readFileSync(path.resolve(__dirname, "..", "main.cjs"), "utf8");
assert.match(mainSource, /projectCodePrefixes: settings\.locations\.projectCodePrefixes/);
assert.match(mainSource, /projectRootNames: settings\.locations\.projectRootNames/);
assert.match(mainSource, /`Project scope: \$\{preview\.scope\}`/);

(async () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "excelsis-date-runtime-"));
  const bundled = path.join(fixture, "starter.exe");
  const runtimeRoot = path.join(fixture, "documents", "Assembly Date");
  fs.copyFileSync(helper, bundled);
  const external = await ensureDateAssemblyRuntime(bundled, runtimeRoot);
  assert.equal(external, path.join(runtimeRoot, "date-assembly-files.exe"));
  assert.deepEqual(fs.readFileSync(external), fs.readFileSync(bundled));
  const seededCheck = spawnSync(external, ["scope", assembly, JSON.stringify(hints), part], {
    encoding: "utf8", timeout: 10000, windowsHide: true,
  });
  assert.ifError(seededCheck.error);
  assert.equal(seededCheck.status, 0, seededCheck.stderr || seededCheck.stdout);
  assert.equal(JSON.parse(seededCheck.stdout).candidateInside, true);
  const initial = await fingerprintDateAssemblyRuntime(external);
  fs.writeFileSync(external, "edited external tool");
  assert.equal(await ensureDateAssemblyRuntime(bundled, runtimeRoot), external);
  assert.equal(fs.readFileSync(external, "utf8"), "edited external tool");
  assert.notEqual(await fingerprintDateAssemblyRuntime(external), initial);
  await assert.rejects(ensureDateAssemblyRuntime("relative", runtimeRoot), /absolute/);
  console.log("Assembly-date scope and external runtime preservation tests passed.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
