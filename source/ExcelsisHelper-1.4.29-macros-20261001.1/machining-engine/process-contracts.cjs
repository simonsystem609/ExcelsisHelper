"use strict";

const {
  AGGRESSIVENESS,
  COOLING_MODES,
  HARDNESS_SCALES,
  MachiningValidationError,
  PRIORITIES,
  SUBSTRATES,
} = require("./contracts.cjs");

const DRILL_TOOL_TYPES = Object.freeze(["center_drill", "spot_drill", "drill"]);
const DRILL_CYCLES = Object.freeze(["CYCLE81", "CYCLE83", "plain_drilling", "unknown"]);
const TAP_STYLES = Object.freeze(["cut", "form", "unknown"]);
const HOLE_KINDS = Object.freeze(["blind", "through", "unknown"]);
const FEED_MODES = Object.freeze(["mm_per_min", "mm_per_rev", "unknown"]);

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function numberValue(value, path, errors, options = {}) {
  const { optional = false, minimum = null, exclusiveMinimum = null, maximum = null } = options;
  if (value === null || value === undefined || value === "") {
    if (!optional) errors.push(`${path} is required.`);
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number)) {
    errors.push(`${path} must be a finite number.`);
    return null;
  }
  if (minimum !== null && number < minimum) errors.push(`${path} must be at least ${minimum}.`);
  if (exclusiveMinimum !== null && number <= exclusiveMinimum) errors.push(`${path} must be greater than ${exclusiveMinimum}.`);
  if (maximum !== null && number > maximum) errors.push(`${path} must be at most ${maximum}.`);
  return number;
}

function integerValue(value, path, errors, options = {}) {
  const number = numberValue(value, path, errors, options);
  if (number !== null && !Number.isInteger(number)) errors.push(`${path} must be an integer.`);
  return number;
}

function textValue(value, path, errors, options = {}) {
  const { optional = false } = options;
  const clean = String(value ?? "").trim();
  if (!clean && !optional) errors.push(`${path} is required.`);
  return clean ? clean.slice(0, 240) : null;
}

function enumValue(value, allowed, path, errors, options = {}) {
  const { optional = false, fallback = null } = options;
  const clean = String(value ?? fallback ?? "").trim();
  if (!clean && optional) return null;
  if (!allowed.includes(clean)) {
    errors.push(`${path} must be one of: ${allowed.join(", ")}.`);
    return fallback;
  }
  return clean;
}

