const { parentPort, workerData } = require("node:worker_threads");
const fs = require("node:fs/promises");
const path = require("node:path");
const utilityParentPort = process.parentPort || null;

// Launched as an Electron utility process (config via JSON argv). Worker-thread
// support remains for focused development tests.
function readConfig() {
  if (workerData) return workerData;
  try { return JSON.parse(process.argv[2] || "{}"); } catch { return {}; }
}
const config = readConfig();
const extensions = new Set(config.extensions || []);
const skipDirNames = new Set((config.skipDirNames || []).map((name) => String(name).toLowerCase()));
// User-configured excluded locations (drives or folders): whole subtrees that
// are never enumerated. Normalized: lowercased, no trailing slash.
const excludePaths = (config.excludePaths || [])
  .map((s) => String(s || "").replace(/[\\/]+$/, "").toLowerCase())
  .filter(Boolean);
const schemaVersion = Number(config.schemaVersion || 1);

function numberConfig(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

const throttleEveryDirs = Math.max(1, numberConfig(config.throttleEveryDirs, 240));
const throttleMs = Math.max(0, numberConfig(config.throttleMs, 12));
const targetUtilization = Math.max(0.1, Math.min(1, numberConfig(config.targetUtilization, 0.5)));
const progressEveryDirs = Math.max(1, numberConfig(config.progressEveryDirs, 350));

function post(message) {
  if (parentPort) { try { parentPort.postMessage(message); } catch {} return; }
  if (utilityParentPort) { try { utilityParentPort.postMessage(message); } catch {} return; }
}

// Flush a terminal message, then exit when running as a standalone process.
function finish(message) {
  post(message);
  if (!parentPort) setTimeout(() => { try { process.exit(0); } catch {} }, 100);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function docSearchPathKey(p) {
  return path.normalize(String(p || "")).toLowerCase();
}

function shouldSkipDirectory(dirPath, dirName = "") {
  const name = String(dirName || path.basename(dirPath) || "").toLowerCase();
  if (skipDirNames.has(name)) return true;
  const p = String(dirPath || "").toLowerCase();
  if (excludePaths.length) {
    const c = p.replace(/[\\/]+$/, "");
    for (const ex of excludePaths) {
      if (c === ex || c.startsWith(`${ex}\\`) || c.startsWith(`${ex}/`)) return true;
    }
  }
  return /[\\/]appdata[\\/]/i.test(p)
    || /[\\/]windows[\\/]/i.test(p)
    || /[\\/]program files(?: \(x86\))?[\\/]/i.test(p)
    || /[\\/]programdata[\\/]/i.test(p)
    || /[\\/]node_modules[\\/]/i.test(p)
    || /[\\/]system volume information[\\/]/i.test(p)
    || /[\\/]__pycache__[\\/]/i.test(p);
}

function entryFromStat(full, name, dir, st) {
  return {
    path: full,
    name,
    ext: path.extname(name).toLowerCase(),
    dir,
    size: Number(st.size || 0),
    mtimeMs: Number(st.mtimeMs || 0),
    fileId: st.ino ? String(st.ino) : "",
  };
}

function removeDirEntries(entriesByPath, dirKey) {
  for (const [entryKey, entry] of entriesByPath) {
    if (docSearchPathKey(entry.dir || path.dirname(entry.path)) === dirKey) entriesByPath.delete(entryKey);
  }
}

async function readIndex(indexPath) {
  try {
    const parsed = JSON.parse(await fs.readFile(indexPath, "utf8"));
    return {
      schemaVersion: Number(parsed.schemaVersion || 0),
      generatedAt: Number(parsed.generatedAt || 0),
      updatedAt: Number(parsed.updatedAt || parsed.generatedAt || 0),
      roots: Array.isArray(parsed.roots) ? parsed.roots : [],
      entries: Array.isArray(parsed.entries)
        ? parsed.entries
            .filter((entry) => typeof entry?.path === "string")
            .map((entry) => {
              const name = entry.name || path.basename(entry.path);
              return {
                path: entry.path,
                name,
                ext: String(entry.ext || path.extname(name)).toLowerCase(),
                dir: entry.dir || path.dirname(entry.path),
                size: Number(entry.size || 0),
                mtimeMs: Number(entry.mtimeMs || 0),
                fileId: String(entry.fileId || ""),
              };
            })
        : [],
      dirs: parsed.dirs && typeof parsed.dirs === "object" ? parsed.dirs : {},
    };
  } catch {
    return { schemaVersion, generatedAt: 0, updatedAt: 0, roots: [], entries: [], dirs: {} };
  }
}

async function writeIndex(indexPath, index) {
  await fs.mkdir(path.dirname(indexPath), { recursive: true });
  // Compact (not pretty-printed) — the index is machine-read only, and at ~17k
  // entries this roughly halves the file size and the per-scan write I/O. A full
  // SQLite/NDJSON store isn't warranted at this scale (9.5 MB parses in ~47 ms).
  await fs.writeFile(indexPath, `${JSON.stringify(index)}\n`, "utf8");
}

async function scan() {
  const startedAt = Date.now();
  let throttleWallStartedAt = startedAt;
  let throttleCpuStartedAt = process.cpuUsage();
  const roots = Array.isArray(config.roots) ? config.roots : [];
  const previous = await readIndex(config.indexPath);
  const hasPreviousDirs = previous?.dirs && Object.keys(previous.dirs).length > 0;
  const full = !!config.force || Number(previous.schemaVersion || 0) < schemaVersion || !hasPreviousDirs || previous.entries.length === 0;
  const entriesByPath = new Map((full ? [] : previous.entries).map((entry) => [docSearchPathKey(entry.path), entry]));
  const dirsMeta = full ? {} : { ...(previous.dirs || {}) };
  const queue = [];
  const queued = new Set();
  let directoriesScanned = 0;
  let filesSeen = 0;

  const enqueue = (dir) => {
    const clean = path.normalize(String(dir || ""));
    if (!clean || shouldSkipDirectory(clean)) return;
    const key = docSearchPathKey(clean);
    if (queued.has(key)) return;
    queued.add(key);
    queue.push(clean);
  };

  for (const root of roots) enqueue(root);
  if (!full) {
    for (const meta of Object.values(previous.dirs || {})) {
      if (meta?.path) enqueue(meta.path);
    }
  }

  post({
    type: "progress",
    state: {
      scanning: true,
      startedAt,
      finishedAt: 0,
      roots,
      directoriesScanned,
      filesSeen,
      entries: entriesByPath.size,
      error: "",
      mode: full ? "full-worker" : "incremental-worker",
    },
  });

  while (queue.length) {
    const dir = queue.pop();
    const dirKey = docSearchPathKey(dir);
    if (!dir || shouldSkipDirectory(dir)) continue;

    let dirStat;
    try {
      dirStat = await fs.stat(dir);
      if (!dirStat.isDirectory()) continue;
    } catch {
      delete dirsMeta[dirKey];
      removeDirEntries(entriesByPath, dirKey);
      continue;
    }

    const prevDir = previous.dirs?.[dirKey];
    const mtimeMs = Number(dirStat.mtimeMs || 0);
    const unchanged = !full && prevDir && Math.abs(Number(prevDir.mtimeMs || 0) - mtimeMs) < 1;
    if (unchanged) {
      dirsMeta[dirKey] = { ...(prevDir || {}), path: dir, mtimeMs, checkedAt: Date.now() };
      directoriesScanned++;
    } else {
      try {
        const handle = await fs.opendir(dir);
        directoriesScanned++;
        removeDirEntries(entriesByPath, dirKey);
        for await (const dirent of handle) {
          const fullPath = path.join(dir, dirent.name);
          if (dirent.isSymbolicLink()) continue;
          if (dirent.isDirectory()) {
            if (!shouldSkipDirectory(fullPath, dirent.name)) enqueue(fullPath);
            continue;
          }
          if (!dirent.isFile()) continue;
          filesSeen++;
          // Skip SOLIDWORKS lock/temp files (~$Part.SLDPRT) — not real docs (0.9.6).
          if (dirent.name.startsWith("~$")) continue;
          const ext = path.extname(dirent.name).toLowerCase();
          if (!extensions.has(ext)) continue;
          try {
            const st = await fs.stat(fullPath);
            entriesByPath.set(docSearchPathKey(fullPath), entryFromStat(fullPath, dirent.name, dir, st));
          } catch {}
        }
        dirsMeta[dirKey] = { path: dir, mtimeMs, checkedAt: Date.now() };
      } catch {
        // Access denied and offline network folders are normal during a whole-PC crawl.
      }
    }

    if (directoriesScanned % progressEveryDirs === 0) {
      post({
        type: "progress",
        state: {
          scanning: true,
          startedAt,
          finishedAt: 0,
          roots,
          directoriesScanned,
          filesSeen,
          entries: entriesByPath.size,
          error: "",
          mode: full ? "full-worker" : "incremental-worker",
        },
      });
    }
    if (directoriesScanned > 0 && directoriesScanned % throttleEveryDirs === 0) {
      const now = Date.now();
      const cpu = process.cpuUsage(throttleCpuStartedAt);
      const cpuMs = (Number(cpu.user || 0) + Number(cpu.system || 0)) / 1000;
      const wallMs = Math.max(1, now - throttleWallStartedAt);
      const adaptiveSleepMs = Math.max(0, (cpuMs / targetUtilization) - wallMs);
      const requestedSleepMs = Math.max(throttleMs, adaptiveSleepMs);
      if (requestedSleepMs > 0) await sleep(Math.min(250, Math.ceil(requestedSleepMs)));
      throttleWallStartedAt = Date.now();
      throttleCpuStartedAt = process.cpuUsage();
    }
  }

  const now = Date.now();
  const index = {
    schemaVersion,
    generatedAt: full ? now : (previous.generatedAt || now),
    updatedAt: now,
    roots,
    entries: Array.from(entriesByPath.values()),
    dirs: dirsMeta,
  };
  await writeIndex(config.indexPath, index);
  return {
    schemaVersion,
    generatedAt: index.generatedAt,
    updatedAt: index.updatedAt,
    roots,
    entries: index.entries.length,
    directoriesScanned,
    filesSeen,
    mode: full ? "full-worker" : "incremental-worker",
    elapsedMs: Date.now() - startedAt,
  };
}

scan()
  .then((result) => finish({ type: "done", result }))
  .catch((error) => finish({ type: "error", error: String(error?.message || error) }));
