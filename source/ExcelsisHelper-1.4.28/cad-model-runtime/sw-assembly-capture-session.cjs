"use strict";

const { spawn } = require("node:child_process");

const MAX_FRAME_BYTES = 68 * 1024 * 1024;
const MAX_COMMAND_BYTES = 4 * 1024 * 1024;

class SwAssemblyCaptureSession {
  constructor(exePath, setEcoQos = () => {}) {
    this.child = spawn(exePath, ["--session"],
      { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    this.buffer = Buffer.alloc(0);
    this.frames = [];
    this.waiter = null;
    this.error = null;
    this.closed = false;
    this.exitCode = null;
    this.stderr = "";
    this.busy = false;
    this.closedPromise = new Promise((resolve) => { this.resolveClosed = resolve; });
    this.child.stdout.on("data", (chunk) => this.onData(chunk));
    this.child.stderr.on("data", (chunk) => {
      this.stderr = (this.stderr + chunk.toString("utf8")).slice(-65536);
    });
    this.child.stdin.on("error", (error) => this.fail(error));
    this.child.on("error", (error) => this.fail(error));
    this.child.on("close", (code) => {
      this.closed = true;
      this.exitCode = code;
      if (code !== 0 || this.waiter) {
        this.fail(new Error(this.stderr.trim()
          || `SOLIDWORKS capture exited ${code === null ? "unexpectedly" : code}.`));
      }
      this.resolveClosed();
    });
    try { setEcoQos(this.child.pid); }
    catch (error) { this.fail(error); }
  }

  fail(error) {
    if (this.error) return;
    this.error = error;
    if (this.waiter) {
      const waiter = this.waiter;
      this.waiter = null;
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
    if (!this.closed) this.child.kill();
  }

  onData(chunk) {
    if (this.error) return;
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 4) {
      const length = this.buffer.readUInt32LE(0);
      if (length > MAX_FRAME_BYTES || this.buffer.length > MAX_FRAME_BYTES + 4) {
        this.fail(new Error("SOLIDWORKS capture response exceeds its size limit."));
        return;
      }
      if (this.buffer.length < length + 4) return;
      const frame = this.buffer.subarray(4, 4 + length);
      this.buffer = this.buffer.subarray(4 + length);
      if (this.waiter) {
        const waiter = this.waiter;
        this.waiter = null;
        clearTimeout(waiter.timer);
        waiter.resolve(frame);
      } else if (this.frames.length === 0) this.frames.push(frame);
      else {
        this.fail(new Error("SOLIDWORKS capture sent an unexpected response."));
        return;
      }
    }
  }

  receive(timeoutMs, phase) {
    if (this.error) return Promise.reject(this.error);
    if (this.frames.length) return Promise.resolve(this.frames.shift());
    if (this.closed) return Promise.reject(new Error("SOLIDWORKS capture closed early."));
    if (this.waiter) return Promise.reject(new Error("Concurrent SOLIDWORKS capture reads."));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.fail(new Error(`SOLIDWORKS ${phase} timed out.`));
      }, timeoutMs);
      this.waiter = { resolve, reject, timer };
    });
  }

  async command(value, timeoutMs = 90000, binary = false) {
    if (this.busy || this.closed || this.error)
      throw this.error || new Error("SOLIDWORKS capture is unavailable.");
    this.busy = true;
    try {
      const line = JSON.stringify(value) + "\n";
      if (Buffer.byteLength(line) > MAX_COMMAND_BYTES)
        throw new Error("SOLIDWORKS capture request exceeds its size limit.");
      await new Promise((resolve, reject) => {
        this.child.stdin.write(line, (error) => error ? reject(error) : resolve());
      });
      const frame = await this.receive(timeoutMs, value.op);
      if (binary) return frame;
      try { return JSON.parse(frame.toString("utf8")); }
      catch { throw new Error("SOLIDWORKS returned invalid capture data."); }
    } catch (error) {
      this.fail(error);
      throw error;
    } finally { this.busy = false; }
  }

  async end() {
    if (this.error) throw this.error;
    if (this.busy) throw new Error("SOLIDWORKS capture still has a pending request.");
    if (this.frames.length || this.buffer.length)
      throw new Error("SOLIDWORKS capture has an unconsumed response.");
    if (!this.closed) this.child.stdin.end('{"op":"end"}\n');
    const timer = setTimeout(() => this.fail(new Error("SOLIDWORKS capture did not exit.")), 5000);
    await this.closedPromise;
    clearTimeout(timer);
    if (this.error) throw this.error;
    if (this.exitCode !== 0) throw new Error(this.stderr.trim() || "SOLIDWORKS capture failed.");
  }

  async abort() {
    if (!this.closed) this.child.kill();
    await this.closedPromise;
  }
}

async function startSwAssemblyCaptureSession(exePath, setEcoQos, inventoryTimeoutMs = 150000) {
  const session = new SwAssemblyCaptureSession(exePath, setEcoQos);
  try {
    const frame = await session.receive(inventoryTimeoutMs, "assembly inventory");
    session.inventory = JSON.parse(frame.toString("utf8"));
    return session;
  } catch (error) {
    await session.abort();
    throw error;
  }
}

module.exports = { startSwAssemblyCaptureSession };
