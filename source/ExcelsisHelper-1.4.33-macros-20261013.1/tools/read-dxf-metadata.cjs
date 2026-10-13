"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");

const MAX_HEADER_BYTES = 65536;
const BEGIN = "EXCELSIS-DXF-META-V1-BEGIN";
const END = "EXCELSIS-DXF-META-V1-END";
const JSON_PREFIX = "EXCELSIS-DXF-JSON ";
const OWNER_PREFIX = "EXCELSIS-DXF-OWNER ";
const CHECKSUM_PREFIX = "EXCELSIS-DXF-CHECKSUM ";
const DIGEST = /^[0-9A-F]{64}$/;

function decodeField(value) {
  return value.replace(/%09/g, "\t").replace(/%0D/g, "\r")
    .replace(/%0A/g, "\n").replace(/%25/g, "%");
}

function inspectDxfMetadata(input) {
  const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input);
  let position = bytes.subarray(0, 3).equals(Buffer.from([239, 187, 191])) ? 3 : 0;
  const bomBytes = position;
  const limit = Math.min(bytes.length, bomBytes + MAX_HEADER_BYTES);
  const line = () => {
    const end = bytes.indexOf(10, position);
    if (end < 0 || end >= limit) return null;
    let stop = end;
    if (stop > position && bytes[stop - 1] === 13) stop--;
    const value = bytes.toString("latin1", position, stop);
    position = end + 1;
    return value;
  };
  const code = line();
  if (code === null || code.trim() !== "999" || line() !== BEGIN) return null;
  const jsonChunks = [];
  const ownerChunks = [];
  let checksum;
  while (position < limit) {
    const group = line();
    const value = line();
    if (group === null || group.trim() !== "999" || value === null) {
      throw new Error("Incomplete embedded DXF identity.");
    }
    if (value === END) {
      const ownerHex = ownerChunks.join("");
      if (!ownerHex || ownerHex.length % 4 !== 0 || !/^[0-9A-F]+$/.test(ownerHex)) {
        throw new Error("Invalid embedded DXF ownership encoding.");
      }
      const owner = [];
      for (let i = 0; i < ownerHex.length; i += 4) {
        owner.push(String.fromCharCode(parseInt(ownerHex.slice(i, i + 4), 16)));
      }
      const record = owner.join("");
      const fields = record.split("\t");
      const json = jsonChunks.join("");
      if (fields.length !== 8 || fields[0] !== "embedded-v1" ||
          !DIGEST.test(fields[1]) || !DIGEST.test(fields[2]) ||
          !fields[5] || !fields[7] || !DIGEST.test(checksum || "")) {
        throw new Error("Invalid embedded DXF ownership fields.");
      }
      const actual = crypto.createHash("sha256").update(record + "\n" + json, "utf8")
        .digest("hex").toUpperCase();
      if (actual !== checksum) throw new Error("Embedded DXF identity checksum mismatch.");
      const metadata = JSON.parse(json);
      const keys = ["schemaVersion", "fullFilename", "configuration", "sourceId", "ownerId"];
      if (!metadata || typeof metadata !== "object" || Array.isArray(metadata) ||
          Object.keys(metadata).length !== keys.length ||
          !keys.every(key => Object.hasOwn(metadata, key)) ||
          metadata.schemaVersion !== 1 ||
          metadata.fullFilename !== decodeField(fields[5]) + ".dxf" ||
          metadata.configuration !== decodeField(fields[7]) ||
          metadata.sourceId !== fields[2] || metadata.ownerId !== fields[1]) {
        throw new Error("Embedded DXF name/configuration does not match its ownership record.");
      }
      return { metadata, bodyOffset: position, bomBytes };
    }
    if (value.startsWith(JSON_PREFIX)) jsonChunks.push(value.slice(JSON_PREFIX.length));
    else if (value.startsWith(OWNER_PREFIX)) ownerChunks.push(value.slice(OWNER_PREFIX.length));
    else if (value.startsWith(CHECKSUM_PREFIX)) {
      if (checksum !== undefined) throw new Error("Duplicate DXF identity checksum.");
      checksum = value.slice(CHECKSUM_PREFIX.length);
    } else throw new Error("Unknown embedded DXF identity record.");
  }
  throw new Error("Incomplete or oversized embedded DXF identity.");
}

function readDxfMetadata(input) {
  return inspectDxfMetadata(input)?.metadata ?? null;
}

module.exports = { MAX_HEADER_BYTES, inspectDxfMetadata, readDxfMetadata };

if (require.main === module) {
  const file = process.argv[2];
  if (!file) {
    process.stderr.write("Usage: node tools/read-dxf-metadata.cjs <file.dxf>\n");
    process.exitCode = 2;
  } else {
    let descriptor;
    try {
      descriptor = fs.openSync(file, "r");
      const header = Buffer.alloc(MAX_HEADER_BYTES + 3);
      const count = fs.readSync(descriptor, header, 0, header.length, 0);
      const metadata = readDxfMetadata(header.subarray(0, count));
      process.stdout.write(JSON.stringify(metadata, null, 2) + "\n");
      if (metadata === null) process.exitCode = 1;
    } catch (error) {
      process.stderr.write(error.message + "\n");
      process.exitCode = 1;
    } finally {
      if (descriptor !== undefined) fs.closeSync(descriptor);
    }
  }
}
