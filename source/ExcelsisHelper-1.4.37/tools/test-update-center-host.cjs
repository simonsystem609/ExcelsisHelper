"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const vm = require("node:vm");
const { EventEmitter } = require("node:events");
const { pathToFileURL } = require("node:url");

async function run() {
  const root = path.resolve(__dirname, "..");
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), "helper-update-host-"));
  const handlers = new Map(), windows = [], timers = [], calls = [];
  let serviceOptions, busy = false, dialogResponse = 1, processFailure = false;
  let shows = 0, checks = 0, cancels = 0, begins = 0, ends = 0;
  const service = { snapshot: () => ({}), check: async () => { checks++; return {}; },
    install: async key => { calls.push(["install", key]); return { ok: true }; }, cancel: () => { cancels++; } };
  class FakeWindow extends EventEmitter {
    constructor(options) {
      super(); this.options = options; this.dead = false; this.minimized = false;
      this.webContents = new EventEmitter();
      this.webContents.mainFrame = { url: pathToFileURL(path.join(root, "update-center.html")).href };
      this.webContents.isDestroyed = () => this.dead;
      this.webContents.setWindowOpenHandler = callback => { this.openHandler = callback; };
      this.webContents.send = (...args) => calls.push(["send", ...args]);
      windows.push(this);
    }
    isDestroyed() { return this.dead; }
    isMinimized() { return this.minimized; }
    restore() { this.minimized = false; }
    setMenu(value) { assert.equal(value, null); }
    show() { shows++; }
    focus() { calls.push(["focus"]); }
    loadFile(file) { this.file = file; }
  }
  const module = { exports: {} };
  const source = await fs.readFile(path.join(root, "update-center-host.cjs"), "utf8");
  const requireMock = name => name === "./update-service.cjs"
    ? { CACHE_MS: 21600000, createUpdateService: options => { serviceOptions = options; return service; } }
    : name === "./update-releases.cjs" ? require("../update-releases.cjs") : require(name);
  const timer = (callback, delay) => { const item = { callback, delay, cleared: false, unref() {} }; timers.push(item); return item; };
  vm.runInNewContext(source, { require: requireMock, module, URL, process,
    setTimeout: timer, setInterval: timer,
    clearTimeout: item => { if (item) item.cleared = true; }, clearInterval: item => { if (item) item.cleared = true; },
  }, { filename: "update-center-host.cjs" });
  const host = module.exports.createUpdateCenterHost({
    app: { getVersion: () => "1.4.37", getPath: () => folder }, BrowserWindow: FakeWindow,
    ipcMain: { handle: (name, callback) => { assert.equal(handlers.has(name), false); handlers.set(name, callback); } },
    dialog: { showMessageBox: async (_window, options) => { calls.push(["dialog", options]); return { response: dialogResponse }; } },
    shell: { openPath: async file => { calls.push(["openPath", file]); return ""; } },
    entryRoot: root, assetPath: (...args) => path.join(root, ...args), mainWindow: () => null,
    scheduleEcoQos: () => calls.push(["ecoqos"]), onAvailability: () => {},
    powershell: "powershell.exe", powerShellArgs: (...args) => ["-NoProfile", "-NonInteractive", ...args],
    execFile: (file, args, options, callback) => {
      calls.push(["exec", file, args, options]);
      callback(processFailure ? new Error("Synthetic process failure") : null,
        args.includes("-Command") ? '{"versions":["1.1.49","1.1.50"]}' : '{"ok":true,"updated":["DXF_v16.swp"]}');
    },
    isMacroBusy: async () => busy, beginMacroUpdate: async () => { begins++; }, endMacroUpdate: async () => { ends++; },
  });
  assert.deepEqual([...handlers.keys()], ["updates:catalog", "updates:install"]);
  host.start(); host.start();
  assert.equal(timers.length, 2); assert.equal(timers[0].delay, 15000); assert.equal(timers[1].delay, 21600000);
  await timers[0].callback(); await timers[1].callback();
  assert.equal(checks, 2); assert.equal(windows.length, 0); assert.equal(calls.length, 0);
  host.open(); const window = windows[0];
  assert.equal(window.options.show, false);
  assert.equal(window.options.webPreferences.contextIsolation, true);
  assert.equal(window.options.webPreferences.sandbox, true);
  assert.equal(window.options.webPreferences.nodeIntegration, false);
  assert.equal(window.options.webPreferences.preload, path.join(root, "update-center-preload.cjs"));
  assert.equal(window.openHandler().action, "deny");
  for (const name of ["will-navigate", "will-attach-webview"]) {
    let prevented = false; window.webContents.emit(name, { preventDefault: () => { prevented = true; } }); assert.equal(prevented, true);
  }
  window.emit("ready-to-show"); assert.equal(shows, 1);
  window.minimized = true; host.open(); assert.equal(windows.length, 1); assert.equal(window.minimized, false);
  const event = { sender: window.webContents, senderFrame: window.webContents.mainFrame };
  await handlers.get("updates:catalog")(event, { force: true });
  for (const untrusted of [{}, { ...event, sender: {} }, { ...event, senderFrame: { url: event.senderFrame.url } }]) {
    assert.throws(() => handlers.get("updates:catalog")(untrusted), /Blocked/);
  }
  const validUrl = event.senderFrame.url;
  for (const url of [pathToFileURL(path.join(root, "automation.html")).href, validUrl + "?x=1", validUrl + "#x", "https://github.com/"]) {
    event.senderFrame.url = url; assert.throws(() => handlers.get("updates:install")(event, "helper"), /Blocked/);
  }
  event.senderFrame.url = validUrl;
  serviceOptions.onProgress({ productKey: "macros", percent: 50 }); assert.equal(calls.at(-1)[1], "updates:progress");
  assert.equal(await serviceOptions.confirm({ kind: "app", title: "Excelsis Helper", version: "1.4.38" }), false);
  assert.equal(calls.at(-1)[1].defaultId, 1); assert.equal(calls.at(-1)[1].cancelId, 1);
  assert.equal(await serviceOptions.retryLocked("Sharing violation"), false);
  assert.equal(calls.at(-1)[1].buttons.join(","), "Retry,Later");
  dialogResponse = 0; assert.equal(await serviceOptions.confirm({ kind: "macros", revision: "20261026.1", names: ["DXF_v16.swp"] }), true);
  if (process.platform === "win32") {
    assert.equal(await serviceOptions.readInstalledVersion("viewer"), "1.1.50");
    const registry = calls.at(-1);
    assert.equal(registry[3].windowsHide, true); assert.equal(registry[3].timeout, 15000);
    assert.ok(registry[2].at(-1).includes("OpenSubKey")); assert.ok(!registry[2].at(-1).includes("SetValue"));
  }
  await assert.rejects(serviceOptions.readInstalledVersion("helper"), /Only the companion/);
  busy = true; await assert.rejects(serviceOptions.applyMacros({}), /deferred/); assert.equal(begins, 0);
  busy = false;
  assert.equal((await serviceOptions.applyMacros({ requestPath: path.join(folder, "request.json"), requestSha256: "a".repeat(64) })).ok, true);
  assert.equal(begins, 1); assert.equal(ends, 1);
  assert.equal(calls.at(-1)[3].timeout, undefined, "Never kill an active macro transaction on a timeout");
  processFailure = true;
  await assert.rejects(serviceOptions.applyMacros({ requestPath: "fixture", requestSha256: "a".repeat(64) }), /Synthetic/);
  assert.equal(begins, 2); assert.equal(ends, 2);
  window.dead = true; window.emit("closed"); assert.equal(cancels, 1);
  assert.throws(() => handlers.get("updates:catalog")(event), /Blocked/);
  host.stop(); assert.equal(cancels, 2); assert.equal(timers[1].cleared, true);
  const preload = await fs.readFile(path.join(root, "update-center-preload.cjs"), "utf8");
  assert.ok(!preload.includes("excelsisAutomation"));
  assert.ok(!(await fs.readFile(path.join(root, "preload.cjs"), "utf8")).includes('invoke("updates:install"'));
  console.log("Update Center host passed: quiet timers, secure singleton window, exact-frame IPC, denied navigation, cancel-default prompts, registry-only detection and macro guard. No Electron or live application calls.");
}
run().catch(error => { console.error(error); process.exitCode = 1; });
