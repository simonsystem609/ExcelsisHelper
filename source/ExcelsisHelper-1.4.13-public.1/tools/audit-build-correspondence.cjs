"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const root = path.resolve(__dirname, "..");
const output = path.resolve(process.argv[2] || path.join(root, "dist", "win-unpacked"));
const resource = path.join(output, "resources");
const sha = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const read = (name) => fs.readFileSync(name);
const same = (source, packaged) => assert.equal(sha(read(packaged)), sha(read(source)), packaged);

(async () => {
  const asar = await import("@electron/asar");
  const archive = path.join(resource, "app.asar");
  let authored = 0;
  const pkg = JSON.parse(read(path.join(root, "package.json")));
  for (const item of asar.listPackage(archive)) {
    const name = item.replace(/^[\\/]+/, "").replace(/\\/g, "/");
    const archiveName = path.normalize(name);
    const info = asar.statFile(archive, archiveName);
    if (info.files) continue;
    assert.doesNotMatch(name, /(?:^|\/)(?:tools|node_modules|backups|tmp|dist)\/|settings.*\.json$|\.sw[bp]$/i);
    const bytes = asar.extractFile(archive, archiveName);
    if (name === "package.json") {
      const packed = JSON.parse(bytes);
      for (const field of ["name", "version", "main", "license"]) assert.equal(packed[field], pkg[field], field);
    } else {
      assert.equal(sha(bytes), sha(read(path.join(root, name))), name);
      authored++;
    }
    if (info.unpacked) same(path.join(root, name), path.join(resource, "app.asar.unpacked", name));
  }
  const folders = ["scripts", "scripts/automation-defaults", "macros", "build", "licenses"];
  let external = 0;
  for (const folder of folders) {
    const expected = fs.readdirSync(path.join(root, folder), { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => folder === "macros" ? name.endsWith(".swp")
        : folder === "build" ? ["icon.ico", "icon-256.png"].includes(name)
          : name !== "after-pack.cjs");
    const actual = fs.readdirSync(path.join(resource, folder), { withFileTypes: true })
      .filter((entry) => entry.isFile()).map((entry) => entry.name);
    assert.deepEqual(actual.sort(), expected.sort(), `${folder} contains unexpected or missing resources`);
    for (const name of expected) { same(path.join(root, folder, name), path.join(resource, folder, name)); external++; }
  }
  same(path.join(root, "LICENSE"), path.join(resource, "LICENSE.txt"));
  same(path.join(root, "THIRD_PARTY_NOTICES.md"), path.join(resource, "THIRD_PARTY_NOTICES.md"));
  for (const name of ["ExcelsisHelper-settings.json", "install-settings-preset.json", "macro-settings.json", "tools"]) {
    assert.equal(fs.existsSync(path.join(resource, name)), false, `${name} must remain external/private`);
  }
  assert.deepEqual(fs.readdirSync(path.join(output, "locales")).sort(), ["en-US.pak", "hu.pak"]);
  let installerPayloadFiles = null;
  if (process.argv[3]) {
    const payload = path.resolve(process.argv[3]);
    const directories = ["", "locales", "resources", "resources/app.asar.unpacked",
      "resources/app.asar.unpacked/machining-engine", "resources/app.asar.unpacked/machining-engine/schemas",
      ...folders.map((name) => `resources/${name}`)];
    const known = new Set(directories);
    installerPayloadFiles = 0;
    for (const folder of directories) {
      const builtFiles = fs.readdirSync(path.join(output, folder), { withFileTypes: true });
      const extractedNames = fs.readdirSync(path.join(payload, folder));
      assert.deepEqual(builtFiles.map((entry) => entry.name).sort(), extractedNames.sort(), folder);
      for (const entry of builtFiles) {
        const relative = folder ? `${folder}/${entry.name}` : entry.name;
        if (entry.isDirectory()) { assert.ok(known.has(relative), `Uninspected directory: ${relative}`); continue; }
        assert.ok(entry.isFile(), relative);
        same(path.join(output, relative), path.join(payload, relative));
        installerPayloadFiles++;
      }
    }
  }
  console.log(JSON.stringify({ version: pkg.version, authoredAsarFiles: authored, externalSourceFiles: external + 2,
    sourceMacros: fs.readdirSync(path.join(resource, "macros")).length,
    installerPayloadFiles, privateSettingsEmbedded: false, matching: true }, null, 2));
})().catch((error) => { console.error(error); process.exitCode = 1; });
