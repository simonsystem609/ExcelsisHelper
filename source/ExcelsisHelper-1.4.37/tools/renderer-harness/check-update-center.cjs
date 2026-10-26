"use strict";

// Browser-only mocks: no installers, live settings, SOLIDWORKS, or network feeds.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, "..", "..");
const output = path.resolve(process.argv[2] || path.join(root, "..", "tmp", "update-center-ui"));

async function startServer() {
  const child = spawn(process.execPath, [path.join(__dirname, "server.cjs"), "0"], { cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Renderer server timed out")), 10000);
    let text = "";
    child.once("error", error => { clearTimeout(timer); reject(error); });
    child.stdout.on("data", bytes => {
      text += bytes; if (!text.includes("\n")) return;
      clearTimeout(timer); const address = JSON.parse(text.split("\n")[0]); resolve(`http://${address.host}:${address.port}`);
    });
  });
  return { child, url };
}

async function layout(page, selector) {
  const problems = await page.locator(selector).evaluate(root => {
    const visible = [...root.querySelectorAll("button,h1,h2,.version,.detail")].filter(el => el.getBoundingClientRect().width && !el.hidden);
    const issues = [];
    for (const el of visible) {
      const box = el.getBoundingClientRect();
      if (box.left < -1 || box.right > window.innerWidth + 1 || el.scrollWidth > el.clientWidth + 1) issues.push(el.id || el.className || el.tagName);
    }
    for (let i = 0; i < visible.length; i++) for (let j = i + 1; j < visible.length; j++) {
      const a = visible[i].getBoundingClientRect(), b = visible[j].getBoundingClientRect();
      if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) issues.push("overlap");
    }
    return issues;
  });
  assert.deepEqual(problems, []);
}

(async () => {
  await fs.mkdir(output, { recursive: true });
  const server = await startServer(); let browser;
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const page = await browser.newPage({ viewport: { width: 1180, height: 850 } });
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${server.url}/automation.html`);
    await page.waitForFunction(() => !!window.__rendererHarness?.callbacks.onUpdateAvailability);
    assert.equal(await page.locator("#updateAvailableBtn").isVisible(), false);
    for (const status of ["unchecked", "unknown", "up-to-date", "newer-installed", "not-installed"]) {
      await page.evaluate(status => window.__rendererHarness.callbacks.onUpdateAvailability({ hasUpdates: true,
        products: [{ key: "viewer", displayName: "ExcelsisView", status }], macros: { status } }), status);
      assert.equal(await page.locator("#updateAvailableBtn").isVisible(), false);
    }
    for (const key of ["viewer", "helper", "macros"]) {
      await page.evaluate(key => window.__rendererHarness.callbacks.onUpdateAvailability({ products: key === "macros" ? [] :
        [{ key, displayName: key === "viewer" ? "ExcelsisView" : "Excelsis Helper", status: "update-available" }],
        macros: { status: key === "macros" ? "update-available" : "unavailable" } }), key);
      assert.equal(await page.locator("#updateAvailableBtn").isVisible(), true);
      await page.locator("#updateAvailableBtn").click();
    }
    assert.equal(await page.evaluate(() => window.__rendererHarness.calls.filter(call => call.name === "openUpdateCenter").length), 3);
    for (const width of [840, 920, 1180, 1920]) {
      await page.setViewportSize({ width, height: 850 }); await layout(page, ".topbar");
      if (width === 920 || width === 1180) await page.screenshot({ path: path.join(output, `helper-update-${width}.png`) });
    }
    await page.locator("#navSettingsBtn").click(); await page.locator("#settingsUpdateCenterBtn").click();
    assert.equal(await page.evaluate(() => window.__rendererHarness.calls.filter(call => call.name === "openUpdateCenter").length), 4);

    const popup = await browser.newPage(); popup.on("pageerror", error => errors.push(error.message));
    await popup.addInitScript(() => {
      const data = { products: ["viewer", "helper"].map(key => ({ key, displayName: key, installedVersion: "1.1.0", latestVersion: "1.4.38",
        status: "update-available", canInstall: true, assetName: "Excelsis-Setup-1.4.38.exe", size: 110000000 })),
        macros: { installedVersion: "1.4.37", revision: "20261026.1", status: "update-available", canInstall: true, detail: "2 macro file(s) differ; originals will be backed up." } };
      window.__updateMock = { data, mode: "cancelled", calls: [], progress: null, resolve: null };
      window.excelsisUpdater = {
        getCatalog: async force => { window.__updateMock.calls.push(["catalog", force]); return window.__updateMock.data; },
        onProgress: callback => { window.__updateMock.progress = callback; return () => {}; },
        install: async key => { const mock = window.__updateMock; mock.calls.push(["install", key]);
          if (mock.mode === "pending") return new Promise(resolve => { mock.resolve = resolve; });
          if (mock.mode === "error") throw new Error("Synthetic download failure");
          return { [mock.mode]: true, revision: "20261026.1" };
        },
      };
    });
    await popup.goto(`${server.url}/update-center.html`);
    await popup.waitForFunction(() => document.querySelector("#status").textContent === "Release check complete.");
    for (const width of [320, 480, 780, 1180]) {
      await popup.setViewportSize({ width, height: 800 }); await layout(popup, "main");
      await popup.screenshot({ path: path.join(output, `update-center-${width}.png`), fullPage: true });
    }
    await popup.locator('[data-product="viewer"] .install').click();
    await popup.waitForFunction(() => document.querySelector("#status").textContent === "Update cancelled.");
    await popup.evaluate(() => { window.__updateMock.mode = "deferred"; });
    await popup.locator('[data-product="macros"] .install').click();
    await popup.waitForFunction(() => document.querySelector("#status").textContent.includes("deferred"));
    await popup.evaluate(() => { window.__updateMock.mode = "error"; });
    await popup.locator('[data-product="helper"] .install').click();
    await popup.waitForFunction(() => document.querySelector("#status").classList.contains("error"));
    await popup.evaluate(() => { window.__updateMock.mode = "pending"; });
    await popup.locator('[data-product="macros"] .install').click();
    assert.equal(await popup.locator(".install:enabled").count(), 0); assert.equal(await popup.locator("#refresh").isDisabled(), true);
    await popup.evaluate(() => window.__updateMock.progress({ productKey: "macros", percent: 60, message: "Downloading verified SWPs" }));
    assert.equal(await popup.locator('[data-product="macros"] progress').evaluate(element => element.value), 60);
    await popup.evaluate(() => window.__updateMock.resolve({ ok: true, revision: "20261026.1" }));
    await popup.waitForFunction(() => document.querySelector("#status").textContent.includes("installed"));
    await popup.evaluate(() => { for (const info of window.__updateMock.data.products) { info.status = "unknown"; info.canInstall = false; info.error = '<img src=x onerror=alert(1)>'; } });
    await popup.locator("#refresh").click();
    await popup.waitForFunction(() => document.querySelector(".detail").textContent.includes("<img"));
    assert.equal(await popup.locator(".detail img").count(), 0);
    await layout(popup, "main"); assert.deepEqual(errors, []);
    console.log(`Update UI passed: conditional badge, both entry points, 8 layouts, busy/progress/cancel/deferred/error states and text-only release data; ${output}`);
  } finally {
    if (browser) await browser.close();
    server.child.kill();
    if (server.child.exitCode === null) await new Promise(resolve => server.child.once("exit", resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
