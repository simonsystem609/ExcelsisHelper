"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { Readable } = require("node:stream");
const { spawn, spawnSync } = require("node:child_process");
const { EventEmitter } = require("node:events");
const https = require("node:https");
const protocol = require("../update-releases.cjs");
const { createUpdateService, githubTransport, boundedBody, RECEIPT } = require("../update-service.cjs");
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const root = path.resolve(__dirname, "..");
const version = "1.4.37";
const swpNames = ["DXF_v16.swp", "DXF_v16_ROfriendy.swp"];
const oldBytes = Buffer.alloc(512, 1);
const newBytes = Buffer.alloc(512, 2);
for (const bytes of [oldBytes, newBytes]) Buffer.from("d0cf11e0a1b11ae1", "hex").copy(bytes);
const installer = Buffer.alloc(1024 * 1024, 7);
installer.write("MZ");

function asset(repo, tag, name, bytes) {
  return { name, state: "uploaded", size: bytes.length, digest: `sha256:${hash(bytes)}`,
    browser_download_url: `https://github.com/simonsystem609/${repo}/releases/download/${tag}/${encodeURIComponent(name)}` };
}
function appRelease(key, value) {
  const item = protocol.product(key), label = value + (key === "helper" ? "-public.1" : ""), tag = item.prefix + label;
  return { tag_name: tag, draft: false, prerelease: false, immutable: true,
    html_url: `https://github.com/simonsystem609/${item.repository}/releases/tag/${tag}`,
    assets: [asset(item.repository, tag, item.installer(label), installer)] };
}
function macroRelease(revision = "20261026.1", helper = version) {
  const tag = `excelsis-helper-macros-${helper}-${revision}`;
  const files = [...swpNames.map(name => asset("ExcelsisHelper", tag, name, newBytes)),
    ...swpNames.map(name => asset("ExcelsisHelper", tag, name.replace(".swp", ".swb"), Buffer.alloc(64, 1))),
    ...["MACRO-REVISION.json", "SHA256SUMS.txt"].map(name => asset("ExcelsisHelper", tag, name, Buffer.alloc(64, 1)))];
  return { tag_name: tag, draft: false, prerelease: true, immutable: true,
    html_url: `https://github.com/simonsystem609/ExcelsisHelper/releases/tag/${tag}`, assets: files };
}
function stream(bytes, length = bytes.length) {
  const result = Readable.from([bytes.subarray(0, 100), bytes.subarray(100)]);
  result.headers = length === null ? {} : { "content-length": String(length) };
  result.statusCode = 200;
  return result;
}

async function fixture() {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), "helper-update-tests-"));
  const documents = path.join(folder, "Documents"), macros = path.join(documents, "Excelsis Helper", "Macros");
  await fs.mkdir(macros, { recursive: true });
  await fs.writeFile(path.join(macros, ".bundled-macros.json"), JSON.stringify({ schema: "excelsis-bundled-macros-v2", appVersion: version, files: swpNames }));
  await fs.writeFile(path.join(macros, "ExcelsisHelper-settings.json"), "untouched macro settings");
  await fs.writeFile(path.join(documents, "Excelsis Helper", "settings.json"), "untouched personal settings");
  await fs.writeFile(path.join(documents, "Excelsis Helper", "project-activity.json"), "untouched activity");
  for (const name of swpNames) await fs.writeFile(path.join(macros, name), oldBytes);
  const state = { viewerVersion: "1.1.49", confirm: true, retry: false, macroBusy: false, metadata: [], streams: [], prompts: [], opened: [], applies: 0, progress: [],
    viewerRelease: appRelease("viewer", "1.1.50"), helperRelease: appRelease("helper", version), macroReleases: [macroRelease()] };
  const transport = {
    async json(url) {
      state.metadata.push(url);
      if (state.error) throw new Error(state.error);
      if (url === protocol.apiUrl("viewer")) return structuredClone(state.viewerRelease);
      if (url === protocol.apiUrl("helper")) return structuredClone(state.helperRelease);
      if (url === protocol.apiUrl("helper", true)) return structuredClone(state.macroReleases);
      throw new Error("Unexpected endpoint");
    },
    async stream(url) { state.streams.push(url); if (state.beforeStream) await state.beforeStream(url); return state.badStream ? state.badStream(url) : stream(url.endsWith(".exe") ? installer : newBytes); },
  };
  const options = { version, documents, downloads: path.join(folder, "Downloads"), stagingRoot: path.join(folder, "staging"), transport,
    readInstalledVersion: async () => state.viewerVersion,
    confirm: async request => { state.prompts.push(request); return state.confirm; },
    retryLocked: async () => state.retry,
    isMacroBusy: async () => state.macroBusy,
    openInstaller: async file => { state.opened.push(file); return ""; },
    applyMacros: async request => {
      state.applies++;
      if (state.applyOverride) return state.applyOverride(request);
      return nativeApply(request, documents);
    },
    onProgress: event => state.progress.push(event),
  };
  return { folder, documents, macros, state, options, service: createUpdateService(options) };
}

