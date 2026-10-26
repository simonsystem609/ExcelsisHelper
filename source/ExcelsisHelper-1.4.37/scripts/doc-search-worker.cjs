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

function numberConfig(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

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

function shouldSkipDirectory(dirPath, dirName = "", settings = config) {
  const skipDirNames = settings.skipDirNames || [];
  const excludePaths = settings.excludePaths || [];
  const name = String(dirName || path.basename(dirPath) || "").toLowerCase();
  if (name === "#recycle" || name === "$recycle.bin") return true;
  if (skipDirNames.includes(name)) return true;
  const p = String(dirPath || "").toLowerCase();
  if (p.split(/[\\/]/).some((segment) => segment === "#recycle" || segment === "$recycle.bin" || skipDirNames.includes(segment))) return true;
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

function createEntryIndex(entries) {
  const index = { entriesByPath: new Map(), entryKeysByDir: new Map() };
  for (const entry of entries) addEntry(index, entry);
  return index;
}

function addEntry(index, entry) {
  const entryKey = docSearchPathKey(entry.path);
  const dirKey = docSearchPathKey(entry.dir || path.dirname(entry.path));
  const old = index.entriesByPath.get(entryKey);
  if (old) {
    const oldDir = docSearchPathKey(old.dir || path.dirname(old.path));
    if (oldDir !== dirKey) index.entryKeysByDir.get(oldDir)?.delete(entryKey);
  }
  index.entriesByPath.set(entryKey, entry);
  if (!index.entryKeysByDir.has(dirKey)) index.entryKeysByDir.set(dirKey, new Set());
  index.entryKeysByDir.get(dirKey).add(entryKey);
}

function removeDirEntries(index, dirKey) {
  const keys = index.entryKeysByDir.get(dirKey);
  if (!keys) return;
  for (const key of keys) index.entriesByPath.delete(key);
  index.entryKeysByDir.delete(dirKey);
}

async function readIndex(indexPath, schemaVersion, io) {
  try {
    const parsed = JSON.parse(await io.readFile(indexPath, "utf8"));
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

async function writeIndex(indexPath, index, io) {
  await io.mkdir(path.dirname(indexPath), { recursive: true });
  // Compact (not pretty-printed) — the index is machine-read only, and at ~17k
  // entries this roughly halves the file size and the per-scan write I/O. A full
  // SQLite/NDJSON store isn't warranted at this scale (9.5 MB parses in ~47 ms).
  await io.writeFile(indexPath, `${JSON.stringify(index)}\n`, "utf8");
}

async function scan(settings = config, io = fs, notify = post) {
  settings = {
    ...settings,
    skipDirNames: (settings.skipDirNames || []).map((name) => String(name).toLowerCase()),
    excludePaths: (settings.excludePaths || []).map((name) => String(name).replace(/[\\/]+$/, "").toLowerCase()).filter(Boolean),
  };
  const schemaVersion = Number(settings.schemaVersion || 1);
  const extensions = new Set(settings.extensions || []);
  const throttleEveryDirs = Math.max(1, numberConfig(settings.throttleEveryDirs, 240));
  const throttleMs = Math.max(0, numberConfig(settings.throttleMs, 12));
  const targetUtilization = Math.max(0.1, Math.min(1, numberConfig(settings.targetUtilization, 0.5)));
  const progressEveryDirs = Math.max(1, numberConfig(settings.progressEveryDirs, 350));
  const startedAt = Date.now();
  let throttleWallStartedAt = startedAt;
  let throttleCpuStartedAt = process.cpuUsage();
  const roots = Array.isArray(settings.roots) ? settings.roots : [];
  const rootFor = (dir) => roots.find((root) => {
    const relative = path.relative(root, dir);
    return !relative || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`));
  });
  const previous = await readIndex(settings.indexPath, schemaVersion, io);
  const hasPreviousDirs = previous?.dirs && Object.keys(previous.dirs).length > 0;
  const full = !!settings.force || Number(previous.schemaVersion || 0) < schemaVersion || !hasPreviousDirs || previous.entries.length === 0;
  const targeted = !full && Array.isArray(settings.changedDirs) && settings.changedDirs.length > 0;
  const mode = full ? "full-worker" : (targeted ? "changed-folders-worker" : "incremental-worker");
  const entryIndex = createEntryIndex(previous.entries.filter((entry) =>
    rootFor(entry.path) && extensions.has(entry.ext) && !shouldSkipDirectory(entry.dir, "", settings)));
  const { entriesByPath } = entryIndex;
  const dirsMeta = Object.fromEntries(Object.entries(previous.dirs || {}).filter(([, meta]) =>
    meta?.path && rootFor(meta.path) && !shouldSkipDirectory(meta.path, "", settings)));
  const queue = [];
  const queued = new Set();
  const forcedDirs = new Set();
  const childDirs = new Map();
  for (const meta of Object.values(previous.dirs || {})) {
    if (!meta?.path) continue;
    const parentKey = docSearchPathKey(path.dirname(meta.path));
    if (!childDirs.has(parentKey)) childDirs.set(parentKey, []);
    childDirs.get(parentKey).push(meta.path);
  }
  let directoriesScanned = 0;
  let filesSeen = 0;

  const enqueue = (dir) => {
    const clean = path.normalize(String(dir || ""));
    if (!clean || !rootFor(clean) || shouldSkipDirectory(clean, "", settings)) return;
    const key = docSearchPathKey(clean);
    if (queued.has(key)) return;
    queued.add(key);
    queue.push(clean);
  };

  if (targeted) {
    for (const dir of settings.changedDirs) {
      if (typeof dir !== "string" || !path.isAbsolute(dir) || !rootFor(dir)) continue;
      forcedDirs.add(docSearchPathKey(dir));
      enqueue(dir);
    }
  } else {
    for (const root of roots) enqueue(root);
  }
  if (!targeted) {
    for (const meta of Object.values(previous.dirs || {})) {
      if (meta?.path) enqueue(meta.path);
    }
  }

  const rootAvailable = new Map();
  const ancestorLinks = new Map();
  const dirStats = new Map();
  const readDirStat = (dir) => {
    const key = docSearchPathKey(dir);
    if (!dirStats.has(key)) dirStats.set(key, io.lstat(dir));
    return dirStats.get(key);
  };
  const hasLinkedAncestor = async (dir) => {
    const root = rootFor(dir);
    let ancestor = path.dirname(dir);
    while (ancestor !== root && rootFor(ancestor)) {
      const key = docSearchPathKey(ancestor);
      if (!ancestorLinks.has(key)) {
        try { ancestorLinks.set(key, (await readDirStat(ancestor)).isSymbolicLink()); }
        catch { return true; }
      }
      if (ancestorLinks.get(key)) return true;
      const parent = path.dirname(ancestor);
      if (parent === ancestor) break;
      ancestor = parent;
    }
    return false;
  };
  const removeMissingSubtree = async (dir, dirKey) => {
    const root = rootFor(dir);
    const rootKey = docSearchPathKey(root);
    if (dirKey === rootKey) return;
    if (rootAvailable.get(rootKey) === false) return;
    try { rootAvailable.set(rootKey, (await io.stat(root)).isDirectory()); }
    catch { rootAvailable.set(rootKey, false); }
    if (!rootAvailable.get(rootKey)) return;
    for (const key of Object.keys(dirsMeta)) {
      if (key === dirKey || key.startsWith(`${dirKey}${path.sep}`)) {
        delete dirsMeta[key];
        removeDirEntries(entryIndex, key);
      }
    }
  };

  notify({
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
      mode,
    },
  });

  while (queue.length) {
    const dir = queue.pop();
    const dirKey = docSearchPathKey(dir);
    if (!dir || shouldSkipDirectory(dir, "", settings)) continue;

    let dirStat;
    try {
      if (await hasLinkedAncestor(dir)) continue;
      dirStat = await readDirStat(dir);
      if (dirStat.isSymbolicLink()) continue;
      if (!dirStat.isDirectory()) {
        await removeMissingSubtree(dir, dirKey);
        continue;
      }
    } catch (error) {
      if (error.code === "ENOENT" || error.code === "ENOTDIR") await removeMissingSubtree(dir, dirKey);
      continue;
    }

    const prevDir = previous.dirs?.[dirKey];
    const mtimeMs = Number(dirStat.mtimeMs || 0);
    const unchanged = !full && !forcedDirs.has(dirKey) && prevDir && Math.abs(Number(prevDir.mtimeMs || 0) - mtimeMs) < 1;
    if (unchanged) {
      dirsMeta[dirKey] = { ...(prevDir || {}), path: dir, mtimeMs, checkedAt: Date.now() };
      directoriesScanned++;
    } else {
      try {
        const handle = await io.opendir(dir);
        directoriesScanned++;
        const freshEntries = [];
        const discoveredDirs = [];
        for await (const dirent of handle) {
          const fullPath = path.join(dir, dirent.name);
          if (dirent.isSymbolicLink()) continue;
          if (dirent.isDirectory()) {
            if (!shouldSkipDirectory(fullPath, dirent.name, settings)) discoveredDirs.push(fullPath);
            continue;
          }
          if (!dirent.isFile()) continue;
          filesSeen++;
          // Skip SOLIDWORKS lock/temp files (~$Part.SLDPRT) — not real docs (0.9.6).
          if (dirent.name.startsWith("~$")) continue;
          const ext = path.extname(dirent.name).toLowerCase();
          if (!extensions.has(ext)) continue;
          try {
            const st = await io.stat(fullPath);
            freshEntries.push(entryFromStat(fullPath, dirent.name, dir, st));
          } catch {
            const oldEntry = entriesByPath.get(docSearchPathKey(fullPath));
            if (oldEntry) freshEntries.push(oldEntry);
          }
        }
        // Replace only after a complete enumeration, not midway through an SMB failure.
        removeDirEntries(entryIndex, dirKey);
        for (const entry of freshEntries) addEntry(entryIndex, entry);
        for (const child of discoveredDirs) enqueue(child);
        if (targeted) for (const child of childDirs.get(dirKey) || []) enqueue(child);
        dirsMeta[dirKey] = { path: dir, mtimeMs, checkedAt: Date.now() };
      } catch {
        // Access denied and offline network folders are normal during a whole-PC crawl.
      }
    }

    if (directoriesScanned % progressEveryDirs === 0) {
      notify({
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
          mode,
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
  await writeIndex(settings.indexPath, index, io);
  return {
    schemaVersion,
    generatedAt: index.generatedAt,
    updatedAt: index.updatedAt,
    roots,
    entries: index.entries.length,
    directoriesScanned,
    filesSeen,
    mode,
    elapsedMs: Date.now() - startedAt,
  };
}

module.exports = { scan, createEntryIndex, addEntry, removeDirEntries, docSearchPathKey };
if (parentPort || utilityParentPort || require.main === module) {
  scan()
    .then((result) => finish({ type: "done", result }))
    .catch((error) => finish({ type: "error", error: String(error?.message || error) }));
}
