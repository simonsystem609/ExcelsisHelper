"use strict";

// Optional browser check: provide Playwright through NODE_PATH or the local toolchain.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawn } = require("node:child_process");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, "..");

async function test() {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), "excelsis-shortcut-ui-"));
  const server = spawn(process.execPath, [path.join(__dirname, "renderer-harness", "server.cjs"), "0"], {
    cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
  });
  let browser;
  try {
    const port = await new Promise((resolve, reject) => {
      let text = "";
      const timer = setTimeout(() => reject(new Error("Fixture server startup timed out")), 10000);
      server.once("error", (error) => { clearTimeout(timer); reject(error); });
      server.stdout.on("data", (chunk) => {
        text += chunk;
        if (!text.includes("\n")) return;
        clearTimeout(timer);
        try { resolve(JSON.parse(text.split(/\r?\n/)[0]).port); } catch (error) { reject(error); }
      });
    });
    browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
    const page = await browser.newPage({ viewport: { width: 1180, height: 900 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${port}/automation.html`);
    await page.click("#navSettingsBtn");
    await page.waitForFunction(() => document.querySelectorAll(".macro-shortcut-row").length === 2);
    const rows = page.locator(".macro-shortcut-row");
    assert.equal(await rows.nth(0).locator("input").inputValue(), "Alt+R");
    assert.equal(await rows.nth(1).locator("select").inputValue(), "DXF_v16.swp");
    assert.equal(await rows.nth(1).locator("input").inputValue(), "Alt+D");
    await page.click("#addMacroShortcutBtn");
    await rows.nth(2).locator("select").selectOption("BOM_v19.swp");
    await rows.nth(2).locator("input").fill("Alt+B");
    await page.click("#settingsSaveBtn");
    await page.waitForFunction(() => window.__rendererHarness.getSettings().hotkeys.macroShortcuts.length === 3);
    await page.click("#navMacroBtn");
    assert.match(await page.locator("#macroShortcutNotes").innerText(), /Radius_v9.swp: Alt\+R/);
    assert.match(await page.locator("#macroShortcutNotes").innerText(), /DXF_v16.swp: Alt\+D/);
    assert.match(await page.locator("#macroShortcutNotes").innerText(), /BOM_v19.swp: Alt\+B/);
    await page.screenshot({ path: path.join(output, "macro-notes-desktop.png") });
    await page.click("#navSettingsBtn");
    await page.locator("#settingsMacroShortcuts").scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, "settings-desktop.png") });
    await page.selectOption("#settingsUiLanguage", "hu");
    assert.equal(await rows.nth(2).locator("input").inputValue(), "Alt+B", "Language preview preserves unsaved bindings");
    assert.match(await rows.nth(2).locator("button").getAttribute("title"), /eltávolítása/);
    await page.selectOption("#settingsUiLanguage", "en");
    for (let i = 0; i < 3; i++) await rows.first().locator("button").click();
    await page.click("#settingsSaveBtn");
    await page.waitForFunction(() => window.__rendererHarness.getSettings().hotkeys.macroShortcuts.length === 0);
    await page.click("#navMacroBtn");
    assert.equal(await page.locator("#macroShortcutNotes").innerText(), "");
    await page.click("#navSettingsBtn");
    await page.click('[data-settings-reset="hotkeys"]');
    await page.waitForFunction(() => document.querySelectorAll(".macro-shortcut-row").length === 2);
    await page.uncheck("#settingsHotkeysEnabled");
    await page.click("#settingsSaveBtn");
    await page.click("#navMacroBtn");
    await page.waitForFunction(() => document.querySelector("#macroShortcutNotes").textContent.includes("disabled"));
    await page.click("#navSettingsBtn");
    await page.click("#settingsImportBtn");
    await page.waitForFunction(() => window.__rendererHarness.getSettings().hotkeys.enabled);
    await page.click("#settingsExportBtn");
    await page.waitForFunction(() => window.__rendererHarness.calls.some((call) => call.name === "exportSettings"));
    for (const width of [920, 640, 390]) {
      await page.setViewportSize({ width, height: 850 });
      await page.locator("#settingsMacroShortcuts").scrollIntoViewIfNeeded();
      const invalid = await page.locator(".macro-shortcut-row").evaluateAll((elements) => elements.some((row) => {
        const box = row.getBoundingClientRect();
        return [...row.querySelectorAll("input,select,button")].some((control) => {
          const rect = control.getBoundingClientRect();
          return rect.width <= 0 || rect.right > box.right + 1 || rect.left < box.left - 1;
        });
      }));
      assert.equal(invalid, false, `Shortcut rows fit at ${width}px`);
      await page.screenshot({ path: path.join(output, `settings-${width}.png`) });
      await page.click("#navMacroBtn");
      assert.equal(await page.locator("#macroShortcutNotes").evaluate((node) => node.scrollWidth > node.clientWidth + 1), false);
      await page.screenshot({ path: path.join(output, `macro-notes-${width}.png`) });
      await page.click("#navSettingsBtn");
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ ok: true, screenshots: output, tested: "defaults, add/save/notes, language, removal, reset, disable, import/export, responsive layout" }));
  } finally {
    if (browser) await browser.close();
    server.kill();
    await new Promise((resolve) => server.exitCode !== null ? resolve() : server.once("exit", resolve));
  }
}
test().catch((error) => { console.error(error); process.exitCode = 1; });