function nativeApply(request, documents, script = path.join(root, "scripts", "apply-macro-update.ps1")) {
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script,
    "-RequestPath", request.requestPath, "-RequestSha256", request.requestSha256, "-DocumentsPath", documents],
  { windowsHide: true, encoding: "utf8", timeout: 30000, maxBuffer: 128 * 1024 });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return JSON.parse(result.stdout.replace(/^\uFEFF/, ""));
}

async function verifyOriginals(f) {
  for (const name of swpNames) assert.equal(hash(await fs.readFile(path.join(f.macros, name))), hash(oldBytes));
  assert.equal(await fs.readFile(path.join(f.macros, "ExcelsisHelper-settings.json"), "utf8"), "untouched macro settings");
  assert.equal(await fs.readFile(path.join(f.documents, "Excelsis Helper", "project-activity.json"), "utf8"), "untouched activity");
}

async function run() {
  for (const [a, b, expected] of [["1.4.9", "1.4.10", -1], [version, version, 0], ["1.4.38", version, 1], ["1.4.37-beta.1", version, null], ["01.4.37", version, null], ["garbage", version, null]]) assert.equal(protocol.compareVersions(a, b), expected);
  for (const key of ["__proto__", "constructor", "https://evil.invalid", "macros"]) assert.throws(() => protocol.product(key), /Unknown/);
  assert.equal(protocol.versionStatus(null, version), "not-installed");
  assert.equal(protocol.appRelease("helper", appRelease("helper", version)).version, version);
  const badApps = [
    release => { release.immutable = false; }, release => { release.prerelease = true; }, release => { release.draft = true; },
    release => { release.assets[0].digest = "sha256:bad"; }, release => { release.assets[0].size = 2; },
    release => { release.assets[0].browser_download_url += "?x=1"; },
    release => { release.assets[0].browser_download_url = release.assets[0].browser_download_url.replace("ExcelsisViewer", "Unrelated"); },
    release => { release.assets.push({ ...release.assets[0] }); }, release => { release.html_url += "?x=1"; },
    release => { release.tag_name = "excelsis-view-v1.1.50-candidate.1"; },
  ];
  for (const mutate of badApps) { const release = appRelease("viewer", "1.1.50"); mutate(release); assert.throws(() => protocol.appRelease("viewer", release)); }
  for (const value of ["https://github.com.evil.invalid/file", "http://github.com/file", "https://user@github.com/file", "https://github.com:443/file", "file:///C:/bad.exe"]) {
    if (value.includes(":443")) continue; // URL canonicalization removes the default HTTPS port.
    assert.equal(protocol.downloadHost(value), false);
  }
  assert.equal(protocol.latestMacros([macroRelease("20261026.1", "1.4.36")], version), null);
  assert.equal(protocol.latestMacros([macroRelease("20261025.1"), macroRelease("20261026.2"), macroRelease("20261026.1")], version).revision, "20261026.2");
  assert.equal(protocol.macroTag(`excelsis-helper-macros-${version}-20260231.1`), null);
  for (const mutate of [release => { release.immutable = false; }, release => { release.assets.pop(); }, release => { release.assets.push(release.assets[0]); },
    release => { release.assets[0].name = "../DXF_v16.swp"; }, release => { release.assets.splice(2, 1); }]) {
    const release = macroRelease(); mutate(release); assert.throws(() => protocol.macroRelease(release));
  }

  let f = await fixture();
  const [a, b] = await Promise.all([f.service.check(), f.service.check()]);
  assert.equal(a.hasUpdates, true); assert.deepEqual(a, b);
  assert.equal(f.state.metadata.length, 3); assert.equal(f.state.streams.length, 0); assert.equal(f.state.prompts.length, 0); assert.equal(f.state.applies, 0); assert.equal(f.state.opened.length, 0);
  await f.service.check(); assert.equal(f.state.metadata.length, 3, "Passive status checks must use the six-hour cache");
  await verifyOriginals(f);
  f.state.confirm = false;
  assert.equal((await f.service.install("viewer")).cancelled, true);
  assert.equal((await f.service.install("macros")).cancelled, true);
  assert.equal(f.state.streams.length, 0); await verifyOriginals(f);

  f = await fixture();
  f.state.macroReleases = []; f.state.viewerVersion = null;
  let catalog = await f.service.check();
  assert.equal(catalog.hasUpdates, false, "A missing optional Viewer alone is not an update notification");
  assert.equal(catalog.products[0].canInstall, true);
  f.state.viewerVersion = "1.1.51";
  await assert.rejects(f.service.install("viewer"), /current, newer/);
  f.state.error = "Offline";
  f.service = createUpdateService(f.options);
  catalog = await f.service.check();
  assert.equal(catalog.hasUpdates, false);
  assert.ok(catalog.products.every(row => row.status === "unknown" && !row.canInstall));

  f = await fixture();
  await fs.mkdir(f.options.downloads);
  const originalInstaller = path.join(f.options.downloads, f.state.viewerRelease.assets[0].name);
  await fs.writeFile(originalInstaller, "unrelated existing file");
  let result = await f.service.install("viewer");
  assert.equal(result.ok, true); assert.ok(result.path.endsWith(" (1).exe")); assert.equal(f.state.opened.length, 1);
  assert.equal(await fs.readFile(originalInstaller, "utf8"), "unrelated existing file");
  assert.equal(hash(await fs.readFile(result.path)), hash(installer));
  await f.service.install("viewer"); assert.equal(f.state.streams.length, 1, "A verified installer can be reused without another download");
  assert.equal((await fs.readdir(f.options.downloads)).some(name => name.endsWith(".part")), false);
  f = await fixture();
  f.state.helperRelease = appRelease("helper", "1.4.38");
  assert.equal((await f.service.install("helper")).ok, true);
  await assert.rejects(f.service.install("macros"), /Finish the Helper installer/);
  await assert.rejects(f.service.install("helper"), /already opened/);
  assert.equal((await f.service.check()).macros.status, "requires-restart");
  for (const bad of [() => stream(Buffer.alloc(installer.length, 3)), () => stream(installer.subarray(0, 100)),
    () => stream(Buffer.concat([installer, Buffer.from("extra")]), null), () => stream(installer, 5)]) {
    f = await fixture(); f.state.badStream = bad;
    await assert.rejects(f.service.install("viewer"));
    assert.equal(f.state.opened.length, 0);
    assert.deepEqual(await fs.readdir(f.options.downloads), []);
  }
  f = await fixture();
  f.state.beforeStream = () => f.service.cancel();
  await assert.rejects(f.service.install("viewer"), /cancelled/);
  assert.equal(f.state.opened.length, 0);
  f = await fixture();
  f.state.macroBusy = true;
  await assert.rejects(f.service.install("macros"), /running/);
  assert.equal(f.state.streams.length, 0);

  if (process.platform === "win32") {
    f = await fixture();
    const beforeMarker = hash(await fs.readFile(path.join(f.macros, ".bundled-macros.json")));
    result = await f.service.install("macros");
    assert.equal(result.ok, true); assert.deepEqual(result.updated.slice().sort(), swpNames.slice().sort());
    for (const name of swpNames) {
      assert.equal(hash(await fs.readFile(path.join(f.macros, name))), hash(newBytes));
      assert.equal(hash(await fs.readFile(path.join(result.backupFolder, name))), hash(oldBytes));
    }
    assert.equal(hash(await fs.readFile(path.join(f.macros, ".bundled-macros.json"))), beforeMarker);
    assert.equal(await fs.readFile(path.join(f.documents, "Excelsis Helper", "settings.json"), "utf8"), "untouched personal settings");
    assert.equal(JSON.parse(await fs.readFile(path.join(f.macros, RECEIPT), "utf8")).revision, "20261026.1");
    assert.ok(f.state.progress.every((event, i, list) => !i || event.percent >= list[i - 1].percent), "Multi-file progress never runs backwards");
    assert.equal((await f.service.install("macros")).alreadyCurrent, true);
    f.state.macroReleases = [macroRelease("20261025.1")];
    await assert.rejects(f.service.install("macros"), /downgrade/);

    f = await fixture();
    const previousReceipt = JSON.stringify({ schema: "excelsis-helper-macro-update-v1", helperVersion: version,
      revision: "20261025.1", tag: `excelsis-helper-macros-${version}-20261025.1` });
    await fs.writeFile(path.join(f.macros, RECEIPT), previousReceipt);
    result = await f.service.install("macros");
    assert.equal(result.ok, true);
    assert.equal(await fs.readFile(path.join(result.backupFolder, "previous-receipt.json"), "utf8"), previousReceipt);
    assert.equal(JSON.parse(await fs.readFile(path.join(f.macros, RECEIPT), "utf8")).revision, "20261026.1");

    f = await fixture(); f.state.retry = false;
    f.state.applyOverride = () => ({ ok: false, code: "locked", error: "simulated sharing violation" });
    assert.equal((await f.service.install("macros")).deferred, true); await verifyOriginals(f);
    f = await fixture(); f.state.retry = true;
    f.state.applyOverride = request => f.state.applies === 1 ? { ok: false, code: "locked", error: "sharing violation" } : nativeApply(request, f.documents);
    assert.equal((await f.service.install("macros")).ok, true); assert.equal(f.state.applies, 2);

    f = await fixture();
    const source = await fs.readFile(path.join(root, "scripts", "apply-macro-update.ps1"), "utf8");
    const changed = source.replace("Write-Held $record.stream $record.after", "if ($record.name -eq 'DXF_v16_ROfriendy.swp') { throw 'injected second-write failure' }; Write-Held $record.stream $record.after");
    assert.notEqual(changed, source);
    const faultScript = path.join(f.folder, "fault-transaction.ps1");
    await fs.writeFile(faultScript, changed);
    f.state.applyOverride = request => nativeApply(request, f.documents, faultScript);
    await assert.rejects(f.service.install("macros"), /injected/); await verifyOriginals(f);
    const receiptExists = await fs.access(path.join(f.macros, RECEIPT)).then(() => true, () => false);
    assert.equal(receiptExists, false);

    f = await fixture();
    let changedOnce = false;
    f.state.beforeStream = async () => { if (!changedOnce) { changedOnce = true; await fs.writeFile(path.join(f.macros, swpNames[0]), Buffer.alloc(512, 9)); } };
    await assert.rejects(f.service.install("macros"), /changed since/);
    assert.equal(hash(await fs.readFile(path.join(f.macros, swpNames[0]))), hash(Buffer.alloc(512, 9)), "Do not roll back a user's concurrent edit");
    assert.equal(hash(await fs.readFile(path.join(f.macros, swpNames[1]))), hash(oldBytes));

    f = await fixture();
    const held = path.join(f.folder, "held"), release = path.join(f.folder, "release");
    const holder = path.join(f.folder, "holder.ps1");
    await fs.writeFile(holder, `param($Target,$Ready,$Release)\n$s=[IO.File]::Open($Target,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)\ntry { [IO.File]::WriteAllText($Ready,'ready'); $stop=[DateTime]::UtcNow.AddSeconds(30); while(-not(Test-Path -LiteralPath $Release) -and [DateTime]::UtcNow -lt $stop){Start-Sleep -Milliseconds 50} } finally { $s.Dispose() }\n`);
    const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", holder, "-Target", path.join(f.macros, swpNames[1]), "-Ready", held, "-Release", release], { windowsHide: true, stdio: "ignore" });
    const exited = new Promise(resolve => child.once("exit", resolve));
    try {
      for (let attempt = 0; ; attempt++) {
        if (await fs.access(held).then(() => true, () => false)) break;
        if (attempt > 100) throw new Error("Disposable file lock did not become ready.");
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      // Install needs a pre-lock snapshot; the child holds the second target
      // only when the verified native transaction attempts both exclusive opens.
      const requestDir = path.join(f.folder, "native-stage"); await fs.mkdir(requestDir);
      for (const name of swpNames) await fs.writeFile(path.join(requestDir, name), newBytes);
      const requestPath = path.join(requestDir, "request.json");
      const requestBytes = Buffer.from(JSON.stringify({ schema: "excelsis-helper-macro-request-v1", helperVersion: version, revision: "20261026.1",
        tag: `excelsis-helper-macros-${version}-20261026.1`, stagingRoot: requestDir,
        files: swpNames.map(name => ({ name, sha256: hash(newBytes), previousSha256: hash(oldBytes), size: newBytes.length })) }));
      await fs.writeFile(requestPath, requestBytes);
      const locked = nativeApply({ requestPath, requestSha256: hash(requestBytes) }, f.documents);
      assert.equal(locked.ok, false); assert.equal(locked.code, "locked");
      assert.equal(hash(await fs.readFile(path.join(f.macros, swpNames[0]))), hash(oldBytes), "First macro is untouched when second is locked");
    } finally { await fs.writeFile(release, "release"); await exited; }
    await verifyOriginals(f);
  }

  const originalGet = https.get;
  let requests = 0;
  https.get = (_url, _options, callback) => {
    requests++;
    const req = new EventEmitter(); req.destroy = () => {};
    queueMicrotask(() => { const response = stream(Buffer.alloc(0)); response.statusCode = 302; response.headers.location = "https://evil.invalid/installer.exe"; callback(response); });
    return req;
  };
  try {
    await assert.rejects(githubTransport(version).stream("https://github.com/simonsystem609/ExcelsisViewer/releases/download/v/test.exe"), /Unapproved/);
    assert.equal(requests, 1);
    await assert.rejects(githubTransport(version).json("https://evil.invalid/metadata"), /Unapproved/);
  } finally { https.get = originalGet; }
  await assert.rejects(boundedBody(stream(Buffer.alloc(100), null), 99), /exceeded/);
  console.log("Update protocol/service passed: public immutable feeds, exact assets, version/downgrade guards, quiet cached checks, opt-in installs, verified non-overwriting downloads, macro compatibility, atomic file locks, backup/read-back, rollback, concurrent edits and Retry/Later. No live updater or SOLIDWORKS calls.");
}

run().catch(error => { console.error(error); process.exitCode = 1; });
