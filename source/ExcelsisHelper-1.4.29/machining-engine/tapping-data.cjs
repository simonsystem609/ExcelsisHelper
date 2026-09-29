"use strict";

const SFM_TO_M_MIN = 0.3048;

const TAPPING_SOURCES = Object.freeze({
  green: Object.freeze({
    id: "guhring-green-ring-cut-taps-steel",
    owner: "Guhring",
    title: "Green ring cut taps - steel",
    url: "https://guhring.com/media/speedfeed/3948.pdf",
    retrievedAt: "2026-07-16",
    sha256: "5570C96662110DFD42D7EEFD95B1861CAE782F0C9AD12C32CD8EE21DAF3FF4C1",
    reviewStatus: "visually-reviewed",
  }),
  blue: Object.freeze({
    id: "guhring-blue-ring-cut-taps-stainless",
    owner: "Guhring",
    title: "Blue ring cut taps - stainless steel",
    url: "https://guhring.com/media/speedfeed/879.pdf",
    retrievedAt: "2026-07-16",
    sha256: "6EA835D61282825A66FBAE612155DE8403FA577D00AD4FDE8028D6C88922D2F5",
    reviewStatus: "visually-reviewed",
  }),
  black: Object.freeze({
    id: "guhring-black-ring-cut-taps-aluminum",
    owner: "Guhring",
    title: "Black ring cut taps - aluminium",
    url: "https://www.guhring.com/media/speedfeed/3934.pdf",
    retrievedAt: "2026-07-16",
    sha256: "46ACD1CD9C6BB764538D8D37607D3A37157E2E8A3A03BD024BD2C42F0BF0CA71",
    reviewStatus: "visually-reviewed",
  }),
  form: Object.freeze({
    id: "guhring-form-tap-catalog-table",
    owner: "Guhring",
    title: "Form taps - material speed table",
    url: "https://guhring.com/media/catalogs/044mlrkbbek.pdf",
    retrievedAt: "2026-07-16",
    sha256: "B7712EB1BAD8BD5FCC64BC6E0438E757E86388389B149D00DF32B57296817977",
    reviewStatus: "visually-reviewed-page-175",
  }),
});

function sfmRange(lower, upper) {
  return [lower * SFM_TO_M_MIN, upper * SFM_TO_M_MIN];
}

function coated(tool) {
  const value = String(tool.coating_class || "").toLowerCase();
  return Boolean(value) && !/bright|none|uncoated|unknown/.test(value);
}

function substrateColumn(tool, tableSupportsCarbide = false) {
  if (tool.substrate === "carbide" && tableSupportsCarbide) return "carbide";
  if (tool.substrate === "pm_hss") return "pm_hss";
  if (["hss", "hss_co"].includes(tool.substrate)) return "hss_e";
  return null;
}

function selectedRange(columns, tool, supportsCarbide = false) {
  const column = substrateColumn(tool, supportsCarbide);
  if (!column) return null;
  const entry = columns[column];
  if (!entry) return null;
  const raw = Array.isArray(entry) ? entry : (coated(tool) ? entry.coated : entry.bright);
  if (!raw) return null;
  const derating = tool.substrate === "hss" ? 0.8 : 1;
  return sfmRange(raw[0] * derating, raw[1] * derating);
}

function result(options) {
  return {
    supported: true,
    key: options.key,
    vcRange: options.vcRange,
    source: TAPPING_SOURCES[options.source],
    confidence: options.confidence || "provisional",
    upperTrialAllowed: options.upperTrialAllowed === true,
    sourceTransfer: options.sourceTransfer === true,
    warnings: [...(options.warnings || [])],
  };
}

function unsupported(message) {
  return { supported: false, reasons: [message] };
}

function steelKind(material) {
  const id = String(material.materialId || "");
  const subfamily = String(material.subfamily || "").toLowerCase();
  const hrc = material.hardness?.scale?.toUpperCase() === "HRC" ? material.hardness.value : null;
  if (id.includes("stainless") || subfamily.includes("stainless")) {
    if (id.includes("303") || subfamily.includes("sulphur")) return "stainless_sulphured";
    if (subfamily.includes("austenitic")) return "stainless_austenitic";
    return "stainless_martensitic";
  }
  if (material.confidence === "low") return "unknown";
  if (hrc !== null && hrc >= 30) return hrc < 35 ? "steel_30_35" : "too_hard";
  if (id.includes("tool.") || id.includes("bearing") || id.includes("hss.")) return "tool";
  if (id.includes("case_hardening") || id.includes("alloy.") || subfamily.includes("alloy")) return "heat_treatable";
  return "structural";
}

