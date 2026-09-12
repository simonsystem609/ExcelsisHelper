"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const main = read("main.cjs");
const vbs = read("scripts/capture-sw-viewport.vbs");
const ps = read("scripts/capture-sw-viewport.ps1");
const procedure = (name) => {
  const match = main.match(new RegExp(`^(?:async )?function ${name}\\([^]*?^\\}`, "m"));
  assert.ok(match, name);
  return match[0];
};

assert.doesNotMatch(vbs, /OpenDoc|ActivateDoc|ShowNamedView|ViewZoom|ClearSelection|GraphicsRedraw|SetUserPreference|CopyFromScreen|PrintWindow/i);
assert.match(vbs, /doc\.SaveBMP\(outputPath, 0, 0\)/);
assert.match(vbs, /PathKey\(activePath\) <> PathKey\(wantedPath\)/);
assert.match(ps, /WaitForExit\(10000\)/);
assert.match(ps, /ProcessPriorityClass\]::Normal/);
assert.match(ps, /set-ecoqos\.ps1/);
assert.match(ps, /DrawImage\(\$bitmap, 0, 0, \$width, \$height\)/);
assert.equal((main.match(/pathToFileURL\(thumbState\.path\)/g) || []).length, 2, "Both document lists display the manual cache path.");

const win = path.win32;
const cache = "C:\\test\\thumbs";
const canonical = win.join(cache, `${"a".repeat(20)}.png`);
const manual = `${canonical}.manual.png`;
const staging = win.join(cache, "viewport-staging", "viewport-capture.png");
const doc = "C:\\Mock\\assembly.SLDASM";
function harness(files = new Map([[canonical, "old embedded"]])) {
  const state = { files, calls: [], gates: [], runs: 0, macro: false, result: { ok: true }, delayed: false, scans: 0 };
  const sandbox = {
    path: win, Date, Map, Set,
    fs: {
      readdir: async () => { state.scans++; return [...files.keys()].filter((p) => win.dirname(p) === cache).map((p) => win.basename(p)); },
      stat: async (p) => { if (!files.has(p)) throw new Error("missing"); return { size: files.get(p).length, mtimeMs: files.get(p).length }; },
      readFile: async (p) => { if (!files.has(p)) throw new Error("missing"); return files.get(p); },
      mkdir: async () => {},
      copyFile: async (a, b) => files.set(b, files.get(a)),
      rename: async (a, b) => { if (state.renameError) throw new Error("locked cache"); files.set(b, files.get(a)); files.delete(a); },
    },
    isBlankThumbnailBuffer: (value) => value === "blank",
    recentDocsThumbDir: () => cache,
    thumbPathForDoc: () => canonical,
    pathExists: async (p) => files.has(p),
    isMacroRecentDocSuppressionActive: async () => state.macro || state.runs > 0,
    beginHelperMacroRun: () => state.runs++,
    endHelperMacroRun: () => state.runs--,
    publishMacroRunWatcherGate: async (active) => state.gates.push(active),
    hiddenPowerShellArgs: (...args) => args,
    assetPath: (...args) => win.join("C:\\test", ...args),
    POWERSHELL_EXE: "powershell.exe",
    automationMacroRunMarkerPath: () => "C:\\test\\marker.json",
    execFile: (exe, args, options, done) => {
      state.calls.push({ exe, args, options });
      const finish = () => { if (state.result.ok) files.set(staging, state.image || "fresh viewport"); done(state.execError, JSON.stringify(state.result)); };
      if (state.delayed) state.finish = finish; else finish();
    },
    thumbRetryState: new Map(), clearThumbnailRetryTimer: () => {},
    sendAutomationRendererEvent: () => {},
    THUMB_BATCH_FILE_LIMIT: 32, THUMB_MAX_ATTEMPTS: 3,
    thumbsInProgress: new Set(),
    queueThumbnailExtraction: () => { throw new Error("Manual capture must bypass background queue."); },
    runEmbeddedPreviewBatch: () => { throw new Error("Manual thumbnail must not be replaced by background extraction."); },
  };
  vm.createContext(sandbox);
  vm.runInContext(`const blankThumbVerdictCache = new Map();
    const manualViewportThumbPaths = new Set(); let manualViewportThumbsLoaded = null;
    let manualViewportCaptureInProgress = false;
    ${["loadManualViewportThumbnails", "readThumbnailState", "readThumbnailFileState", "scheduleSingleDocThumbnailRetry", "runThumbnailExtractionBatch"].map(procedure).join("\n")}`, sandbox);
  return { state, sandbox };
}

