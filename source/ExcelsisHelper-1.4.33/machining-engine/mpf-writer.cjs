"use strict";

const crypto = require("node:crypto");
const path = require("node:path");
const { parseMpfProgram } = require("./mpf-parser.cjs");

const MAX_DETAILED_AUDIT_EDITS = 5000;
const AUDIT_LINE_SAMPLE_LIMIT = 50;

function sha256Buffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function decodeMpfBuffer(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value || []);
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return { text: buffer.subarray(3).toString("utf8"), encoding: "utf8", bom: "utf8" };
  }
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return { text: buffer.subarray(2).toString("utf16le"), encoding: "utf16le", bom: "utf16le" };
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    const body = Buffer.from(buffer.subarray(2));
    if (body.length % 2 !== 0) throw new Error("The UTF-16BE MPF has an incomplete final code unit.");
    body.swap16();
    return { text: body.toString("utf16le"), encoding: "utf16be", bom: "utf16be" };
  }
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    return { text: decoder.decode(buffer), encoding: "utf8", bom: "none" };
  } catch {
    // SolidCAM installations commonly emit a Windows single-byte code page.
    // Latin-1 is used as a one-byte transport mapping so every original byte
    // survives unchanged; only ASCII numeric tokens are ever replaced.
    return { text: buffer.toString("latin1"), encoding: "single-byte", bom: "none" };
  }
}

function encodeMpfText(text, descriptor = {}) {
  const encoding = descriptor.encoding || "utf8";
  let body;
  if (encoding === "single-byte") {
    for (const char of String(text)) {
      if (char.codePointAt(0) > 0xff) {
        throw new Error("The optimized MPF contains a character that cannot be preserved in its original single-byte encoding.");
      }
    }
    body = Buffer.from(String(text), "latin1");
  } else if (encoding === "utf16le") {
    body = Buffer.from(String(text), "utf16le");
  } else if (encoding === "utf16be") {
    body = Buffer.from(String(text), "utf16le");
    body.swap16();
  } else {
    body = Buffer.from(String(text), "utf8");
  }
  const bom = descriptor.bom || "none";
  if (bom === "utf8") return Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), body]);
  if (bom === "utf16le") return Buffer.concat([Buffer.from([0xff, 0xfe]), body]);
  if (bom === "utf16be") return Buffer.concat([Buffer.from([0xfe, 0xff]), body]);
  return body;
}

function normalizeOptimizedSuffix(value, fallback = "_optimized") {
  const clean = String(value || "").trim();
  if (!clean) return fallback;
  if (clean.length > 40 || clean === "." || clean === ".." || clean.includes("..")) {
    throw new Error("The optimized filename suffix is invalid.");
  }
  if (/[<>:"/\\|?*\x00-\x1f]/.test(clean) || /[. ]$/.test(clean)) {
    throw new Error("The optimized filename suffix contains a character Windows filenames cannot use.");
  }
  return clean;
}

function optimizedPathFor(sourcePath, suffix) {
  const parsed = path.parse(path.resolve(String(sourcePath || "")));
  if (parsed.ext.toLowerCase() !== ".mpf") throw new Error("The source must be an .MPF file.");
  const safeSuffix = normalizeOptimizedSuffix(suffix);
  const destination = path.join(parsed.dir, `${parsed.name}${safeSuffix}${parsed.ext}`);
  if (destination.toLowerCase() === path.resolve(sourcePath).toLowerCase()) {
    throw new Error("The optimized copy must have a different filename.");
  }
  return destination;
}

function formatNumericReplacement(value, oldText) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error("Replacement values must be positive numbers.");
  const raw = String(oldText || "").trim();
  const sign = raw.startsWith("+") ? "+" : "";
  const decimal = /([.,])(\d*)$/.exec(raw.replace(/^[+-]/, ""));
  if (!decimal) return `${sign}${Number.isInteger(number) ? number : Number(number.toFixed(6))}`;
  const separator = decimal[1];
  const digits = decimal[2].length;
  const formatted = digits === 0 ? `${Math.round(number)}.` : number.toFixed(digits);
  return `${sign}${separator === "," ? formatted.replace(".", ",") : formatted}`;
}

function flattenChangeGroups(proposal) {
  return (proposal?.tools || []).flatMap((tool) => tool.changeGroups || []);
}

