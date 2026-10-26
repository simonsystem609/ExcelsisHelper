"use strict";

// Isolated mock UI plus the real backend search predicate; no Electron/CAD/cache access.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const vm = require("node:vm");
const { spawn } = require("node:child_process");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..", "..");
const output = path.resolve(process.argv[2] || path.join(root, "..", "tmp", "recent-search"));
const records = [
  { title: "Main assembly.SLDASM", path: "C:\\Demo\\Clamp Project\\root.SLDASM", type: "assembly" },
  { title: "Clamp-plate.SLDPRT", path: "C:\\Demo\\Other\\Clamp-plate.SLDPRT", type: "part" },
  { title: "Unrelated.SLDPRT", path: "C:\\Demo\\Other\\Unrelated.SLDPRT", type: "part" },
  { title: "Drawing.SLDDRW", path: "C:\\Demo\\Clamp Project\\root.SLDDRW", type: "drawing" },
  { title: "Crown cover", path: "C:\\Demo\\Clamp Project\\stock.SLDPRT", type: "part" },
].map(record => ({ ...record, displayPath: record.path, missing: false, thumbnail: null, lastOpenedAt: 1 }));

async function startServer() {
  const child = spawn(process.execPath, [path.join(__dirname, "server.cjs"), "0"], {
    cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error("Renderer server did not start.")); }, 10000);
    child.once("error", error => { clearTimeout(timer); reject(error); });
    child.once("exit", code => { clearTimeout(timer); reject(new Error(`Renderer server exited (${code}).`)); });
    child.stdout.on("data", chunk => {
      stdout += chunk;
      if (!stdout.includes("\n")) return;
      clearTimeout(timer);
      try { const address = JSON.parse(stdout.split("\n")[0]); resolve(`http://${address.host}:${address.port}`); }
      catch (error) { reject(error); }
    });
  });
  return { child, url };
}

(async () => {
  await fs.mkdir(output, { recursive: true });
  const main = await fs.readFile(path.join(root, "main.cjs"), "utf8");
  const handler = main.indexOf('trustedIpcHandle("automation:list-recent-docs"');
  const start = main.indexOf("  const requestedFilter", handler);
  const end = main.indexOf("  const filteredCount", start);
  assert.ok(handler >= 0 && start > handler && end > start);
  const host = { path: path.win32, displayPathOf: file => file,
    classifyDocType: file => ({ ".sldasm": "assembly", ".sldprt": "part", ".slddrw": "drawing" })[path.win32.extname(file).toLowerCase()] };
  vm.createContext(host);
  vm.runInContext(`this.search = function(list, request) {\n${main.slice(start, end)}\nreturn filtered; };`, host);
  const server = await startServer();
  let browser;
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const page = await browser.newPage({ viewport: { width: 1180, height: 850 } });
    const errors = [];
    const calls = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.exposeFunction("__recentSearchTestList", request => {
      calls.push(request);
      const entries = host.search(records, request);
      return { ok: true, entries, totalCount: records.length, filteredCount: entries.length,
        limited: false, canToggleAll: false, showAll: Boolean(request.showAll), limit: 50 };
    });
    const mock = await fs.readFile(path.join(__dirname, "mock-api.js"), "utf8");
    await page.route("**/mock-api.js", route => route.fulfill({ contentType: "application/javascript",
      body: mock + "\nwindow.excelsisAutomation.listRecentDocs = request => window.__recentSearchTestList(request);\n" }));
    await page.goto(`${server.url}/automation.html`);
    await page.locator("#navRecentDocsBtn").click();
    const tiles = page.locator("#recentDocsList .recent-docs-tile");
    await page.waitForFunction(count => document.querySelectorAll("#recentDocsList .recent-docs-tile").length === count, records.length);
    const checks = [];
    async function search(query, filter, paths) {
      await page.locator("#recentDocsFilter").selectOption(filter);
      await page.locator("#recentDocsSearch").fill(query);
      await page.waitForFunction(expectedPaths => {
        const actual = Array.from(document.querySelectorAll("#recentDocsList .recent-docs-tile"), tile => tile.dataset.path);
        return JSON.stringify(actual) === JSON.stringify(expectedPaths);
      }, paths);
      assert.deepEqual(await tiles.evaluateAll(elements => elements.map(element => element.dataset.path)), paths);
      checks.push({ query, filter, count: paths.length });
    }
    const matching = [records[0].path, records[1].path, records[3].path, records[4].path];
    await search("clamp", "all", matching);
    for (const width of [840, 1180, 1920]) {
      await page.setViewportSize({ width, height: 850 });
      assert.deepEqual(await tiles.evaluateAll(elements => elements.map(element => element.dataset.path)), matching);
      await page.screenshot({ path: path.join(output, `search-${width}.png`) });
    }
    await search("clamp", "assembly", [records[0].path]);
    await search("clamp", "part", [records[1].path, records[4].path]);
    await search("clamp", "drawing", [records[3].path]);
    await search("  CLAMP  crown  ", "all", [records[4].path]);
    await search("not-a-match", "all", []);
    await search("", "all", records.map(record => record.path));
    assert.ok(calls.some(call => call.query.toLowerCase().includes("clamp")));
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(output, "browser-checks.json"), JSON.stringify({ checks, requests: calls, errors }, null, 2) + "\n");
    console.log(`Recent search UI passed: ${checks.length} searches, real backend predicate, name/path inclusion, token AND, types, reset and three viewport screenshots; ${output}`);
  } finally {
    if (browser) await browser.close();
    server.child.kill();
    await new Promise(resolve => {
      if (server.child.exitCode !== null) return resolve();
      server.child.once("exit", resolve);
    });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
