"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const root = path.resolve(__dirname, "..");
const output = path.resolve(process.argv[2] || path.join(root, "dist", "win-unpacked"));
const companySeed = process.argv[4] ? path.resolve(process.argv[4]) : "";
const resource = path.join(output, "resources");
const sha = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const read = (name) => fs.readFileSync(name);
const same = (source, packaged) => assert.equal(sha(read(packaged)), sha(read(source)), packaged);
const buildConfig = require("js-yaml").load(read(path.join(root, "electron-builder.yml")).toString("utf8"));
const { RUNTIME_FILES } = require(path.join(root, "cad-model-runtime-host.cjs"));
const scriptRule = buildConfig.extraResources.filter((rule) => rule.from === "scripts");
assert.equal(scriptRule.length, 1);
const scriptFiles = scriptRule[0].filter;
assert.equal(scriptFiles.length, 18);
assert.equal(new Set(scriptFiles).size, scriptFiles.length);
for (const file of scriptFiles) assert.match(file, /^(?:automation-defaults\/)?[A-Za-z0-9_.-]+$/);
const cadRule = buildConfig.extraResources.filter((rule) => rule.from === "cad-model-runtime");
assert.equal(cadRule.length, 1);
assert.equal(cadRule[0].to, "cad-model-runtime");
assert.deepEqual(cadRule[0].filter.slice().sort(), RUNTIME_FILES.slice().sort());

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
  const folders = ["scripts", "scripts/automation-defaults", "cad-model-runtime", "macros", "build", "licenses"];
  let companyFiles = [];
  if (companySeed) {
    const { readManifest, readCompanySettings, validateCatalogue } = require("../company-seed.cjs");
    const manifest = await readManifest(companySeed);
    assert.ok(manifest, "Company seed manifest missing");
    await readCompanySettings(companySeed, { documents: "C:\\Profile\\Documents", desktop: "C:\\Profile\\Desktop", downloads: "C:\\Profile\\Downloads" });
    validateCatalogue(manifest, JSON.parse(read(path.join(companySeed, "recent-docs.json"))), JSON.parse(read(path.join(companySeed, "index.json"))));
    for (const [name, item] of Object.entries(manifest.files)) {
      const bytes = read(path.join(companySeed, name));
      assert.equal(bytes.length, item.bytes, name);
      assert.equal(sha(bytes), item.sha256, name);
    }
    companyFiles = ["manifest.json", ...Object.keys(manifest.files)];
    folders.push("company-seed");
    if (companyFiles.some(name => name.startsWith("thumbnails/"))) folders.push("company-seed/thumbnails");
  }
  let external = 0;
  for (const folder of folders) {
    const expected = folder.startsWith("company-seed")
      ? companyFiles.filter(name => path.posix.dirname(`company-seed/${name}`) === folder).map(name => path.posix.basename(name))
      : folder.startsWith("scripts")
      ? scriptFiles.filter((name) => path.posix.dirname(`scripts/${name}`) === folder).map((name) => path.posix.basename(name))
      : folder === "cad-model-runtime" ? RUNTIME_FILES.slice()
      : fs.readdirSync(path.join(root, folder), { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => folder === "macros" ? name.endsWith(".swp")
        : folder === "build" ? ["icon.ico", "icon-256.png"].includes(name)
          : true);
    const entries = fs.readdirSync(path.join(resource, folder), { withFileTypes: true });
    assert.deepEqual(entries.filter((entry) => !entry.isFile()).map((entry) => entry.name).sort(),
      folder === "scripts" ? ["automation-defaults"]
        : folder === "company-seed" && folders.includes("company-seed/thumbnails") ? ["thumbnails"] : [], `${folder} contains an unexpected resource directory`);
    const actual = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
    assert.deepEqual(actual.sort(), expected.sort(), `${folder} contains unexpected or missing resources`);
    for (const name of expected) {
      const source = folder.startsWith("company-seed") ? path.join(companySeed, folder.slice("company-seed".length), name) : path.join(root, folder, name);
      same(source, path.join(resource, folder, name)); external++;
    }
  }
  same(path.join(root, "LICENSE"), path.join(resource, "LICENSE.txt"));
  same(path.join(root, "THIRD_PARTY_NOTICES.md"), path.join(resource, "THIRD_PARTY_NOTICES.md"));
  assert.deepEqual(fs.readdirSync(resource).sort(),
    ["app.asar", "app.asar.unpacked", "elevate.exe", ...buildConfig.extraResources.map((rule) => rule.to), ...(companySeed ? ["company-seed"] : [])].sort(),
    "Unexpected or missing top-level resource; presets and development helpers must stay external");
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
    installerPayloadFiles, privateSettingsEmbedded: Boolean(companySeed), companySeedFiles: companyFiles.length,
    compilerPackaged: false, matching: true }, null, 2));
})().catch((error) => { console.error(error); process.exitCode = 1; });