function cutSteelProfile(request, material) {
  const kind = steelKind(material);
  if (request.tool.substrate === "carbide") return unsupported("The reviewed Guhring steel cut-tap table does not include a solid-carbide column.");
  if (kind === "too_hard" || kind === "tool") return unsupported("The reviewed cut-tap tables do not cover this steel class/hardness safely.");
  let source = "green";
  let key = kind;
  let columns;
  let sourceTransfer = false;
  const warnings = [];
  if (kind === "stainless_sulphured") {
    source = "blue";
    columns = { hss_e: { bright: [25, 35], coated: [40, 55] }, pm_hss: { bright: [30, 55], coated: [35, 70] } };
  } else if (kind === "stainless_austenitic") {
    source = "blue";
    columns = { hss_e: { bright: [20, 30], coated: [30, 40] }, pm_hss: { bright: [30, 50], coated: [35, 60] } };
  } else if (kind === "stainless_martensitic") {
    source = "blue";
    const hard = material.hardness?.scale?.toUpperCase() === "HRC" && material.hardness.value >= 30;
    columns = hard
      ? { hss_e: { bright: [10, 20], coated: [20, 30] }, pm_hss: { bright: [20, 35], coated: [25, 50] } }
      : { hss_e: { bright: [20, 30], coated: [25, 40] }, pm_hss: { bright: [25, 45], coated: [30, 50] } };
  } else if (kind === "heat_treatable") {
    columns = { hss_e: { bright: [30, 45], coated: [30, 65] }, pm_hss: { bright: [30, 60], coated: [35, 75] } };
  } else if (kind === "steel_30_35") {
    columns = { hss_e: { bright: [15, 25], coated: [20, 35] }, pm_hss: { bright: [25, 45], coated: [30, 60] } };
  } else if (kind === "structural") {
    columns = { hss_e: { bright: [40, 50], coated: [40, 75] }, pm_hss: { bright: [40, 65], coated: [40, 80] } };
  } else {
    columns = { hss_e: { bright: [15, 25], coated: [15, 25] }, pm_hss: { bright: [18, 28], coated: [18, 30] } };
    sourceTransfer = true;
    key = "unknown-steel-fallback";
    warnings.push("Steel grade/hardness is unknown; a deliberately low cross-table fallback is used.");
  }
  const vcRange = selectedRange(columns, request.tool);
  if (!vcRange) return unsupported(`The ${request.tool.substrate} cut-tap column is unavailable for this steel class.`);
  if (request.tool.substrate === "hss") warnings.push("Plain HSS is conservatively derated from the HSS-E source column.");
  return result({
    key: `cut-steel-${key}`,
    vcRange,
    source,
    sourceTransfer,
    upperTrialAllowed: !sourceTransfer && material.confidence !== "low",
    warnings,
  });
}

function cutAluminumProfile(request, material) {
  const id = String(material.materialId || "");
  const highSilicon = id.includes("alsi12");
  const mediumSilicon = id.includes("alsi10");
  let columns;
  if (highSilicon) {
    columns = {
      hss_e: { bright: null, coated: [25, 35] },
      pm_hss: { bright: [40, 65], coated: [65, 80] },
      carbide: { bright: [60, 130], coated: [80, 140] },
    };
  } else if (mediumSilicon) {
    columns = {
      hss_e: { bright: [25, 35], coated: [40, 50] },
      pm_hss: { bright: [40, 65], coated: [65, 80] },
      carbide: { bright: [80, 140], coated: [90, 165] },
    };
  } else {
    columns = {
      hss_e: { bright: [30, 50], coated: [50, 75] },
      pm_hss: { bright: [50, 70], coated: [65, 80] },
      carbide: { bright: [80, 140], coated: [90, 165] },
    };
  }
  let vcRange = selectedRange(columns, request.tool, true);
  if (!vcRange) return unsupported(`The ${request.tool.substrate} cut-tap column is unavailable for this aluminium class/coating.`);
  const sourceTransfer = material.confidence === "low";
  const warnings = [];
  if (sourceTransfer) {
    vcRange = vcRange.map((value) => value * 0.75);
    warnings.push("Exact alloy/silicon class is unknown; the aluminium table is derated.");
  }
  if (request.tool.substrate === "hss") warnings.push("Plain HSS is conservatively derated from the HSS-E source column.");
  return result({
    key: highSilicon ? "cut-aluminum-high-silicon" : (mediumSilicon ? "cut-aluminum-medium-silicon" : "cut-aluminum-wrought-low-silicon"),
    vcRange,
    source: "black",
    sourceTransfer,
    upperTrialAllowed: !sourceTransfer && !highSilicon,
    warnings,
  });
}

