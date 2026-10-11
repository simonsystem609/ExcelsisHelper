"use strict";

// Mock-only UI checks; never starts Electron or accesses the configured folder.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..", "..");
const output = path.resolve(process.argv[2] || path.join(root, "..", "tmp", "recent-folder-buttons"));
const widths = [840, 920, 1180, 1366, 1600, 1920, 2560];

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

async function assertLayout(page, description) {
  const metrics = await page.locator(".recent-docs-heading").evaluate(heading => {
    const rect = heading.getBoundingClientRect();
    const selectors = ["h1", "#copyRecentFolderPathBtn", "#openRecentFolderBtn", "#recentDocsSearch",
      ".recent-docs-filter-label", "#retryThumbnailsBtn", "#refreshRecentDocsBtn"];
    return { left: rect.left, right: rect.right, bottom: rect.bottom,
      overflow: heading.scrollWidth > heading.clientWidth,
      items: selectors.map(selector => {
        const element = heading.querySelector(selector);
        const box = element.getBoundingClientRect();
        return { selector, left: box.left, right: box.right, top: box.top, bottom: box.bottom,
          overflow: element.scrollWidth > element.clientWidth };
      }),
    };
  });
  assert.equal(metrics.overflow, false, `${description}: heading overflow`);
  for (const item of metrics.items) {
    assert.equal(item.overflow, false, `${description}: ${item.selector} text overflow`);
    assert.ok(item.left >= metrics.left - 1 && item.right <= metrics.right + 1 && item.bottom <= metrics.bottom + 1,
      `${description}: ${item.selector} outside heading`);
  }
  for (let a = 0; a < metrics.items.length; a++) {
    for (let b = a + 1; b < metrics.items.length; b++) {
      const x = metrics.items[a];
      const y = metrics.items[b];
      const overlap = Math.min(x.right, y.right) - Math.max(x.left, y.left) > 1
        && Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top) > 1;
      assert.equal(overlap, false, `${description}: ${x.selector} overlaps ${y.selector}`);
    }
  }
  return metrics;
}

(async () => {
  await fs.mkdir(output, { recursive: true });
  const server = await startServer();
  let browser;
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const page = await browser.newPage({ viewport: { width: 1180, height: 850 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    let persisted = null;
    const mock = await fs.readFile(path.join(__dirname, "mock-api.js"), "utf8");
    await page.route("**/mock-api.js", route => route.fulfill({ contentType: "application/javascript",
      body: mock + (persisted ? `\n{
        const saved = ${JSON.stringify(persisted)};
        const get = window.excelsisAutomation.getSettings;
        window.excelsisAutomation.getSettings = async () => ({ ...(await get()), settings: saved });
      }` : ""),
    }));
    await page.goto(`${server.url}/automation.html`);
    await page.waitForFunction(() => document.querySelector("#settingsState").textContent.includes("loaded"));
    assert.equal(await page.locator("#copyRecentFolderPathBtn").isDisabled(), true);
    assert.equal(await page.locator("#openRecentFolderBtn").isDisabled(), true);
    await page.locator("#navSettingsBtn").click();
    await page.locator("#settingsRecentFolderPath").fill("C:\\Demo\\Drawing Archive");
    await page.locator("#settingsRecentFolderCopyLabel").fill("work drawings path copy");
    await page.locator("#settingsRecentFolderOpenLabel").fill("work drawings folder open");
    await page.locator("#settingsCadModelInbox").fill("C:\\Demo\\CAD Inbox");
    await page.locator("#settingsSaveBtn").click();
    await page.waitForFunction(() => document.querySelector("#settingsState").textContent.includes("saved"));
    persisted = await page.evaluate(() => window.__rendererHarness.getSettings());
    assert.equal(persisted.recentDocsFolder.path, "C:\\Demo\\Drawing Archive");
    await page.locator("#navRecentDocsBtn").click();
    assert.equal(await page.locator("#copyRecentFolderPathBtn").isEnabled(), true);
    await page.locator("#copyRecentFolderPathBtn").click();
    await page.locator("#openRecentFolderBtn").click();
    assert.deepEqual(await page.evaluate(() => window.__rendererHarness.calls
      .filter(call => call.name === "recentFolderAction").map(call => call.args[0])), ["copy", "open"]);
    const layouts = [];
    for (const width of widths) {
      await page.setViewportSize({ width, height: 850 });
      layouts.push(await assertLayout(page, `configured ${width}px`));
      if ([920, 1180, 1920].includes(width)) await page.screenshot({ path: path.join(output, `recent-${width}.png`) });
    }
    await page.reload();
    await page.waitForFunction(() => document.querySelector("#copyRecentFolderPathBtn").textContent.includes("work drawings path copy"));
    await page.locator("#navSettingsBtn").click();
    await page.locator("#settingsRecentFolderCopyLabel").fill("<b>Copy folder</b> " + "A".repeat(60));
    await page.locator("#settingsRecentFolderOpenLabel").fill("Open folder");
    await page.locator("#settingsSaveBtn").click();
    await page.waitForFunction(() => document.querySelector("#copyRecentFolderPathBtn").textContent.includes("<b>"));
    await page.locator("#settingsUiLanguage").selectOption("hu");
    assert.equal(await page.locator("#openRecentFolderBtn .recent-folder-button-label").textContent(), "Open folder",
      "Language preview must not translate a custom name");
    assert.equal(await page.locator("#copyRecentFolderPathBtn b").count(), 0, "Labels are plain text, not HTML");
    await page.locator("#navRecentDocsBtn").click();
    for (const width of widths) {
      await page.setViewportSize({ width, height: 850 });
      layouts.push(await assertLayout(page, `long labels, HU ${width}px`));
    }
    await page.locator("#navSettingsBtn").click();
    await page.locator('[data-settings-reset="recent-folder"]').click();
    await page.waitForFunction(() => document.querySelector("#settingsRecentFolderPath").value === "");
    assert.equal(await page.locator("#copyRecentFolderPathBtn").isDisabled(), true);
    assert.equal(await page.locator("#settingsCadModelInbox").inputValue(), "C:\\Demo\\CAD Inbox", "Group reset preserves other fields");
    await page.locator("#settingsImportBtn").click();
    await page.waitForFunction(() => document.querySelector("#settingsGcodeMachineMaxRpm").value === "14500");
    assert.equal(await page.locator("#openRecentFolderBtn").isDisabled(), true);
    await page.locator("#settingsExportBtn").click();
    await page.waitForFunction(() => window.__rendererHarness.calls.some(call => call.name === "exportSettings"));
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(output, "layout-checks.json"), JSON.stringify(layouts, null, 2) + "\n");
    console.log(`Recent folder buttons passed: save/reload, actions, labels, language, reset/import/export and ${layouts.length} layouts; ${output}`);
  } finally {
    if (browser) await browser.close();
    server.child.kill();
    await new Promise(resolve => {
      if (server.child.exitCode !== null) return resolve();
      server.child.once("exit", resolve);
    });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
