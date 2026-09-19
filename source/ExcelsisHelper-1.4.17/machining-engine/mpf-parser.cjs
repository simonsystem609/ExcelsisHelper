"use strict";

function cleanOption(value, fallback) {
  const clean = typeof value === "string" ? value.trim() : "";
  return clean || fallback;
}

function numeric(value) {
  const number = Number(String(value ?? "").trim().replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

const NUMBER_PATTERN = "[-+]?(?:\\d+(?:[.,]\\d*)?|[.,]\\d+)";

function uniqueNumbers(values) {
  return [...new Set(values.filter((value) => Number.isFinite(value)))];
}

function findNumericWords(code, letter) {
  const words = [];
  const expression = new RegExp(`(^|\\s)(${letter}\\s*=?\\s*)(${NUMBER_PATTERN})`, "ig");
  let match;
  while ((match = expression.exec(code))) {
    const start = match.index + match[1].length + match[2].length;
    const end = start + match[3].length;
    words.push({
      letter: letter.toUpperCase(),
      value: numeric(match[3]),
      rawValue: match[3],
      start,
      end,
      rawWord: code.slice(match.index + match[1].length, end),
    });
  }
  return words;
}

function parseCycleCall(code, lineIndex, blockNumber) {
  const match = /\b(CYCLE\d+|POCKET\w*|SLOT\w*|HOLES\w*|LONGHOLE\w*)\s*\(/i.exec(code);
  if (!match) return null;
  const open = match.index + match[0].lastIndexOf("(");
  let depth = 0;
  let close = -1;
  for (let index = open; index < code.length; index += 1) {
    if (code[index] === "(") depth += 1;
    else if (code[index] === ")") {
      depth -= 1;
      if (depth === 0) {
        close = index;
        break;
      }
    }
  }
  if (close < 0) return null;
  const argumentTokens = [];
  let tokenStart = open + 1;
  let nested = 0;
  for (let index = open + 1; index <= close; index += 1) {
    const char = code[index];
    if (char === "(") nested += 1;
    if (char === ")" && index < close) nested -= 1;
    if ((char === "," && nested === 0) || index === close) {
      const rawStart = tokenStart;
      const rawEnd = index;
      const raw = code.slice(rawStart, rawEnd);
      const leading = raw.match(/^\s*/)?.[0].length || 0;
      const trailing = raw.match(/\s*$/)?.[0].length || 0;
      const start = rawStart + leading;
      const end = Math.max(start, rawEnd - trailing);
      const trimmed = code.slice(start, end);
      argumentTokens.push({
        index: argumentTokens.length,
        raw,
        text: trimmed,
        value: new RegExp(`^${NUMBER_PATTERN}$`).test(trimmed) ? numeric(trimmed) : null,
        start,
        end,
      });
      tokenStart = index + 1;
    }
  }
  const name = match[1].toUpperCase();
  const modal = /\bMCALL\s+/i.test(code.slice(0, match.index + 1));
  const valueAt = (index) => argumentTokens[index]?.value ?? null;
  const cycle = {
    id: null,
    name,
    modal,
    lineIndex,
    lineNumber: lineIndex + 1,
    blockNumber,
    start: match.index,
    end: close + 1,
    argumentTokens,
    holeCount: modal ? 0 : 1,
    programmedDepthMm: null,
    peckDepthMm: null,
    pitchMm: null,
    tapRpm: null,
    retractRpm: null,
  };
  if (["CYCLE81", "CYCLE83", "CYCLE84"].includes(name)) {
    cycle.programmedDepthMm = Math.abs(valueAt(3) ?? valueAt(4) ?? 0) || null;
  }
  if (name === "CYCLE83") {
    cycle.peckDepthMm = Math.abs(valueAt(5) ?? valueAt(6) ?? 0) || null;
  }
  if (name === "CYCLE84") {
    cycle.pitchMm = valueAt(8);
    cycle.tapRpm = valueAt(10);
    cycle.retractRpm = valueAt(11);
  }
  return cycle;
}

function parseToolGeometry(description, label) {
  const source = `${description || ""} ${label || ""}`;
  const diameterMatch = source.match(/(?:^|\s|_)D\s*=?\s*(\d+(?:[.,_]\d+)?)/i)
    || source.match(/(\d+(?:[.,_]\d+)?)\s*MM\b/i);
  const diameterMm = diameterMatch ? numeric(diameterMatch[1].replace("_", ".")) : null;
  const radiusMatch = source.match(/(?:^|[^A-Z])R\s*=?\s*(\d+(?:[.,_]\d+)?)/i);
  const radius = radiusMatch ? numeric(radiusMatch[1].replace("_", ".")) : null;
  const fluteMatch = source.match(/(?:^|\s|_)(\d+)\s*F(?:L|LUTE|LUTES)?\b/i);
  const fluteCount = fluteMatch ? Number(fluteMatch[1]) : null;
  return {
    diameterMm: Number.isFinite(diameterMm) && diameterMm > 0 && diameterMm <= 250 ? diameterMm : null,
    radiusMm: Number.isFinite(radius) && radius >= 0 && radius <= 250 ? radius : null,
    fluteCount: Number.isInteger(fluteCount) && fluteCount > 0 && fluteCount <= 20 ? fluteCount : null,
  };
}

function toolIdentityTokens(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/,/g, ".")
    .match(/[a-z]+|\d+(?:\.\d+)?/g) || [];
}

function catalogMatchScore(item, label) {
  const labelText = String(label || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const idText = String(item?.id || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (!labelText || !idText) return 0;
  if (labelText === idText) return 1000;
  if (labelText.length >= 2 && (labelText.includes(idText) || idText.includes(labelText))) return 700;
  const labelTokens = toolIdentityTokens(label);
  const itemTokens = toolIdentityTokens(`${item.id} ${item.description}`);
  const shared = labelTokens.filter((token) => itemTokens.includes(token));
  const hasNumber = shared.some((token) => /\d/.test(token));
  const hasWord = shared.some((token) => /[a-z]/.test(token) && token !== "d" && token !== "r");
  return (shared.length * 80) + (hasNumber ? 120 : 0) + (hasWord ? 160 : 0);
}

function resolveCatalogMatch(catalog, items, label) {
  const key = String(label || "").toLowerCase();
  const direct = catalog.get(key);
  if (direct) return { item: direct, confidence: "high", evidence: "exact tool-catalog ID" };
  const ranked = items
    .map((item) => ({ item, score: catalogMatchScore(item, label) }))
    .filter(({ score }) => score >= 240)
    .sort((a, b) => b.score - a.score || a.item.number - b.item.number);
  if (!ranked.length) return { item: null, confidence: null, evidence: "no tool-catalog match" };
  if (ranked[1]?.score === ranked[0].score) {
    return { item: null, confidence: "low", evidence: "ambiguous tool-catalog match" };
  }
  return {
    item: ranked[0].item,
    confidence: "medium",
    evidence: `unique fuzzy tool-catalog match (${ranked[0].score})`,
  };
}

function lowerConfidence(first, second) {
  const rank = { low: 0, medium: 1, high: 2 };
  if (!first) return second;
  if (!second) return first;
  return rank[first] <= rank[second] ? first : second;
}

function classifyTool(description, label, cycleNames = []) {
  const text = `${description || ""} ${label || ""} ${cycleNames.join(" ")}`.toUpperCase();
  const geometry = parseToolGeometry(description, label);
  const evidence = [];
  let confidence = "high";
  const matched = (expression, reason) => {
    if (!expression.test(text)) return false;
    evidence.push(reason);
    return true;
  };
  let process = "milling";
  let toolType = "square_endmill";
  if (matched(/THREAD\s*MILL|MENETMAR/, "thread-mill wording")) {
    process = "milling";
    toolType = "thread_mill";
  } else if (matched(/\bTAP\b|MENET|GEWINDE|CYCLE84/, "tap wording or CYCLE84")) {
    process = "tapping";
    toolType = "tap";
  } else if (matched(/\bREAM(?:ER|ING)?\b|DORZSAR/, "reamer wording")) {
    process = "reaming";
    toolType = "reamer";
  } else if (matched(/CENTER\s*DRILL|CENT(?:ER|RE).*DRILL/, "center-drill wording")) {
    process = "drilling";
    toolType = "center_drill";
  } else if (matched(/\bSPOT(?:TING)?\b/, "spot-drill wording")) {
    process = "drilling";
    toolType = "spot_drill";
  } else if (matched(/\bDRILL\b|BOHR|FURO|FURAS/, "drill wording")) {
    process = "drilling";
    toolType = "drill";
  } else if (matched(/BALL\s*NOSE|BALLNOSE|GOMBMARO/, "ballnose wording")) {
    toolType = "ballnose";
  } else if (matched(/CHAMFER|ENGRAV|SULLYESZT|FAZ/, "chamfer/engraving wording")) {
    toolType = "chamfer";
  } else if (matched(/ROUGH/, "roughing wording")) {
    toolType = "roughing_endmill";
  } else if (matched(/BULL\s*NOSE|CORNER\s*RADIUS/, "corner-radius wording")) {
    toolType = "corner_radius";
  } else if (matched(/FACE\s*MILL|SIK\s*MARO|SIKMARO/, "face-mill wording")) {
    toolType = "face_mill";
  } else if (matched(/END\s*MILL|\bMILL\b|MILLING|CUTTER/, "milling wording")) {
    toolType = geometry.radiusMm > 0 ? "corner_radius" : "square_endmill";
  } else if (geometry.diameterMm && geometry.radiusMm !== null) {
    toolType = geometry.radiusMm > 0 && Math.abs((geometry.radiusMm * 2) - geometry.diameterMm) < 0.01
      ? "ballnose" : (geometry.radiusMm > 0 ? "corner_radius" : "square_endmill");
    evidence.push("diameter/radius tool-label geometry");
    confidence = "medium";
  } else if (geometry.diameterMm) {
    toolType = "square_endmill";
    evidence.push("diameter-only tool-label geometry");
    confidence = "medium";
  } else if (matched(/CYCLE8[13]/, "drilling cycle fallback")) {
    process = "drilling";
    toolType = "drill";
  } else {
    evidence.push("unknown wording; retained legacy milling fallback");
    confidence = "low";
  }
  const pointAngleDeg = process === "drilling" && geometry.radiusMm > 20 ? geometry.radiusMm : null;
  const cornerRadiusMm = toolType === "corner_radius" && geometry.radiusMm !== null ? geometry.radiusMm : null;
  return {
    process,
    toolKind: process === "milling" ? "milling" : "drill",
    toolType,
    confidence,
    evidence,
    pointAngleDeg,
    cornerRadiusMm,
    ballRadiusMm: toolType === "ballnose" ? geometry.radiusMm : null,
    includedAngleDeg: toolType === "chamfer" && geometry.radiusMm > 0 ? geometry.radiusMm : null,
    ...geometry,
  };
}

function arcLength(from, to, words, motion, plane) {
  const dx = (to.x ?? from.x ?? 0) - (from.x ?? to.x ?? 0);
  const dy = (to.y ?? from.y ?? 0) - (from.y ?? to.y ?? 0);
  const dz = (to.z ?? from.z ?? 0) - (from.z ?? to.z ?? 0);
  const chord = Math.hypot(dx, dy);
  if (![2, 3].includes(motion) || plane !== "G17" || from.x === null || from.y === null || to.x === null || to.y === null) {
    return Math.hypot(dx, dy, dz);
  }
  const i = words.i;
  const j = words.j;
  if (!Number.isFinite(i) || !Number.isFinite(j)) return Math.hypot(chord, dz);
  const cx = from.x + i;
  const cy = from.y + j;
  const radius = Math.hypot(from.x - cx, from.y - cy);
  if (!Number.isFinite(radius) || radius <= 0) return Math.hypot(chord, dz);
  const start = Math.atan2(from.y - cy, from.x - cx);
  const end = Math.atan2(to.y - cy, to.x - cx);
  let sweep = motion === 2 ? start - end : end - start;
  while (sweep < 0) sweep += Math.PI * 2;
  if (sweep < 1e-12 && chord < 1e-9) sweep = Math.PI * 2;
  const planar = radius * sweep;
  return Math.hypot(planar, dz);
}

function secondsFromHms(hours, minutes, seconds) {
  return (Number(hours) * 3600) + (Number(minutes) * 60) + Number(seconds);
}

function parseMpfProgram(text, options = {}) {
  const sourceText = String(text || "");
  const compact = options.compact === true;
  const structureOnly = options.structureOnly === true;
  const lineEnding = sourceText.includes("\r\n") ? "\r\n" : "\n";
  const lines = sourceText.split(/\r?\n/);
  const defaultMillingToolMaterial = cleanOption(
    options.defaultMillingToolMaterial ?? options.defaultMillingToolType,
    "Carbide",
  );
  const defaultDrillToolMaterial = cleanOption(
    options.defaultDrillToolMaterial ?? options.defaultDrillToolType,
    "HSS",
  );
  const defaultTapToolMaterial = cleanOption(options.defaultTapToolMaterial, defaultDrillToolMaterial);
  const toolMaterialOverride = cleanOption(options.toolMaterialOverride ?? options.toolTypeOverride, "");

  const headerComments = [];
  const toolCatalog = new Map();
  const toolCatalogItems = [];
  const postedTimes = { overall: null, perTool: [] };
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const rawLine = lines[lineIndex];
    const trimmed = rawLine.trim();
    if (lineIndex < 120 && trimmed.startsWith(";") && headerComments.length < 40) {
      headerComments.push(trimmed.slice(1).trim().slice(0, 240));
    }
    const overall = /SZAMITOTT\s+MEGMUNK\.\s*IDO\s*:\s*(\d+)\s+ORA\s*:\s*(\d+)\s+PERC\s*:\s*(\d+)\s+SEC/i.exec(rawLine);
    if (overall) {
      postedTimes.overall = {
        lineIndex,
        lineNumber: lineIndex + 1,
        hours: Number(overall[1]),
        minutes: Number(overall[2]),
        secondsPart: Number(overall[3]),
        totalSeconds: secondsFromHms(overall[1], overall[2], overall[3]),
        raw: rawLine,
      };
    }
    if (lineIndex >= 300) continue;
    const header = /^\s*;\s*T(\d+)\s+(.+?)\s+ID\s*:\s*(.+)$/i.exec(rawLine);
    if (!header) continue;
    const tail = header[3];
    const sum = /,\s*SUM\s*:\s*(\d+)\s*:\s*(\d+)\s*:\s*(\d+)/i.exec(tail);
    const zmin = /ZMIN\s*=\s*(-?\d+(?:[.,]\d+)?)/i.exec(tail);
    const id = tail.split(/,\s*SUM\s*:|,?\s*-\s*ZMIN\s*=/i)[0].trim().replace(/,+$/, "");
    const item = {
      number: Number(header[1]),
      description: header[2].trim().slice(0, 200),
      id: id.slice(0, 160),
      lineIndex,
      zMinMm: zmin ? numeric(zmin[1]) : null,
      postedTimeSeconds: sum ? secondsFromHms(sum[1], sum[2], sum[3]) : null,
    };
    if (sum) {
      postedTimes.perTool.push({
        toolNumber: item.number,
        toolId: item.id,
        lineIndex,
        lineNumber: lineIndex + 1,
        totalSeconds: item.postedTimeSeconds,
        raw: rawLine,
      });
    }
    if (item.id) toolCatalog.set(item.id.toLowerCase(), item);
    toolCatalog.set(`t${item.number}`, item);
    toolCatalogItems.push(item);
  }

  const tools = [];
  const toolByKey = new Map();
  const feedDefinitions = [];
  const spindleDefinitions = [];
  const cycles = [];
  const motionRecords = [];
  const motionTimeSegmentMap = new Map();
  const compactFeedDefinitionByKey = new Map();
  let motionSequence = 0;
  const hasAnyM6 = /(?:^|[\s;])M0?6(?:[\s;]|$)/mi.test(sourceText);
  let currentTool = null;
  let pendingTool = null;

  function ensureTool(label) {
    const key = String(label || "UNKNOWN").toLowerCase();
    if (toolByKey.has(key)) return toolByKey.get(key);
    const catalogMatch = resolveCatalogMatch(toolCatalog, toolCatalogItems, label);
    const catalog = catalogMatch.item;
    const provisional = classifyTool(catalog?.description || "", label, []);
    const tool = {
      id: `tool-${tools.length + 1}`,
      label: String(label || "UNKNOWN"),
      description: catalog?.description || "",
      headerToolNumber: catalog?.number || null,
      headerLineIndex: catalog?.lineIndex ?? null,
      headerZMinMm: catalog?.zMinMm ?? null,
      postedTimeSeconds: catalog?.postedTimeSeconds ?? null,
      process: provisional.process,
      toolKind: provisional.toolKind,
      toolType: provisional.toolType,
      classificationConfidence: lowerConfidence(provisional.confidence, catalogMatch.confidence),
      classificationEvidence: [...provisional.evidence, catalogMatch.evidence],
      catalogMatchConfidence: catalogMatch.confidence,
      catalogMatchEvidence: catalogMatch.evidence,
      diameterMm: provisional.diameterMm,
      fluteCount: provisional.fluteCount,
      effectiveTeeth: provisional.fluteCount,
      pointAngleDeg: provisional.pointAngleDeg,
      cornerRadiusMm: provisional.cornerRadiusMm,
      ballRadiusMm: provisional.ballRadiusMm,
      includedAngleDeg: provisional.includedAngleDeg,
      toolMaterial: "",
      rpmDefinitions: [],
      feedDefinitions: [],
      cyclesDetailed: [],
      coolantModes: new Set(),
      cuttingZLevels: new Set(),
      minZ: null,
      entries: { helix: 0, ramp: 0, plunge: 0, arc: 0, straight: 0 },
      exits: { arc: 0, straight: 0 },
      stepoverSamples: [],
      entryDepthSamples: [],
      cuttingLenMm: 0,
      cuttingTimeMin: 0,
      rapidMoves: 0,
      cuttingMoves: 0,
      motionRecordIds: [],
    };
    tools.push(tool);
    toolByKey.set(key, tool);
    return tool;
  }

  const position = { x: null, y: null, z: null };
  let modalMotion = null;
  let incremental = false;
  let units = "mm";
  let feedMode = "mm_per_min";
  const feedModesUsed = new Set([feedMode]);
  let inchUnitsUsed = false;
  let coordinateTransformUsed = false;
  let controlFlowUsed = false;
  let nonXyPlaneUsed = false;
  let plane = "G17";
  let workOffset = null;
  let spindleDirection = null;
  let spindleRpm = null;
  let currentFeed = null;
  let currentFeedDefinition = null;

  function addFeedUsage(definition, usage) {
    if (!definition) return;
    if (!compact) {
      definition.usages.push(usage);
      return;
    }
    const key = `${usage.toolId}\u0000${usage.classification}`;
    let aggregate = definition.usageSummary.get(key);
    if (!aggregate) {
      aggregate = {
        toolId: usage.toolId,
        classification: usage.classification,
        lengthMm: 0,
        count: 0,
      };
      definition.usageSummary.set(key, aggregate);
    }
    aggregate.lengthMm += Number(usage.lengthMm || 0);
    aggregate.count += 1;
  }

  function addMotionTimeSegment(record) {
    if (!compact || !currentFeedDefinition || record.classification === "rapid"
        || !(record.lengthMm > 0) || !(record.feedMmMin > 0)) return;
    const values = [
      record.toolId || "",
      record.classification || "unknown",
      record.feedMode || "mm_per_min",
      Number(record.spindleRpm) || 0,
    ];
    const key = JSON.stringify(values);
    const existing = currentFeedDefinition.motionSummary.get(key);
    if (existing) {
      existing.lengthMm += record.lengthMm;
      existing.motionCount += 1;
      return;
    }
    currentFeedDefinition.motionSummary.set(key, {
      toolId: values[0],
      classification: values[1],
      feedMmMin: Number(record.feedMmMin),
      feedMode: values[2],
      spindleRpm: values[3] || null,
      lengthMm: record.lengthMm,
      motionCount: 1,
    });
  }

  function finalizeCompactFeedDefinition(definition) {
    if (!compact || !definition || definition.finalized) return;
    definition.finalized = true;
    const usages = [...definition.usageSummary.values()];
    const signature = usages
      .map((usage) => `${usage.toolId}\u0000${usage.classification}`)
      .sort()
      .join("\u0001") || `unused:${definition.toolIdAtDefinition || ""}`;
    const key = JSON.stringify([definition.value, definition.feedMode, signature]);
    let aggregate = compactFeedDefinitionByKey.get(key);
    if (!aggregate) {
      aggregate = {
        id: `feed-${feedDefinitions.length + 1}`,
        toolIdAtDefinition: definition.toolIdAtDefinition,
        lineIndex: definition.lineIndex,
        lineNumber: definition.lineNumber,
        blockNumber: definition.blockNumber,
        value: definition.value,
        rawValue: definition.rawValue,
        feedMode: definition.feedMode,
        start: definition.start,
        end: definition.end,
        rawWord: definition.rawWord,
        usages: [],
        tokenBatches: [],
        sourceDefinitionCount: 0,
        _usageSummary: new Map(),
        _tokenBatchByText: new Map(),
      };
      compactFeedDefinitionByKey.set(key, aggregate);
      feedDefinitions.push(aggregate);
    }
    definition.aggregate = aggregate;
    aggregate.sourceDefinitionCount += 1;
    for (const usage of usages) {
      const usageKey = `${usage.toolId}\u0000${usage.classification}`;
      let combined = aggregate._usageSummary.get(usageKey);
      if (!combined) {
        combined = {
          toolId: usage.toolId,
          classification: usage.classification,
          lengthMm: 0,
          count: 0,
        };
        aggregate._usageSummary.set(usageKey, combined);
      }
      combined.lengthMm += Number(usage.lengthMm || 0);
      combined.count += Number(usage.count || 0);
    }
    let batch = aggregate._tokenBatchByText.get(definition.rawValue);
    if (!batch) {
      batch = {
        oldText: definition.rawValue,
        lineIndexes: [],
        starts: [],
        ends: [],
      };
      aggregate._tokenBatchByText.set(definition.rawValue, batch);
      aggregate.tokenBatches.push(batch);
    }
    batch.lineIndexes.push(definition.lineIndex);
    batch.starts.push(definition.start);
    batch.ends.push(definition.end);
    for (const cycle of definition.cycles) cycle.feedDefinitionId = aggregate.id;
    for (const segment of definition.motionSummary.values()) {
      const segmentKey = JSON.stringify([
        aggregate.id,
        segment.toolId,
        segment.classification,
        segment.feedMode,
        segment.spindleRpm || 0,
      ]);
      const existing = motionTimeSegmentMap.get(segmentKey);
      if (existing) {
        existing.lengthMm += segment.lengthMm;
        existing.motionCount += segment.motionCount;
      } else {
        motionTimeSegmentMap.set(segmentKey, {
          ...segment,
          feedDefinitionId: aggregate.id,
        });
      }
    }
  }

  function addGeometrySample(collection, value) {
    if (!compact || collection.length < 5000) collection.push(value);
  }

  function addZLevel(collection, value) {
    if (!compact || collection.size < 5000 || collection.has(value)) collection.add(value);
  }
  let activeModalCycle = null;
  let previousWasCutting = false;
  let cutsSinceRapid = 0;
  let lastCutZ = null;
  let incrementalUsed = false;
  let previousCutRecord = null;
  let previousCutUsage = null;
  let previousCutDefinition = null;
  let previousCutTool = null;
  let collectingEntryDepth = true;
  let entryStartZ = null;
  let entryMinimumZ = null;

  function finishEntryDepthSample(tool = currentTool) {
    const value = Number.isFinite(entryStartZ) && Number.isFinite(entryMinimumZ)
      ? Math.round((entryStartZ - entryMinimumZ) * 1000) / 1000 : 0;
    if (tool && value > 0.005 && value < 100) addGeometrySample(tool.entryDepthSamples, value);
    entryStartZ = null;
    entryMinimumZ = null;
  }

  function resetEntryDepth(tool = currentTool) {
    finishEntryDepthSample(tool);
    collectingEntryDepth = true;
  }

  function adjustCompactUsage(definition, usage, oldClassification, newClassification) {
    if (!compact || !definition || !usage) return;
    const aggregate = definition.finalized ? definition.aggregate : null;
    const usageMap = aggregate?._usageSummary || definition.usageSummary;
    if (usageMap) {
      const oldKey = `${usage.toolId}\u0000${oldClassification}`;
      const oldValue = usageMap.get(oldKey);
      if (oldValue) {
        oldValue.lengthMm -= Number(usage.lengthMm || 0);
        oldValue.count -= 1;
        if (oldValue.count <= 0) usageMap.delete(oldKey);
      }
      const newKey = `${usage.toolId}\u0000${newClassification}`;
      let newValue = usageMap.get(newKey);
      if (!newValue) {
        newValue = { toolId: usage.toolId, classification: newClassification, lengthMm: 0, count: 0 };
        usageMap.set(newKey, newValue);
      }
      newValue.lengthMm += Number(usage.lengthMm || 0);
      newValue.count += 1;
    }

    const rpm = Number(previousCutRecord?.spindleRpm) || 0;
    const values = [usage.toolId || "", oldClassification, previousCutRecord?.feedMode || "mm_per_min", rpm];
    const oldMotionKey = aggregate
      ? JSON.stringify([aggregate.id, ...values])
      : JSON.stringify(values);
    const newValues = [values[0], newClassification, values[2], values[3]];
    const newMotionKey = aggregate
      ? JSON.stringify([aggregate.id, ...newValues])
      : JSON.stringify(newValues);
    const motionMap = aggregate ? motionTimeSegmentMap : definition.motionSummary;
    const oldMotion = motionMap?.get(oldMotionKey);
    if (oldMotion) {
      oldMotion.lengthMm -= Number(previousCutRecord?.lengthMm || 0);
      oldMotion.motionCount -= 1;
      if (oldMotion.motionCount <= 0) motionMap.delete(oldMotionKey);
      const existing = motionMap.get(newMotionKey);
      if (existing) {
        existing.lengthMm += Number(previousCutRecord?.lengthMm || 0);
        existing.motionCount += 1;
      } else {
        motionMap.set(newMotionKey, {
          toolId: newValues[0],
          classification: newClassification,
          feedDefinitionId: aggregate?.id,
          feedMmMin: Number(previousCutRecord?.feedMmMin),
          feedMode: newValues[2],
          spindleRpm: newValues[3] || null,
          lengthMm: Number(previousCutRecord?.lengthMm || 0),
          motionCount: 1,
        });
      }
    }
  }

  function markPreviousLeadOut() {
    if (!previousCutRecord) return;
    const oldClassification = previousCutRecord.classification;
    if (oldClassification === "lead_out") return;
    previousCutRecord.isLeadOut = true;
    const usageKey = `${previousCutUsage?.toolId || ""}\u0000${oldClassification}`;
    const sourceUsageCount = compact
      ? Number(previousCutDefinition?.usageSummary?.get(usageKey)?.count || 0)
      : (previousCutDefinition?.usages || []).filter((usage) =>
        usage.toolId === previousCutUsage?.toolId && usage.classification === oldClassification
      ).length;
    const toolDiameter = Number(previousCutTool?.diameterMm);
    const leadOutLengthLimit = Number.isFinite(toolDiameter) && toolDiameter > 0
      ? Math.max(5, toolDiameter * 3)
      : 50;
    const plausibleLeadOutLength = Number(previousCutRecord.lengthMm || 0) <= leadOutLengthLimit;
    // A modal working-feed definition commonly remains active through the
    // final cutting move. Reclassify only a dedicated one-motion definition;
    // also reject long full-width passes that CAM happens to emit with a new F
    // word on each pass. Otherwise repeated face cuts become false lead-outs.
    if (!previousCutUsage || sourceUsageCount !== 1 || !plausibleLeadOutLength) {
      if (previousCutTool) {
        previousCutTool.exits[previousCutRecord.motion === 2 || previousCutRecord.motion === 3 ? "arc" : "straight"] += 1;
      }
      return;
    }
    previousCutRecord.classification = "lead_out";
    previousCutRecord.classificationConfidence = "medium";
    if (previousCutUsage) {
      if (compact) adjustCompactUsage(previousCutDefinition, previousCutUsage, oldClassification, "lead_out");
      else previousCutUsage.classification = "lead_out";
    }
    if (previousCutTool) {
      previousCutTool.exits[previousCutRecord.motion === 2 || previousCutRecord.motion === 3 ? "arc" : "straight"] += 1;
    }
  }

  const readCoordinate = (code, letter) => findNumericWords(code, letter)[0]?.value ?? null;
  const roundedZ = (value) => Math.round(value * 1000) / 1000;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const rawLine = lines[lineIndex];
    const semicolon = rawLine.indexOf(";");
    const code = (semicolon >= 0 ? rawLine.slice(0, semicolon) : rawLine)
      .replace(/MSG\s*\([^)]*\)/gi, " ");
    const trimmed = code.trim();
    if (!trimmed || trimmed.startsWith("%")) continue;
    const blockMatch = /^\s*N(\d+)\b/i.exec(code);
    const blockNumber = blockMatch ? Number(blockMatch[1]) : null;
    const upper = code.toUpperCase();
    if (/\b(?:TRANS|ATRANS|ROT|AROT|SCALE|ASCALE|MIRROR|AMIRROR|FRAME)\b/.test(upper)) {
      coordinateTransformUsed = true;
    }
    if (/\b(?:GOTO[BF]?|IF|ELSE|ENDIF|WHILE|ENDWHILE|FOR|ENDFOR|REPEAT|UNTIL|PROC|RET)\b/.test(upper)) {
      controlFlowUsed = true;
    }

    const tQuoted = /T\s*=\s*"([^"]+)"/i.exec(code);
    const tNumbered = tQuoted ? null : /(?:^|\s)T\s*=?\s*(\d+)/i.exec(code);
    if (tQuoted || tNumbered) {
      pendingTool = tQuoted ? tQuoted[1].trim() : `T${tNumbered[1]}`;
      if (!hasAnyM6) {
        const nextTool = ensureTool(pendingTool);
        if (currentTool?.id !== nextTool.id) resetEntryDepth(currentTool);
        currentTool = nextTool;
      }
    }
    if (/(?:^|\s)M0?6(?:\s|$)/i.test(code) && pendingTool) {
      markPreviousLeadOut();
      resetEntryDepth(currentTool);
      currentTool = ensureTool(pendingTool);
      previousWasCutting = false;
      cutsSinceRapid = 0;
      previousCutRecord = null;
      previousCutUsage = null;
      previousCutDefinition = null;
      previousCutTool = null;
    }

    const gWords = [...upper.matchAll(/G\s*(\d+(?:\.\d+)?)/g)];
    for (const match of gWords) {
      const g = Number(match[1]);
      if ([0, 1, 2, 3].includes(g)) modalMotion = g;
      else if (g === 20) {
        units = "inch";
        inchUnitsUsed = true;
      }
      else if (g === 21) units = "mm";
      else if (g === 90) incremental = false;
      else if (g === 91) {
        incremental = true;
        incrementalUsed = true;
      } else if (g === 93) feedMode = "inverse_time";
      else if (g === 94) feedMode = "mm_per_min";
      else if (g === 95) feedMode = "mm_per_rev";
      else if ([17, 18, 19].includes(g)) {
        plane = `G${g}`;
        if (g !== 17) nonXyPlaneUsed = true;
      }
      else if (g >= 54 && g <= 59) workOffset = `G${g}`;
    }
    feedModesUsed.add(feedMode);
    if (/(?:^|\s)M0?3(?:\s|$)/i.test(code)) spindleDirection = "clockwise";
    if (/(?:^|\s)M0?4(?:\s|$)/i.test(code)) spindleDirection = "counterclockwise";
    if (/(?:^|\s)M0?5(?:\s|$)/i.test(code)) spindleDirection = "stopped";
    if (currentTool) {
      if (/(?:^|\s)M0?7(?:\s|$)/i.test(code)) currentTool.coolantModes.add("mist");
      if (/(?:^|\s)M0?8(?:\s|$)/i.test(code)) currentTool.coolantModes.add("flood");
      if (/(?:^|\s)M0?9(?:\s|$)/i.test(code)) currentTool.coolantModes.clear();
    }

    const spindleWord = findNumericWords(code, "S").at(-1) || null;
    if (spindleWord?.value > 0) {
      spindleRpm = spindleWord.value;
      if (!structureOnly) {
        const owner = currentTool || (pendingTool ? ensureTool(pendingTool) : null);
        const definition = {
          id: `spindle-${spindleDefinitions.length + 1}`,
          toolId: owner?.id || null,
          lineIndex,
          lineNumber: lineIndex + 1,
          blockNumber,
          value: spindleWord.value,
          rawValue: spindleWord.rawValue,
          start: spindleWord.start,
          end: spindleWord.end,
          rawWord: spindleWord.rawWord,
        };
        spindleDefinitions.push(definition);
        if (owner) owner.rpmDefinitions.push(definition.id);
      }
    }

    const feedWord = findNumericWords(code, "F").at(-1) || null;
    if (feedWord?.value !== null && feedWord?.value >= 0) {
      currentFeed = feedWord.value;
      if (!structureOnly) {
        if (compact) finalizeCompactFeedDefinition(currentFeedDefinition);
        currentFeedDefinition = {
          id: compact ? null : `feed-${feedDefinitions.length + 1}`,
          toolIdAtDefinition: currentTool?.id || null,
          lineIndex,
          lineNumber: lineIndex + 1,
          blockNumber,
          value: feedWord.value,
          rawValue: feedWord.rawValue,
          feedMode,
          start: feedWord.start,
          end: feedWord.end,
          rawWord: feedWord.rawWord,
          usages: [],
          usageSummary: compact ? new Map() : null,
          motionSummary: compact ? new Map() : null,
          cycles: compact ? [] : null,
          finalized: false,
        };
        if (!compact) {
          feedDefinitions.push(currentFeedDefinition);
          if (currentTool) currentTool.feedDefinitions.push(currentFeedDefinition.id);
        }
      }
    }

    if (/^\s*(?:N\d+\s*)?MCALL\s*$/i.test(code)) activeModalCycle = null;
    const cycle = parseCycleCall(code, lineIndex, blockNumber);
    if (cycle && currentTool) {
      cycle.id = `cycle-${cycles.length + 1}`;
      cycle.toolId = currentTool.id;
      cycle.feedDefinitionId = currentFeedDefinition?.id || null;
      if (compact && currentFeedDefinition) currentFeedDefinition.cycles.push(cycle);
      cycle.modalFeed = currentFeed;
      cycle.feedMode = feedMode;
      cycle.spindleRpm = spindleRpm;
      cycles.push(cycle);
      currentTool.cyclesDetailed.push(cycle.id);
      if (cycle.modal) activeModalCycle = cycle;
      if (currentFeedDefinition && cycle.name !== "CYCLE84") {
        addFeedUsage(currentFeedDefinition, {
          toolId: currentTool.id,
          lineIndex,
          classification: "canned_cycle",
          lengthMm: cycle.programmedDepthMm || 0,
        });
      }
      if (cycle.name === "CYCLE84" && cycle.tapRpm > 0) spindleRpm = cycle.tapRpm;
    }

    if (structureOnly) continue;

    const x = readCoordinate(code, "X");
    const y = readCoordinate(code, "Y");
    const z = readCoordinate(code, "Z");
    if (x === null && y === null && z === null) continue;

    if (activeModalCycle && !cycle && currentTool?.id === activeModalCycle.toolId) {
      activeModalCycle.holeCount += 1;
      if (currentFeedDefinition && activeModalCycle.name !== "CYCLE84") {
        addFeedUsage(currentFeedDefinition, {
          toolId: currentTool.id,
          lineIndex,
          classification: "canned_cycle",
          lengthMm: activeModalCycle.programmedDepthMm || 0,
        });
      }
    }
    if (modalMotion === null) continue;

    const from = { ...position };
    if (incremental) {
      if (x !== null) position.x = (position.x ?? 0) + x;
      if (y !== null) position.y = (position.y ?? 0) + y;
      if (z !== null) position.z = (position.z ?? 0) + z;
    } else {
      if (x !== null) position.x = x;
      if (y !== null) position.y = y;
      if (z !== null) position.z = z;
    }
    if (!currentTool) continue;

    const dx = (position.x ?? from.x ?? 0) - (from.x ?? position.x ?? 0);
    const dy = (position.y ?? from.y ?? 0) - (from.y ?? position.y ?? 0);
    const dz = (position.z ?? from.z ?? 0) - (from.z ?? position.z ?? 0);
    const xyLength = Math.hypot(dx, dy);
    const lengthMm = arcLength(from, position, {
      i: readCoordinate(code, "I"),
      j: readCoordinate(code, "J"),
    }, modalMotion, plane);
    const cutting = [1, 2, 3].includes(modalMotion);
    let classification = "rapid";
    let classificationConfidence = "high";
    if (cutting) {
      if ([2, 3].includes(modalMotion) && Math.abs(dz) > 0.001) classification = "helix";
      else if (xyLength <= 0.001 && dz < -0.001) classification = "plunge";
      else if (xyLength > 0.001 && dz < -0.001) classification = "ramp";
      else if (!previousWasCutting && [2, 3].includes(modalMotion)) classification = "lead_in";
      else if (!previousWasCutting) classification = "lead_in";
      else classification = "cutting";
      classificationConfidence = classification === "cutting" ? "medium" : "medium";
    }
    if (!cutting && previousCutRecord) markPreviousLeadOut();

    const feedMmMin = feedMode === "mm_per_rev" && spindleRpm > 0
      ? currentFeed * spindleRpm
      : (feedMode === "mm_per_min" ? currentFeed : null);
    motionSequence += 1;
    const record = {
      id: `motion-${motionSequence}`,
      toolId: currentTool.id,
      lineIndex,
      lineNumber: lineIndex + 1,
      blockNumber,
      motion: modalMotion,
      classification,
      classificationConfidence,
      isLeadOut: false,
      from,
      to: { ...position },
      lengthMm: Number(lengthMm.toFixed(6)),
      feed: currentFeed,
      feedMode,
      feedMmMin,
      feedDefinitionId: currentFeedDefinition?.id || null,
      spindleRpm,
      spindleDirection,
      workOffset,
      plane,
    };
    if (!compact) {
      motionRecords.push(record);
      currentTool.motionRecordIds.push(record.id);
    }
    addMotionTimeSegment(record);

    if (!cutting) {
      resetEntryDepth(currentTool);
      currentTool.rapidMoves += 1;
      if (previousWasCutting && lastCutZ !== null && position.z !== null
          && Math.abs(position.z - lastCutZ) < 0.001 && xyLength > 0.05 && xyLength < 50) {
        addGeometrySample(currentTool.stepoverSamples, xyLength);
      }
      previousWasCutting = false;
      cutsSinceRapid = 0;
      previousCutRecord = null;
      previousCutUsage = null;
      previousCutDefinition = null;
      previousCutTool = null;
      continue;
    }

    if (collectingEntryDepth) {
      if (entryStartZ === null && Number.isFinite(from.z)) {
        entryStartZ = from.z;
        entryMinimumZ = from.z;
      }
      if (Number.isFinite(position.z)) entryMinimumZ = Math.min(entryMinimumZ ?? position.z, position.z);
      if (xyLength > 0.01 && Math.abs(dz) < 0.001) {
        finishEntryDepthSample(currentTool);
        collectingEntryDepth = false;
      }
    }

    currentTool.cuttingMoves += 1;
    currentTool.cuttingLenMm += lengthMm;
    if (feedMmMin > 0) currentTool.cuttingTimeMin += lengthMm / feedMmMin;
    let feedUsage = null;
    if (currentFeedDefinition) {
      feedUsage = {
        toolId: currentTool.id,
        motionId: record.id,
        lineIndex,
        classification,
        lengthMm: record.lengthMm,
      };
      addFeedUsage(currentFeedDefinition, feedUsage);
    }
    if (position.z !== null) {
      if (currentTool.minZ === null || position.z < currentTool.minZ) currentTool.minZ = position.z;
      if (xyLength > 0.01 && Math.abs(dz) < 0.001) {
        addZLevel(currentTool.cuttingZLevels, roundedZ(position.z));
        lastCutZ = position.z;
      }
    }
    cutsSinceRapid += 1;
    if (cutsSinceRapid === 1) {
      if (classification === "helix") currentTool.entries.helix += 1;
      else if (classification === "ramp") currentTool.entries.ramp += 1;
      else if (classification === "plunge") currentTool.entries.plunge += 1;
      else if ([2, 3].includes(modalMotion)) currentTool.entries.arc += 1;
      else currentTool.entries.straight += 1;
    }
    previousWasCutting = true;
    previousCutRecord = record;
    previousCutUsage = feedUsage;
    previousCutDefinition = currentFeedDefinition;
    previousCutTool = currentTool;
  }

  finishEntryDepthSample(currentTool);
  if (compact) finalizeCompactFeedDefinition(currentFeedDefinition);

  const median = (items) => {
    if (!items.length) return null;
    const sorted = [...items].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  };
  if (compact) {
    for (const definition of feedDefinitions) {
      definition.usages = [...definition._usageSummary.values()];
      definition.sharedToolIds = [...new Set(definition.usages.map((usage) => usage.toolId))];
      definition.tokenBatches = definition.tokenBatches.map((batch) => ({
        oldText: batch.oldText,
        lineIndexes: Uint32Array.from(batch.lineIndexes),
        starts: Uint32Array.from(batch.starts),
        ends: Uint32Array.from(batch.ends),
      }));
      delete definition._usageSummary;
      delete definition._tokenBatchByText;
    }
  } else {
    for (const definition of feedDefinitions) delete definition.usageSummary;
  }
  const feedDefinitionById = new Map(feedDefinitions.map((item) => [item.id, item]));
  const cycleById = new Map(cycles.map((item) => [item.id, item]));

  const report = tools.map((tool) => {
    const cycleDetails = tool.cyclesDetailed.map((id) => cycleById.get(id)).filter(Boolean);
    const reclassified = classifyTool(tool.description, tool.label, cycleDetails.map((item) => item.name));
    Object.assign(tool, {
      process: reclassified.process,
      toolKind: reclassified.toolKind,
      toolType: reclassified.toolType,
      classificationConfidence: lowerConfidence(reclassified.confidence, tool.catalogMatchConfidence),
      classificationEvidence: [...reclassified.evidence, tool.catalogMatchEvidence],
      pointAngleDeg: reclassified.pointAngleDeg,
      cornerRadiusMm: reclassified.cornerRadiusMm,
      ballRadiusMm: reclassified.ballRadiusMm,
      includedAngleDeg: reclassified.includedAngleDeg,
      diameterMm: tool.diameterMm ?? reclassified.diameterMm,
      fluteCount: tool.fluteCount ?? reclassified.fluteCount,
      effectiveTeeth: tool.effectiveTeeth ?? reclassified.fluteCount,
    });
    tool.toolMaterial = toolMaterialOverride || (
      tool.process === "milling" ? defaultMillingToolMaterial
        : (tool.process === "tapping" ? defaultTapToolMaterial : defaultDrillToolMaterial)
    );

    const zLevels = [...tool.cuttingZLevels].sort((a, b) => b - a);
    const stepDowns = [];
    for (let index = 1; index < zLevels.length; index += 1) {
      const difference = Math.round((zLevels[index - 1] - zLevels[index]) * 1000) / 1000;
      if (difference > 0.005 && difference < 100) stepDowns.push(difference);
    }
    const entryDepths = tool.entryDepthSamples.filter((value) => value > 0.005 && value < 100);
    const typicalStepDown = median(stepDowns);
    let axialDepthEstimate = null;
    if (typicalStepDown) {
      const minimum = Math.min(...stepDowns);
      const maximum = Math.max(...stepDowns);
      const tolerance = Math.max(0.01, typicalStepDown * 0.05);
      const agreement = stepDowns.filter((value) => Math.abs(value - typicalStepDown) <= tolerance).length
        / stepDowns.length;
      const continuousSurfaceTool = ["ballnose", "tapered_ballnose"].includes(tool.toolType);
      let confidence = "low";
      if (!continuousSurfaceTool && stepDowns.length >= 3 && agreement >= 0.75
          && zLevels.length <= 250 && maximum <= typicalStepDown * 1.5) {
        confidence = "high";
      } else if (!continuousSurfaceTool && agreement >= 0.5
          && zLevels.length <= 500 && maximum <= typicalStepDown * 3) {
        confidence = "medium";
      }
      axialDepthEstimate = {
        valueMm: typicalStepDown,
        source: "cutting_z_levels",
        confidence,
        sampleCount: stepDowns.length,
        zLevelCount: zLevels.length,
        agreement: Number(agreement.toFixed(3)),
        minimumMm: minimum,
        maximumMm: maximum,
      };
    } else if (entryDepths.length) {
      axialDepthEstimate = {
        valueMm: median(entryDepths),
        source: "cutting_entry_motion",
        confidence: "low",
        sampleCount: entryDepths.length,
        zLevelCount: zLevels.length,
        agreement: null,
        minimumMm: Math.min(...entryDepths),
        maximumMm: Math.max(...entryDepths),
      };
    }
    const definitions = feedDefinitions.filter((item) => item.usages.some((usage) => usage.toolId === tool.id));
    const feedCounts = new Map();
    const plungeCounts = new Map();
    for (const definition of definitions) {
      for (const usage of definition.usages.filter((item) => item.toolId === tool.id)) {
        const destination = usage.classification === "plunge" ? plungeCounts : feedCounts;
        destination.set(definition.value, (destination.get(definition.value) || 0) + Number(usage.count || 1));
      }
    }
    const feedClasses = [];
    for (const definition of definitions) {
      const usages = definition.usages.filter((item) => item.toolId === tool.id);
      const classes = [...new Set(usages.map((item) => item.classification))];
      const lengthMm = usages.reduce((sum, item) => sum + Number(item.lengthMm || 0), 0);
      feedClasses.push({
        id: definition.id,
        value: definition.value,
        feedMode: definition.feedMode,
        classification: classes.length === 1 ? classes[0] : "mixed",
        classes,
        confidence: classes.includes("unknown") || classes.length > 1 ? "low" : "medium",
        lineIndex: definition.lineIndex,
        lineNumber: definition.lineNumber,
        blockNumber: definition.blockNumber,
        affectedMotionCount: usages.reduce((sum, usage) => sum + Number(usage.count || 1), 0),
        affectedLengthMm: Number(lengthMm.toFixed(3)),
        editableByReplacement: classes.length === 1 && definition.feedMode === "mm_per_min",
      });
    }
    const spindleItems = tool.rpmDefinitions
      .map((id) => spindleDefinitions.find((item) => item.id === id))
      .filter(Boolean);
    const cycleRpms = cycleDetails.flatMap((item) => [item.tapRpm, item.retractRpm]);
    const rpms = uniqueNumbers([...spindleItems.map((item) => item.value), ...cycleRpms]);
    const cyclesNames = [...new Set(cycleDetails.map((item) => item.name))];
    const coolantModes = [...tool.coolantModes];
    return {
      id: tool.id,
      label: tool.label,
      description: tool.description,
      headerToolNumber: tool.headerToolNumber,
      headerLineIndex: tool.headerLineIndex,
      process: tool.process,
      toolKind: tool.toolKind,
      toolType: tool.toolType,
      classificationConfidence: tool.classificationConfidence,
      classificationEvidence: tool.classificationEvidence,
      catalogMatchConfidence: tool.catalogMatchConfidence,
      catalogMatchEvidence: tool.catalogMatchEvidence,
      toolMaterial: tool.toolMaterial,
      diameterMm: tool.diameterMm,
      fluteCount: tool.fluteCount,
      effectiveTeeth: tool.effectiveTeeth,
      pointAngleDeg: tool.pointAngleDeg,
      cornerRadiusMm: tool.cornerRadiusMm,
      ballRadiusMm: tool.ballRadiusMm,
      includedAngleDeg: tool.includedAngleDeg,
      rpms,
      rpmDefinitions: spindleItems,
      feeds: [...feedCounts.entries()].sort((a, b) => b[1] - a[1]).map(([feed, moves]) => ({ feed, moves })),
      plungeFeeds: [...plungeCounts.entries()].sort((a, b) => b[1] - a[1]).map(([feed, moves]) => ({ feed, moves })),
      feedClasses,
      cycles: cyclesNames,
      cyclesDetailed: cycleDetails,
      coolant: coolantModes.length > 0,
      coolantModes,
      minZ: tool.minZ,
      headerZMinMm: tool.headerZMinMm,
      zLevelCount: zLevels.length,
      stepDownTypical: typicalStepDown,
      stepDownMax: stepDowns.length ? Math.max(...stepDowns) : null,
      axialDepthEstimate,
      stepoverEstimate: median(tool.stepoverSamples),
      stepoverSamples: tool.stepoverSamples.length,
      entries: tool.entries,
      exits: tool.exits,
      cuttingLenMm: Math.round(tool.cuttingLenMm),
      cuttingTimeMin: Number(tool.cuttingTimeMin.toFixed(2)),
      motionEstimatedSeconds: Number((tool.cuttingTimeMin * 60).toFixed(2)),
      postedTimeSeconds: tool.postedTimeSeconds,
      rapidMoves: tool.rapidMoves,
      cuttingMoves: tool.cuttingMoves,
      motionRecordIds: tool.motionRecordIds,
    };
  });

  const cycleEstimatedSeconds = cycles.reduce((sum, cycle) => {
    const holes = Math.max(1, cycle.holeCount || 0);
    if (cycle.name === "CYCLE84" && cycle.programmedDepthMm > 0 && cycle.pitchMm > 0 && cycle.tapRpm > 0) {
      return sum + ((2 * cycle.programmedDepthMm * holes) / (cycle.pitchMm * cycle.tapRpm) * 60);
    }
    if (["CYCLE81", "CYCLE83"].includes(cycle.name) && cycle.programmedDepthMm > 0 && cycle.modalFeed > 0) {
      const feedMmMin = cycle.feedMode === "mm_per_rev" && cycle.spindleRpm > 0
        ? cycle.modalFeed * cycle.spindleRpm : cycle.modalFeed;
      return sum + ((cycle.programmedDepthMm * holes) / feedMmMin * 60);
    }
    return sum;
  }, 0);
  const motionEstimatedSeconds = report.reduce((sum, tool) => sum + tool.motionEstimatedSeconds, 0);
  const perToolSum = postedTimes.perTool.reduce((sum, item) => sum + item.totalSeconds, 0);
  postedTimes.perToolConsistent = Boolean(postedTimes.overall && postedTimes.perTool.length)
    ? Math.abs(perToolSum - postedTimes.overall.totalSeconds) <= 1
    : null;
  postedTimes.perToolSumSeconds = postedTimes.perTool.length ? perToolSum : null;

  return {
    parserVersion: "siemens-solidcam-2",
    lineCount: lines.length,
    lineEnding,
    headerComments,
    incrementalUsed,
    program: {
      name: cleanOption(options.programName, ""),
      dialect: "siemens_solidcam",
      units,
      feedMode,
      feedModesUsed: [...feedModesUsed],
      plane,
      inchUnitsUsed,
      nonXyPlaneUsed,
      coordinateTransformUsed,
      controlFlowUsed,
    },
    toolDefaults: {
      milling: defaultMillingToolMaterial,
      drill: defaultDrillToolMaterial,
      tap: defaultTapToolMaterial,
      override: toolMaterialOverride,
    },
    tools: report,
    definitions: {
      spindle: spindleDefinitions,
      feed: feedDefinitions,
      cycles,
    },
    motionRecords,
    motionTimeSegments: compact ? [...motionTimeSegmentMap.values()] : [],
    postedTimes,
    timeEstimate: {
      motionSeconds: Number(motionEstimatedSeconds.toFixed(2)),
      cycleSeconds: Number(cycleEstimatedSeconds.toFixed(2)),
      modeledSeconds: Number((motionEstimatedSeconds + cycleEstimatedSeconds).toFixed(2)),
      fixedAndUnknownSeconds: postedTimes.overall
        ? Math.max(0, Number((postedTimes.overall.totalSeconds - motionEstimatedSeconds - cycleEstimatedSeconds).toFixed(2)))
        : null,
      confidence: cycles.some((item) => !["CYCLE81", "CYCLE83", "CYCLE84"].includes(item.name))
        || inchUnitsUsed || nonXyPlaneUsed || coordinateTransformUsed || controlFlowUsed
        ? "low" : "provisional",
    },
  };
}

module.exports = {
  arcLength,
  classifyTool,
  findNumericWords,
  parseCycleCall,
  parseMetricToolGeometry: parseToolGeometry,
  parseMpfProgram,
};
