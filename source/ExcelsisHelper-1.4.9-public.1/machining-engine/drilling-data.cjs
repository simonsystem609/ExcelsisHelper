"use strict";

const { logInterpolate } = require("./formulas.cjs");

const INCH_TO_MM = 25.4;

const DRILLING_SOURCES = Object.freeze({
  guhring217219: Object.freeze({
    id: "guhring-series-217-219-hss-drilling",
    owner: "Guhring",
    title: "Series 217/219 HSS drilling speed and feed table",
    url: "https://guhring.com/media/speedfeed/217.pdf",
    retrievedAt: "2026-07-16",
    sha256: "20D375BC2947AF6F5A513F178DE5E27F1BDC5FBA0A1AE2E87867100EA5C61FCD",
    reviewStatus: "visually-reviewed",
  }),
  dhfDak: Object.freeze({
    id: "dhf-dak-carbide-drill-series-pages-7-13",
    owner: "DHF Precision Tool",
    title: "DAK carbide drill milling conditions",
    url: "https://www.endmill.com.tw/download/en/&page=3",
    retrievedAt: "2026-07-16",
    sha256: "0935AD9E6EFFB6F6D4099C90C88B0BB3AE6A348F608D8ABBFD68CF88E3FEEDAA",
    reviewStatus: "visually-reviewed-pages-7-13",
  }),
});

const HSS_DIAMETERS_MM = Object.freeze([1.59, 3.17, 6.35, 9.52, 12.7, 15.87, 19.05, 25.4]);
const HSS_FEED_IPR = Object.freeze({
  type_n_soft: Object.freeze([0.0017, 0.005, 0.008, 0.01, 0.0125, 0.0125, 0.014, 0.016]),
  type_n_medium: Object.freeze([0.0015, 0.004, 0.0065, 0.008, 0.01, 0.01, 0.011, 0.0125]),
  type_n_tool: Object.freeze([0.0012, 0.003, 0.005, 0.0065, 0.008, 0.008, 0.009, 0.01]),
  type_w_aluminum: Object.freeze([0.002, 0.0065, 0.01, 0.0125, 0.016, 0.016, 0.018, 0.018]),
});

const DAK_DIAMETERS_MM = Object.freeze([3.25, 4.05, 5.05, 6.05, 8.05, 10.05, 12, 15, 20]);
const DAK_FZ_MM_TOOTH = Object.freeze({
  aluminum: Object.freeze([0.2, 0.21, 0.2, 0.22, 0.21, 0.15, 0.17, 0.16, 0.1]),
  steel_soft: Object.freeze([0.07, 0.05, 0.07, 0.09, 0.08, 0.08, 0.09, 0.08, 0.07]),
  steel_alloy: Object.freeze([0.06, 0.04, 0.05, 0.06, 0.08, 0.08, 0.09, 0.08, 0.06]),
  steel_tool: Object.freeze([0.05, 0.05, 0.05, 0.06, 0.08, 0.06, 0.08, 0.1, 0.06]),
  steel_prehardened: Object.freeze([0.02, 0.03, 0.04, 0.04, 0.06, 0.07, 0.07, 0.08, 0.06]),
  steel_hardened: Object.freeze([0.01, 0.01, 0.01, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02]),
});

function interpolateClamped(diameterMm, knots, values) {
  const diameter = Number(diameterMm);
  if (!Number.isFinite(diameter) || diameter <= 0) throw new TypeError("diameterMm must be positive.");
  if (diameter <= knots[0]) return values[0];
  const last = knots.length - 1;
  if (diameter >= knots[last]) return values[last];
  for (let index = 0; index < last; index += 1) {
    if (diameter < knots[index] || diameter > knots[index + 1]) continue;
    return logInterpolate(diameter, knots[index], knots[index + 1], values[index], values[index + 1]);
  }
  return values[last];
}

function hssFeedPerRevolution(curve, diameterMm) {
  const ipr = interpolateClamped(diameterMm, HSS_DIAMETERS_MM, HSS_FEED_IPR[curve]);
  return ipr * INCH_TO_MM;
}

function dakFz(curve, diameterMm) {
  return interpolateClamped(diameterMm, DAK_DIAMETERS_MM, DAK_FZ_MM_TOOTH[curve]);
}

