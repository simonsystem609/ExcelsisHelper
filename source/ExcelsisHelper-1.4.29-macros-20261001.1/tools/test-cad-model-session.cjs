"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { EventEmitter } = require("node:events");

const source = fs.readFileSync(path.join(__dirname, "..", "cad-model-runtime",
  "sw-assembly-capture-session.cjs"), "utf8");
const identity = { sourcePath: "C:\\Models\\Assembly.SLDASM",
  configuration: "Default", updateStamp: 42 };

function frame(value) {
  const payload = Buffer.from(JSON.stringify(value), "utf8");
  const result = Buffer.alloc(payload.length + 4);
  result.writeUInt32LE(payload.length, 0);
  payload.copy(result, 4);
  return result;
}

function fixture(stamp = 42) {
  const events = [];
  let child;
  const spawn = (_exe, args) => {
    assert.deepEqual([...args], ["--session", identity.sourcePath, "Default", "42"]);
    child = new EventEmitter();
    child.pid = 123;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = new EventEmitter();
    child.stdin.write = (_line, callback) => callback();
    child.stdin.end = () => setImmediate(() => child.emit("close", 0));
    child.kill = () => setImmediate(() => child.emit("close", 1));
    setImmediate(() => child.stdout.emit("data", frame({
      format: "excelsis-sw-capture-pinned", formatVersion: 1,
      ...identity, updateStamp: stamp,
    })));
    return child;
  };
  const module = { exports: {} };
  vm.runInNewContext(source, { module, Buffer, setTimeout, clearTimeout,
    require: (name) => name === "node:child_process" ? { spawn } : require(name) },
  { filename: "sw-assembly-capture-session.cjs" });
  return {
    events,
    start: (onPinned) => module.exports.startSwAssemblyCaptureSession(
      "capture.exe", () => {}, identity, () => {
        events.push("pinned");
        child.stdout.emit("data", frame({
          format: "excelsis-sw-assembly-geometry", formatVersion: 1,
          ...identity, components: [],
        }));
        onPinned?.();
      }),
  };
}

(async () => {
  const valid = fixture();
  const session = await valid.start(() => valid.events.push("ready"));
  assert.equal(session.inventory.updateStamp, 42);
  assert.deepEqual(valid.events, ["pinned", "ready"]);
  await session.end();

  const changed = fixture(43);
  await assert.rejects(changed.start(), /did not pin/);
  assert.deepEqual(changed.events, []);
  console.log("CAD inactive-assembly capture handshake tests passed.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
