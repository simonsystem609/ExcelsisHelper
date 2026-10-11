const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { scan, createEntryIndex, addEntry, removeDirEntries, docSearchPathKey } = require("../scripts/doc-search-worker.cjs");

const testRoot = path.resolve(__dirname, "..", "..", "tmp");
fsSync.mkdirSync(testRoot, { recursive: true });
const fixture = fsSync.mkdtempSync(path.join(testRoot, "doc-search-optimization-test-"));

async function main() {
  const records = Array.from({ length: 24000 }, (_, index) => ({
    path: path.join(fixture, `dir${index % 200}`, `part${index}.SLDPRT`),
    dir: path.join(fixture, `dir${index % 200}`),
  }));
  const lookup = createEntryIndex(records);
  const expected = new Map(records.map((entry) => [docSearchPathKey(entry.path), entry]));
  for (let index = 0; index < 100; index++) {
    const key = docSearchPathKey(path.join(fixture, `dir${index}`));
    removeDirEntries(lookup, key);
    for (const [entryKey, entry] of expected) if (docSearchPathKey(entry.dir) === key) expected.delete(entryKey);
  }
  assert.deepEqual(Array.from(lookup.entriesByPath.keys()), Array.from(expected.keys()));
  const renamedDirEntry = { ...records[0], dir: path.join(fixture, "elsewhere") };
  addEntry(lookup, renamedDirEntry);
  addEntry(lookup, { ...renamedDirEntry, dir: path.join(fixture, "second") });
  removeDirEntries(lookup, docSearchPathKey(renamedDirEntry.dir));
  assert.ok(lookup.entriesByPath.has(docSearchPathKey(renamedDirEntry.path)));

  const root = path.join(fixture, "root");
  const changed = path.join(root, "changed");
  const untouched = path.join(root, "untouched");
  const moved = path.join(root, "move-me");
  for (const dir of [changed, untouched, path.join(moved, "child"), path.join(root, "#recycle")]) await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(changed, "One.SLDPRT"), "old");
  await fs.writeFile(path.join(changed, "~$One.SLDPRT"), "lock");
  await fs.writeFile(path.join(untouched, "Two.SLDASM"), "part");
  await fs.writeFile(path.join(moved, "child", "Three.SLDDRW"), "drawing");
  await fs.writeFile(path.join(root, "#recycle", "Skip.SLDPRT"), "skip");
  const settings = { roots: [root], indexPath: path.join(fixture, "index.json"), schemaVersion: 2,
    extensions: [".sldprt", ".sldasm", ".slddrw"], throttleMs: 0 };
  const read = async () => JSON.parse(await fs.readFile(settings.indexPath, "utf8"));
  assert.equal((await scan(settings)).entries, 3);
  const oldMtime = (await fs.stat(changed)).mtime;
  await fs.writeFile(path.join(changed, "One.SLDPRT"), "new contents");
  await fs.utimes(changed, oldMtime, oldMtime);
  const enumerated = [];
  const monitored = { ...fs, opendir: async (dir) => { enumerated.push(dir); return fs.opendir(dir); } };
  const result = await scan({ ...settings, changedDirs: [changed, path.dirname(fixture), path.join(root, "#recycle")] }, monitored);
  assert.equal(result.mode, "changed-folders-worker");
  assert.deepEqual(enumerated, [changed]);
  assert.equal((await read()).entries.find((entry) => entry.name === "One.SLDPRT").size, 12);
  const fresh = path.join(changed, "new-dir");
  await fs.mkdir(fresh);
  await fs.writeFile(path.join(fresh, "New.SLDPRT"), "new");
  assert.equal((await scan({ ...settings, changedDirs: [changed] })).entries, 4);

  // A renamed/deleted subtree is removed only if its configured root is reachable.
  const renamed = path.join(fixture, "preserved-move-me");
  await fs.rename(moved, renamed);
  await scan({ ...settings, changedDirs: [root] });
  assert.ok(!(await read()).entries.some((entry) => entry.name === "Three.SLDDRW"));
  const beforeOffline = (await read()).entries;
  const unavailable = Object.assign(new Error("Share unavailable"), { code: "ENOENT" });
  await scan({ ...settings, changedDirs: [changed] }, {
    ...fs, lstat: async () => { throw unavailable; }, stat: async () => { throw unavailable; },
  });
  assert.deepEqual((await read()).entries, beforeOffline);
  await scan({ ...settings, force: true }, {
    ...fs, lstat: async () => { throw unavailable; }, stat: async () => { throw unavailable; },
  });
  assert.deepEqual((await read()).entries, beforeOffline, "A forced refresh must also preserve unavailable-share entries.");
  await scan({ ...settings, changedDirs: [changed] }, {
    ...fs, opendir: async () => { throw Object.assign(new Error("Denied"), { code: "EACCES" }); },
  });
  assert.deepEqual((await read()).entries, beforeOffline);
  await scan({ ...settings, changedDirs: [changed] }, {
    ...fs, opendir: async () => ({ async *[Symbol.asyncIterator]() {
      yield { name: "One.SLDPRT", isSymbolicLink: () => false, isDirectory: () => false, isFile: () => true };
      throw unavailable;
    } }),
  });
  assert.deepEqual((await read()).entries, beforeOffline, "An interrupted enumeration must not erase cached files.");
  let readLinked = false;
  await scan({ ...settings, changedDirs: [fresh] }, {
    ...fs, lstat: async (dir) => dir === changed ? { isSymbolicLink: () => true } : fs.lstat(dir),
    opendir: async (dir) => { readLinked = true; return fs.opendir(dir); },
  });
  assert.equal(readLinked, false, "Do not traverse a linked ancestor from a watcher event.");

  const source = fsSync.readFileSync(path.join(__dirname, "..", "main.cjs"), "utf8");
  const queueFunction = source.match(/function queueDocSearchChangedFolders\([\s\S]*?\n\}/)[0];
  const timers = [];
  const calls = [];
  let release;
  const context = vm.createContext({ path, docSearchPathKey, isQuitting: false, docSearchChangedDirs: new Map(),
    docSearchChangedDirsTimer: null, DOC_SEARCH_WATCH_DEBOUNCE_MS: 15000,
    isInsideFolderOrEqual: (file, parent) => file === parent || file.startsWith(parent + path.sep),
    shouldSkipDocSearchDirectory: () => false, isExcludedDocLocation: () => false,
    docSearchWatcherFileLooksRelevant: (file) => /\.sldprt$/i.test(file),
    scheduleDocSearchBackgroundScan: (delay) => calls.push({ fallback: delay }),
    scanDocSearchIndex: (options) => { calls.push(options); return new Promise((resolve) => { release = resolve; }); },
    setTimeout: (fn) => { timers.push(fn); return timers.length; },
  });
  vm.runInContext(queueFunction, context);
  context.queueDocSearchChangedFolders(root, "change", "changed/One.SLDPRT");
  context.queueDocSearchChangedFolders(root, "change", "changed/One.SLDPRT");
  context.queueDocSearchChangedFolders(root, "change", "changed/~$One.SLDPRT");
  assert.equal(timers.length, 1);
  const pending = timers[0]();
  assert.deepEqual(Array.from(calls[0].changedDirs), [changed]);
  context.queueDocSearchChangedFolders(root, "change", "untouched/Two.SLDPRT");
  assert.equal(timers.length, 2, "An event during a scan must queue another refresh.");
  release();
  await pending;
  const next = timers[1]();
  assert.deepEqual(Array.from(calls[1].changedDirs), [untouched]);
  release();
  await next;
  context.queueDocSearchChangedFolders(root, "rename", "");
  context.queueDocSearchChangedFolders(root, "change", "../escape.SLDPRT");
  assert.equal(calls.filter((entry) => entry.fallback).length, 2);
  const jobs = [];
  let finishScan;
  const singleFlight = vm.createContext({
    isQuitting: false, docSearchScanPromise: null, docSearchIndex: { entries: [] },
    performDocSearchIndexScan: (options) => {
      jobs.push(options);
      return new Promise((resolve) => { finishScan = resolve; });
    },
  });
  vm.runInContext(source.match(/async function scanDocSearchIndex\([\s\S]*?\n\}/)[0], singleFlight);
  const firstScan = singleFlight.scanDocSearchIndex({});
  const queuedScan = singleFlight.scanDocSearchIndex({ changedDirs: [changed] });
  assert.equal(jobs.length, 1);
  finishScan({ entries: [] });
  await firstScan;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(jobs.length, 2, "A targeted request must run after, not disappear into, an existing scan.");
  const stoppedScan = singleFlight.scanDocSearchIndex({ changedDirs: [untouched] });
  singleFlight.isQuitting = true;
  finishScan({ entries: [] });
  await Promise.all([queuedScan, stoppedScan]);
  assert.equal(jobs.length, 2, "Queued work must not launch during shutdown.");
  assert.match(source, /DOC_SEARCH_BACKGROUND_RESCAN_MS = 5 \* 60 \* 1000|DOC_SEARCH_BACKGROUND_RESCAN_MS = 300000/);
  console.log(`Doc Search directory lookup, targeted refresh, watcher queue and outage tests passed. Fixtures: ${fixture}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
