"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "..");
const main = fs.readFileSync(path.join(root, "main.cjs"), "utf8");
const renderer = fs.readFileSync(path.join(root, "automation.js"), "utf8");
function between(source, start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, start);
  return source.slice(a, b);
}

const entries = Object.freeze([
  { id: "path-only", title: "Main assembly.SLDASM", type: "assembly",
    path: "\\\\server\\share\\Projects\\Clamp Project\\Machine\\root.SLDASM" },
  { id: "filename", title: "Clamp-plate.SLDPRT", type: "part", path: "C:\\Other\\Clamp-plate.SLDPRT" },
  { id: "actual-filename", title: "Bracket alias", type: "part", path: "C:\\Other\\Clamp-bracket.SLDPRT" },
  { id: "mapped-path", title: "Frame.SLDASM", type: "assembly", path: "\\\\server\\share\\opaque\\frame.SLDASM",
    displayPath: "Y:\\Projects\\Clamp Project\\frame.SLDASM" },
  { id: "unrelated", title: "Other.SLDPRT", type: "part", path: "C:\\Other\\Other.SLDPRT" },
  { id: "drawing", title: "Drawing.SLDDRW", type: "drawing", path: "C:\\Projects\\Clamp Project\\root.SLDDRW" },
  { id: "title-only", title: "Clamp document.SLDPRT", type: "part", path: "C:\\Other\\document.SLDPRT" },
  { id: "missing-title", title: "", type: "part", path: "C:\\Other\\Clamp-washer.SLDPRT" },
  { id: "literal", title: "[Clamp] cut.SLDPRT", type: "part", path: "C:\\Other\\[Clamp] cut.SLDPRT" },
  { id: "unicode", title: "St\u00fctze.SLDPRT", type: "part", path: "C:\\Projects\\St\u00fctze.SLDPRT" },
  { id: "cam", title: "Setup.prz", type: "solidcam", path: "C:\\Projects\\Clamp Project\\Setup.prz" },
  { id: "cross-field", title: "Crown cover", type: "part", path: "C:\\Projects\\Clamp Project\\stock.SLDPRT" },
].map(Object.freeze));
const original = JSON.stringify(entries);
const displayPaths = new Map(entries.map(entry => [entry.path, entry.displayPath || entry.path]));
const handlers = new Map();
const host = {
  path: path.win32, pathToFileURL,
  trustedIpcHandle: (channel, handler) => handlers.set(channel, handler),
  mergeSolidWorksRecentFileListIntoCache: async () => 0,
  loadRecentDocs: async () => entries,
  shouldExcludeDocPath: () => false,
  classifyDocType: file => ({ ".sldasm": "assembly", ".sldprt": "part", ".slddrw": "drawing", ".prz": "solidcam" })[path.win32.extname(file).toLowerCase()],
  displayPathOf: file => displayPaths.get(file) || file,
  pathExists: async () => true,
  rootOfPath: file => path.win32.parse(file).root,
  thumbPathForDoc: () => "C:\\Mock\\existing-thumbnail.png",
  readThumbnailState: async file => ({ blank: false, missing: false, path: file, mtimeMs: 1 }),
  queueThumbnailExtraction: async () => {},
  saveRecentDocs: () => { throw new Error("Search must not save the fixture cache."); },
  fs: { unlink: () => { throw new Error("Search must not delete fixture thumbnails."); } },
  RECENT_DOC_DEFAULT_LIST_LIMIT: 2, RECENT_DOC_THUMB_BATCH_LIMIT: 2, THUMB_PRIORITY_RECENT_DOC: 1,
};
vm.createContext(host);
vm.runInContext(between(main, "async function mapWithConcurrency", 'trustedIpcHandle("automation:list-worklogs"'), host);
const listRecentDocs = handlers.get("automation:list-recent-docs");
assert.equal(typeof listRecentDocs, "function");
const view = { recentDocsState: { filter: "all", search: "" }, basenameOf: path.win32.basename };
vm.createContext(view);
vm.runInContext(between(renderer, "function filterRecentDocs", "function formatProjectActivity")
  + "\nthis.filter = filterRecentDocs;", view);
const ids = values => Array.from(values, value => value.id);
const all = ids(entries);
const clamp = ["path-only", "filename", "actual-filename", "mapped-path", "drawing", "title-only", "missing-title", "literal", "cam", "cross-field"];
const cases = [
  { query: "clamp", expected: clamp },
  { query: "  cLaMp  ", expected: clamp },
  { query: "clamp", filter: "assembly", expected: ["path-only", "mapped-path"] },
  { query: "clamp", filter: "part", expected: ["filename", "actual-filename", "title-only", "missing-title", "literal", "cross-field"] },
  { query: "clamp", filter: "drawing", expected: ["drawing"] },
  { query: "clamp", filter: "solidcam", expected: ["cam"] },
  { query: "clamp crown", expected: ["cross-field"] },
  { query: "machine clamp", expected: ["path-only"] },
  { query: "CLAMP  bracket", expected: ["actual-filename"] },
  { query: "Y:\\Projects\\Clamp", expected: ["mapped-path"] },
  { query: "root", expected: ["path-only", "drawing"] },
  { query: "[clamp]", expected: ["literal"] },
  { query: "ST\u00dcTZE", expected: ["unicode"] },
  { query: "unknown-project", expected: [] },
  { query: "clamp missing-token", expected: [] },
  { query: "", expected: all },
  { query: "   ", expected: all },
  { query: "", showAll: true, expected: all },
  { query: "", filter: "assembly", expected: ["path-only", "mapped-path"] },
];

async function run() {
  const failures = [];
  for (const test of cases) {
    const filter = test.filter || "all";
    const description = `${filter}/${JSON.stringify(test.query)}/${Boolean(test.showAll)}`;
    const result = await listRecentDocs({}, { filter, query: test.query, showAll: Boolean(test.showAll) });
    const searching = Boolean(test.query.trim());
    const selected = searching || test.showAll ? test.expected : test.expected.slice(0, 2);
    try {
      assert.deepEqual(ids(result.entries), selected, "Path matches must not disappear when a filename also matches");
      assert.equal(result.filteredCount, test.expected.length);
      assert.equal(result.totalCount, entries.length);
      assert.equal(result.limited, !test.showAll && !searching && test.expected.length > selected.length);
      assert.equal(result.canToggleAll, !searching && test.expected.length > 2);
      assert.equal(new Set(ids(result.entries)).size, result.entries.length, "Name and path matches must not duplicate a row");
    } catch (error) { failures.push(`Backend ${description}: ${error.message}`); }
    view.recentDocsState = { filter, search: test.query };
    try {
      assert.deepEqual(ids(view.filter(entries)), test.expected, "Renderer must retain filename and full/display-path matches together");
      assert.deepEqual(ids(view.filter(result.entries)), selected, "Renderer must not discard a backend result");
    } catch (error) { failures.push(`Renderer ${description}: ${error.message}`); }
  }
  assert.equal(JSON.stringify(entries), original, "Searching must not mutate the cached document records or order");
  assert.deepEqual(failures, []);
  console.log(`Recent search passed: ${cases.length} backend/UI parity cases; full paths plus names, mapped paths, token AND, types, order, limits, no duplication or cache writes.`);
}

run().catch(error => { console.error(error); process.exitCode = 1; });
