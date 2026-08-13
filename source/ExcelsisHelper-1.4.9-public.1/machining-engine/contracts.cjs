"use strict";

const TOOL_TYPES = Object.freeze([
  "square_endmill", "roughing_endmill", "corner_radius", "ballnose",
  "tapered_ballnose", "chamfer", "engraver_vbit", "lollipop", "undercut",
  "face_mill", "shoulder_mill", "high_feed_mill", "drill", "reamer", "tap",
  "thread_mill", "other",
]);
const RELEASE_ONE_TOOL_TYPES = new Set([
  "square_endmill", "roughing_endmill", "corner_radius", "ballnose",
  "tapered_ballnose", "chamfer", "engraver_vbit",
]);
const SUBSTRATES = Object.freeze([
  "hss", "hss_co", "pm_hss", "carbide", "pcd", "cbn", "ceramic", "cermet", "unknown",
]);
const OPERATIONS = Object.freeze([
  "full_slot", "pocket", "side_mill", "adaptive", "face", "wall_finish",
  "floor_finish", "3d_finish", "rest_rough", "chamfer", "linear_ramp", "helical_ramp",
]);
const CONTACT_MODES = Object.freeze([
  "side", "floor_tip", "mixed_3d", "wall_side", "chamfer_edge",
  "known_contact_angle", "unknown",
]);
const COOLING_MODES = Object.freeze(["dry", "air", "mist", "air_plus_mql", "flood", "through_tool"]);
const AGGRESSIVENESS = Object.freeze(["conservative", "balanced", "slightly_aggressive"]);
const PRIORITIES = Object.freeze(["tool_life", "balanced", "cycle_time", "surface_finish"]);
const HARDNESS_SCALES = Object.freeze(["HRC", "HB", "HV", "HRB", "ShoreD", "other"]);

