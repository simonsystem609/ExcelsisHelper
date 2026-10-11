const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { EventEmitter } = require("node:events");
const { spawn, execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const main = fs.readFileSync(path.join(root, "main.cjs"), "utf8");
const policy = fs.readFileSync(path.join(root, "scripts", "set-ecoqos.ps1"), "utf8");
const block = main.slice(main.indexOf("const pendingEcoQosPids = new Set()"), main.indexOf("const APP_PROCESS_TREE_ECOQOS_DELAYS_MS"));
const timers = new Map();
const children = [];
const context = vm.createContext({
  isQuitting: false, process: { platform: "win32", pid: 10 }, os: { setPriority: () => {}, constants: { priority: { PRIORITY_NORMAL: 0 } } },
  POWERSHELL_EXE: "powershell.exe", hiddenPowerShellArgs: (...args) => args, assetPath: (...args) => path.join(...args),
  setTimeout: (fn, ms) => { const timer = { unref() {} }; timers.set(timer, { fn, ms }); return timer; },
  clearTimeout: (timer) => timers.delete(timer),
  spawn: (command, args, options) => {
    const child = new EventEmitter();
    child.unref = () => {}; child.kill = () => child.emit("exit", 1);
    children.push({ child, command, args, options });
    return child;
  },
});
vm.runInContext(block, context);
const tick = (ms) => {
  const [timer, item] = [...timers].find(([, entry]) => entry.ms === ms) || [];
  assert.ok(item, `Expected a ${ms} ms timer`);
  timers.delete(timer); item.fn();
};
context.applyBackgroundEcoQos(12);
context.applyBackgroundEcoQos(12);
context.applyProcessTreeEcoQos(13);
context.applyBackgroundEcoQos(0);
assert.equal(timers.size, 1);
tick(100);
assert.equal(children.length, 1);
assert.equal(children[0].args[children[0].args.indexOf("-TargetPids") + 1], "12,13");
assert.ok(children[0].args.includes("-IncludeChildren"));
assert.equal(children[0].args[children[0].args.indexOf("-OwnerPid") + 1], "10");
assert.equal(children[0].options.windowsHide, true);
context.applyBackgroundEcoQos(12);
context.applyBackgroundEcoQos(14);
assert.equal(timers.size, 1, "Only the existing watchdog should be running while a batch is active.");
children[0].child.emit("exit", 0);
tick(100);
assert.equal(children.length, 2);
assert.equal(children[1].args[children[1].args.indexOf("-TargetPids") + 1], "14");
context.applyBackgroundEcoQos(15);
tick(15000);
tick(100);
assert.equal(children.length, 3, "A timed-out policy worker must release the queue.");
children[2].child.emit("error", new Error("Disposable failure"));
children[2].child.emit("exit", 1);
context.isQuitting = true;
context.applyBackgroundEcoQos(16);
assert.equal(timers.size, 0);
assert.doesNotMatch(policy, /Get-CimInstance|Get-WmiObject/);
assert.match(policy, /if \(-not \('EcoQoS' -as \[type\]\)\)/);
for (const name of ["solidworks-bridge.ps1", "sw-addin-bridge.ps1", "sw-addin-status.ps1", "extract-sw-thumbnails.ps1", "capture-sw-viewport.ps1"]) {
  assert.match(fs.readFileSync(path.join(root, "scripts", name), "utf8"), /set-ecoqos\.ps1[\s\S]{0,120}-IncludeChildren/);
}
assert.match(fs.readFileSync(path.join(root, "cad-model-runtime", "cad-model-workflow.cjs"), "utf8"), /applyBackgroundEcoQos\(child\?\.pid\)/);

async function windowsTest() {
  const tempRoot = path.resolve(root, "..", "tmp");
  fs.mkdirSync(tempRoot, { recursive: true });
  const fixture = fs.mkdtempSync(path.join(tempRoot, "process-policy-test-"));
  const sleeper = spawn(process.execPath, ["-e", "const c=require('child_process').spawn(process.execPath,['-e','setTimeout(()=>{},30000)'],{stdio:'ignore',windowsHide:true});console.log(c.pid);setTimeout(()=>{},30000);process.on('SIGTERM',()=>{c.kill();process.exit()});"],
    { stdio: ["ignore", "pipe", "ignore"], windowsHide: true });
  let nestedPid;
  try {
    nestedPid = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Disposable child did not start.")), 5000);
      sleeper.once("error", (error) => { clearTimeout(timeout); reject(error); });
      sleeper.stdout.once("data", (data) => { clearTimeout(timeout); resolve(Number(String(data).trim())); });
    });
    assert.ok(nestedPid > 0);
    const script = path.join(fixture, "verify.ps1");
    const scriptPath = path.join(root, "scripts", "set-ecoqos.ps1").replace(/'/g, "''");
    fs.writeFileSync(script, `
$ErrorActionPreference = 'Stop'
$first = & '${scriptPath}' -TargetPids '${sleeper.pid},${nestedPid},${sleeper.pid}' -OwnerPid ${process.pid} -IncludeChildren -Verify
$second = & '${scriptPath}' -TargetPid ${nestedPid} -Verify
$rows = [EcoQoS+ProcessEntry[]]@(
  [EcoQoS+ProcessEntry]::new(1, 0, 'Excelsis Helper.exe'),
  [EcoQoS+ProcessEntry]::new(2, 1, 'cscript.exe'),
  [EcoQoS+ProcessEntry]::new(3, 2, 'conhost.exe'),
  [EcoQoS+ProcessEntry]::new(4, 1, 'SLDWORKS.exe'),
  [EcoQoS+ProcessEntry]::new(5, 4, 'powershell.exe'),
  [EcoQoS+ProcessEntry]::new(6, 1, 'explorer.exe'),
  [EcoQoS+ProcessEntry]::new(7, 6, 'node.exe'),
  [EcoQoS+ProcessEntry]::new(8, 99, 'powershell.exe'))
$selected = [EcoQoS]::SelectTargets([int[]]@(1,4), $rows, $true)
$owned = [EcoQoS]::SelectTargets([int[]]@(1,2,5,7,8), $rows, $true, 1)
@{ firstJson = [string]$first; secondJson = [string]$second; selected = @($selected); owned = @($owned) } | ConvertTo-Json -Depth 5 -Compress
`, "utf8");
    const result = JSON.parse(execFileSync("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script],
      { windowsHide: true, encoding: "utf8", timeout: 15000 }));
    const first = JSON.parse(result.firstJson);
    const second = JSON.parse(result.secondJson);
    const ids = first.map((entry) => entry.ProcessId);
    assert.ok(ids.includes(sleeper.pid) && ids.includes(nestedPid), `Missing disposable workers: ${JSON.stringify(result)}`);
    assert.equal(new Set(ids).size, ids.length);
    for (const entry of first) assert.ok(entry.PriorityNormal && entry.Applied && entry.EcoQos);
    assert.equal(second.ProcessId, nestedPid);
    assert.ok(second.EcoQos, "Reusing the PowerShell native type must still apply policy.");
    assert.deepEqual(result.selected, [1, 2, 3], "External applications and their workers are outside Helper policy.");
    assert.deepEqual(result.owned, [1, 2, 3], "Explicit delayed targets also need a live Helper ownership chain.");
  } finally {
    if (nestedPid) { try { process.kill(nestedPid); } catch {} }
    try { sleeper.kill(); } catch {}
  }
}

(process.platform === "win32" ? windowsTest() : Promise.resolve())
  .then(() => console.log("Batched process policy, owned-tree filtering and disposable worker tests passed."))
  .catch((error) => { console.error(error); process.exitCode = 1; });
