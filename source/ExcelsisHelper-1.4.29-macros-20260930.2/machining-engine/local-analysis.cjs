"use strict";

const { recommendGeneric } = require("./solver.cjs");
const { recommendDrilling } = require("./drilling-solver.cjs");
const { recommendTapping } = require("./tapping-solver.cjs");
const { recommendFaceMilling } = require("./face-milling-solver.cjs");
const { resolveMaterialSelection } = require("./materials.cjs");

const LOCAL_MILLING_TYPES = new Set([
  "square_endmill", "roughing_endmill", "corner_radius", "ballnose",
  "tapered_ballnose", "chamfer", "engraver_vbit", "face_mill",
]);
const MAX_FEED_CHANGE_GROUPS_PER_TOOL = 64;
const MAX_RPM_CHANGE_GROUPS_PER_TOOL = 32;

function finite(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positive(value, fallback = null) {
  const number = finite(value, fallback);
  return number !== null && number > 0 ? number : fallback;
}

function resolveAxialDepth(tool, override) {
  const hasOperatorValue = Object.prototype.hasOwnProperty.call(override, "apMm");
  const estimate = tool.axialDepthEstimate || (tool.stepDownTypical ? {
    valueMm: tool.stepDownTypical,
    source: "cutting_z_levels",
    confidence: "medium",
    sampleCount: null,
    minimumMm: tool.stepDownTypical,
    maximumMm: tool.stepDownMax || tool.stepDownTypical,
  } : null);
  const valueMm = positive(hasOperatorValue ? override.apMm : estimate?.valueMm, null);
  return {
    valueMm,
    source: valueMm ? (hasOperatorValue ? "operator" : estimate?.source || "none") : "none",
    confidence: valueMm ? (hasOperatorValue ? "operator" : estimate?.confidence || "low") : null,
    sampleCount: hasOperatorValue ? null : estimate?.sampleCount ?? null,
    minimumMm: hasOperatorValue ? valueMm : finite(estimate?.minimumMm, valueMm),
    maximumMm: hasOperatorValue ? valueMm : finite(estimate?.maximumMm, valueMm),
  };
}

function normalizeToolSubstrate(value) {
  const clean = String(value || "").trim().toLowerCase().replace(/[_\s]+/g, "-");
  if (!clean) return "unknown";
  if (/pcd|diamond/.test(clean)) return "pcd";
  if (/cbn/.test(clean)) return "cbn";
  if (/ceramic/.test(clean)) return "ceramic";
  if (/cermet/.test(clean)) return "cermet";
  if (/pm-?hss|hss-?pm|powder/.test(clean)) return "pm_hss";
  if (/hss.*(?:co|cobalt)|(?:co|cobalt).*hss/.test(clean)) return "hss_co";
  if (/hss/.test(clean)) return "hss";
  if (/carbide|hardmetal|kemenyfem|kem.nyf.m/.test(clean)) return "carbide";
  return clean.replace(/-/g, "_");
}

function materialInput(common) {
  const hardnessValue = finite(common.hardnessValue, null);
  return {
    material_id: String(common.materialFamily || "").trim(),
    material_family: String(common.materialFamily || "").trim(),
    grade: String(common.materialGrade || "").trim() || null,
    condition: String(common.materialCondition || "").trim() || null,
    hardness: hardnessValue === null ? null : {
      value: hardnessValue,
      scale: String(common.hardnessScale || "HRC").trim() || "HRC",
      measured: common.hardnessMeasured === true,
    },
  };
}

function coolingInput(common, override) {
  const mode = String(override.coolingMode || common.coolingMode || "air");
  return {
    mode,
    continuous: override.coolingContinuous ?? common.coolingContinuous ?? !["dry", "air"].includes(mode),
    directed: override.coolingDirected ?? common.coolingDirected ?? false,
    chip_evacuation_score: finite(override.chipEvacuationScore ?? common.chipEvacuationScore, null),
    lubrication_score: finite(override.lubricationScore ?? common.lubricationScore, null),
    polymer_compatibility: String(override.polymerCompatibility || common.polymerCompatibility || "").trim() || null,
  };
}

function objectiveInput(common, override) {
  return {
    aggressiveness: String(override.aggressiveness || common.aggressiveness || "balanced"),
    priority: String(override.priority || common.priority || "balanced"),
    unattended: false,
  };
}

function dominantFeedClass(tool, allowed = ["cutting", "canned_cycle"]) {
  return [...(tool.feedClasses || [])]
    .filter((item) => allowed.includes(item.classification))
    .sort((a, b) => b.affectedLengthMm - a.affectedLengthMm || b.affectedMotionCount - a.affectedMotionCount)[0]
    || [...(tool.feedClasses || [])].sort((a, b) => b.affectedLengthMm - a.affectedLengthMm)[0]
    || null;
}

function feedClassMmMin(feedClass, tool, rpmOverride = null) {
  if (!feedClass) return null;
  if (feedClass.feedMode === "mm_per_min") return positive(feedClass.value, null);
  if (feedClass.feedMode !== "mm_per_rev") return null;
  const rpm = positive(rpmOverride ?? tool.rpms?.[0], null);
  return rpm ? positive(feedClass.value, null) * rpm : null;
}

function inferredMillingOperation(tool, aePercent, contactMode, override) {
  if (override.operation) return override.operation;
  if (tool.toolType === "face_mill") return "face";
  if (["chamfer", "engraver_vbit"].includes(tool.toolType)) return "chamfer";
  if (["ballnose", "tapered_ballnose"].includes(tool.toolType)) return "3d_finish";
  if (aePercent >= 90) return "full_slot";
  if (contactMode === "floor_tip") return "floor_finish";
  if (contactMode === "wall_side") return "wall_finish";
  return "side_mill";
}

function commonMachine(common) {
  return {
    max_rpm: positive(common.machineMaxRpm, null),
    max_feed_mm_min: positive(common.machineMaxFeedMmMin, null),
    rigidity_class: String(common.rigidityClass || "unknown"),
    measured_runout_mm: finite(common.measuredRunoutMm, null),
    max_accel_mm_s2: finite(common.maxAccelMmS2, null),
  };
}

function applicationClass(tool, override) {
  if (override.applicationClass) return String(override.applicationClass);
  if (tool.toolType === "face_mill") return "indexable_unknown_geometry";
  const text = `${tool.description} ${tool.label}`.toLowerCase();
  if (/hard.*mill|hardened/.test(text)) return "hard_milling";
  if (/alum|alu|polish/.test(text)) return "aluminum_specific_polished";
  return "general_purpose_unknown_geometry";
}

function millingRequest(tool, common, override) {
  const missing = [];
  const diameter = positive(override.diameterMm ?? tool.diameterMm, null);
  const fluteCount = Math.round(positive(override.fluteCount ?? tool.fluteCount ?? common.fluteCount, 0));
  const apMm = resolveAxialDepth(tool, override).valueMm;
  const aePercent = positive(override.aePercent ?? common.aePercent, null);
  let contactMode = String(override.contactMode || common.contactMode || "unknown");
  if (["chamfer", "engraver_vbit"].includes(tool.toolType) && !override.contactMode) contactMode = "chamfer_edge";
  if (!diameter) missing.push("diameterMm");
  if (!fluteCount) missing.push("fluteCount");
  if (!apMm) missing.push("apMm");
  if (!aePercent) missing.push("aePercent");
  if (!LOCAL_MILLING_TYPES.has(tool.toolType)) missing.push("supportedToolType");
  const featureDepthMm = positive(override.featureDepthMm, null);
  if (["chamfer", "engraver_vbit"].includes(tool.toolType) && !featureDepthMm) missing.push("featureDepthMm");
  if (missing.length) return { missing };
  const feedClass = dominantFeedClass(tool);
  const currentRpm = positive(override.currentRpm ?? tool.rpms?.[0], null);
  const currentFeed = positive(override.currentFeed ?? feedClassMmMin(feedClass, tool, currentRpm), null);
  const toolRequest = {
    type: tool.toolType,
    diameter_mm: diameter,
    flute_count: fluteCount,
    effective_teeth: Math.round(positive(override.effectiveTeeth ?? fluteCount, fluteCount)),
    substrate: normalizeToolSubstrate(override.toolMaterial || tool.toolMaterial),
    application_class: applicationClass(tool, override),
    coating_class: String(override.coatingClass || "").trim() || null,
    stickout_mm: positive(override.stickoutMm, null),
    vendor_max_rpm: positive(override.vendorMaxRpm, null),
    vendor_max_feed_mm_min: positive(override.vendorMaxFeedMmMin, null),
    corner_radius_mm: positive(override.cornerRadiusMm ?? tool.cornerRadiusMm, null),
    ball_radius_mm: positive(override.ballRadiusMm ?? tool.ballRadiusMm, null),
    included_angle_deg: positive(override.includedAngleDeg ?? tool.includedAngleDeg, null),
    tip_diameter_mm: finite(override.tipDiameterMm, 0),
    roughing_profile: tool.toolType === "roughing_endmill"
      ? (String(override.roughingProfile || "unknown_profile")) : null,
  };
  return {
    missing: [],
    request: {
      mode: "analyze_gcode",
      machine: commonMachine(common),
      workpiece: materialInput(common),
      tool: toolRequest,
      cut: {
        operation: inferredMillingOperation(tool, aePercent, contactMode, override),
        ap_mm: apMm,
        ae_percent: aePercent,
        contact_mode: contactMode,
        contact_angle_deg: finite(override.contactAngleDeg, null),
        stock_model_quality: String(override.stockModelQuality || "unknown"),
        feature_depth_mm: featureDepthMm,
        active_diameter_min_mm: positive(override.activeDiameterMinMm, null),
        active_diameter_max_mm: positive(override.activeDiameterMaxMm, null),
        edge_utilization_percent: positive(override.edgeUtilizationPercent, null),
      },
      cooling: coolingInput(common, override),
      objective: objectiveInput(common, override),
      gcode_context: {
        commanded_rpm: currentRpm,
        commanded_feed_mm_min: currentFeed,
        tool_number: tool.headerToolNumber,
        operation_comment: tool.description,
        dialect: "siemens_solidcam",
        units: "mm",
        commanded_feed_mode: "mm_per_min",
      },
    },
  };
}

function drillingRequest(tool, common, override) {
  const cycle = (tool.cyclesDetailed || []).find((item) => ["CYCLE81", "CYCLE83"].includes(item.name)) || null;
  const missing = [];
  const diameter = positive(override.diameterMm ?? tool.diameterMm, null);
  const fluteCount = Math.round(positive(override.fluteCount ?? tool.fluteCount ?? common.fluteCount, 0));
  const depth = positive(override.holeDepthMm ?? cycle?.programmedDepthMm, null);
  if (!diameter) missing.push("diameterMm");
  if (!fluteCount) missing.push("fluteCount");
  if (!depth) missing.push("holeDepthMm");
  if (missing.length) return { missing };
  const feedClass = dominantFeedClass(tool, ["canned_cycle", "cutting"]);
  const currentRpm = positive(override.currentRpm ?? tool.rpms?.[0], null);
  return {
    missing: [],
    request: {
      mode: "analyze_gcode",
      machine: commonMachine(common),
      workpiece: materialInput(common),
      tool: {
        type: ["center_drill", "spot_drill", "drill"].includes(tool.toolType) ? tool.toolType : "drill",
        diameter_mm: diameter,
        flute_count: fluteCount,
        substrate: normalizeToolSubstrate(override.toolMaterial || tool.toolMaterial),
        coating_class: String(override.coatingClass || "").trim() || null,
        point_angle_deg: positive(override.pointAngleDeg ?? tool.pointAngleDeg, null),
        vendor_max_rpm: positive(override.vendorMaxRpm, null),
        vendor_max_feed_mm_min: positive(override.vendorMaxFeedMmMin, null),
      },
      hole: {
        depth_mm: depth,
        kind: String(override.holeKind || "unknown"),
        cycle: cycle?.name || "unknown",
        peck_depth_mm: positive(override.peckDepthMm ?? cycle?.peckDepthMm, null),
        dwell_seconds: finite(override.dwellSeconds, null),
      },
      cooling: coolingInput(common, override),
      objective: objectiveInput(common, override),
      gcode_context: {
        commanded_rpm: currentRpm,
        commanded_feed_mm_min: positive(override.currentFeed ?? feedClassMmMin(feedClass, tool, currentRpm), null),
        tool_number: tool.headerToolNumber,
        operation_comment: tool.description,
        cycle_text: cycle?.name || null,
      },
    },
  };
}

function tappingRequest(tool, common, override) {
  const cycle = (tool.cyclesDetailed || []).find((item) => item.name === "CYCLE84") || null;
  const missing = [];
  const diameter = positive(override.diameterMm ?? tool.diameterMm, null);
  const depth = positive(override.threadDepthMm ?? cycle?.programmedDepthMm, null);
  if (!diameter) missing.push("diameterMm");
  if (!depth) missing.push("threadDepthMm");
  if (missing.length) return { missing };
  const cycleRpm = positive(cycle?.tapRpm ?? tool.rpms?.[0], null);
  const cyclePitch = positive(cycle?.pitchMm, null);
  return {
    missing: [],
    request: {
      mode: "analyze_gcode",
      machine: commonMachine(common),
      workpiece: materialInput(common),
      tool: {
        type: "tap",
        nominal_diameter_mm: diameter,
        substrate: normalizeToolSubstrate(override.toolMaterial || tool.toolMaterial),
        coating_class: String(override.coatingClass || "").trim() || null,
        style: String(override.tapStyle || "unknown"),
        vendor_max_rpm: positive(override.vendorMaxRpm, null),
      },
      thread: {
        label: String(override.threadLabel || tool.label || ""),
        pitch_mm: positive(override.pitchMm, null),
        operator_confirmed_pitch_mm: positive(override.operatorConfirmedPitchMm, null),
        cycle_pitch_mm: cyclePitch,
        depth_mm: depth,
        pre_drill_diameter_mm: positive(override.preDrillDiameterMm, null),
        kind: String(override.holeKind || "unknown"),
      },
      cooling: coolingInput(common, override),
      objective: objectiveInput(common, override),
      gcode_context: cycle ? {
        cycle: cycle.name,
        cycle_text: cycle.name,
        commanded_rpm: cycleRpm,
        retract_rpm: positive(cycle.retractRpm, null),
        synchronized_feed_mm_min: cycleRpm && cyclePitch ? cycleRpm * cyclePitch : null,
        feed_mode: "mm_per_min",
        tool_number: tool.headerToolNumber,
        operation_comment: tool.description,
      } : null,
    },
  };
}

function tokenFromDefinition(definition, type) {
  return {
    type,
    definitionId: definition.id,
    lineIndex: definition.lineIndex,
    lineNumber: definition.lineNumber,
    blockNumber: definition.blockNumber,
    start: definition.start,
    end: definition.end,
    oldText: definition.rawValue,
    oldValue: definition.value,
  };
}

function tokensFromDefinition(definition, type) {
  if (type !== "feed_word" || !Array.isArray(definition.tokenBatches)) {
    return [tokenFromDefinition(definition, type)];
  }
  return definition.tokenBatches.map((batch) => ({
    type: "feed_word_batch",
    definitionId: definition.id,
    oldText: batch.oldText,
    oldValue: definition.value,
    lineIndexes: batch.lineIndexes,
    starts: batch.starts,
    ends: batch.ends,
    sharedToolIds: definition.sharedToolIds || [],
  }));
}

function createChangeGroups(tool, recommendation, analysis, common, safetyWarnings = []) {
  const target = recommendation?.levels?.target;
  if (!target) return [];
  const groups = [];
  const spindleDefinitions = tool.rpmDefinitions || [];
  const hasTapCycle = tool.process === "tapping" && (tool.cyclesDetailed || []).some((item) => item.name === "CYCLE84");
  if (!hasTapCycle && target.rpm > 0) {
    const byValue = new Map();
    for (const definition of spindleDefinitions) {
      const key = String(definition.value);
      if (!byValue.has(key)) byValue.set(key, []);
      byValue.get(key).push(definition);
    }
    if (byValue.size > MAX_RPM_CHANGE_GROUPS_PER_TOOL) {
      safetyWarnings.push(`${byValue.size} distinct spindle values were detected; automatic RPM editing is disabled for this tool.`);
    } else {
      for (const [oldValue, definitions] of byValue) {
        groups.push({
          id: `${tool.id}-rpm-${oldValue}`,
          toolId: tool.id,
          kind: "rpm",
          classification: "spindle",
          currentValues: [Number(oldValue)],
          proposedValue: target.rpm,
          calculatedValue: target.rpm,
          accepted: Number(oldValue) !== target.rpm,
          editable: true,
          step: 100,
          minimum: Math.min(100, positive(common.machineMaxRpm, target.rpm)),
          maximum: positive(common.machineMaxRpm, target.rpm),
          programmedUnit: "RPM",
          source: "calculated",
          tokens: definitions.map((definition) => tokenFromDefinition(definition, "spindle_word")),
        });
      }
    }
  }
  if (hasTapCycle && target.rpm > 0) {
    for (const cycle of tool.cyclesDetailed.filter((item) => item.name === "CYCLE84")) {
      const tokens = [10, 11]
        .map((index) => cycle.argumentTokens[index])
        .filter((token) => token && token.value > 0)
        .map((token) => ({
          type: "cycle_argument",
          cycleId: cycle.id,
          argumentIndex: token.index,
          lineIndex: cycle.lineIndex,
          lineNumber: cycle.lineNumber,
          blockNumber: cycle.blockNumber,
          start: token.start,
          end: token.end,
          oldText: token.text,
          oldValue: token.value,
        }));
      if (!tokens.length) continue;
      groups.push({
        id: `${tool.id}-${cycle.id}-tap-rpm`,
        toolId: tool.id,
        cycleId: cycle.id,
        kind: "tap_rpm",
        classification: "synchronized_tapping",
        currentValues: [...new Set(tokens.map((token) => token.oldValue))],
        proposedValue: target.rpm,
        calculatedValue: target.rpm,
        synchronizedFeedMmMin: target.feed_mm_min,
        pitchMm: target.pitch_mm,
        accepted: tokens.some((token) => token.oldValue !== target.rpm),
        editable: true,
        step: 100,
        minimum: 100,
        maximum: positive(common.machineMaxRpm, target.rpm),
        source: "calculated",
        tokens,
      });
    }
  }

  const definitionById = new Map((analysis.definitions.feed || []).map((item) => [item.id, item]));
  const groupedFeeds = new Map();
  for (const feedClass of tool.feedClasses || []) {
    const definition = definitionById.get(feedClass.id);
    if (!definition) continue;
    const key = `${feedClass.classification}\u0000${definition.value}\u0000${definition.feedMode}`;
    if (!groupedFeeds.has(key)) groupedFeeds.set(key, { feedClasses: [], definitions: [] });
    groupedFeeds.get(key).feedClasses.push(feedClass);
    groupedFeeds.get(key).definitions.push(definition);
  }
  if (groupedFeeds.size > MAX_FEED_CHANGE_GROUPS_PER_TOOL) {
    safetyWarnings.push(`${groupedFeeds.size} distinct feed definitions were detected; automatic feed editing is disabled because the program appears CAM-feed-optimized.`);
    return groups;
  }
  for (const { feedClasses, definitions } of groupedFeeds.values()) {
    const feedClass = feedClasses[0];
    const automatic = ["cutting", "canned_cycle"].includes(feedClass.classification)
      && feedClass.editableByReplacement;
    const proposedValue = automatic && target.feed_mm_min > 0 ? target.feed_mm_min : definitions[0].value;
    groups.push({
      id: `${tool.id}-feed-${feedClass.classification}-${definitions[0].value}`,
      toolId: tool.id,
      kind: "feed",
      classification: feedClass.classification,
      classes: feedClass.classes,
      confidence: feedClass.confidence,
      currentValues: [definitions[0].value],
      proposedValue,
      calculatedValue: automatic ? target.feed_mm_min : null,
      accepted: automatic && definitions[0].value !== proposedValue,
      editable: feedClass.editableByReplacement,
      requiresManualValue: !automatic,
      step: 5,
      minimum: 5,
      maximum: positive(common.machineMaxFeedMmMin, 100000),
      programmedUnit: feedClass.feedMode === "mm_per_rev" ? "mm/rev"
        : (feedClass.feedMode === "inverse_time" ? "1/min" : "mm/min"),
      source: automatic ? "calculated" : "unchanged-ambiguous-class",
      affectedMotionCount: feedClasses.reduce((sum, item) => sum
        + Number(item.affectedMotionCount || 0), 0),
      tokens: definitions.flatMap((definition) => tokensFromDefinition(definition, "feed_word")),
    });
  }
  return groups;
}

function toolControls(tool, common, override) {
  const cycle = (tool.cyclesDetailed || [])[0] || null;
  const axialDepth = resolveAxialDepth(tool, override);
  const allowedFeedClasses = tool.process === "drilling" || tool.process === "tapping"
    ? ["canned_cycle", "cutting"] : ["cutting"];
  const feedClass = dominantFeedClass(tool, allowedFeedClasses);
  const currentRpm = positive(
    override.currentRpm ?? (tool.process === "tapping" ? cycle?.tapRpm : null) ?? tool.rpms?.[0],
    null,
  );
  const currentFeed = positive(
    override.currentFeed ?? feedClassMmMin(feedClass, tool, currentRpm),
    null,
  );
  return {
    toolMaterial: override.toolMaterial || tool.toolMaterial,
    diameterMm: finite(override.diameterMm ?? tool.diameterMm, null),
    fluteCount: Math.round(positive(override.fluteCount ?? tool.fluteCount ?? common.fluteCount, 0)) || null,
    effectiveTeeth: Math.round(positive(override.effectiveTeeth ?? tool.effectiveTeeth ?? override.fluteCount
      ?? tool.fluteCount ?? common.fluteCount, 0)) || null,
    apMm: finite(axialDepth.valueMm, null),
    apSource: axialDepth.source,
    apConfidence: axialDepth.confidence,
    apEvidenceCount: axialDepth.sampleCount,
    apMinimumMm: axialDepth.minimumMm,
    apMaximumMm: axialDepth.maximumMm,
    aePercent: finite(override.aePercent ?? common.aePercent, null),
    contactMode: override.contactMode || common.contactMode,
    featureDepthMm: finite(override.featureDepthMm, null),
    holeDepthMm: finite(override.holeDepthMm ?? (tool.process === "drilling" ? cycle?.programmedDepthMm : null), null),
    threadDepthMm: finite(override.threadDepthMm ?? (tool.process === "tapping" ? cycle?.programmedDepthMm : null), null),
    holeKind: override.holeKind || "unknown",
    tapStyle: override.tapStyle || "unknown",
    preDrillDiameterMm: finite(override.preDrillDiameterMm, null),
    pitchMm: finite(override.pitchMm ?? (tool.process === "tapping" ? cycle?.pitchMm : null), null),
    operatorConfirmedPitchMm: finite(override.operatorConfirmedPitchMm, null),
    currentRpm,
    currentFeed,
    currentFeedClassification: feedClass?.classification || null,
  };
}

function toolProposal(tool, analysis, common, override, materialResolution, programBlockReasons = []) {
  const controls = toolControls(tool, common, override);
  const inferredApWarnings = controls.apSource !== "operator" && controls.apConfidence === "low"
    ? ["The MPF-derived axial depth ap is a low-confidence estimate. Verify it before creating an optimized copy."]
    : [];
  if (programBlockReasons.length) {
    return {
      id: tool.id,
      label: tool.label,
      description: tool.description,
      process: tool.process,
      toolType: tool.toolType,
      classificationConfidence: tool.classificationConfidence,
      status: "unsupported",
      missingInputs: [],
      warnings: [...programBlockReasons, ...inferredApWarnings],
      controls,
      recommendation: null,
      changeGroups: [],
    };
  }
  if (tool.classificationConfidence === "low") {
    return {
      id: tool.id,
      label: tool.label,
      description: tool.description,
      process: tool.process,
      toolType: tool.toolType,
      classificationConfidence: tool.classificationConfidence,
      status: "unsupported",
      missingInputs: [],
      warnings: ["The MPF does not identify this tool type confidently enough for automatic local editing.", ...inferredApWarnings],
      controls,
      recommendation: null,
      changeGroups: [],
    };
  }
  let built;
  let recommendation;
  if (tool.process === "milling") {
    built = millingRequest(tool, common, override);
    if (!built.missing.length) {
      recommendation = tool.toolType === "face_mill"
        ? recommendFaceMilling(built.request, { materialResolution })
        : recommendGeneric(built.request, { materialResolution });
    }
  } else if (tool.process === "drilling") {
    built = drillingRequest(tool, common, override);
    if (!built.missing.length) recommendation = recommendDrilling(built.request, { materialResolution });
  } else if (tool.process === "tapping") {
    built = tappingRequest(tool, common, override);
    if (!built.missing.length) recommendation = recommendTapping(built.request, { materialResolution });
  } else {
    return {
      id: tool.id,
      label: tool.label,
      description: tool.description,
      process: tool.process,
      toolType: tool.toolType,
      status: "unsupported",
      missingInputs: [],
      warnings: [`${tool.process} uses a separate future solver and remains unchanged.`],
      controls,
      recommendation: null,
      changeGroups: [],
    };
  }
  if (built.missing.length) {
    return {
      id: tool.id,
      label: tool.label,
      description: tool.description,
      process: tool.process,
      toolType: tool.toolType,
      status: "needs_input",
      missingInputs: built.missing,
      warnings: inferredApWarnings,
      controls,
      recommendation: null,
      changeGroups: [],
    };
  }
  const warnings = [
    ...inferredApWarnings,
    ...(recommendation.warnings || []).map((item) => item.message || String(item)),
  ];
  const requiresApConfirmation = tool.process === "milling"
    && controls.apSource !== "operator" && controls.apConfidence === "low";
  const requiresFaceMillAcceptance = tool.toolType === "face_mill";
  const groups = createChangeGroups(tool, recommendation, analysis, common, warnings)
    .map((group) => {
      if (requiresApConfirmation) {
        return {
          ...group,
          accepted: false,
          editable: false,
          requiresApConfirmation: true,
        };
      }
      if (requiresFaceMillAcceptance) {
        return {
          ...group,
          accepted: false,
          requiresOperatorAcceptance: true,
        };
      }
      return group;
    });
  return {
    id: tool.id,
    label: tool.label,
    description: tool.description,
    process: tool.process,
    toolType: tool.toolType,
    classificationConfidence: tool.classificationConfidence,
    status: requiresApConfirmation ? "needs_confirmation" : recommendation.status,
    missingInputs: recommendation.missing_inputs || [],
    warnings,
    controls,
    recommendation,
    changeGroups: groups,
  };
}

function segmentTime(analysis, groups) {
  const accepted = groups.filter((group) => group.accepted && group.editable);
  const feedChanges = new Map();
  const rpmChangesByTool = new Map();
  const tapChangesByCycle = new Map();
  for (const group of accepted) {
    if (group.kind === "feed") {
      for (const token of group.tokens) feedChanges.set(token.definitionId, group.proposedValue);
    } else if (group.kind === "tap_rpm") {
      tapChangesByCycle.set(group.cycleId, group.proposedValue);
      rpmChangesByTool.set(group.toolId, group.proposedValue);
    } else if (group.kind === "rpm") {
      rpmChangesByTool.set(group.toolId, group.proposedValue);
    }
  }
  const toolTimes = new Map((analysis.tools || []).map((tool) => [tool.id, { oldModeled: 0, newModeled: 0 }]));
  let oldMotion = 0;
  let newMotion = 0;
  const motionSegments = analysis.motionTimeSegments?.length
    ? analysis.motionTimeSegments : (analysis.motionRecords || []);
  for (const motion of motionSegments) {
    if (motion.classification === "rapid" || !(motion.lengthMm > 0) || !(motion.feedMmMin > 0)) continue;
    const oldSeconds = (motion.lengthMm / motion.feedMmMin) * 60;
    let newFeedMmMin = motion.feedMmMin;
    if (feedChanges.has(motion.feedDefinitionId)) {
      const programmed = feedChanges.get(motion.feedDefinitionId);
      newFeedMmMin = motion.feedMode === "mm_per_rev"
        ? programmed * (rpmChangesByTool.get(motion.toolId) || motion.spindleRpm)
        : programmed;
    }
    const newSeconds = newFeedMmMin > 0 ? (motion.lengthMm / newFeedMmMin) * 60 : oldSeconds;
    oldMotion += oldSeconds;
    newMotion += newSeconds;
    const item = toolTimes.get(motion.toolId);
    if (item) {
      item.oldModeled += oldSeconds;
      item.newModeled += newSeconds;
    }
  }
  let oldCycles = 0;
  let newCycles = 0;
  for (const cycle of analysis.definitions.cycles || []) {
    const holes = Math.max(1, Number(cycle.holeCount || 0));
    let oldSeconds = 0;
    let newSeconds = 0;
    if (cycle.name === "CYCLE84" && cycle.programmedDepthMm > 0 && cycle.pitchMm > 0 && cycle.tapRpm > 0) {
      oldSeconds = (2 * cycle.programmedDepthMm * holes) / (cycle.pitchMm * cycle.tapRpm) * 60;
      const newRpm = tapChangesByCycle.get(cycle.id) || cycle.tapRpm;
      newSeconds = (2 * cycle.programmedDepthMm * holes) / (cycle.pitchMm * newRpm) * 60;
    } else if (["CYCLE81", "CYCLE83"].includes(cycle.name) && cycle.programmedDepthMm > 0 && cycle.modalFeed > 0) {
      const oldFeed = cycle.feedMode === "mm_per_rev" && cycle.spindleRpm > 0
        ? cycle.modalFeed * cycle.spindleRpm : cycle.modalFeed;
      const changedProgrammedFeed = feedChanges.get(cycle.feedDefinitionId) || cycle.modalFeed;
      const newFeed = cycle.feedMode === "mm_per_rev" && cycle.spindleRpm > 0
        ? changedProgrammedFeed * (rpmChangesByTool.get(cycle.toolId) || cycle.spindleRpm)
        : changedProgrammedFeed;
      oldSeconds = (cycle.programmedDepthMm * holes) / oldFeed * 60;
      newSeconds = (cycle.programmedDepthMm * holes) / newFeed * 60;
    }
    oldCycles += oldSeconds;
    newCycles += newSeconds;
    const item = toolTimes.get(cycle.toolId);
    if (item) {
      item.oldModeled += oldSeconds;
      item.newModeled += newSeconds;
    }
  }
  const oldModeled = oldMotion + oldCycles;
  const newModeled = newMotion + newCycles;
  const posted = analysis.postedTimes?.overall?.totalSeconds ?? null;
  const fixed = posted === null ? 0 : Math.max(0, posted - oldModeled);
  const oldTotal = posted ?? oldModeled;
  const newTotal = fixed + newModeled;
  const perTool = (analysis.tools || []).map((tool) => {
    const item = toolTimes.get(tool.id) || { oldModeled: 0, newModeled: 0 };
    const toolFixed = tool.postedTimeSeconds === null || tool.postedTimeSeconds === undefined
      ? 0 : Math.max(0, tool.postedTimeSeconds - item.oldModeled);
    const old = tool.postedTimeSeconds ?? item.oldModeled;
    const next = toolFixed + item.newModeled;
    return {
      toolId: tool.id,
      label: tool.label,
      oldSeconds: Number(old.toFixed(2)),
      newSeconds: Number(next.toFixed(2)),
      deltaSeconds: Number((next - old).toFixed(2)),
      percentChange: old > 0 ? Number((((next / old) - 1) * 100).toFixed(1)) : null,
      source: tool.postedTimeSeconds != null ? "posted-plus-modeled-change" : "modeled-only",
    };
  });
  return {
    oldSeconds: Number(oldTotal.toFixed(2)),
    newSeconds: Number(newTotal.toFixed(2)),
    deltaSeconds: Number((newTotal - oldTotal).toFixed(2)),
    percentChange: oldTotal > 0 ? Number((((newTotal / oldTotal) - 1) * 100).toFixed(1)) : null,
    oldModeledSeconds: Number(oldModeled.toFixed(2)),
    newModeledSeconds: Number(newModeled.toFixed(2)),
    fixedAndUnknownSeconds: Number(fixed.toFixed(2)),
    source: posted === null ? "modeled-only" : "posted-plus-modeled-change",
    confidence: analysis.timeEstimate?.confidence || "low",
    perTool,
  };
}

function flattenGroups(toolProposals) {
  return toolProposals.flatMap((tool) => tool.changeGroups || []);
}

function guardSharedSourceTokens(toolProposals) {
  const references = new Map();
  for (const tool of toolProposals) {
    for (const group of tool.changeGroups || []) {
      for (const token of group.tokens || []) {
        const key = token.type === "feed_word_batch"
          ? `definition:${token.definitionId}`
          : `${token.lineIndex}:${token.start}:${token.end}`;
        if (!references.has(key)) references.set(key, []);
        references.get(key).push({ tool, group, token });
      }
    }
  }
  for (const items of references.values()) {
    const toolIds = new Set(items.flatMap((item) => [
      item.tool.id,
      ...(item.token.sharedToolIds || []),
    ]));
    if (toolIds.size <= 1) continue;
    for (const { tool, group } of items) {
      group.accepted = false;
      group.editable = false;
      group.source = "shared-modal-source-token";
      group.requiresSourceSplit = true;
      const warning = "One modal source value controls more than one tool; automatic editing is disabled until the MPF defines separate values.";
      if (!tool.warnings.includes(warning)) tool.warnings.push(warning);
    }
  }
  return toolProposals;
}

function withProposalSummary(proposal) {
  const groups = flattenGroups(proposal.tools);
  const acceptedChangeCount = groups.filter((group) => group.accepted && group.editable
    && group.tokens.some((token) => Number(token.oldValue) !== Number(group.proposedValue))).length;
  return {
    ...proposal,
    timeEstimate: segmentTime(proposal.analysis, groups),
    acceptedChangeCount,
    canWrite: acceptedChangeCount > 0,
  };
}

function buildLocalProposal(analysis, input = {}) {
  const common = {
    materialFamily: String(input.materialFamily || "").trim(),
    materialGrade: String(input.materialGrade || "").trim(),
    materialCondition: String(input.materialCondition || "").trim(),
    hardnessValue: input.hardnessValue,
    hardnessScale: input.hardnessScale || "HRC",
    machineMaxRpm: positive(input.machineMaxRpm, null),
    machineMaxFeedMmMin: positive(input.machineMaxFeedMmMin, null),
    aggressiveness: input.aggressiveness || "balanced",
    aePercent: positive(input.aePercent, null),
    coolingMode: input.coolingMode || "air",
    coolingContinuous: input.coolingContinuous,
    coolingDirected: input.coolingDirected,
    contactMode: input.contactMode || "side",
    fluteCount: Math.round(positive(input.fluteCount, 0)),
    priority: input.priority || "balanced",
  };
  const inputErrors = [];
  if (!common.materialFamily) inputErrors.push("materialFamily");
  if (!common.machineMaxRpm) inputErrors.push("machineMaxRpm");
  if (!common.machineMaxFeedMmMin) inputErrors.push("machineMaxFeedMmMin");
  if (!common.aePercent) inputErrors.push("aePercent");
  if (!common.fluteCount) inputErrors.push("fluteCount");
  const materialResolution = resolveMaterialSelection({
    family: common.materialFamily,
    grade: common.materialGrade,
    hardnessValue: common.hardnessValue,
    hardnessScale: common.hardnessScale,
  });
  const programBlockReasons = [];
  if (analysis.program?.inchUnitsUsed || analysis.program?.units === "inch") {
    programBlockReasons.push("Inch-unit MPFs are read-only in the local method; automatic numeric editing requires a metric program.");
  }
  if (analysis.program?.controlFlowUsed) {
    programBlockReasons.push("Control-flow statements were detected; automatic editing is disabled because execution order cannot be proven by the linear parser.");
  }
  const overrides = input.toolOverrides && typeof input.toolOverrides === "object" ? input.toolOverrides : {};
  const tools = inputErrors.length ? [] : guardSharedSourceTokens((analysis.tools || []).map((tool) => {
    try {
      return toolProposal(tool, analysis, common, overrides[tool.id] || {}, materialResolution, programBlockReasons);
    } catch (error) {
      return {
        id: tool.id,
        label: tool.label,
        description: tool.description,
        process: tool.process,
        toolType: tool.toolType,
        status: "error",
        missingInputs: [],
        warnings: [String(error?.message || error)],
        controls: {},
        recommendation: null,
        changeGroups: [],
      };
    }
  }));
  return withProposalSummary({
    method: "local",
    common,
    inputErrors,
    materialResolution,
    tools,
    analysis,
  });
}

function applyProposalSelections(proposal, selections = []) {
  const selectionMap = new Map((Array.isArray(selections) ? selections : []).map((item) => [String(item?.id || ""), item]));
  const tools = proposal.tools.map((tool) => ({
    ...tool,
    changeGroups: (tool.changeGroups || []).map((group) => {
      const selection = selectionMap.get(group.id);
      if (!selection) return group;
      const next = { ...group };
      if (typeof selection.accepted === "boolean") next.accepted = selection.accepted;
      if (selection.value !== undefined && selection.value !== null && selection.value !== "") {
        const value = Number(selection.value);
        if (!Number.isFinite(value) || value < group.minimum || value > group.maximum) {
          throw new RangeError(`${group.id} must be between ${group.minimum} and ${group.maximum}.`);
        }
        const steps = value / group.step;
        if (Math.abs(steps - Math.round(steps)) > 1e-8) {
          throw new RangeError(`${group.id} must use increments of ${group.step}.`);
        }
        next.proposedValue = value;
        if (value !== group.calculatedValue) next.source = "operator-override";
        if (next.kind === "tap_rpm" && next.pitchMm > 0) {
          next.synchronizedFeedMmMin = Number((value * next.pitchMm).toFixed(6));
        }
      }
      return next;
    }),
  }));
  return withProposalSummary({ ...proposal, tools });
}

module.exports = {
  applyProposalSelections,
  buildLocalProposal,
  normalizeToolSubstrate,
  segmentTime,
};
