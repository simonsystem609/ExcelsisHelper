// Independently implemented, read-only extraction of a saved embedded preview
// from SOLIDWORKS part, assembly, and drawing files. The bounded parser runs in
// an isolated Node child and never opens or modifies a live CAD document.

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const SUPPORTED_EXTENSIONS = new Set([".sldprt", ".sldasm", ".slddrw"]);
const TAIL_BYTES = 192 * 1024;
const INFLATE_INPUT_CAP = 96 * 1024;
const MAX_INFLATE_ATTEMPTS = 32 * 1024;
const MAX_PNG_BYTES = 2 * 1024 * 1024;
const MAX_DIMENSION = 4096;
const MAX_PIXELS = 16 * 1024 * 1024;
const MAX_INPUT_JSON_BYTES = 1024 * 1024;
// Main launches one utility process per CAD file so failed inflate probes
// cannot retain native allocations across a large thumbnail batch.
const MAX_BATCH_ITEMS = 1;
const MAX_PATH_CHARS = 32767;

function validatedPng(png) {
  if (!Buffer.isBuffer(png) || png.length < 33 || png.length > MAX_PNG_BYTES) return null;
  if (!png.subarray(0, 8).equals(PNG_SIG)) return null;
  if (png.readUInt32BE(8) !== 13 || png.toString("ascii", 12, 16) !== "IHDR") return null;

  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  if (!width || !height || width > MAX_DIMENSION || height > MAX_DIMENSION) return null;
  if (width * height > MAX_PIXELS) return null;

  let offset = 8;
  let sawIend = false;
  while (offset + 12 <= png.length) {
    const chunkLength = png.readUInt32BE(offset);
    if (chunkLength > MAX_PNG_BYTES || offset + 12 + chunkLength > png.length) return null;
    const type = png.toString("ascii", offset + 4, offset + 8);
    offset += 12 + chunkLength;
    if (type === "IEND") {
      if (chunkLength !== 0) return null;
      sawIend = true;
      break;
    }
  }
  if (!sawIend) return null;
  return { png: png.subarray(0, offset), width, height };
}

function extractPreview(docPath, outPng) {
  let fd = null;
  try {
    if (!SUPPORTED_EXTENSIONS.has(path.extname(docPath).toLowerCase())) return null;
    if (path.extname(outPng).toLowerCase() !== ".png") return null;
    if (!docPath || !outPng || docPath.length > MAX_PATH_CHARS || outPng.length > MAX_PATH_CHARS) return null;

    fd = fs.openSync(docPath, "r");
    const size = fs.fstatSync(fd).size;
    if (!Number.isSafeInteger(size) || size <= 0) return null;
    const readLen = Math.min(TAIL_BYTES, size);
    const tail = Buffer.alloc(readLen);
    fs.readSync(fd, tail, 0, readLen, size - readLen);

    let attempts = 0;
    for (let offset = tail.length - 8; offset >= 0; offset--) {
      const low3 = tail[offset] & 0x07;
      if (low3 !== 4 && low3 !== 5) continue;
      attempts++;
      if (attempts > MAX_INFLATE_ATTEMPTS) break;
      try {
        const inflated = zlib.inflateRawSync(
          tail.subarray(offset, Math.min(offset + INFLATE_INPUT_CAP, tail.length)),
          { maxOutputLength: MAX_PNG_BYTES },
        );
        const candidate = validatedPng(inflated);
        if (candidate) {
          fs.writeFileSync(outPng, candidate.png);
          return candidate;
        }
      } catch {
        // Most candidate offsets are not compressed preview streams.
      }
    }
    return null;
  } catch {
    return null;
  } finally {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch {}
    }
  }
}

function readBatch(inputPath) {
  if (!inputPath || inputPath.length > MAX_PATH_CHARS) return [];
  const stat = fs.statSync(inputPath);
  if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_INPUT_JSON_BYTES) return [];
  const parsed = JSON.parse(fs.readFileSync(inputPath, "utf8").replace(/^\uFEFF/, ""));
  return Array.isArray(parsed) ? parsed.slice(0, MAX_BATCH_ITEMS) : [];
}

function main() {
  try {
    const results = [];
    for (const pair of readBatch(String(process.argv[2] || ""))) {
      const docPath = typeof pair?.path === "string" ? pair.path : "";
      const outPng = typeof pair?.outPng === "string" ? pair.outPng : "";
      const result = extractPreview(docPath, outPng);
      results.push({
        path: docPath,
        ok: Boolean(result),
        w: result ? result.width : 0,
        h: result ? result.height : 0,
      });
    }
    process.stdout.write(JSON.stringify({ results }));
  } catch {
    process.stdout.write(JSON.stringify({ results: [] }));
  }
}

if (require.main === module) main();

module.exports = { extractPreview, readBatch, validatedPng };
