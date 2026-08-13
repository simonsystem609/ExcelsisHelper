const assert = require("node:assert/strict");
const { ThumbnailScheduler } = require("../thumbnail-scheduler.cjs");

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

async function waitFor(predicate, timeoutMs = 1000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("Timed out waiting for scheduler state.");
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
}

async function run() {
  const firstBatchGate = deferred();
  const batches = [];
  const scheduler = new ThumbnailScheduler({
    batchLimit: 2,
    maxPending: 4,
    minGapMs: 0,
    unrefTimers: false,
    runBatch: async (entries, options) => {
      batches.push({ paths: entries.map((entry) => entry.path), options });
      if (batches.length === 1) await firstBatchGate.promise;
      return entries.length;
    },
  });

  const background = scheduler.enqueue([{ path: "background-a" }], { priority: 2 });
  await waitFor(() => batches.length === 1);
  const duplicate = scheduler.enqueue([{ path: "recent-a", marker: 1 }], { priority: 1 });
  const upgradedDuplicate = scheduler.enqueue([{ path: "recent-a", marker: 2 }], {
    priority: 0,
    force: true,
  });
  const docSearch = scheduler.enqueue([{ path: "doc-search-a" }], { priority: 2 });
  firstBatchGate.resolve();

  await Promise.all([background, duplicate, upgradedDuplicate, docSearch]);
  assert.deepEqual(batches.map((batch) => batch.paths), [
    ["background-a"],
    ["recent-a"],
    ["doc-search-a"],
  ]);
  assert.equal(batches[1].options.priority, 0);
  assert.equal(batches[1].options.force, true);
  scheduler.close();

  const cappedBatches = [];
  const capped = new ThumbnailScheduler({
    batchLimit: 1,
    maxPending: 2,
    minGapMs: 0,
    unrefTimers: false,
    runBatch: async (entries) => { cappedBatches.push(entries[0].path); },
  });
  const lowA = capped.enqueue([{ path: "low-a" }], { priority: 3 });
  const lowB = capped.enqueue([{ path: "low-b" }], { priority: 3 });
  const urgent = capped.enqueue([{ path: "urgent" }], { priority: 0 });
  const cappedResults = await Promise.all([lowA, lowB, urgent]);
  assert.ok(cappedResults.some((result) => result[0].reason === "queue-cap"));
  assert.ok(cappedBatches.includes("urgent"));
  capped.close();
}

run().then(() => {
  console.log("Thumbnail scheduler priority, dedupe, and queue-cap tests passed.");
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