function booleanValue(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function validateHardness(input, path, errors) {
  if (!isRecord(input) || input.value === null || input.value === undefined || input.value === "") return null;
  const value = numberValue(input.value, `${path}.value`, errors, { minimum: 0 });
  const scale = enumValue(input.scale || "HRC", HARDNESS_SCALES, `${path}.scale`, errors);
  return value === null || !scale ? null : {
    value,
    scale,
    measured: booleanValue(input.measured),
    source: textValue(input.source, `${path}.source`, errors, { optional: true }),
  };
}

function validateCommon(input, errors) {
  if (!isRecord(input)) throw new MachiningValidationError("Request must be an object.");
  const machineInput = isRecord(input.machine) ? input.machine : {};
  const workpieceInput = isRecord(input.workpiece) ? input.workpiece : {};
  const coolingInput = isRecord(input.cooling) ? input.cooling : {};
  const objectiveInput = isRecord(input.objective) ? input.objective : {};
  const family = textValue(
    workpieceInput.material_family || workpieceInput.family || workpieceInput.material_id,
    "workpiece.material_family",
    errors,
  );
  return {
    mode: enumValue(input.mode || "recommend", ["analyze_gcode", "recommend"], "mode", errors),
    machine: {
      id: textValue(machineInput.id, "machine.id", errors, { optional: true }),
      max_rpm: numberValue(machineInput.max_rpm, "machine.max_rpm", errors, { exclusiveMinimum: 0 }),
      max_feed_mm_min: numberValue(machineInput.max_feed_mm_min, "machine.max_feed_mm_min", errors, { optional: true, exclusiveMinimum: 0 }),
      rigidity_class: enumValue(machineInput.rigidity_class || "unknown", ["light", "medium", "rigid", "unknown"], "machine.rigidity_class", errors),
    },
    workpiece: {
      material_family: family,
      material_id: textValue(workpieceInput.material_id, "workpiece.material_id", errors, { optional: true }) || family,
      grade: textValue(workpieceInput.grade, "workpiece.grade", errors, { optional: true }),
      condition: textValue(workpieceInput.condition, "workpiece.condition", errors, { optional: true }),
      hardness: validateHardness(workpieceInput.hardness, "workpiece.hardness", errors),
    },
    cooling: {
      mode: enumValue(coolingInput.mode || "air", COOLING_MODES, "cooling.mode", errors),
      continuous: booleanValue(coolingInput.continuous),
      directed: booleanValue(coolingInput.directed),
      chip_evacuation_score: numberValue(coolingInput.chip_evacuation_score, "cooling.chip_evacuation_score", errors, { optional: true, minimum: 0, maximum: 1 }),
      lubrication_score: numberValue(coolingInput.lubrication_score, "cooling.lubrication_score", errors, { optional: true, minimum: 0, maximum: 1 }),
      polymer_compatibility: textValue(coolingInput.polymer_compatibility, "cooling.polymer_compatibility", errors, { optional: true }),
    },
    objective: {
      aggressiveness: enumValue(objectiveInput.aggressiveness || "balanced", AGGRESSIVENESS, "objective.aggressiveness", errors),
      priority: enumValue(objectiveInput.priority || "balanced", PRIORITIES, "objective.priority", errors),
      unattended: booleanValue(objectiveInput.unattended),
    },
  };
}

function validateDrillingRequest(input) {
  const errors = [];
  const common = validateCommon(input, errors);
  const toolInput = isRecord(input.tool) ? input.tool : {};
  const holeInput = isRecord(input.hole) ? input.hole : {};
  const contextInput = isRecord(input.gcode_context) ? input.gcode_context : null;
  const fluteCount = integerValue(toolInput.flute_count ?? toolInput.effective_teeth ?? 2, "tool.flute_count", errors, { minimum: 1 });
  const request = {
    process: "drilling",
    ...common,
    tool: {
      id: textValue(toolInput.id, "tool.id", errors, { optional: true }),
      manufacturer: textValue(toolInput.manufacturer, "tool.manufacturer", errors, { optional: true }),
      series: textValue(toolInput.series, "tool.series", errors, { optional: true }),
      type: enumValue(toolInput.type, DRILL_TOOL_TYPES, "tool.type", errors),
      diameter_mm: numberValue(toolInput.diameter_mm, "tool.diameter_mm", errors, { exclusiveMinimum: 0 }),
      flute_count: fluteCount,
      substrate: enumValue(toolInput.substrate, SUBSTRATES, "tool.substrate", errors),
      coating_class: textValue(toolInput.coating_class, "tool.coating_class", errors, { optional: true }),
      point_angle_deg: numberValue(toolInput.point_angle_deg, "tool.point_angle_deg", errors, { optional: true, exclusiveMinimum: 0, maximum: 180 }),
      vendor_max_rpm: numberValue(toolInput.vendor_max_rpm, "tool.vendor_max_rpm", errors, { optional: true, exclusiveMinimum: 0 }),
      vendor_max_feed_mm_min: numberValue(toolInput.vendor_max_feed_mm_min, "tool.vendor_max_feed_mm_min", errors, { optional: true, exclusiveMinimum: 0 }),
    },
    hole: {
      depth_mm: numberValue(holeInput.depth_mm, "hole.depth_mm", errors, { exclusiveMinimum: 0 }),
      kind: enumValue(holeInput.kind || "unknown", HOLE_KINDS, "hole.kind", errors),
      cycle: enumValue(holeInput.cycle || "unknown", DRILL_CYCLES, "hole.cycle", errors),
      peck_depth_mm: numberValue(holeInput.peck_depth_mm, "hole.peck_depth_mm", errors, { optional: true, exclusiveMinimum: 0 }),
      dwell_seconds: numberValue(holeInput.dwell_seconds, "hole.dwell_seconds", errors, { optional: true, minimum: 0 }),
    },
    gcode_context: contextInput ? {
      commanded_rpm: numberValue(contextInput.commanded_rpm, "gcode_context.commanded_rpm", errors, { optional: true, minimum: 0 }),
      commanded_feed_mm_min: numberValue(contextInput.commanded_feed_mm_min, "gcode_context.commanded_feed_mm_min", errors, { optional: true, minimum: 0 }),
      tool_number: textValue(contextInput.tool_number, "gcode_context.tool_number", errors, { optional: true }),
      operation_comment: textValue(contextInput.operation_comment, "gcode_context.operation_comment", errors, { optional: true }),
      cycle_text: textValue(contextInput.cycle_text, "gcode_context.cycle_text", errors, { optional: true }),
    } : null,
  };
  if (request.hole.peck_depth_mm !== null && request.hole.peck_depth_mm > request.hole.depth_mm) {
    errors.push("hole.peck_depth_mm cannot exceed hole.depth_mm.");
  }
  if (errors.length) throw new MachiningValidationError(errors);
  return request;
}

function validateTappingRequest(input) {
  const errors = [];
  const common = validateCommon(input, errors);
  const toolInput = isRecord(input.tool) ? input.tool : {};
  const threadInput = isRecord(input.thread) ? input.thread : {};
  const contextInput = isRecord(input.gcode_context) ? input.gcode_context : null;
  const request = {
    process: "tapping",
    ...common,
    tool: {
      id: textValue(toolInput.id, "tool.id", errors, { optional: true }),
      manufacturer: textValue(toolInput.manufacturer, "tool.manufacturer", errors, { optional: true }),
      series: textValue(toolInput.series, "tool.series", errors, { optional: true }),
      type: enumValue(toolInput.type || "tap", ["tap"], "tool.type", errors),
      nominal_diameter_mm: numberValue(toolInput.nominal_diameter_mm ?? toolInput.diameter_mm, "tool.nominal_diameter_mm", errors, { exclusiveMinimum: 0 }),
      substrate: enumValue(toolInput.substrate, SUBSTRATES, "tool.substrate", errors),
      coating_class: textValue(toolInput.coating_class, "tool.coating_class", errors, { optional: true }),
      style: enumValue(toolInput.style || "unknown", TAP_STYLES, "tool.style", errors),
      vendor_max_rpm: numberValue(toolInput.vendor_max_rpm, "tool.vendor_max_rpm", errors, { optional: true, exclusiveMinimum: 0 }),
    },
    thread: {
      label: textValue(threadInput.label, "thread.label", errors, { optional: true }),
      pitch_mm: numberValue(threadInput.pitch_mm, "thread.pitch_mm", errors, { optional: true, exclusiveMinimum: 0 }),
      operator_confirmed_pitch_mm: numberValue(threadInput.operator_confirmed_pitch_mm, "thread.operator_confirmed_pitch_mm", errors, { optional: true, exclusiveMinimum: 0 }),
      cycle_pitch_mm: numberValue(threadInput.cycle_pitch_mm, "thread.cycle_pitch_mm", errors, { optional: true, exclusiveMinimum: 0 }),
      depth_mm: numberValue(threadInput.depth_mm, "thread.depth_mm", errors, { exclusiveMinimum: 0 }),
      pre_drill_diameter_mm: numberValue(threadInput.pre_drill_diameter_mm, "thread.pre_drill_diameter_mm", errors, { optional: true, exclusiveMinimum: 0 }),
      kind: enumValue(threadInput.kind || "unknown", HOLE_KINDS, "thread.kind", errors),
    },
    gcode_context: contextInput ? {
      cycle: textValue(contextInput.cycle, "gcode_context.cycle", errors, { optional: true }),
      cycle_text: textValue(contextInput.cycle_text, "gcode_context.cycle_text", errors, { optional: true }),
      commanded_rpm: numberValue(contextInput.commanded_rpm, "gcode_context.commanded_rpm", errors, { optional: true, minimum: 0 }),
      retract_rpm: numberValue(contextInput.retract_rpm, "gcode_context.retract_rpm", errors, { optional: true, minimum: 0 }),
      synchronized_feed_mm_min: numberValue(contextInput.synchronized_feed_mm_min ?? contextInput.commanded_feed_mm_min, "gcode_context.synchronized_feed_mm_min", errors, { optional: true, minimum: 0 }),
      feed_mode: enumValue(contextInput.feed_mode || "unknown", FEED_MODES, "gcode_context.feed_mode", errors),
      tool_number: textValue(contextInput.tool_number, "gcode_context.tool_number", errors, { optional: true }),
      operation_comment: textValue(contextInput.operation_comment, "gcode_context.operation_comment", errors, { optional: true }),
    } : null,
  };
  if (request.thread.pre_drill_diameter_mm !== null
      && request.thread.pre_drill_diameter_mm >= request.tool.nominal_diameter_mm) {
    errors.push("thread.pre_drill_diameter_mm must be smaller than tool.nominal_diameter_mm.");
  }
  if (errors.length) throw new MachiningValidationError(errors);
  return request;
}

module.exports = {
  DRILL_CYCLES,
  DRILL_TOOL_TYPES,
  FEED_MODES,
  HOLE_KINDS,
  TAP_STYLES,
  validateDrillingRequest,
  validateTappingRequest,
};
