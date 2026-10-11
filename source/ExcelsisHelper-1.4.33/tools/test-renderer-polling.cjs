const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "automation.js"), "utf8");
const polling = source.slice(source.indexOf("const rendererStatusTimers = []"), source.indexOf('document.addEventListener("click", hideRecentDocContextMenu)'));
const calls = [];
const timers = new Map();
const listeners = {};
let nextId = 0;
const context = vm.createContext({
  document: { hidden: true, addEventListener: (type, fn) => { listeners[type] = fn; },
    getElementById: () => ({ classList: { contains: () => false } }) },
  state: { docSearchPollTimer: null, recentDocsRefreshTimer: null },
  SOLIDWORKS_STATUS_INTERVAL_MS: 2000, SOLIDCAM_STATUS_INTERVAL_MS: 10000,
  setInterval: (fn, ms) => { const id = ++nextId; timers.set(id, { fn, ms }); return id; },
  clearInterval: (id) => timers.delete(id), clearTimeout: () => {}, setStatus: () => {},
  refreshSolidWorksStatus: () => calls.push("sw"), refreshSolidCamLoadStatus: () => calls.push("cam"),
  refreshDriveMapFromMain: () => calls.push("drives"), scheduleRecentDocsRefresh: () => {},
  scheduleDocSearchRefresh: () => {}, refreshWorkLoggerList: async () => {},
});
vm.runInContext(polling, context);
assert.equal(timers.size, 0, "A tray-hidden startup must not start renderer status IPC timers.");
assert.deepEqual(calls, []);
context.document.hidden = false;
listeners.visibilitychange();
assert.deepEqual(calls, ["sw", "cam", "drives"]);
assert.equal(timers.size, 3);
listeners.visibilitychange();
assert.equal(timers.size, 3, "Repeated show events must not duplicate polls.");
context.document.hidden = true;
listeners.visibilitychange();
assert.equal(timers.size, 0);
context.document.hidden = false;
listeners.visibilitychange();
assert.deepEqual(calls, ["sw", "cam", "drives", "sw", "cam", "drives"]);
assert.equal(timers.size, 3);
assert.doesNotMatch(polling, /api\.(stop|pause)|stopSolidWorksWatcher|stopActivityWatcher|stopHotkeyHelper/);
console.log("Hidden-renderer polling and immediate-show refresh tests passed.");
