const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const scriptPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(root, "scripts", "solidworks-watcher.vbs");
const mainPath = process.argv[3]
  ? path.resolve(process.argv[3])
  : path.join(root, "main.cjs");
const script = fs.readFileSync(scriptPath, "utf8");
const main = fs.readFileSync(mainPath, "utf8");

assert.match(script, /Const OPEN_DOCUMENTS_PER_TICK = 2/);
assert.match(script, /default 2000/);
assert.match(script, /Sub ContinueOpenDocumentsSample\(\)/);
assert.match(script, /processed < OPEN_DOCUMENTS_PER_TICK/);
assert.match(script, /GetCachedOpenDocumentsJson\(\)/);
assert.doesNotMatch(script, /Function GetOpenDocumentsJson\(sw\)/);
assert.doesNotMatch(script, /Do While Not candidate Is Nothing/);
assert.match(main, /minForcedRestartGapMs:\s*60 \* 1000/);
assert.match(main, /now - helper\.startedAt < minForcedRestartGapMs/);
assert.match(script, /connectionErrorNumber = Err\.Number/);
assert.match(script, /connectionErrorDescription = Err\.Description/);
assert.match(script, /""connectionErrorNumber""/);
assert.match(script, /""connectionError""/);
assert.match(script, /Function IsMacroRunGateActive\(gatePath\)/);
assert.doesNotMatch(script, /winmgmts|ExecQuery|tasklist/i);
assert.match(script, /If macroRunning Then[\s\S]{0,800}Else[\s\S]{0,800}probe = sw\.Visible/);
assert.match(script, /If Not \(previousActiveDoc Is activeDoc\) Then/);
assert.match(main, /async function refreshDisconnectedSolidWorksProcessSnapshot/);
assert.match(main, /now - lastDisconnectedSolidWorksProcessPollAt >= SW_PROCESS_REFRESH_MS/);
assert.match(main, /if \(watcher && watcher\.connected\) \{\s*resetDisconnectedSolidWorksProcessSnapshot\(\)/);
const heartbeat = main.match(/async function solidWorksHeartbeatTick\(\) \{([\s\S]*?)\n\}\n\nfunction scheduleSolidWorksHeartbeat/);
assert.ok(heartbeat, "The SOLIDWORKS heartbeat is missing.");
assert.match(heartbeat[1], /refreshDisconnectedSolidWorksProcessSnapshot\(now\)/);
assert.match(heartbeat[1], /cacheDisconnectedSolidWorksStatus\(snapshot, watcher, activity\)/);
assert.doesNotMatch(heartbeat[1], /pollSolidWorksOnce|getSolidWorksStatusWithHealth|runSolidWorksBridge/);
assert.doesNotMatch(main, /cacheDisconnectedSolidWorksStatus\(null\)/);
assert.doesNotMatch(main, /async function pollSolidWorksOnce/);
const cachedStatusHandler = main.match(/automation:solidworks-status", async \(\) => \{([\s\S]*?)\n\}\);/);
assert.ok(cachedStatusHandler, "The cached status IPC handler is missing.");
assert.doesNotMatch(cachedStatusHandler[1], /getSolidWorksStatusWithHealth|runSolidWorksBridge/);
const killHandler = main.match(/automation:kill-solidworks", async \(\) => \{([\s\S]*?)\n\}\);/);
assert.ok(killHandler, "The Kill SW handler is missing.");
assert.match(killHandler[1], /getSolidWorksProcessSnapshot\(\)/);
assert.match(killHandler[1], /runSolidWorksBridge\(\["-Action", "kill-solidworks"\]/);
assert.match(killHandler[1], /processSnapshotAfter/);
assert.doesNotMatch(killHandler[1], /getSolidWorksStatusWithHealth|health\?\.canKill|readSolidWorksWatcherStatus/);

if (process.platform !== "win32") {
  console.log("SOLIDWORKS watcher bounded-scan static checks passed.");
  process.exit(0);
}

const outputPath = path.join(os.tmpdir(), `excelsis-sw-watcher-source-test-${process.pid}.json`);
const markerPath = path.join(os.tmpdir(), `excelsis-sw-watcher-source-test-${process.pid}.marker.json`);
fs.writeFileSync(markerPath, JSON.stringify({
  schema: "excelsis-helper-macro-gate-v1",
  active: true,
  writerPid: process.pid,
  sampledAt: new Date().toISOString(),
}), "utf8");
let initialMtime = 0;
try { initialMtime = fs.statSync(outputPath).mtimeMs; } catch {}

const child = spawn("cscript.exe", [
  "//NoLogo",
  "//B",
  scriptPath,
  outputPath,
  "300",
  markerPath,
], {
  stdio: "ignore",
  windowsHide: true,
});

async function waitForStatus() {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`SOLIDWORKS watcher exited before writing status (${child.exitCode}).`);
    }
    try {
      const stat = fs.statSync(outputPath);
      if (stat.mtimeMs > initialMtime) {
        const status = JSON.parse(fs.readFileSync(outputPath, "utf8").replace(/^\uFEFF/, ""));
        assert.equal(status.ok, true);
        assert.equal(status.macroRunning, true);
        assert.equal(status.connected, false);
        assert.ok(status.activeDocument && typeof status.activeDocument === "object");
        assert.ok(Array.isArray(status.openDocuments));
        if (!status.connected && !status.macroRunning) {
          assert.equal(typeof status.connectionErrorNumber, "number");
          assert.equal(typeof status.connectionError, "string");
        }
        return;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("SOLIDWORKS watcher did not publish a valid status within 10 seconds.");
}

waitForStatus()
  .then(() => {
    console.log("SOLIDWORKS watcher bounded-scan and status-write tests passed.");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    try { child.kill(); } catch {}
  });
