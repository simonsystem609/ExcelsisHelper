const assert = require("node:assert/strict");
const { execFileSync, spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const scriptPath = path.join(__dirname, "..", "scripts", "set-ecoqos.ps1");
const script = fs.readFileSync(scriptPath, "utf8");

assert.doesNotMatch(script, /\$pid\s*=/i, "PowerShell's reserved $PID variable must never be assigned.");
assert.doesNotMatch(script, /foreach\s*\(\s*\$pid\b/i, "PowerShell's reserved $PID variable must never be a loop variable.");

if (process.platform !== "win32") {
  console.log("EcoQoS static checks passed; Windows integration check skipped.");
  process.exit(0);
}

const target = spawn(process.execPath, ["-e", "setTimeout(() => {}, 30000)"], {
  stdio: "ignore",
  windowsHide: true,
});

async function run() {
  await new Promise((resolve, reject) => {
    target.once("spawn", resolve);
    target.once("error", reject);
  });

  try {
    const stdout = execFileSync("powershell.exe", [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-WindowStyle",
      "Hidden",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
      "-TargetPid",
      String(target.pid),
      "-Verify",
    ], {
      encoding: "utf8",
      timeout: 15000,
      windowsHide: true,
    }).trim();

    const result = JSON.parse(stdout);
    assert.equal(result.ProcessId, target.pid);
    assert.equal(result.PriorityNormal, true);
    assert.equal(result.Applied, true);
    assert.equal(result.EcoQos, true);
    console.log("EcoQoS disposable-process verification passed.");
  } finally {
    target.kill();
  }
}

run().catch((error) => {
  try { target.kill(); } catch {}
  console.error(error);
  process.exitCode = 1;
});