function forEachSourceToken(token, callback) {
  if (token?.type !== "feed_word_batch") {
    callback(token);
    return;
  }
  const lineIndexes = token.lineIndexes || [];
  const starts = token.starts || [];
  const ends = token.ends || [];
  if (lineIndexes.length !== starts.length || lineIndexes.length !== ends.length) {
    throw new Error(`Feed definition ${token.definitionId || ""} has an invalid compact token batch.`);
  }
  for (let index = 0; index < lineIndexes.length; index += 1) {
    callback({
      type: "feed_word",
      definitionId: token.definitionId,
      lineIndex: lineIndexes[index],
      lineNumber: Number(lineIndexes[index]) + 1,
      start: starts[index],
      end: ends[index],
      oldText: token.oldText,
      oldValue: token.oldValue,
    });
  }
}

function expandAcceptedEdits(proposal) {
  const edits = [];
  const replacementCache = new Map();
  for (const group of flattenChangeGroups(proposal)) {
    if (!group.accepted || !group.editable) continue;
    for (const token of group.tokens || []) {
      forEachSourceToken(token, (sourceToken) => {
        if (Number(sourceToken.oldValue) === Number(group.proposedValue)) return;
        const lineIndex = Number(sourceToken.lineIndex);
        const start = Number(sourceToken.start);
        const end = Number(sourceToken.end);
        if (!Number.isInteger(lineIndex) || lineIndex < 0 || !Number.isInteger(start)
            || !Number.isInteger(end) || start < 0 || end <= start) {
          throw new Error(`Change ${group.id} has an invalid source token.`);
        }
        const replacementKey = `${group.proposedValue}\u0000${sourceToken.oldText}`;
        let newText = replacementCache.get(replacementKey);
        if (newText === undefined) {
          newText = formatNumericReplacement(group.proposedValue, sourceToken.oldText);
          replacementCache.set(replacementKey, newText);
        }
        edits.push({
          groupId: group.id,
          toolId: group.toolId,
          kind: group.kind,
          classification: group.classification,
          source: group.source,
          lineIndex,
          lineNumber: lineIndex + 1,
          start,
          end,
          oldText: String(sourceToken.oldText),
          oldValue: Number(sourceToken.oldValue),
          newValue: Number(group.proposedValue),
          newText,
        });
      });
    }
  }
  edits.sort((a, b) => a.lineIndex - b.lineIndex || a.start - b.start || a.end - b.end);
  for (let index = 1; index < edits.length; index += 1) {
    const previous = edits[index - 1];
    const current = edits[index];
    if (previous.lineIndex !== current.lineIndex || previous.end <= current.start) continue;
    const sameSpan = previous.start === current.start && previous.end === current.end;
    if (sameSpan && previous.newText === current.newText && previous.oldText === current.oldText) {
      edits.splice(index, 1);
      index -= 1;
      continue;
    }
    throw new Error(`Changes ${previous.groupId} and ${current.groupId} overlap on line ${current.lineNumber}.`);
  }
  return edits;
}

function summarizeAcceptedEdits(proposal, lineLimit = AUDIT_LINE_SAMPLE_LIMIT) {
  const groups = [];
  let editCount = 0;
  for (const group of flattenChangeGroups(proposal)) {
    if (!group.accepted || !group.editable) continue;
    let tokenCount = 0;
    const lineNumbers = new Set();
    for (const token of group.tokens || []) {
      if (Number(token.oldValue) === Number(group.proposedValue)) continue;
      if (token.type === "feed_word_batch") {
        const indexes = token.lineIndexes || [];
        tokenCount += indexes.length;
        for (let index = 0; index < indexes.length && lineNumbers.size < lineLimit; index += 1) {
          lineNumbers.add(Number(indexes[index]) + 1);
        }
      } else {
        tokenCount += 1;
        if (lineNumbers.size < lineLimit) lineNumbers.add(Number(token.lineIndex) + 1);
      }
    }
    if (!tokenCount) continue;
    editCount += tokenCount;
    groups.push({
      groupId: group.id,
      toolId: group.toolId,
      kind: group.kind,
      classification: group.classification,
      source: group.source,
      from: [...new Set((group.tokens || []).map((token) => Number(token.oldValue)))],
      to: Number(group.proposedValue),
      tokenCount,
      lineNumbers: [...lineNumbers],
      lineNumbersTruncated: tokenCount > lineNumbers.size,
    });
  }
  return { editCount, groupCount: groups.length, groups };
}