function formProfile(request, material) {
  let columns;
  let key;
  let sourceTransfer = false;
  const warnings = [];
  if (material.familyId === "steel") {
    const kind = steelKind(material);
    if (kind === "too_hard") return unsupported("The reviewed form-tap table does not cover this steel hardness.");
    if (kind === "stainless_sulphured") {
      columns = { hss_e: [40, 50], pm_hss: [45, 60], carbide: [50, 70] };
      key = "stainless-sulphured";
    } else if (kind === "stainless_austenitic") {
      columns = { hss_e: [35, 50], pm_hss: [40, 55], carbide: [45, 60] };
      key = "stainless-austenitic";
    } else if (kind === "stainless_martensitic") {
      columns = { hss_e: [25, 40], pm_hss: [35, 50], carbide: [40, 55] };
      key = "stainless-martensitic";
    } else if (kind === "tool") {
      columns = { hss_e: [15, 30], pm_hss: [30, 50], carbide: [40, 60] };
      key = "alloy-tool-steel";
    } else if (kind === "heat_treatable") {
      columns = { hss_e: [20, 40], pm_hss: [35, 55], carbide: [50, 70] };
      key = "alloy-heat-treatable";
    } else if (kind === "structural") {
      columns = { hss_e: [45, 70], pm_hss: [60, 90], carbide: [90, 120] };
      key = "structural";
    } else {
      columns = { hss_e: [20, 30], pm_hss: [25, 38], carbide: [35, 50] };
      key = "unknown-steel-fallback";
      sourceTransfer = true;
      warnings.push("Steel grade/hardness is unknown; a low form-tap fallback is used.");
    }
  } else if (material.familyId === "aluminum") {
    if (String(material.materialId || "").includes("alsi12")) return unsupported("The reviewed form-tap table has no value for aluminium cast alloy above 10% silicon.");
    const cast = String(material.materialId || "").includes(".cast.");
    columns = cast
      ? { hss_e: [60, 75], pm_hss: [70, 140], carbide: [100, 165] }
      : { hss_e: [80, 100], pm_hss: [100, 150], carbide: [150, 200] };
    key = cast ? "aluminum-cast-under-10si" : "aluminum-wrought";
    if (material.confidence === "low") {
      sourceTransfer = true;
      warnings.push("Exact aluminium alloy/cast class is unknown; source confidence is reduced.");
    }
  } else if (material.familyId === "copper_alloy") {
    const longChipping = /pure|cartridge|red|silicon|phosphor/i.test(`${material.materialId} ${material.subfamily}`);
    columns = longChipping
      ? { hss_e: [40, 65], pm_hss: [60, 80], carbide: [80, 120] }
      : { hss_e: [35, 50], pm_hss: [50, 65], carbide: [75, 100] };
    key = longChipping ? "brass-long-chipping-transfer" : "brass-short-chipping";
    sourceTransfer = !String(material.materialId || "").includes("brass");
    if (sourceTransfer) warnings.push("The form-tap brass row is transferred to a broader copper-alloy identity.");
  } else if (material.familyId === "plastic") {
    return unsupported("The reviewed Guhring form-tap table explicitly provides no plastics recommendation.");
  } else {
    return unsupported("No reviewed form-tap table covers this broad material family.");
  }
  const vcRange = selectedRange(columns, request.tool, true);
  if (!vcRange) return unsupported(`The ${request.tool.substrate} form-tap column is unavailable for this material.`);
  if (request.tool.substrate === "hss") warnings.push("Plain HSS is conservatively derated from the HSS-E source column.");
  if (sourceTransfer) {
    vcRange[0] *= 0.8;
    vcRange[1] *= 0.8;
  }
  return result({
    key: `form-${key}`,
    vcRange,
    source: "form",
    sourceTransfer,
    upperTrialAllowed: !sourceTransfer && material.confidence !== "low",
    warnings,
  });
}

function selectTappingProfile(request, material) {
  if (request.tool.style === "form") return formProfile(request, material);
  if (request.tool.style !== "cut") return unsupported("Tap style must be confirmed as cut or form before local calculation.");
  if (material.familyId === "steel") return cutSteelProfile(request, material);
  if (material.familyId === "aluminum") return cutAluminumProfile(request, material);
  return unsupported(`No reviewed cut-tap table is loaded for ${material.materialLabel}.`);
}

function getTappingSources() {
  return Object.values(TAPPING_SOURCES).map((source) => ({ ...source }));
}

module.exports = {
  SFM_TO_M_MIN,
  TAPPING_SOURCES,
  getTappingSources,
  selectTappingProfile,
  sfmRange,
  steelKind,
};
