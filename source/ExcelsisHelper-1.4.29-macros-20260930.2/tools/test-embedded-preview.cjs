const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const zlib = require("node:zlib");
const { extractPreview, readBatch, validatedPng } = require("../scripts/extract-embedded-preview.cjs");

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data = Buffer.alloc(0)) {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([length, typeBytes, data, checksum]);
}

function makePng(width, height, textBytes = 60000) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const row = Buffer.alloc((64 * 4) + 1, 0xff);
  row[0] = 0;
  const pixels = Buffer.concat(Array.from({ length: 64 }, () => row));
  const text = Buffer.concat([Buffer.from("Comment\0", "latin1"), Buffer.alloc(textBytes, 0x41)]);
  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("tEXt", text),
    pngChunk("IDAT", zlib.deflateSync(pixels)),
    pngChunk("IEND"),
  ]);
}

function embeddedDocument(png) {
  const compressed = zlib.deflateRawSync(png, { level: 9 });
  assert.ok([4, 5].includes(compressed[0] & 0x07), "Fixture should use a dynamic DEFLATE block.");
  return Buffer.concat([Buffer.alloc(4096, 0x31), compressed, Buffer.alloc(24000)]);
}

function embeddedDocumentWithTwo(olderPng, latestPng) {
  const older = zlib.deflateRawSync(olderPng, { level: 9 });
  const latest = zlib.deflateRawSync(latestPng, { level: 9 });
  assert.ok([4, 5].includes(older[0] & 0x07));
  assert.ok([4, 5].includes(latest[0] & 0x07));
  return Buffer.concat([
    Buffer.alloc(4096, 0x31),
    older,
    Buffer.alloc(8000, 0x32),
    latest,
    Buffer.alloc(24000),
  ]);
}

const tempRoot = fs.realpathSync(os.tmpdir());
const tempDir = fs.mkdtempSync(path.join(tempRoot, "excelsis-preview-test-"));
try {
  const validPng = makePng(64, 64);
  assert.deepEqual(validatedPng(validPng)?.width, 64);
  const docPath = path.join(tempDir, "fixture.sldprt");
  const outPath = path.join(tempDir, "fixture.png");
  fs.writeFileSync(docPath, embeddedDocument(validPng));
  const extracted = extractPreview(docPath, outPath);
  assert.equal(extracted?.width, 64);
  assert.equal(extracted?.height, 64);
  assert.deepEqual(fs.readFileSync(outPath), validPng);

  const olderLargePng = makePng(320, 200, 90000);
  const latestPng = makePng(96, 64, 30000);
  const multiDocPath = path.join(tempDir, "multi.sldprt");
  const multiOutPath = path.join(tempDir, "multi.png");
  fs.writeFileSync(multiDocPath, embeddedDocumentWithTwo(olderLargePng, latestPng));
  const latestExtracted = extractPreview(multiDocPath, multiOutPath);
  assert.equal(latestExtracted?.width, 96);
  assert.deepEqual(fs.readFileSync(multiOutPath), latestPng);

  const unsafePng = makePng(5000, 1);
  const unsafeDoc = path.join(tempDir, "unsafe.sldasm");
  const unsafeOut = path.join(tempDir, "unsafe.png");
  fs.writeFileSync(unsafeDoc, embeddedDocument(unsafePng));
  assert.equal(extractPreview(unsafeDoc, unsafeOut), null);
  assert.equal(fs.existsSync(unsafeOut), false);

  const batchPath = path.join(tempDir, "batch.json");
  fs.writeFileSync(batchPath, JSON.stringify(Array.from({ length: 40 }, (_, index) => ({ path: String(index) }))));
  assert.equal(readBatch(batchPath).length, 1);

  const oversizedBatchPath = path.join(tempDir, "oversized.json");
  fs.writeFileSync(oversizedBatchPath, Buffer.alloc((1024 * 1024) + 1, 0x20));
  assert.deepEqual(readBatch(oversizedBatchPath), []);
} finally {
  const resolved = fs.realpathSync(tempDir);
  const relative = path.relative(tempRoot, resolved);
  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

console.log("Embedded preview extraction and resource-cap tests passed.");
