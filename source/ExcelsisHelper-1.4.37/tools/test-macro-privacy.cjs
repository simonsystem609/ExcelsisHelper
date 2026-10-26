"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..", "macros");
const privatePath = /[A-Z]:[\\/](?:Users[\\/](?!Public[\\/])|E_(?:HELPER|VIEWER|CAD)[\\/]|GITHUB[\\/])/i;

function containsPrivatePath(bytes) {
  return [bytes.toString("latin1"), bytes.toString("utf16le"), bytes.subarray(1).toString("utf16le")]
    .some((text) => privatePath.test(text));
}

const sample = ["C:", "Users", "Example", "macro.swp"].join("\\");
for (const encoding of ["latin1", "utf16le"]) {
  const bytes = Buffer.from(sample, encoding);
  assert.ok(containsPrivatePath(bytes));
  assert.ok(containsPrivatePath(Buffer.concat([Buffer.from([0]), bytes])));
}
assert.equal(containsPrivatePath(Buffer.from(["C:", "Macros", "Macro_000.swp"].join("\\"), "utf16le")), false);
const extendedSample = sample.replace("Example", "Example" + String.fromCharCode(233));
assert.ok(containsPrivatePath(Buffer.concat([Buffer.from([0xff, 0xc0]), Buffer.from(extendedSample, "latin1")])));
assert.equal(containsPrivatePath(Buffer.from(["C:", "Users", "Public", "macro.swp"].join("\\"), "latin1")), false);

const files = fs.readdirSync(root, { withFileTypes: true })
  .filter((file) => file.isFile() && file.name.endsWith(".swp"));
assert.equal(files.length, 9, "Expected the complete reviewed macro bundle");
for (const file of files) {
  assert.equal(containsPrivatePath(fs.readFileSync(path.join(root, file.name))), false,
    `${file.name}: compiled metadata contains a developer path`);
}
console.log("All nine compiled macros passed Latin-1 and both-alignment UTF-16 path checks.");