function steelClass(material) {
  const materialId = String(material.materialId || "");
  const subfamily = String(material.subfamily || "").toLowerCase();
  const hardness = material.hardness;
  if (hardness?.scale?.toUpperCase() === "HRC") {
    if (hardness.value >= 48) return hardness.value <= 54 ? "hardened" : "beyond_dhf";
    if (hardness.value >= 36) return "prehardened";
  }
  if (materialId.includes("stainless") || subfamily.includes("stainless")) return "stainless";
  if (materialId.includes("tool.") || materialId.includes("bearing") || materialId.includes("hss.")) return "tool";
  if (materialId.includes("42crmo4") || materialId.includes("34crnimo6") || subfamily.includes("alloy")) return "alloy";
  if (material.confidence === "low") return "unknown";
  return "soft";
}

function profile(options) {
  return {
    key: options.key,
    vcRange: [...options.vcRange],
    feedBasis: options.feedBasis,
    feedRange: [...options.feedRange],
    source: DRILLING_SOURCES[options.source],
    confidence: options.confidence || "provisional",
    upperTrialAllowed: options.upperTrialAllowed === true,
    sourceTransfer: options.sourceTransfer === true,
    requiresWetCoolant: options.requiresWetCoolant === true,
    diameterClamped: options.diameterClamped || null,
    warnings: [...(options.warnings || [])],
  };
}

function selectHssProfile(request, material) {
  const diameter = request.tool.diameter_mm;
  const warnings = [];
  if (diameter < HSS_DIAMETERS_MM[0] || diameter > HSS_DIAMETERS_MM.at(-1)) {
    warnings.push(`Diameter is outside the ${HSS_DIAMETERS_MM[0]}-${HSS_DIAMETERS_MM.at(-1)} mm Guhring feed table; the nearest boundary feed is used.`);
  }
  const clampState = diameter < HSS_DIAMETERS_MM[0] ? "below" : (diameter > HSS_DIAMETERS_MM.at(-1) ? "above" : null);
  let curve = "type_n_medium";
  let vcRange = [13.7, 21.3];
  let key = "hss-broad-fallback";
  let sourceTransfer = false;
  if (material.familyId === "aluminum") {
    curve = "type_w_aluminum";
    vcRange = material.confidence === "low" ? [45, 55] : [55, 68.5];
    key = "hss-aluminum-series-219";
  } else if (material.familyId === "copper_alloy") {
    curve = "type_n_medium";
    vcRange = [21, 27];
    key = "hss-copper-alloy-series-217";
  } else if (material.familyId === "plastic") {
    curve = material.seedKey === "plastic_unfilled_sharp" ? "type_n_medium" : "type_n_tool";
    vcRange = material.seedKey === "plastic_unfilled_sharp" ? [17, 21] : [11, 14];
    key = "hss-plastic-series-217";
    if (material.seedKey === "plastic_reinforced_or_thermoset") {
      warnings.push("Broad or reinforced plastic uses the lower duroplastic row and requires wear/heat review.");
    }
  } else if (material.familyId === "steel") {
    const kind = steelClass(material);
    if (["stainless", "hardened", "beyond_dhf"].includes(kind)) return null;
    if (kind === "tool") {
      curve = "type_n_tool";
      vcRange = [11, 13.7];
      key = "hss-tool-steel-series-217";
    } else if (kind === "soft") {
      curve = "type_n_soft";
      vcRange = [21.3, 27.4];
      key = "hss-soft-steel-series-217";
    } else if (kind === "alloy") {
      curve = "type_n_medium";
      vcRange = [17, 21.3];
      key = "hss-alloy-steel-series-217";
      sourceTransfer = true;
    } else {
      curve = "type_n_tool";
      vcRange = [11, 15];
      key = "hss-unknown-steel-fallback";
      sourceTransfer = true;
      warnings.push("Steel grade/hardness is unknown; the broad fallback is deliberately below the normal structural-steel table.");
    }
  } else {
    return null;
  }
  const nominalFn = hssFeedPerRevolution(curve, diameter);
  return profile({
    key,
    vcRange,
    feedBasis: "per_revolution",
    feedRange: [nominalFn * 0.7, nominalFn],
    source: "guhring217219",
    sourceTransfer,
    upperTrialAllowed: material.confidence !== "low" && !sourceTransfer,
    diameterClamped: clampState,
    warnings,
  });
}

