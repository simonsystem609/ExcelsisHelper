"use strict";

// Mock-only browser checks. No Electron, CAD connection or project-folder I/O.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..", "..");
const output = path.resolve(process.argv[2] || path.join(root, "..", "tmp", "project-folder-ui"));

async function run() {
  await fs.mkdir(output, { recursive: true });
  const server = spawn(process.execPath, [path.join(__dirname, "server.cjs"), "0"], {
    cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
  });
  let browser;
  try {
    const url = await new Promise((resolve, reject) => {
      let text = "";
      const timer = setTimeout(() => reject(new Error("Harness startup timed out")), 10000);
      server.once("error", error => { clearTimeout(timer); reject(error); });
      server.once("exit", code => { clearTimeout(timer); reject(new Error(`Harness exited ${code}`)); });
      server.stdout.on("data", chunk => {
        text += chunk;
        if (!text.includes("\n")) return;
        clearTimeout(timer);
        const address = JSON.parse(text.split("\n")[0]);
        resolve(`http://${address.host}:${address.port}`);
      });
    });
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const page = await browser.newPage({ viewport: { width: 1180, height: 850 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${url}/automation.html`);
    await page.waitForFunction(() => !document.querySelector("#newProjectFolderBtn").disabled);
    assert.deepEqual(await page.locator(".recent-folder-actions > button").evaluateAll(elements => elements.map(el => el.id)),
      ["newProjectFolderBtn", "copyRecentFolderPathBtn", "openRecentFolderBtn"]);
    await page.locator("#newProjectFolderBtn").click();
    assert.equal(await page.locator("#projectFolderCompany").inputValue(), "");
    assert.equal(await page.locator("#projectFolderName").isDisabled(), true);
    await page.locator("#projectFolderCompany").selectOption("company");
    await page.waitForFunction(() => document.querySelector("#projectFolderStatus").textContent.includes("company root"));
    assert.equal(await page.locator("#createProjectFolderBtn").isEnabled(), true, "Allow retry after an offline/missing-root error");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#projectFolderDialog").evaluate(el => el.open), false);
    assert.equal(await page.locator("#newProjectFolderBtn").evaluate(el => el === document.activeElement), true);
    assert.equal(await page.evaluate(() => window.__rendererHarness.calls.some(call => call.name === "createProjectFolder")), false);

    await page.locator("#navSettingsBtn").click();
    const company = page.locator('[data-project-company="company"]');
    const tools = page.locator('[data-project-company="tools"]');
    await company.locator('[data-project-field="name"]').fill("Example Engineering");
    await company.locator('[data-project-field="root"]').fill("C:\\Demo\\Projects");
    await company.locator('[data-project-field="prefix"]').fill("JOB");
    await tools.locator('[data-project-field="name"]').fill("<b>Tools</b>");
    await tools.locator('[data-project-field="root"]').fill("C:\\Demo\\ToolProjects");
    await tools.locator('[data-project-field="prefix"]').fill("TOOL");
    await page.locator("#settingsCadModelInbox").fill("C:\\Demo\\CAD Inbox");
    await page.locator("#settingsSaveBtn").click();
    await page.waitForFunction(() => document.querySelector("#settingsState").textContent.includes("saved"));
    await page.locator("#navRecentDocsBtn").click();
    await page.locator("#newProjectFolderBtn").click();
    assert.equal(await page.locator('#projectFolderCompany option[value="tools"]').textContent(), "<b>Tools</b>");
    assert.equal(await page.locator("#projectFolderCompany b").count(), 0);
    await page.locator("#projectFolderCompany").selectOption("company");
    const year = await page.evaluate(() => new Date().getFullYear());
    const yearCode = String(year).slice(-2);
    await page.waitForFunction(code => document.querySelector("#projectFolderName").value === code, `JOB-${yearCode}-019_`);
    assert.equal(await page.locator("#projectFolderName").evaluate(el => el.selectionStart), `JOB-${yearCode}-019_`.length);
    assert.equal(await page.locator("#projectFolderName").evaluate(el => el === document.activeElement), true);
    await page.locator("#projectFolderCompany").selectOption("tools");
    await page.waitForFunction(code => document.querySelector("#projectFolderName").value === code, `TOOL-${yearCode}-088_`);
    assert.equal(await page.locator("#projectFolderDestination").textContent(), `C:\\Demo\\ToolProjects\\${year}\\TOOL-${yearCode}-088_`);
    await page.locator("#projectFolderName").fill(`TOOL-${yearCode}-088_Fixture \u00e9kezet`);
    for (const [width, height] of [[840, 650], [1180, 850], [1920, 1080], [2560, 1200], [840, 480]]) {
      await page.setViewportSize({ width, height });
      const metrics = await page.locator("#projectFolderDialog").evaluate(dialog => {
        const box = dialog.getBoundingClientRect();
        return { overflow: dialog.scrollWidth > dialog.clientWidth, left: box.left, top: box.top,
          right: box.right, bottom: box.bottom, children: [...dialog.querySelectorAll("input,select,button")].map(el => {
            const b = el.getBoundingClientRect();
            return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, overflow: el.scrollWidth > el.clientWidth };
          }) };
      });
      assert.equal(metrics.overflow, false, `${width}x${height} dialog overflow`);
      assert.ok(metrics.left >= 0 && metrics.top >= 0 && metrics.right <= width && metrics.bottom <= height);
      for (const child of metrics.children) assert.ok(child.left >= metrics.left && child.right <= metrics.right
        && child.top >= metrics.top && child.bottom <= metrics.bottom, "Control must fit in dialog");
      await page.screenshot({ path: path.join(output, `project-folder-${width}x${height}.png`) });
    }
    await page.setViewportSize({ width: 1180, height: 850 });
    await page.locator("#createProjectFolderBtn").click();
    await page.waitForFunction(() => !document.querySelector("#projectFolderDialog").open);
    assert.equal(await page.evaluate(() => window.__rendererHarness.calls.filter(call => call.name === "createProjectFolder").length), 1);
    assert.match(await page.locator("#logOutput").textContent(), /Project folder created/);

    // A slow preview must not overwrite a later company choice or a reopened dialog.
    await page.evaluate(() => {
      window.__originalProjectPreview = window.excelsisAutomation.previewProjectFolder;
      window.excelsisAutomation.previewProjectFolder = id => id === "company"
        ? new Promise(resolve => { window.__resolveOldPreview = resolve; }) : window.__originalProjectPreview(id);
    });
    await page.locator("#newProjectFolderBtn").click();
    await page.locator("#projectFolderCompany").selectOption("company");
    await page.locator("#projectFolderCompany").selectOption("tools");
    await page.waitForFunction(() => document.querySelector("#projectFolderName").value.includes("089_"));
    await page.evaluate(async () => window.__resolveOldPreview(await window.__originalProjectPreview("company")));
    assert.match(await page.locator("#projectFolderName").inputValue(), /089_$/);
    await page.locator("#projectFolderName").fill(`TOOL-${yearCode}-089_My project`);
    await page.evaluate(() => {
      const original = window.excelsisAutomation.createProjectFolder;
      window.excelsisAutomation.createProjectFolder = async request => {
        window.excelsisAutomation.createProjectFolder = original;
        return { ok: false, conflict: true, error: "Number changed", preview: {
          companyId: "tools", code: request.name.slice(0, request.name.indexOf("_" )).replace("089", "090"),
          token: "changed", yearPath: "C:\\Demo\\ToolProjects\\2026",
        } };
      };
    });
    await page.locator("#createProjectFolderBtn").click();
    await page.waitForFunction(() => document.querySelector("#projectFolderStatus").textContent === "Number changed");
    assert.equal(await page.locator("#projectFolderName").inputValue(), `TOOL-${yearCode}-090_My project`);
    await page.locator("#cancelProjectFolderBtn").click();

    // Never offer a second creation after Explorer failed to open the created folder.
    await page.evaluate(() => {
      window.excelsisAutomation.createProjectFolder = async () => ({ ok: true, created: true,
        path: "C:\\Demo\\Created", warning: "Explorer unavailable" });
    });
    await page.locator("#newProjectFolderBtn").click();
    await page.locator("#projectFolderCompany").selectOption("tools");
    await page.waitForFunction(() => !document.querySelector("#projectFolderName").disabled);
    await page.locator("#createProjectFolderBtn").click();
    await page.waitForFunction(() => document.querySelector("#projectFolderStatus").textContent.includes("Explorer unavailable"));
    assert.equal(await page.locator("#createProjectFolderBtn").isDisabled(), true);
    await page.locator("#cancelProjectFolderBtn").click();
    await page.locator("#navSettingsBtn").click();
    await page.locator('[data-settings-reset="project-folders"]').click();
    await page.waitForFunction(() => document.querySelector('[data-project-company="company"] [data-project-field="root"]').value === "");
    assert.equal(await company.locator('[data-project-field="name"]').inputValue(), "Company");
    assert.equal(await tools.locator('[data-project-field="root"]').inputValue(), "");
    assert.deepEqual(errors, []);
    console.log(`Project-folder UI passed: button order, settings, preview, focus, company switching, cancellation, creation, races, warnings and 5 layouts. ${output}`);
  } finally {
    if (browser) await browser.close();
    server.kill();
    await new Promise(resolve => { if (server.exitCode !== null) return resolve(); server.once("exit", resolve); });
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
