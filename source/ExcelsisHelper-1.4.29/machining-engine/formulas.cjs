"use strict";

const EPSILON = 1e-12;

function finite(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`${name} must be finite.`);
  return number;
}

function positive(value, name, allowZero = false) {
  const number = finite(value, name);
  if (allowZero ? number < 0 : number <= 0) {
    throw new RangeError(`${name} must be ${allowZero ? "nonnegative" : "positive"}.`);
  }
  return number;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function rpmFromVc(vcMMin, effectiveDiameterMm) {
  return (1000 * positive(vcMMin, "vcMMin")) / (Math.PI * positive(effectiveDiameterMm, "effectiveDiameterMm"));
}

function vcFromRpm(rpm, effectiveDiameterMm) {
  return (Math.PI * positive(effectiveDiameterMm, "effectiveDiameterMm") * positive(rpm, "rpm")) / 1000;
}

function feedFromFz(rpm, effectiveTeeth, fzMmTooth) {
  return positive(rpm, "rpm") * positive(effectiveTeeth, "effectiveTeeth") * positive(fzMmTooth, "fzMmTooth", true);
}

function fzFromFeed(feedMmMin, rpm, effectiveTeeth) {
  return positive(feedMmMin, "feedMmMin", true) / (positive(rpm, "rpm") * positive(effectiveTeeth, "effectiveTeeth"));
}

function feedFromFn(rpm, feedPerRevolutionMm) {
  return positive(rpm, "rpm") * positive(feedPerRevolutionMm, "feedPerRevolutionMm");
}

function fnFromFeed(feedMmMin, rpm) {
  return positive(feedMmMin, "feedMmMin", true) / positive(rpm, "rpm");
}

function pitchFromSynchronizedFeed(feedMmMin, rpm) {
  return fnFromFeed(feedMmMin, rpm);
}

function ballnoseEffectiveDiameterFromDepth(diameterMm, contactDepthMm) {
  const diameter = positive(diameterMm, "diameterMm");
  const depth = positive(contactDepthMm, "contactDepthMm", true);
  const radius = diameter / 2;
  if (depth >= radius) return diameter;
  return 2 * Math.sqrt(Math.max(0, (2 * radius * depth) - (depth * depth)));
}

function ballnoseEffectiveDiameterFromAngle(diameterMm, contactAngleDeg) {
  const diameter = positive(diameterMm, "diameterMm");
  const angle = finite(contactAngleDeg, "contactAngleDeg");
  if (angle < 0 || angle > 90) throw new RangeError("contactAngleDeg must be between 0 and 90.");
  return diameter * Math.sin((angle * Math.PI) / 180);
}

function bullnoseEffectiveDiameter(diameterMm, cornerRadiusMm, contactDepthMm) {
  const diameter = positive(diameterMm, "diameterMm");
  const radius = positive(cornerRadiusMm, "cornerRadiusMm");
  const depth = positive(contactDepthMm, "contactDepthMm", true);
  if (radius > diameter / 2 + EPSILON) throw new RangeError("cornerRadiusMm cannot exceed half the diameter.");
  if (depth >= radius) return diameter;
  return diameter - (2 * radius) + (2 * Math.sqrt(Math.max(0, (2 * radius * depth) - (depth * depth))));
}

function chamferActiveDiameter(options) {
  const diameter = positive(options.diameterMm, "diameterMm");
  const tip = positive(options.tipDiameterMm, "tipDiameterMm", true);
  const angle = positive(options.includedAngleDeg, "includedAngleDeg");
  if (angle >= 180) throw new RangeError("includedAngleDeg must be below 180.");
  if (tip >= diameter) throw new RangeError("tipDiameterMm must be below diameterMm.");

  let inner = options.activeDiameterMinMm == null ? null : positive(options.activeDiameterMinMm, "activeDiameterMinMm");
  let outer = options.activeDiameterMaxMm == null ? null : positive(options.activeDiameterMaxMm, "activeDiameterMaxMm");
  if (outer === null) {
    const depth = positive(options.featureDepthMm, "featureDepthMm", true);
    outer = Math.min(diameter, tip + (2 * depth * Math.tan((angle * Math.PI) / 360)));
    if (inner === null) {
      const utilization = options.edgeUtilizationPercent == null
        ? 100
        : clamp(finite(options.edgeUtilizationPercent, "edgeUtilizationPercent"), 0, 100);
      const activeSpan = depth * (utilization / 100);
      inner = Math.max(tip, tip + (2 * (depth - activeSpan) * Math.tan((angle * Math.PI) / 360)));
    }
  }
  if (inner === null) inner = tip || Math.min(outer, diameter * 0.01);
  inner = clamp(inner, Math.max(tip, EPSILON), diameter);
  outer = clamp(outer, inner, diameter);
  return { innerMm: inner, outerMm: outer, midpointMm: (inner + outer) / 2 };
}

function effectiveDiameterRange(tool, cut) {
  const diameter = positive(tool.diameter_mm, "tool.diameter_mm");
  switch (tool.type) {
    case "ballnose":
    case "tapered_ballnose": {
      if (cut.contact_mode === "known_contact_angle") {
        const value = ballnoseEffectiveDiameterFromAngle(diameter, cut.contact_angle_deg);
        return { minimumMm: value, targetMm: value, maximumMm: value, method: "ballnose_contact_angle" };
      }
      if (cut.contact_mode === "floor_tip") {
        const value = ballnoseEffectiveDiameterFromDepth(diameter, cut.ap_mm);
        return { minimumMm: value, targetMm: value, maximumMm: value, method: "ballnose_tip_depth" };
      }
      if (cut.contact_mode === "wall_side") {
        return { minimumMm: diameter * 0.75, targetMm: diameter * 0.875, maximumMm: diameter, method: "ballnose_wall_range" };
      }
      if (cut.contact_mode === "mixed_3d") {
        return { minimumMm: diameter * 0.45, targetMm: diameter * 0.6, maximumMm: diameter * 0.75, method: "ballnose_mixed_range" };
      }
      return { minimumMm: diameter * 0.25, targetMm: diameter * 0.5, maximumMm: diameter, method: "ballnose_unknown_range" };
    }
    case "corner_radius": {
      const value = ["floor_tip", "mixed_3d"].includes(cut.contact_mode)
        ? bullnoseEffectiveDiameter(diameter, tool.corner_radius_mm, cut.ap_mm)
        : diameter;
      return { minimumMm: value, targetMm: value, maximumMm: value, method: value === diameter ? "bullnose_nominal" : "bullnose_shallow" };
    }
    case "chamfer":
    case "engraver_vbit": {
      const active = chamferActiveDiameter({
        diameterMm: diameter,
        tipDiameterMm: tool.tip_diameter_mm,
        includedAngleDeg: tool.included_angle_deg,
        featureDepthMm: cut.feature_depth_mm,
        activeDiameterMinMm: cut.active_diameter_min_mm,
        activeDiameterMaxMm: cut.active_diameter_max_mm,
        edgeUtilizationPercent: cut.edge_utilization_percent,
      });
      return { minimumMm: active.innerMm, targetMm: active.midpointMm, maximumMm: active.outerMm, method: "chamfer_active_band" };
    }
    default:
      return { minimumMm: diameter, targetMm: diameter, maximumMm: diameter, method: "nominal_diameter" };
  }
}

function radialChipThicknessFactor(aePercent) {
  const percent = finite(aePercent, "aePercent");
  if (percent <= 0 || percent > 100) throw new RangeError("aePercent must be above 0 and at most 100.");
  const ratio = percent / 100;
  if (ratio >= 0.5) return 1;
  const phi = Math.acos(1 - (2 * ratio));
  return Math.sin(phi);
}

function radialChipThinningMultiplier(aePercent, cap = Number.POSITIVE_INFINITY) {
  const factor = radialChipThicknessFactor(aePercent);
  const limit = Number.isFinite(cap) ? positive(cap, "cap") : Number.POSITIVE_INFINITY;
  return Math.min(1 / Math.max(factor, EPSILON), limit);
}

function mrrMm3Min(apMm, aeMm, feedMmMin) {
  return positive(apMm, "apMm", true) * positive(aeMm, "aeMm", true) * positive(feedMmMin, "feedMmMin", true);
}

function estimatedPowerKw(mrr, specificCuttingForceNmm2, efficiency = 1) {
  const q = positive(mrr, "mrrMm3Min", true);
  const kc = positive(specificCuttingForceNmm2, "specificCuttingForceNmm2");
  const eta = positive(efficiency, "efficiency");
  if (eta > 1) throw new RangeError("efficiency cannot exceed 1.");
  return (q * kc) / (60 * 1_000_000 * eta);
}

function scallopHeight(ballRadiusMm, stepoverMm) {
  const radius = positive(ballRadiusMm, "ballRadiusMm");
  const step = positive(stepoverMm, "stepoverMm", true);
  if (step > 2 * radius) throw new RangeError("stepoverMm cannot exceed the ball diameter.");
  return radius - Math.sqrt(Math.max(0, (radius * radius) - ((step * step) / 4)));
}

function stepoverForScallop(ballRadiusMm, cuspMm) {
  const radius = positive(ballRadiusMm, "ballRadiusMm");
  const cusp = positive(cuspMm, "cuspMm", true);
  if (cusp > radius) throw new RangeError("cuspMm cannot exceed ballRadiusMm.");
  return 2 * Math.sqrt(Math.max(0, (2 * radius * cusp) - (cusp * cusp)));
}

function logInterpolate(x, x0, x1, y0, y1) {
  const px = positive(x, "x");
  const p0 = positive(x0, "x0");
  const p1 = positive(x1, "x1");
  const py0 = positive(y0, "y0");
  const py1 = positive(y1, "y1");
  if (p1 <= p0) throw new RangeError("x1 must be greater than x0.");
  if (px < p0 - EPSILON || px > p1 + EPSILON) throw new RangeError("x must be inside the interpolation interval.");
  const t = Math.log(px / p0) / Math.log(p1 / p0);
  return Math.exp(Math.log(py0) + (t * (Math.log(py1) - Math.log(py0))));
}

function quantizeMachiningValue(value, increment, options = {}) {
  const raw = positive(value, "value", true);
  const step = positive(increment, "increment");
  const minimum = options.minimum == null ? 0 : positive(options.minimum, "minimum", true);
  const maximum = options.maximum == null ? Number.POSITIVE_INFINITY : positive(options.maximum, "maximum");
  const effectiveMinimum = Math.min(minimum, maximum);
  const clamped = clamp(raw, effectiveMinimum, maximum);
  let quantized = Math.round(clamped / step) * step;
  if (quantized > maximum) quantized = Math.floor(maximum / step) * step;
  if (quantized < effectiveMinimum) quantized = Math.ceil(effectiveMinimum / step) * step;
  if (!Number.isFinite(quantized) || quantized <= 0 || quantized > maximum) return clamped;
  return Number(quantized.toFixed(9));
}

module.exports = {
  ballnoseEffectiveDiameterFromAngle,
  ballnoseEffectiveDiameterFromDepth,
  bullnoseEffectiveDiameter,
  chamferActiveDiameter,
  effectiveDiameterRange,
  estimatedPowerKw,
  feedFromFn,
  feedFromFz,
  fnFromFeed,
  fzFromFeed,
  logInterpolate,
  mrrMm3Min,
  pitchFromSynchronizedFeed,
  quantizeMachiningValue,
  radialChipThicknessFactor,
  radialChipThinningMultiplier,
  rpmFromVc,
  scallopHeight,
  stepoverForScallop,
  vcFromRpm,
};