function selectCarbideProfile(request, material) {
  const diameter = request.tool.diameter_mm;
  const warnings = [];
  if (diameter < DAK_DIAMETERS_MM[0] || diameter > DAK_DIAMETERS_MM.at(-1)) {
    warnings.push(`Diameter is outside the ${DAK_DIAMETERS_MM[0]}-${DAK_DIAMETERS_MM.at(-1)} mm DHF DAK table; the nearest boundary chip load is used.`);
  }
  const clampState = diameter < DAK_DIAMETERS_MM[0] ? "below" : (diameter > DAK_DIAMETERS_MM.at(-1) ? "above" : null);
  let curve;
  let vcRange;
  let key;
  let sourceTransfer = false;
  if (material.familyId === "aluminum") {
    curve = "aluminum";
    vcRange = material.confidence === "low" ? [110, 160] : [140, 200];
    key = "carbide-aluminum-dhf-dak";
    sourceTransfer = !/5052|6061|7075/i.test(`${material.materialId} ${material.gradeInput || ""}`);
  } else if (material.familyId === "steel") {
    const kind = steelClass(material);
    if (kind === "stainless" || kind === "beyond_dhf") return null;
    if (kind === "hardened") {
      curve = "steel_hardened";
      vcRange = [24, 30];
      key = "carbide-hardened-steel-dhf-dak";
    } else if (kind === "prehardened") {
      curve = "steel_prehardened";
      vcRange = [48, 60];
      key = "carbide-prehardened-steel-dhf-dak";
    } else if (kind === "tool") {
      curve = "steel_tool";
      vcRange = [72, 90];
      key = "carbide-tool-steel-dhf-dak";
    } else if (kind === "alloy") {
      curve = "steel_alloy";
      vcRange = [100, 125];
      key = "carbide-alloy-steel-dhf-dak";
    } else if (kind === "soft") {
      curve = "steel_soft";
      vcRange = [100, 125];
      key = "carbide-soft-steel-dhf-dak";
    } else {
      curve = "steel_prehardened";
      vcRange = [42, 55];
      key = "carbide-unknown-steel-fallback";
      sourceTransfer = true;
      warnings.push("Steel grade/hardness is unknown; the broad fallback is based on the lower prehardened-steel envelope.");
    }
  } else if (["plastic", "copper_alloy"].includes(material.familyId)) {
    const hss = selectHssProfile(request, material);
    if (!hss) return null;
    return profile({
      key: `carbide-${material.familyId}-conservative-transfer`,
      vcRange: hss.vcRange,
      feedBasis: hss.feedBasis,
      feedRange: hss.feedRange.map((value) => value * 0.8),
      source: "guhring217219",
      sourceTransfer: true,
      upperTrialAllowed: false,
      diameterClamped: hss.diameterClamped,
      warnings: [...hss.warnings, "No reviewed carbide-drill family table is loaded for this material; the HSS envelope is transferred conservatively."],
    });
  } else {
    return null;
  }
  const fz = dakFz(curve, diameter);
  return profile({
    key,
    vcRange,
    feedBasis: "per_tooth",
    feedRange: [fz * 0.65, fz * 0.9],
    source: "dhfDak",
    sourceTransfer,
    requiresWetCoolant: true,
    upperTrialAllowed: material.confidence !== "low" && !sourceTransfer,
    diameterClamped: clampState,
    warnings,
  });
}

function selectDrillingProfile(request, material) {
  const substrate = String(request.tool.substrate || "");
  if (["hss", "hss_co", "pm_hss"].includes(substrate)) return selectHssProfile(request, material);
  if (substrate === "carbide") return selectCarbideProfile(request, material);
  return null;
}

function getDrillingSources() {
  return Object.values(DRILLING_SOURCES).map((source) => ({ ...source }));
}

module.exports = {
  DAK_DIAMETERS_MM,
  DAK_FZ_MM_TOOTH,
  DRILLING_SOURCES,
  HSS_DIAMETERS_MM,
  HSS_FEED_IPR,
  dakFz,
  getDrillingSources,
  hssFeedPerRevolution,
  interpolateClamped,
  selectDrillingProfile,
  steelClass,
};
