class ThumbnailScheduler {
  constructor(options = {}) {
    if (typeof options.runBatch !== "function") throw new TypeError("runBatch is required.");
    this.runBatch = options.runBatch;
    this.batchLimit = Math.max(1, Number(options.batchLimit || 32));
    this.maxPending = Math.max(this.batchLimit, Number(options.maxPending || 256));
    this.minGapMs = Math.max(0, Number(options.minGapMs || 0));
    this.unrefTimers = options.unrefTimers !== false;
    this.pending = new Map();
    this.nextSequence = 1;
    this.active = false;
    this.lastBatchEndedAt = 0;
    this.timer = null;
    this.closed = false;
  }

  enqueue(entries, options = {}) {
    if (this.closed) return Promise.resolve([]);
    const normalized = this.#normalizeOptions(options);
    const completions = [];
    for (const entry of Array.isArray(entries) ? entries : []) {
      const docPath = String(entry?.path || "").trim();
      if (!docPath) continue;
      const key = docPath.toLowerCase();
      let job = this.pending.get(key);
      if (job) {
        job.entry = { ...job.entry, ...entry, path: docPath };
        job.options = this.#mergeOptions(job.options, normalized);
        completions.push(job.completion);
        continue;
      }
      if (this.pending.size >= this.maxPending && !this.#makeRoom(normalized.priority)) {
        completions.push(Promise.resolve({ processed: false, reason: "queue-cap" }));
        continue;
      }
      let resolveCompletion;
      const completion = new Promise((resolve) => { resolveCompletion = resolve; });
      job = {
        key,
        entry: { ...entry, path: docPath },
        options: normalized,
        sequence: this.nextSequence++,
        completion,
        resolve: resolveCompletion,
      };
      this.pending.set(key, job);
      completions.push(completion);
    }
    if (completions.length) this.#schedule();
    return Promise.all(completions);
  }

  close() {
    this.closed = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    for (const job of this.pending.values()) {
      job.resolve({ processed: false, reason: "closed" });
    }
    this.pending.clear();
  }

  #normalizeOptions(options) {
    const renderOnly = !!options.renderOnly;
    return {
      priority: Number.isFinite(Number(options.priority)) ? Number(options.priority) : 2,
      force: renderOnly || !!options.force,
      skipShellTier: renderOnly || !!options.skipShellTier,
      renderOnly,
      allowSolidWorksRender: renderOnly || !!options.allowSolidWorksRender,
    };
  }

  #mergeOptions(current, incoming) {
    const renderOnly = current.renderOnly || incoming.renderOnly;
    return {
      priority: Math.min(current.priority, incoming.priority),
      force: renderOnly || current.force || incoming.force,
      skipShellTier: renderOnly || current.skipShellTier || incoming.skipShellTier,
      renderOnly,
      allowSolidWorksRender: renderOnly
        || current.allowSolidWorksRender
        || incoming.allowSolidWorksRender,
    };
  }

  #makeRoom(incomingPriority) {
    let victim = null;
    for (const job of this.pending.values()) {
      if (job.options.priority <= incomingPriority) continue;
      if (!victim
        || job.options.priority > victim.options.priority
        || (job.options.priority === victim.options.priority && job.sequence > victim.sequence)) {
        victim = job;
      }
    }
    if (!victim) return false;
    this.pending.delete(victim.key);
    victim.resolve({ processed: false, reason: "queue-cap" });
    return true;
  }

  #modeKey(options) {
    return [
      options.force ? 1 : 0,
      options.skipShellTier ? 1 : 0,
      options.renderOnly ? 1 : 0,
      options.allowSolidWorksRender ? 1 : 0,
    ].join(":");
  }

  #schedule() {
    if (this.closed || this.active || this.timer || this.pending.size === 0) return;
    const delay = Math.max(0, this.minGapMs - (Date.now() - this.lastBatchEndedAt));
    this.timer = setTimeout(() => {
      this.timer = null;
      this.#drain().catch(() => {});
    }, delay);
    if (this.unrefTimers && typeof this.timer.unref === "function") this.timer.unref();
  }

  async #drain() {
    if (this.closed || this.active || this.pending.size === 0) return;
    const ordered = [...this.pending.values()]
      .sort((a, b) => (a.options.priority - b.options.priority) || (a.sequence - b.sequence));
    const first = ordered[0];
    const modeKey = this.#modeKey(first.options);
    const batch = ordered
      .filter((job) => this.#modeKey(job.options) === modeKey)
      .slice(0, this.batchLimit);
    for (const job of batch) this.pending.delete(job.key);

    this.active = true;
    try {
      const result = await this.runBatch(batch.map((job) => job.entry), first.options);
      for (const job of batch) job.resolve({ processed: true, result });
    } catch (error) {
      for (const job of batch) {
        job.resolve({
          processed: false,
          reason: "batch-error",
          error: String(error?.message || error),
        });
      }
    } finally {
      this.active = false;
      this.lastBatchEndedAt = Date.now();
      this.#schedule();
    }
  }
}

module.exports = { ThumbnailScheduler };
