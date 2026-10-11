"use strict";

// Uses the mock-only renderer, never the production Electron main process.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..", "..");
const output = path.resolve(process.argv[2] || path.join(root, "..", "tmp", "document-card-layout"));
const cssOverride = process.argv[3] && path.resolve(process.argv[3]);
const widths = [840, 920, 1180, 1366, 1600, 1920, 2560];
const names = [
  "PRJ-020_301 Punch 1.2379 58-60.Hrc_PRJ_2026.10.08.SLDPRT",
  "PRJ-020_301 H\u00faz\u00f3 1.2379 58-60.Hrc_PRJ_2026.10.08.SLDPRT",
  "assembly_feeder_steel_processing_unit_2026.10.07_Long_configuration.SLDASM",
  "A".repeat(90) + ".SLDPRT",
  "Cover.SLDPRT",
  "plate & clamp_2026.10.07.SLDPRT",
];
const entries = names.map((title, index) => ({
  title, name: title, path: `C:\\Demo\\Engineering\\${title}`,
  type: title.endsWith("SLDASM") ? "assembly" : "part",
  thumbnail: index < 3 ? "/icon-256.png" : "",
}));

async function startServer() {
  const child = spawn(process.execPath, [path.join(__dirname, "server.cjs"), "0"], {
    cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stderr.on("data", chunk => { stderr += chunk; });
  const address = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Renderer server did not start: ${stderr}`));
    }, 10000);
    child.once("error", error => { clearTimeout(timer); reject(error); });
    child.once("exit", code => { clearTimeout(timer); reject(new Error(`Renderer server exited (${code}): ${stderr}`)); });
    child.stdout.on("data", chunk => {
      stdout += chunk;
      if (!stdout.includes("\n")) return;
      try { clearTimeout(timer); resolve(JSON.parse(stdout.split("\n")[0])); }
      catch (error) { reject(error); }
    });
  });
  return { child, url: `http://${address.host}:${address.port}` };
}

async function measure(page, selector) {
  return page.locator(`${selector} .recent-docs-tile`).evaluateAll(tiles => tiles.map(tile => {
    const name = tile.querySelector(".recent-docs-tile-name");
    const nameRect = name.getBoundingClientRect();
    const pathRect = tile.querySelector(".recent-docs-tile-path").getBoundingClientRect();
    const thumbRect = tile.querySelector(".document-thumb-wrap").getBoundingClientRect();
    const style = getComputedStyle(name);
    // Unclamp an invisible copy to measure actual character wrapping, not strings.
    const copy = name.cloneNode(true);
    Object.assign(copy.style, {
      position: "absolute", visibility: "hidden", display: "block",
      left: "0", top: "0", width: `${nameRect.width}px`, minHeight: "0",
      maxHeight: "none", overflow: "visible", webkitLineClamp: "unset",
    });
    document.body.appendChild(copy);
    const lines = new Map();
    const text = copy.firstChild;
    for (let index = 0; index < text.length; index++) {
      const range = document.createRange();
      range.setStart(text, index);
      range.setEnd(text, index + 1);
      const rect = range.getBoundingClientRect();
      if (!rect.width) continue;
      const y = Math.round(rect.top * 100) / 100;
      const line = lines.get(y) || { left: rect.left, right: rect.right };
      line.left = Math.min(line.left, rect.left);
      line.right = Math.max(line.right, rect.right);
      lines.set(y, line);
    }
    copy.remove();
    return {
      name: name.textContent, tooltip: tile.title,
      width: nameRect.width, height: nameRect.height,
      lineHeight: parseFloat(style.lineHeight), fontSize: style.fontSize,
      wordBreak: style.wordBreak,
      lines: [...lines.values()].map(line => (line.right - line.left) / nameRect.width),
      thumbnailGap: nameRect.top - thumbRect.bottom,
      pathGap: pathRect.top - nameRect.bottom,
      horizontalOverflow: tile.scrollWidth > tile.clientWidth,
    };
  }));
}

(async () => {
  await fs.mkdir(output, { recursive: true });
  const server = await startServer();
  let browser;
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const page = await browser.newPage({ viewport: { width: widths[0], height: 900 } });
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    const mock = await fs.readFile(path.join(__dirname, "mock-api.js"), "utf8");
    await page.route("**/mock-api.js", route => route.fulfill({
      contentType: "application/javascript",
      body: mock + `\n(function () {
        const entries = ${JSON.stringify(entries)};
        window.excelsisAutomation.listRecentDocs = async () => ({
          ok: true, entries, totalCount: entries.length, filteredCount: entries.length,
          canToggleAll: false, showAll: false, limited: false, limit: 50
        });
        window.excelsisAutomation.docSearch = async () => ({
          ok: true, entries, query: "", fileType: "all", page: 0, hasMore: false,
          mode: "query", index: { count: entries.length, scanning: false }
        });
      })();`,
    }));
    if (cssOverride) {
      const css = await fs.readFile(cssOverride, "utf8");
      await page.route("**/automation.css", route => route.fulfill({ contentType: "text/css", body: css }));
    }
    await page.goto(`${server.url}/automation.html`);
    await page.waitForFunction(count => document.querySelectorAll("#recentDocsList .recent-docs-tile").length === count, entries.length);
    const results = [];
    for (const [view, button, selector] of [
      ["recent", "#navRecentDocsBtn", "#recentDocsList"],
      ["search", "#navDocSearchBtn", "#docSearchList"],
    ]) {
      await page.locator(button).click();
      await page.waitForFunction(({ selector, count }) => document.querySelectorAll(`${selector} .recent-docs-tile`).length === count, { selector, count: entries.length });
      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 });
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        results.push({ view, width, cards: await measure(page, selector) });
        await page.screenshot({ path: path.join(output, `${view}-${width}.png`) });
      }
    }
    await fs.writeFile(path.join(output, "measurements.json"), JSON.stringify({ cssOverride, pageErrors, results }, null, 2));
    assert.deepEqual(pageErrors, [], "The isolated renderer must have no page errors.");
    for (const result of results) {
      for (const [index, card] of result.cards.entries()) {
        const at = `${result.view} ${result.width}px ${card.name}`;
        assert.equal(card.name, names[index], `${at}: renderer must keep the full name.`);
        assert.ok(card.tooltip.includes(card.name), `${at}: full-name tooltip.`);
        assert.equal(card.fontSize, "13px", `${at}: keep readable text size.`);
        assert.equal(card.wordBreak, "break-all", `${at}: wrap long filename segments across both rows.`);
        assert.ok(Math.abs(card.height - 2 * card.lineHeight) < 0.5, `${at}: fixed two-line height.`);
        assert.ok(card.thumbnailGap >= 6 && card.pathGap >= 6, `${at}: text must not overlap.`);
        assert.equal(card.horizontalOverflow, false, `${at}: no horizontal card overflow.`);
        if (card.lines.length > 2) {
          for (const fill of card.lines.slice(0, 2)) {
            assert.ok(fill > 0.9, `${at}: a long filename left too much unused row space (${fill}).`);
          }
        }
      }
    }
    console.log(`Document-card layout passed: ${results.length} view/width combinations, ${names.length} filenames; ${output}`);
  } finally {
    if (browser) await browser.close();
    server.child.kill();
    await new Promise(resolve => {
      if (server.child.exitCode !== null) return resolve();
      server.child.once("exit", resolve);
    });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