class MachiningValidationError extends Error {
  constructor(details) {
    const list = Array.isArray(details) ? details : [String(details || "Invalid machining request.")];
    super(list.join(" "));
    this.name = "MachiningValidationError";
    this.details = list;
  }
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function finiteNumber(value, path, errors, options = {}) {
  const { nullable = false, minimum = null, exclusiveMinimum = null, maximum = null } = options;
  if (value === null || value === undefined || value === "") {
    if (nullable) return null;
    errors.push(`${path} is required.`);
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

function integer(value, path, errors, options = {}) {
  const number = finiteNumber(value, path, errors, options);
  if (number !== null && !Number.isInteger(number)) errors.push(`${path} must be an integer.`);
  return number;
}

function text(value, path, errors, options = {}) {
  const { nullable = false, required = false } = options;
  if (value === null || value === undefined) {
    if (required && !nullable) errors.push(`${path} is required.`);
    return null;
  }
  const clean = String(value).trim();
  if (!clean) {
    if (required) errors.push(`${path} is required.`);
    return nullable ? null : "";
  }
  return clean.slice(0, 240);
}

function enumValue(value, allowed, path, errors, options = {}) {
  const { nullable = false, fallback = null } = options;
  if ((value === null || value === undefined || value === "") && nullable) return null;
  const clean = String(value ?? fallback ?? "").trim();
  if (!allowed.includes(clean)) {
    errors.push(`${path} must be one of: ${allowed.join(", ")}.`);
    return fallback;
  }
  return clean;
}

function booleanValue(value, fallback = null) {
  return typeof value === "boolean" ? value : fallback;
}

function optionalNumber(value, path, errors, options = {}) {
  return finiteNumber(value, path, errors, { ...options, nullable: true });
}

function validateRecommendationRequest(input) {
  const errors = [];
  if (!isRecord(input)) throw new MachiningValidationError("Request must be an object.");
  const machineInput = isRecord(input.machine) ? input.machine : {};
  const workpieceInput = isRecord(input.workpiece) ? input.workpiece : {};
  const toolInput = isRecord(input.tool) ? input.tool : {};
  const cutInput = isRecord(input.cut) ? input.cut : {};
  const coolingInput = isRecord(input.cooling) ? input.cooling : {};
  const objectiveInput = isRecord(input.objective) ? input.objective : {};
  const contextInput = isRecord(input.gcode_context) ? input.gcode_context : null;

  const hardnessInput = isRecord(workpieceInput.hardness) ? workpieceInput.hardness : null;
  let hardness = null;
  if (hardnessInput) {
    const value = optionalNumber(hardnessInput.value, "workpiece.hardness.value", errors, { minimum: 0 });
    const scale = hardnessInput.scale === null || hardnessInput.scale === undefined || hardnessInput.scale === ""
      ? null
      : enumValue(hardnessInput.scale, HARDNESS_SCALES, "workpiece.hardness.scale", errors);
    if ((value === null) !== (scale === null)) {
      errors.push("workpiece.hardness.value and workpiece.hardness.scale must be supplied together.");
    } else if (value !== null) {
      hardness = {
        value,
        scale,
        measured: booleanValue(hardnessInput.measured),
        source: text(hardnessInput.source, "workpiece.hardness.source", errors, { nullable: true }),
      };
    }
  }

  const toolType = enumValue(toolInput.type, TOOL_TYPES, "tool.type", errors);
  const diameterMm = finiteNumber(toolInput.diameter_mm, "tool.diameter_mm", errors, { exclusiveMinimum: 0 });
  const fluteCount = integer(toolInput.flute_count, "tool.flute_count", errors, { minimum: 1 });
  const effectiveTeeth = optionalNumber(toolInput.effective_teeth, "tool.effective_teeth", errors, { minimum: 1 });
  if (effectiveTeeth !== null && !Number.isInteger(effectiveTeeth)) {
    errors.push("tool.effective_teeth must be an integer.");
  }

  const tool = {
    id: text(toolInput.id, "tool.id", errors, { nullable: true }),
    manufacturer: text(toolInput.manufacturer, "tool.manufacturer", errors, { nullable: true }),
    series: text(toolInput.series, "tool.series", errors, { nullable: true }),
    sku: text(toolInput.sku, "tool.sku", errors, { nullable: true }),
    type: toolType,
    diameter_mm: diameterMm,
    flute_count: fluteCount,
    effective_teeth: effectiveTeeth === null ? fluteCount : effectiveTeeth,
    substrate: enumValue(toolInput.substrate, SUBSTRATES, "tool.substrate", errors),
    application_class: text(toolInput.application_class, "tool.application_class", errors, { required: true }),
    coating_class: text(toolInput.coating_class, "tool.coating_class", errors, { nullable: true }),
    coating_raw: text(toolInput.coating_raw, "tool.coating_raw", errors, { nullable: true }),
    polished_flutes: booleanValue(toolInput.polished_flutes),
    edge_preparation: text(toolInput.edge_preparation, "tool.edge_preparation", errors, { nullable: true }),
    center_cutting: booleanValue(toolInput.center_cutting),
    ball_radius_mm: optionalNumber(toolInput.ball_radius_mm, "tool.ball_radius_mm", errors, { exclusiveMinimum: 0 }),
    corner_radius_mm: optionalNumber(toolInput.corner_radius_mm, "tool.corner_radius_mm", errors, { minimum: 0 }),
    included_angle_deg: optionalNumber(toolInput.included_angle_deg, "tool.included_angle_deg", errors, { exclusiveMinimum: 0, maximum: 179.999 }),
    tip_diameter_mm: optionalNumber(toolInput.tip_diameter_mm, "tool.tip_diameter_mm", errors, { minimum: 0 }),
    stickout_mm: optionalNumber(toolInput.stickout_mm, "tool.stickout_mm", errors, { exclusiveMinimum: 0 }),
    neck_diameter_mm: optionalNumber(toolInput.neck_diameter_mm, "tool.neck_diameter_mm", errors, { exclusiveMinimum: 0 }),
    neck_length_mm: optionalNumber(toolInput.neck_length_mm, "tool.neck_length_mm", errors, { minimum: 0 }),
    loc_mm: optionalNumber(toolInput.loc_mm, "tool.loc_mm", errors, { exclusiveMinimum: 0 }),
    vendor_max_rpm: optionalNumber(toolInput.vendor_max_rpm, "tool.vendor_max_rpm", errors, { exclusiveMinimum: 0 }),
    holder_max_rpm: optionalNumber(toolInput.holder_max_rpm, "tool.holder_max_rpm", errors, { exclusiveMinimum: 0 }),
    vendor_max_feed_mm_min: optionalNumber(toolInput.vendor_max_feed_mm_min, "tool.vendor_max_feed_mm_min", errors, { exclusiveMinimum: 0 }),
    roughing_profile: text(toolInput.roughing_profile, "tool.roughing_profile", errors, { nullable: true }),
  };

  if (["ballnose", "tapered_ballnose"].includes(toolType)) {
    if (tool.ball_radius_mm === null) errors.push(`${toolType} requires tool.ball_radius_mm.`);
    if (diameterMm !== null && tool.ball_radius_mm !== null && tool.ball_radius_mm > diameterMm / 2 + 1e-9) {
      errors.push("tool.ball_radius_mm cannot exceed half the nominal diameter.");
    }
  }
  if (toolType === "corner_radius") {
    if (tool.corner_radius_mm === null || tool.corner_radius_mm <= 0) errors.push("corner_radius requires a positive tool.corner_radius_mm.");
    if (diameterMm !== null && tool.corner_radius_mm !== null && tool.corner_radius_mm > diameterMm / 2 + 1e-9) {
      errors.push("tool.corner_radius_mm cannot exceed half the nominal diameter.");
    }
  }
  if (["chamfer", "engraver_vbit"].includes(toolType)) {
    if (tool.included_angle_deg === null) errors.push(`${toolType} requires tool.included_angle_deg.`);
    if (tool.tip_diameter_mm === null) errors.push(`${toolType} requires tool.tip_diameter_mm.`);
    if (diameterMm !== null && tool.tip_diameter_mm !== null && tool.tip_diameter_mm >= diameterMm) {
      errors.push("tool.tip_diameter_mm must be smaller than tool.diameter_mm.");
    }
  }
  if (toolType === "roughing_endmill" && !tool.roughing_profile) {
    errors.push("roughing_endmill requires tool.roughing_profile.");
  }

  const cut = {
    operation: enumValue(cutInput.operation, OPERATIONS, "cut.operation", errors),
    ap_mm: finiteNumber(cutInput.ap_mm, "cut.ap_mm", errors, { exclusiveMinimum: 0 }),
    ae_percent: finiteNumber(cutInput.ae_percent, "cut.ae_percent", errors, { exclusiveMinimum: 0, maximum: 100 }),
    contact_mode: enumValue(cutInput.contact_mode, CONTACT_MODES, "cut.contact_mode", errors),
    contact_angle_deg: optionalNumber(cutInput.contact_angle_deg, "cut.contact_angle_deg", errors, { minimum: 0, maximum: 90 }),
    radial_stock_mm: optionalNumber(cutInput.radial_stock_mm, "cut.radial_stock_mm", errors, { minimum: 0 }),
    axial_stock_mm: optionalNumber(cutInput.axial_stock_mm, "cut.axial_stock_mm", errors, { minimum: 0 }),
    smallest_internal_corner_radius_mm: optionalNumber(cutInput.smallest_internal_corner_radius_mm, "cut.smallest_internal_corner_radius_mm", errors, { minimum: 0 }),
    local_max_engagement_deg: optionalNumber(cutInput.local_max_engagement_deg, "cut.local_max_engagement_deg", errors, { minimum: 0, maximum: 180 }),
    previous_tool_diameter_mm: optionalNumber(cutInput.previous_tool_diameter_mm, "cut.previous_tool_diameter_mm", errors, { exclusiveMinimum: 0 }),
    stock_model_quality: text(cutInput.stock_model_quality, "cut.stock_model_quality", errors, { nullable: true }) || "unknown",
    rest_stock_model_quality: text(cutInput.rest_stock_model_quality, "cut.rest_stock_model_quality", errors, { nullable: true }),
    local_engagement_multiplier: optionalNumber(cutInput.local_engagement_multiplier, "cut.local_engagement_multiplier", errors, { minimum: 1, maximum: 3 }),
    path_segment_length_mm_p10: optionalNumber(cutInput.path_segment_length_mm_p10, "cut.path_segment_length_mm_p10", errors, { minimum: 0 }),
    ramp_angle_deg: optionalNumber(cutInput.ramp_angle_deg, "cut.ramp_angle_deg", errors, { minimum: 0, maximum: 90 }),
    target_scallop_mm: optionalNumber(cutInput.target_scallop_mm, "cut.target_scallop_mm", errors, { minimum: 0 }),
    feature_depth_mm: optionalNumber(cutInput.feature_depth_mm, "cut.feature_depth_mm", errors, { minimum: 0 }),
    active_diameter_min_mm: optionalNumber(cutInput.active_diameter_min_mm, "cut.active_diameter_min_mm", errors, { exclusiveMinimum: 0 }),
    active_diameter_max_mm: optionalNumber(cutInput.active_diameter_max_mm, "cut.active_diameter_max_mm", errors, { exclusiveMinimum: 0 }),
    edge_utilization_percent: optionalNumber(cutInput.edge_utilization_percent, "cut.edge_utilization_percent", errors, { exclusiveMinimum: 0, maximum: 100 }),
  };
  if (cut.contact_mode === "known_contact_angle" && cut.contact_angle_deg === null) {
    errors.push("cut.contact_angle_deg is required for known_contact_angle.");
  }
  if (["chamfer", "engraver_vbit"].includes(toolType)
      && cut.active_diameter_max_mm === null && cut.feature_depth_mm === null) {
    errors.push("Chamfer geometry requires cut.feature_depth_mm or explicit active diameters.");
  }
  if (cut.active_diameter_min_mm !== null && cut.active_diameter_max_mm !== null
      && cut.active_diameter_min_mm > cut.active_diameter_max_mm) {
    errors.push("cut.active_diameter_min_mm cannot exceed cut.active_diameter_max_mm.");
  }

  const request = {
    mode: enumValue(input.mode, ["analyze_gcode", "recommend"], "mode", errors),
    machine: {
      id: text(machineInput.id, "machine.id", errors, { nullable: true }),
      max_rpm: finiteNumber(machineInput.max_rpm, "machine.max_rpm", errors, { exclusiveMinimum: 0 }),
      max_feed_mm_min: optionalNumber(machineInput.max_feed_mm_min, "machine.max_feed_mm_min", errors, { exclusiveMinimum: 0 }),
      measured_runout_mm: optionalNumber(machineInput.measured_runout_mm, "machine.measured_runout_mm", errors, { minimum: 0 }),
      rigidity_class: enumValue(machineInput.rigidity_class || "unknown", ["light", "medium", "rigid", "unknown"], "machine.rigidity_class", errors),
      max_accel_mm_s2: optionalNumber(machineInput.max_accel_mm_s2, "machine.max_accel_mm_s2", errors, { exclusiveMinimum: 0 }),
    },
    workpiece: {
      material_id: text(workpieceInput.material_id, "workpiece.material_id", errors, { required: true }),
      grade: text(workpieceInput.grade, "workpiece.grade", errors, { nullable: true }),
      condition: text(workpieceInput.condition, "workpiece.condition", errors, { nullable: true }),
      material_family: text(workpieceInput.material_family, "workpiece.material_family", errors, { nullable: true }),
      subfamily: text(workpieceInput.subfamily, "workpiece.subfamily", errors, { nullable: true }),
      temper: text(workpieceInput.temper, "workpiece.temper", errors, { nullable: true }),
      hardness,
      silicon_percent: optionalNumber(workpieceInput.silicon_percent, "workpiece.silicon_percent", errors, { minimum: 0, maximum: 100 }),
      reinforcement_percent: optionalNumber(workpieceInput.reinforcement_percent, "workpiece.reinforcement_percent", errors, { minimum: 0, maximum: 100 }),
      machinability_tags: Array.isArray(workpieceInput.machinability_tags)
        ? workpieceInput.machinability_tags.map((item) => String(item).trim()).filter(Boolean).slice(0, 30)
        : [],
    },
    tool,
    cut,
    cooling: {
      mode: enumValue(coolingInput.mode, COOLING_MODES, "cooling.mode", errors),
      continuous: booleanValue(coolingInput.continuous, false),
      directed: booleanValue(coolingInput.directed),
      flow_quality: text(coolingInput.flow_quality, "cooling.flow_quality", errors, { nullable: true }) || "unknown",
      chip_evacuation_score: optionalNumber(coolingInput.chip_evacuation_score, "cooling.chip_evacuation_score", errors, { minimum: 0, maximum: 1 }),
      lubrication_score: optionalNumber(coolingInput.lubrication_score, "cooling.lubrication_score", errors, { minimum: 0, maximum: 1 }),
      lubrication_quality: text(coolingInput.lubrication_quality, "cooling.lubrication_quality", errors, { nullable: true }) || "unknown",
      polymer_compatibility: text(coolingInput.polymer_compatibility, "cooling.polymer_compatibility", errors, { nullable: true }),
    },
    objective: {
      aggressiveness: enumValue(objectiveInput.aggressiveness, AGGRESSIVENESS, "objective.aggressiveness", errors),
      priority: enumValue(objectiveInput.priority, PRIORITIES, "objective.priority", errors),
      unattended: booleanValue(objectiveInput.unattended, false),
    },
    gcode_context: contextInput ? {
      commanded_rpm: optionalNumber(contextInput.commanded_rpm, "gcode_context.commanded_rpm", errors, { minimum: 0 }),
      commanded_feed_mm_min: optionalNumber(contextInput.commanded_feed_mm_min, "gcode_context.commanded_feed_mm_min", errors, { minimum: 0 }),
      tool_number: contextInput.tool_number === null || contextInput.tool_number === undefined
        ? null : String(contextInput.tool_number).slice(0, 80),
      operation_comment: text(contextInput.operation_comment, "gcode_context.operation_comment", errors, { nullable: true }),
      dialect: text(contextInput.dialect, "gcode_context.dialect", errors, { nullable: true }),
      units: text(contextInput.units, "gcode_context.units", errors, { nullable: true }),
      commanded_feed_mode: text(contextInput.commanded_feed_mode, "gcode_context.commanded_feed_mode", errors, { nullable: true }),
    } : null,
  };

  if (errors.length) throw new MachiningValidationError(errors);
  return request;
}

function isReleaseOneToolType(toolType) {
  return RELEASE_ONE_TOOL_TYPES.has(String(toolType || ""));
}

module.exports = {
  AGGRESSIVENESS,
  CONTACT_MODES,
  COOLING_MODES,
  HARDNESS_SCALES,
  MachiningValidationError,
  OPERATIONS,
  PRIORITIES,
  RELEASE_ONE_TOOL_TYPES,
  SUBSTRATES,
  TOOL_TYPES,
  isReleaseOneToolType,
  validateRecommendationRequest,
};