function summarizeExpandedEdits(edits, lineLimit = AUDIT_LINE_SAMPLE_LIMIT) {
  const grouped = new Map();
  for (const edit of edits) {
    let item = grouped.get(edit.groupId);
    if (!item) {
      item = {
        groupId: edit.groupId,
        toolId: edit.toolId,
        kind: edit.kind,
        classification: edit.classification,
        source: edit.source,
        from: new Set(),
        to: edit.newValue,
        tokenCount: 0,
        lineNumbers: new Set(),
      };
      grouped.set(edit.groupId, item);
    }
    item.from.add(edit.oldValue);
    item.tokenCount += 1;
    if (item.lineNumbers.size < lineLimit) item.lineNumbers.add(edit.lineNumber);
  }
  return [...grouped.values()].map((item) => ({
    ...item,
    from: [...item.from],
    lineNumbers: [...item.lineNumbers],
    lineNumbersTruncated: item.tokenCount > item.lineNumbers.size,
  }));
}

function lineStartOffsets(text) {
  const starts = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== "\n") continue;
    starts.push(index + 1);
  }
  return starts;
}

function applyTokenEdits(sourceText, edits) {
  const source = String(sourceText || "");
  const starts = lineStartOffsets(source);
  const chunks = [];
  let sourceOffset = 0;
  for (const edit of edits) {
    const lineStart = starts[edit.lineIndex];
    if (lineStart === undefined) throw new Error(`Line ${edit.lineNumber} no longer exists in the source MPF.`);
    const start = lineStart + edit.start;
    const end = lineStart + edit.end;
    if (start < sourceOffset) throw new Error(`Change ${edit.groupId} overlaps an earlier source token.`);
    if (source.slice(start, end) !== edit.oldText) {
      throw new Error(`Line ${edit.lineNumber} changed after analysis; expected "${edit.oldText}".`);
    }
    chunks.push(source.slice(sourceOffset, start), edit.newText);
    sourceOffset = end;
  }
  chunks.push(source.slice(sourceOffset));
  return chunks.join("");
}

function structureSignature(analysis) {
  return {
    lineCount: analysis.lineCount,
    lineEnding: analysis.lineEnding,
    tools: (analysis.tools || []).map((tool) => ({
      label: tool.label,
      headerToolNumber: tool.headerToolNumber,
      process: tool.process,
      toolType: tool.toolType,
    })),
    cycles: (analysis.definitions?.cycles || []).map((cycle) => ({
      name: cycle.name,
      modal: cycle.modal,
      lineIndex: cycle.lineIndex,
      blockNumber: cycle.blockNumber,
      argumentCount: cycle.argumentTokens?.length || 0,
      toolId: cycle.toolId,
    })),
  };
}

function buildOptimizedText(sourceText, proposal, parserOptions = {}, verificationOptions = {}) {
  let edits = expandAcceptedEdits(proposal);
  if (!edits.length) throw new Error("No accepted numeric changes are ready to write.");
  const editCount = edits.length;
  const editSummary = summarizeExpandedEdits(edits);
  const detailedEdits = edits.slice(0, MAX_DETAILED_AUDIT_EDITS);
  const rewrittenText = applyTokenEdits(sourceText, edits);
  edits = null;
  const verificationParserOptions = { ...parserOptions, compact: true, structureOnly: true };
  const originalStructure = verificationOptions.expectedStructure || structureSignature(
    parseMpfProgram(sourceText, verificationParserOptions),
  );
  const rewrittenAnalysis = parseMpfProgram(rewrittenText, verificationParserOptions);
  const rewrittenStructure = structureSignature(rewrittenAnalysis);
  if (JSON.stringify(originalStructure) !== JSON.stringify(rewrittenStructure)) {
    throw new Error("The optimized copy failed structural verification; no file was written.");
  }
  return {
    text: rewrittenText,
    edits: detailedEdits,
    editsTruncated: editCount > detailedEdits.length,
    editCount,
    editSummary,
    verification: {
      lineCount: rewrittenAnalysis.lineCount,
      toolCount: rewrittenAnalysis.tools.length,
      cycleCount: rewrittenAnalysis.definitions.cycles.length,
      structurePreserved: true,
      exactTokenEditCount: editCount,
      detailedAuditLimit: MAX_DETAILED_AUDIT_EDITS,
    },
  };
}

module.exports = {
  applyTokenEdits,
  buildOptimizedText,
  decodeMpfBuffer,
  encodeMpfText,
  expandAcceptedEdits,
  formatNumericReplacement,
  normalizeOptimizedSuffix,
  optimizedPathFor,
  sha256Buffer,
  structureSignature,
  summarizeAcceptedEdits,
};