async function testMain() {
  const { state, sandbox } = harness();
  assert.equal((await sandbox.scheduleSingleDocThumbnailRetry(doc)).viewportOnly, true);
  assert.equal(state.files.get(canonical), "old embedded");
  assert.equal(state.files.get(manual), "fresh viewport");
  assert.equal(state.calls.length, 1);
  assert.equal(state.calls[0].options.timeout, 20000);
  assert.deepEqual(state.gates, [true, false]);
  assert.equal(state.runs, 0);
  assert.equal((await sandbox.readThumbnailState(canonical)).path, manual);
  await sandbox.runThumbnailExtractionBatch([{ path: doc }], { force: true });
  assert.equal(state.calls.length, 1, "Bulk force retry skips a manual capture.");

  state.result = { ok: false, error: "wrong active doc" };
  assert.equal((await sandbox.scheduleSingleDocThumbnailRetry(doc)).ok, false);
  assert.equal(state.files.get(manual), "fresh viewport");
  state.result = { ok: true }; state.image = "new viewport";
  await sandbox.scheduleSingleDocThumbnailRetry(doc);
  assert.equal(state.files.get(manual), "new viewport");
  assert.ok([...state.files.keys()].some((p) => p.endsWith(".previous")), "Previous manual capture is retained.");
  state.renameError = true;
  assert.equal((await sandbox.scheduleSingleDocThumbnailRetry(doc)).ok, false);
  assert.equal(state.files.get(manual), "new viewport");
  assert.equal(state.runs, 0);

  const restart = harness(state.files);
  assert.equal((await restart.sandbox.readThumbnailState(canonical)).manual, true, "Manual preference survives restart.");
  await restart.sandbox.readThumbnailState(canonical);
  assert.equal(restart.state.scans, 1, "No repeating directory scan.");

  const concurrent = harness();
  concurrent.state.delayed = true;
  const first = concurrent.sandbox.scheduleSingleDocThumbnailRetry(doc);
  for (let i = 0; i < 15 && !concurrent.state.finish; i++) await Promise.resolve();
  assert.ok(concurrent.state.finish);
  assert.equal((await concurrent.sandbox.scheduleSingleDocThumbnailRetry(doc)).ok, false);
  assert.equal(concurrent.state.calls.length, 1);
  concurrent.state.finish(); await first;
  concurrent.state.macro = true;
  assert.equal((await concurrent.sandbox.scheduleSingleDocThumbnailRetry(doc)).ok, false);
  assert.equal((await concurrent.sandbox.scheduleSingleDocThumbnailRetry("C:\\Mock\\part.step")).ok, false);
  assert.equal(concurrent.state.calls.length, 1);
}

