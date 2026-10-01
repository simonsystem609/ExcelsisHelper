const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const variant = process.env.RENDER_SMOKE_VARIANT || "unknown";
const resultRoot = process.env.RENDER_SMOKE_OUTPUT || path.join(os.tmpdir(), "excelsis-renderer-smoke");
app.setPath("userData", path.join(os.tmpdir(), `excelsis-renderer-smoke-${variant}`));
app.disableHardwareAcceleration();

function serializeError(error) {
  return String(error?.stack || error?.message || error || "");
}

app.whenReady().then(async () => {
  fs.mkdirSync(resultRoot, { recursive: true });
  const report = { variant, events: [], loaded: false, state: null, error: "" };
  const win = new BrowserWindow({
    width: 640,
    height: 420,
    show: false,
    backgroundColor: "#101317",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.webContents.on("console-message", (_event, details) => {
    report.events.push({ type: "console", level: details.level, message: details.message });
  });
  win.webContents.on("preload-error", (_event, preloadPath, error) => {
    report.events.push({ type: "preload-error", preloadPath, error: serializeError(error) });
  });
  win.webContents.on("render-process-gone", (_event, details) => {
    report.events.push({ type: "render-process-gone", details });
  });
  win.webContents.on("did-fail-load", (_event, code, description, url, isMainFrame) => {
    report.events.push({ type: "did-fail-load", code, description, url, isMainFrame });
  });
  win.webContents.on("did-finish-load", () => report.events.push({ type: "did-finish-load" }));

  try {
    await win.loadFile(path.join(__dirname, "index.html"));
    report.loaded = true;
    await new Promise((resolve) => setTimeout(resolve, 750));
    report.state = await win.webContents.executeJavaScript(`({
      bodyText: document.body.innerText,
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      cardColor: getComputedStyle(document.getElementById('smoke-card')).color,
      rendererReady: document.documentElement.dataset.rendererReady || '',
      preloadReady: window.rendererSmoke?.ready === true
    })`);
    const image = await win.webContents.capturePage();
    fs.writeFileSync(path.join(resultRoot, `${variant}.png`), image.toPNG());
  } catch (error) {
    report.error = serializeError(error);
  }

  fs.writeFileSync(path.join(resultRoot, `${variant}.json`), JSON.stringify(report, null, 2));
  app.exit(report.loaded && report.state?.rendererReady === "yes" && report.state?.preloadReady ? 0 : 2);
}).catch((error) => {
  fs.mkdirSync(resultRoot, { recursive: true });
  fs.writeFileSync(path.join(resultRoot, `${variant}.json`), JSON.stringify({ variant, fatal: serializeError(error) }, null, 2));
  app.exit(3);
});
