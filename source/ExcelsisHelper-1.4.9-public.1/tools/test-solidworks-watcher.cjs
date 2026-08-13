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
assert.match(main, /async function refreshDisconnectedSolidWorksProcessSnapshot/);
assert.match(main, /now - lastDisconnectedSolidWorksProcessPollAt >= SW_FULL_REFRESH_MS/);
assert.match(main, /if \(watcher && watcher\.connected\) \{\s*resetDisconnectedSolidWorksProcessSnapshot\(\)/);
const disconnectedBranch = main.match(/else if \(watcher && !watcher\.connected\) \{([\s\S]*?)\n\s*\} else \{/);
assert.ok(disconnectedBranch, "The disconnected watcher branch is missing.");
assert.match(disconnectedBranch[1], /refreshDisconnectedSolidWorksProcessSnapshot\(now\)/);
assert.match(disconnectedBranch[1], /cacheDisconnectedSolidWorksStatus\(snapshot, watcher\)/);
assert.doesNotMatch(disconnectedBranch[1], /pollSolidWorksOnce|getSolidWorksStatusWithHealth/);
assert.doesNotMatch(main, /cacheDisconnectedSolidWorksStatus\(null\)/);
assert.match(main, /automation:kill-solidworks"[\s\S]{0,300}readSolidWorksWatcherStatus\(\)/);
assert.match(main, /automation:kill-solidworks"[\s\S]{0,600}cacheDisconnectedSolidWorksStatus\(snapshot, watcher\)/);

if (process.platform !== "win32") {
  console.log("SOLIDWORKS watcher bounded-scan static checks passed.");
  process.exit(0);
}

const outputPath = path.join(os.tmpdir(), "excelsis-sw-watcher-source-test.json");
let initialMtime = 0;
try { initialMtime = fs.statSync(outputPath).mtimeMs; } catch {}

const child = spawn("cscript.exe", [
  "//NoLogo",
  "//B",
  scriptPath,
  outputPath,
  "300",
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
        assert.equal(typeof status.connected, "boolean");
        assert.ok(status.activeDocument && typeof status.activeDocument === "object");
        assert.ok(Array.isArray(status.openDocuments));
        if (!status.connected) {
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
