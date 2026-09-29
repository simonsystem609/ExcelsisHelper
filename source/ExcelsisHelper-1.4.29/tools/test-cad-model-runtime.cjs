"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { RUNTIME_FILES, ensureCadModelRuntime, loadCadModelRuntime } = require("../cad-model-runtime-host.cjs");

(async () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "excelsis-cad-runtime-"));
  const bundled = path.join(fixture, "bundle");
  const external = path.join(fixture, "documents", "CAD Model Export");
  fs.mkdirSync(bundled);
  for (const fileName of RUNTIME_FILES) {
    fs.writeFileSync(path.join(bundled, fileName), fileName === "cad-model-workflow.cjs"
      ? 'module.exports = { exportActiveCadModel: async () => "v1" };\n'
      : `fixture:${fileName}\n`);
  }

  assert.equal(await ensureCadModelRuntime(bundled, external), external);
  for (const fileName of RUNTIME_FILES) {
    assert.deepEqual(fs.readFileSync(path.join(external, fileName)),
      fs.readFileSync(path.join(bundled, fileName)));
  }
  const workflow = path.join(external, "cad-model-workflow.cjs");
  fs.writeFileSync(workflow, 'module.exports = { exportActiveCadModel: async () => "edited" };\n');
  await ensureCadModelRuntime(bundled, external);
  assert.match(fs.readFileSync(workflow, "utf8"), /edited/);

  const loaded = await loadCadModelRuntime(external);
  assert.equal(await loaded.exportActiveCadModel(), "edited");
  await loaded.verifyUnchanged();
  fs.writeFileSync(path.join(external, "export-active-glb.vbs"), "changed during run\n");
  await assert.rejects(loaded.verifyUnchanged(), /changed during export: export-active-glb\.vbs/);

  fs.writeFileSync(workflow, 'module.exports = { exportActiveCadModel: async () => "next-run" };\n');
  const reloaded = await loadCadModelRuntime(external);
  assert.equal(await reloaded.exportActiveCadModel(), "next-run");
  await reloaded.verifyUnchanged();
  await assert.rejects(loaded.verifyUnchanged(), /changed during export/);

  await assert.rejects(ensureCadModelRuntime("relative", external), /absolute paths/);
  const malformed = path.join(fixture, "malformed");
  fs.mkdirSync(malformed);
  fs.mkdirSync(path.join(malformed, "export-active-glb.vbs"));
  await assert.rejects(ensureCadModelRuntime(bundled, malformed), /regular file/);
  assert.ok((await fsp.stat(malformed)).isDirectory());
  const realRuntime = path.join(fixture, "real-runtime");
  await ensureCadModelRuntime(path.join(__dirname, "..", "cad-model-runtime"), realRuntime);
  const realLoaded = await loadCadModelRuntime(realRuntime);
  assert.equal(typeof realLoaded.exportActiveCadModel, "function");
  await realLoaded.verifyUnchanged();
  console.log("External CAD runtime install, preservation, reload, mutation gate and file checks passed.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
