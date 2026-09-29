const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "main.cjs"), "utf8");
const start = source.indexOf("async function noteRecentDoc(");
const end = source.indexOf("\nfunction clampSolidWorksActivityPauseMinutes", start);
assert.ok(start >= 0 && end > start, "Could not isolate noteRecentDoc.");
const noteRecentDocSource = source.slice(start, end);

const context = { path };
vm.createContext(context);
vm.runInContext(`
let recentDocsCache = [];
let recentDocBurstLastKey = "";
let recentDocBurstLastAt = 0;
let now = 100000;
let macroRunning = false;
let burstSeconds = 4;
let saveCount = 0;
const RECENT_DOC_TOUCH_THROTTLE_MS = 5 * 60 * 1000;
const EMBEDDED_PREVIEW_EXTENSIONS = new Set();
const THUMB_PRIORITY_ACTIVE_DOC = 0;
const Date = { now: () => now };
const fs = { stat: async () => { throw new Error("not found"); } };
function shouldExcludeDocPath() { return false; }
function classifyDocType() { return "part"; }
async function loadRecentDocs() {}
async function isMacroRecentDocSuppressionActive() { return macroRunning; }
async function readAutomationSettings() {
  return { activity: { recentDocsNewEntryBurstSeconds: burstSeconds } };
}
function recentDocNewEntryBurstMs(settings) {
  return Number(settings?.activity?.recentDocsNewEntryBurstSeconds ?? 4) * 1000;
}
function logActivity() {}
async function saveRecentDocs() { saveCount += 1; }
function sendAutomationRendererEvent() {}
async function queueThumbnailExtraction() {}
${noteRecentDocSource}
this.testApi = {
  noteRecentDoc,
  setNow(value) { now = value; },
  setMacroRunning(value) { macroRunning = value; },
  setBurstSeconds(value) { burstSeconds = value; },
  setEntries(value) { recentDocsCache = value.map((entry) => ({ ...entry })); },
  entries() { return recentDocsCache.map((entry) => ({ ...entry })); },
  saves() { return saveCount; },
  reset() {
    recentDocsCache = [];
    recentDocBurstLastKey = "";
    recentDocBurstLastAt = 0;
    saveCount = 0;
    now = 100000;
    macroRunning = false;
    burstSeconds = 4;
  },
};
`, context);

async function main() {
const api = context.testApi;

api.setMacroRunning(true);
await api.noteRecentDoc("C:\\Projects\\new.SLDPRT", "part", "new.SLDPRT");
await api.noteRecentDoc("C:\\Projects\\forced.SLDPRT", "part", "forced.SLDPRT", { force: true });
assert.equal(api.entries().length, 0, "Macro runs must block every new entry, including forced notes.");
assert.equal(api.saves(), 0);

api.setEntries([{ path: "C:\\Projects\\known.SLDPRT", type: "part", title: "known.SLDPRT", lastSeen: 1 }]);
api.setNow(500000);
await api.noteRecentDoc("C:\\Projects\\known.SLDPRT", "part", "known.SLDPRT");
assert.equal(api.entries().length, 1);
assert.equal(api.entries()[0].lastSeen, 500000, "Known entries must continue refreshing during macros.");
assert.equal(api.saves(), 1);

api.reset();
api.setNow(100000);
await api.noteRecentDoc("C:\\Projects\\first.SLDPRT", "part", "first.SLDPRT");
api.setNow(101000);
await api.noteRecentDoc("C:\\Projects\\second.SLDPRT", "part", "second.SLDPRT");
assert.deepEqual(Array.from(api.entries(), (entry) => entry.title), ["first.SLDPRT"]);
api.setNow(106000);
await api.noteRecentDoc("C:\\Projects\\second.SLDPRT", "part", "second.SLDPRT");
assert.deepEqual(Array.from(api.entries(), (entry) => entry.title), ["second.SLDPRT", "first.SLDPRT"]);

api.reset();
api.setBurstSeconds(0);
await api.noteRecentDoc("C:\\Projects\\first.SLDPRT", "part", "first.SLDPRT");
api.setNow(100001);
await api.noteRecentDoc("C:\\Projects\\second.SLDPRT", "part", "second.SLDPRT");
assert.deepEqual(Array.from(api.entries(), (entry) => entry.title), ["second.SLDPRT", "first.SLDPRT"]);

console.log("Recent SW macro suppression and configurable burst-cutoff tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