function testWindowsScripts() {
  if (process.platform !== "win32") return;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "excelsis-viewport-tests-"));
  const mock = `
Class MockDrives
  Public Count
  Private Sub Class_Initialize(): Count = 2: End Sub
  Function Item(i)
    If i = 0 Then Item = "Y:" Else Item = "\\\\server\\share"
  End Function
End Class
Class MockNetwork
  Function EnumNetworkDrives(): Set EnumNetworkDrives = New MockDrives: End Function
End Class
Class MockDoc
  Public FilePath
  Function GetPathName(): GetPathName = FilePath: End Function
  Function SaveBMP(p, width, height)
    WScript.StdOut.WriteLine "viewport:" & width & "," & height
    SaveBMP = (WScript.Arguments(2) <> "fail")
  End Function
End Class
Class MockSW
  Private reads
  Public Property Get ActiveDoc
    reads = reads + 1
    If WScript.Arguments(2) = "nodoc" Then Set ActiveDoc = Nothing: Exit Property
    Dim d: Set d = New MockDoc
    d.FilePath = "C:\\Mock\\assembly.SLDASM"
    If WScript.Arguments(2) = "alias" Then d.FilePath = "\\\\server\\share\\assembly.SLDASM"
    If reads > 1 And WScript.Arguments(2) = "changed" Then d.FilePath = "C:\\Mock\\other.SLDASM"
    Set ActiveDoc = d
  End Property
End Class
Function MockConnection()
  If WScript.Arguments(2) = "nosw" Then Set MockConnection = Nothing Else Set MockConnection = New MockSW
End Function
`;
  const substituted = vbs.replace("Arguments.Count <> 2", "Arguments.Count <> 3")
    .replace('CreateObject("WScript.Network")', "New MockNetwork")
    .replace('GetObject(, "SldWorks.Application")', "MockConnection()");
  assert.doesNotMatch(substituted, /SldWorks\.Application/i, "Tests must never bind live SOLIDWORKS.");
  const script = path.join(dir, "capture-mock.vbs");
  fs.writeFileSync(script, substituted + mock);
  for (const [mode, wanted, code] of [
    ["ok", doc, 0], ["alias", "Y:\\assembly.SLDASM", 0], ["wrong", "C:\\Mock\\other.SLDPRT", 5],
    ["fail", doc, 6], ["changed", doc, 7], ["nodoc", doc, 3], ["nosw", doc, 2],
  ]) {
    const run = spawnSync("cscript.exe", ["//NoLogo", script, wanted, path.join(dir, "unused.bmp"), mode], { encoding: "utf8", timeout: 10000, windowsHide: true });
    assert.equal(run.status, code, `${mode}: ${run.stdout}\n${run.stderr}`);
    if (code === 0) assert.match(run.stdout, /viewport:0,0/);
    if ([2, 3, 5].includes(code)) assert.doesNotMatch(run.stdout, /viewport:/);
  }

  const quoted = (p) => `'${p.replace(/'/g, "''")}'`;
  const conversion = ps.slice(ps.indexOf("  $info = Get-Item"), ps.indexOf("  [ordered]@{ ok = $true"));
  const conversionTest = path.join(dir, "bitmap-test.ps1");
  fs.writeFileSync(conversionTest, `$ErrorActionPreference = 'Stop'
    Add-Type -AssemblyName System.Drawing
    $bitmapPath = ${quoted(path.join(dir, "fixture.bmp"))}
    $OutputPng = ${quoted(path.join(dir, "capture.png"))}
    $Size = 256
    $fixture = New-Object System.Drawing.Bitmap -ArgumentList 800, 400
    $g = [System.Drawing.Graphics]::FromImage($fixture)
    $g.Clear([System.Drawing.Color]::White)
    $g.FillRectangle([System.Drawing.Brushes]::Red, 0, 0, 80, 400)
    $g.FillRectangle([System.Drawing.Brushes]::Blue, 720, 0, 80, 400)
    $fixture.Save($bitmapPath, [System.Drawing.Imaging.ImageFormat]::Bmp)
    $g.Dispose(); $fixture.Dispose()
    ${conversion}
    $result = [System.Drawing.Bitmap]::FromFile($OutputPng)
    if ($result.Width -ne 256 -or $result.Height -ne 128) { throw 'Aspect ratio changed' }
    if ($result.GetPixel(5,64).R -lt 240 -or $result.GetPixel(250,64).B -lt 240) { throw 'Viewport edges cropped' }
    $result.Dispose()
    'Viewport conversion preserves framing and aspect ratio.'
  `);
  const run = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", conversionTest], { encoding: "utf8", timeout: 15000, windowsHide: true });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  fs.writeFileSync(path.join(dir, "empty-batch.json"), "[]");
  const batch = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", path.join(root, "scripts/extract-sw-thumbnails.ps1"), "-InputJson", path.join(dir, "empty-batch.json")], { encoding: "utf8", timeout: 15000, windowsHide: true });
  assert.equal(batch.status, 0, batch.stdout + batch.stderr);
  assert.equal(JSON.parse(batch.stdout).results.length, 0);
}

testMain().then(() => {
  testWindowsScripts();
  console.log("Manual viewport framing, failure safety, single-flight, persistence and background isolation passed.");
}).catch((error) => { console.error(error); process.exitCode = 1; });
