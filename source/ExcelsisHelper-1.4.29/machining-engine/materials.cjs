"use strict";

// This catalog resolves operator wording to material identities and conservative
// generic seed families. It is taxonomy, not manufacturer cutting data.
const MATERIAL_SOURCES = Object.freeze([
  {
    id: "ensinger-stock-shapes",
    owner: "Ensinger",
    role: "plastic taxonomy",
    url: "https://www.ensingerplastics.com/en/shapes",
    retrievedAt: "2026-07-16",
  },
  {
    id: "hydro-extrusion-alloys",
    owner: "Hydro",
    role: "aluminum alloy taxonomy",
    url: "https://www.hydro.com/gb/global/aluminium/products/extruded-profiles/alloys-for-extruded-aluminium-profiles/",
    retrievedAt: "2026-07-16",
  },
  {
    id: "ssab-structural-grades",
    owner: "SSAB",
    role: "structural steel taxonomy",
    url: "https://www.ssab.com/en-us/brands-and-products/steel-categories/structural-steels/patterned-steel",
    retrievedAt: "2026-07-16",
  },
  {
    id: "ovako-steel-navigator",
    owner: "Ovako",
    role: "engineering steel taxonomy and aliases",
    url: "https://steelnavigator.ovako.com/material-data-sheets/",
    retrievedAt: "2026-07-16",
  },
  {
    id: "uddeholm-stock-programme",
    owner: "Uddeholm",
    role: "tool steel taxonomy and aliases",
    url: "https://www.uddeholm.com/app/uploads/sites/232/2024/06/standard-stock-programme-ireland.pdf",
    retrievedAt: "2026-07-16",
  },
  {
    id: "voestalpine-bohler-stock-programme",
    owner: "voestalpine Bohler",
    role: "tool-steel, mold-steel, and HSS trade-name equivalences",
    url: "https://www.voestalpine.com/highperformancemetals/uk/app/uploads/sites/16/2020/02/voestalpine-High-Performance-Metals-UK-Ltd-FINAL-Jan-2020-ONLINE-004.pdf",
    retrievedAt: "2026-07-16",
  },
  {
    id: "voestalpine-bohler-equivalence-table",
    owner: "voestalpine Bohler",
    role: "legacy Bohler trade-name equivalences including K200",
    url: "https://www.voestalpine.com/highperformancemetals/argentina/app/uploads/sites/264/2024/09/Tabla-de-equivalencias-Denk-Styria.pdf",
    retrievedAt: "2026-07-16",
  },
  {
    id: "outokumpu-prodec",
    owner: "Outokumpu",
    role: "stainless steel taxonomy and aliases",
    url: "https://www.outokumpu.com/en/products/product-ranges/prodec",
    retrievedAt: "2026-07-16",
  },
  {
    id: "copper-uns",
    owner: "Copper Development Association",
    role: "copper and copper-alloy family taxonomy",
    url: "https://uns.copper.org/",
    retrievedAt: "2026-07-16",
  },
]);

const MATERIAL_GROUPS = Object.freeze([
  {
    id: "steel",
    label: "Steel",
    aliases: ["steel", "steels", "carbon steel", "alloy steel", "tool steel", "stainless steel"],
    isoGroup: "P/H",
    genericSeedKey: "steel_low_alloy_or_mold_annealed",
    sourceIds: ["ssab-structural-grades", "ovako-steel-navigator", "uddeholm-stock-programme", "voestalpine-bohler-stock-programme", "voestalpine-bohler-equivalence-table", "outokumpu-prodec"],
    grades: [
      grade("steel.generic", "Generic steel (grade unknown)", ["generic steel", "steel", "unknown steel"], "steel_low_alloy_or_mold_annealed", "general"),
      grade("steel.structural.s235", "S235 structural steel", ["S235", "S235JR"], "steel_mild_soft", "structural low-carbon"),
      grade("steel.structural.s275", "S275 structural steel", ["S275", "S275JR"], "steel_mild_soft", "structural low-carbon"),
      grade("steel.structural.s355", "S355 structural steel", ["S355", "S355JR", "S355MC"], "steel_mild_soft", "structural low-carbon"),
      grade("steel.structural.a36", "ASTM A36 / 1018 mild steel", ["A36", "1018", "mild steel"], "steel_mild_soft", "structural low-carbon"),
      grade("steel.free_cutting.11smn30", "11SMn30 free-cutting steel", ["11SMn30", "1.0715", "1215"], "steel_mild_soft", "free-cutting"),
      grade("steel.free_cutting.11smnpb30", "11SMnPb30 / 12L14 free-cutting steel", ["11SMnPb30", "1.0718", "12L14"], "steel_mild_soft", "free-cutting"),
      grade("steel.carbon.c45", "C45 / AISI 1045", ["C45", "C45E", "1.1191", "1.0503", "1045"], "steel_low_alloy_or_mold_annealed", "medium-carbon"),
      grade("steel.case_hardening.16mncr5", "16MnCr5 case-hardening steel", ["16MnCr5", "1.7131"], "steel_low_alloy_or_mold_annealed", "case-hardening"),
      grade("steel.case_hardening.20mncr5", "20MnCr5 case-hardening steel", ["20MnCr5", "1.7147"], "steel_low_alloy_or_mold_annealed", "case-hardening"),
      grade("steel.alloy.crmo4_family", "CrMo4 alloy-steel family (exact grade required)", ["CrMo4", "chromium molybdenum steel", "chrome moly steel"], "steel_low_alloy_or_mold_annealed", "quenched-and-tempered alloy", { exactSourcePreferred: true }),
      grade("steel.alloy.42crmo4", "42CrMo4 / AISI 4140 / 1.7225", ["42CrMo4", "1.7225", "1.7227", "4140", "MoC 410 M"], "steel_low_alloy_or_mold_annealed", "quenched-and-tempered alloy"),
      grade("steel.alloy.34crnimo6", "34CrNiMo6 / AISI 4340", ["34CrNiMo6", "1.6582", "4340"], "steel_low_alloy_or_mold_annealed", "quenched-and-tempered alloy"),
      grade("steel.bearing.100cr6", "Bohler K200 / 100Cr6 / AISI 52100", ["K200", "Bohler K200", "100Cr6", "1.3505", "52100", "L3"], "steel_high_carbide_tool_or_hss_workpiece_annealed", "bearing steel"),
      grade("steel.tool.o1", "O1 / Bohler K460 / 1.2510", ["O1", "K460", "Bohler K460", "1.2510", "100MnCrW4", "Uddeholm Arne"], "steel_high_carbide_tool_or_hss_workpiece_annealed", "cold-work tool steel"),
      grade("steel.tool.a2", "A2 / Bohler K305 / 1.2363", ["A2", "K305", "Bohler K305", "1.2363", "X100CrMoV5", "X100CrMoV5-1"], "steel_high_carbide_tool_or_hss_workpiece_annealed", "cold-work tool steel"),
      grade("steel.tool.d3", "D3 / Bohler K100 / 1.2080", ["D3", "K100", "Bohler K100", "1.2080", "X210Cr12", "SKD1"], "steel_high_carbide_tool_or_hss_workpiece_annealed", "cold-work tool steel", { upperTrialAllowed: false }),
      grade("steel.tool.d2", "D2 / Bohler K110 / 1.2379", ["D2", "K110", "Bohler K110", "1.2379", "X153CrMoV12", "Sverker 21"], "steel_high_carbide_tool_or_hss_workpiece_annealed", "cold-work tool steel"),
      grade("steel.tool.h11", "H11 / Bohler W300 / 1.2343", ["H11", "W300", "Bohler W300", "1.2343", "X37CrMoV5-1"], "steel_low_alloy_or_mold_annealed", "hot-work tool steel"),
      grade("steel.tool.h13", "H13 / Bohler W302 / 1.2344", ["H13", "W302", "Bohler W302", "1.2344", "X40CrMoV5-1", "Orvar Supreme"], "steel_low_alloy_or_mold_annealed", "hot-work tool steel"),
      grade("steel.mold.p20", "P20 / 1.2311 mold steel", ["P20", "1.2311", "40CrMnMo7"], "steel_low_alloy_or_mold_annealed", "mold steel"),
      grade("steel.mold.p20s", "Bohler M200 / P20+S / 1.2312", ["M200", "Bohler M200", "1.2312", "40CrMnMoS8-6", "P20+S", "P20 S"], "steel_low_alloy_or_mold_annealed", "mold steel"),
      grade("steel.mold.p20ni", "Bohler M238 / P20+Ni / 1.2738", ["M238", "Bohler M238", "P20+Ni", "P20 Ni", "1.2738", "40CrMnNiMo8-6-4", "Impax Supreme"], "steel_low_alloy_or_mold_annealed", "mold steel"),
      grade("steel.mold.m310", "Bohler M310 / 420 ESR / 1.2083", ["M310", "M310 Isoplast", "Bohler M310", "1.2083", "X40Cr14", "420 ESR", "420SS ESR"], "steel_high_carbide_tool_or_hss_workpiece_annealed", "corrosion-resistant mold steel", { upperTrialAllowed: false }),
      grade("steel.hss.m1", "M1 / Bohler S401 / 1.3346", ["M1", "S401", "Bohler S401", "1.3346", "HS2-9-1", "UNS T11301"], "steel_high_carbide_tool_or_hss_workpiece_annealed", "high-speed steel", { upperTrialAllowed: false }),
      grade("steel.hss.m2", "M2 / Bohler S600 / 1.3343", ["M2", "S600", "Bohler S600", "1.3343", "HS6-5-2", "HS6-5-2C"], "steel_high_carbide_tool_or_hss_workpiece_annealed", "high-speed steel", { upperTrialAllowed: false }),
      grade("steel.tool.pm", "PM tool steel (exact grade required)", ["PM tool steel", "Elmax", "Vanadis 4 Extra", "Vanadis 8", "Vancron", "K390", "M390"], "steel_high_carbide_tool_or_hss_workpiece_annealed", "powder-metallurgy tool steel", { exactSourcePreferred: true }),
      grade("steel.stainless.303", "303 / 1.4305 stainless steel", ["303", "1.4305", "X8CrNiS18-9"], "steel_high_carbide_tool_or_hss_workpiece_annealed", "austenitic stainless", { upperTrialAllowed: false }),
      grade("steel.stainless.304", "304 / 304L / 1.4301 / 1.4307 stainless", ["304", "304L", "1.4301", "1.4307", "X5CrNi18-10", "X2CrNi18-9"], "steel_high_carbide_tool_or_hss_workpiece_annealed", "austenitic stainless", { upperTrialAllowed: false }),
      grade("steel.stainless.316", "316 / 316L / 1.4401 / 1.4404 stainless", ["316", "316L", "1.4401", "1.4404", "X2CrNiMo17-12-2"], "steel_high_carbide_tool_or_hss_workpiece_annealed", "austenitic stainless", { upperTrialAllowed: false }),
      grade("steel.stainless.17-4ph", "17-4PH / 1.4542 stainless", ["17-4PH", "17 4 PH", "1.4542", "X5CrNiCuNb16-4"], "steel_low_alloy_or_mold_annealed", "precipitation-hardening stainless", { upperTrialAllowed: false }),
      grade("steel.stainless.420", "420 / 1.4021 martensitic stainless", ["420", "1.4021", "X20Cr13"], "steel_low_alloy_or_mold_annealed", "martensitic stainless", { upperTrialAllowed: false }),
      grade("steel.hardened.generic", "Hardened steel (use HRC)", ["hardened steel", "hard steel"], "steel_hardened_38_45", "hardened steel", { exactSourcePreferred: true }),
    ],
  },
  {
    id: "aluminum",
    label: "Aluminium",
    aliases: ["aluminium", "aluminum", "alu", "al alloy", "aluminium alloy", "aluminum alloy"],
    isoGroup: "N",
    genericSeedKey: "aluminum_wrought_general",
    sourceIds: ["hydro-extrusion-alloys"],
    grades: [
      grade("aluminum.generic", "Generic aluminium (grade unknown)", ["generic aluminium", "generic aluminum", "aluminium", "aluminum", "alu"], "aluminum_wrought_general", "unknown alloy"),
      grade("aluminum.wrought.1050", "EN AW-1050 / 1070", ["1050", "EN AW 1050", "EN AW-1050", "1070", "EN AW 1070"], "aluminum_wrought_general", "wrought 1xxx"),
      grade("aluminum.wrought.2011", "EN AW-2011 free-machining aluminium", ["2011", "EN AW 2011", "EN AW-2011", "AlCu6BiPb"], "aluminum_wrought_general", "wrought 2xxx"),
      grade("aluminum.wrought.2024", "EN AW-2024", ["2024", "EN AW 2024", "EN AW-2024", "AlCu4Mg1"], "aluminum_wrought_general", "wrought 2xxx"),
      grade("aluminum.wrought.3003", "EN AW-3003 / 3103", ["3003", "3103", "EN AW 3003", "EN AW 3103"], "aluminum_wrought_general", "wrought 3xxx"),
      grade("aluminum.wrought.5083", "EN AW-5083", ["5083", "EN AW 5083", "EN AW-5083", "AlMg4.5Mn"], "aluminum_wrought_general", "wrought 5xxx"),
      grade("aluminum.wrought.5754", "EN AW-5754", ["5754", "EN AW 5754", "EN AW-5754", "AlMg3"], "aluminum_wrought_general", "wrought 5xxx"),
      grade("aluminum.wrought.6060", "EN AW-6060", ["6060", "EN AW 6060", "EN AW-6060", "AlMgSi0.5"], "aluminum_wrought_general", "wrought 6xxx"),
      grade("aluminum.wrought.6061", "EN AW-6061 / 6061-T6", ["6061", "6061-T6", "6061 T6", "EN AW 6061", "EN AW-6061", "AlMg1SiCu"], "aluminum_wrought_general", "wrought 6xxx"),
      grade("aluminum.wrought.6063", "EN AW-6063", ["6063", "EN AW 6063", "EN AW-6063", "AlMg0.7Si"], "aluminum_wrought_general", "wrought 6xxx"),
      grade("aluminum.wrought.6082", "EN AW-6082 / AlMgSi1", ["6082", "EN AW 6082", "EN AW-6082", "AlMgSi1"], "aluminum_wrought_general", "wrought 6xxx"),
      grade("aluminum.wrought.7075", "Perunal 215 / EN AW-7075 / 7075", ["Perunal", "Perunal 215", "7075", "EN AW 7075", "EN AW-7075", "AlZn5.5MgCu"], "aluminum_wrought_general", "wrought 7xxx"),
      grade("aluminum.wrought.7108", "EN AW-7108", ["7108", "EN AW 7108", "EN AW-7108"], "aluminum_wrought_general", "wrought 7xxx"),
      grade("aluminum.cast.alsi7mg", "Cast AlSi7Mg / A356", ["AlSi7Mg", "A356", "356 aluminum", "356 aluminium"], "aluminum_wrought_general", "cast low/medium-silicon", { upperTrialAllowed: false }),
      grade("aluminum.cast.alsi10mg", "Cast AlSi10Mg", ["AlSi10Mg", "Al Si 10 Mg"], "aluminum_wrought_general", "cast medium-silicon", { upperTrialAllowed: false }),
      grade("aluminum.cast.alsi12", "Cast AlSi12", ["AlSi12", "Al Si 12", "high silicon aluminum", "high silicon aluminium"], "aluminum_wrought_general", "cast high-silicon", { upperTrialAllowed: false, abrasive: true }),
    ],
  },
  {
    id: "copper_alloy",
    label: "Copper and copper alloys",
    aliases: ["copper", "copper alloy", "copper alloys", "brass", "bronze", "cu alloy"],
    isoGroup: "N",
    genericSeedKey: "bronze_or_pure_copper_sharp",
    sourceIds: ["copper-uns"],
    grades: [
      grade("copper.generic", "Generic copper alloy (grade unknown)", ["generic copper", "generic copper alloy", "copper alloy", "bronze"], "bronze_or_pure_copper_sharp", "unknown copper alloy"),
      grade("copper.pure", "Pure copper / C10100 / C11000", ["pure copper", "C10100", "C11000", "Cu-ETP", "Cu-OF"], "bronze_or_pure_copper_sharp", "pure copper", { upperTrialAllowed: false }),
      grade("copper.brass.free_cutting", "Free-cutting brass / C36000 / CW614N", ["free cutting brass", "C36000", "CW614N", "CuZn39Pb3", "leaded brass"], "brass_free_cutting", "brass"),
      grade("copper.brass.cartridge", "Cartridge brass / C26000", ["cartridge brass", "C26000", "CuZn30"], "bronze_or_pure_copper_sharp", "brass"),
      grade("copper.brass.red", "Red brass / C23000", ["red brass", "C23000", "CuZn15"], "bronze_or_pure_copper_sharp", "red brass"),
      grade("copper.brass.lead_free", "Lead-free brass / CW724R", ["lead free brass", "lead-free brass", "CW724R", "CuZn21Si3P"], "bronze_or_pure_copper_sharp", "brass", { upperTrialAllowed: false }),
      grade("copper.bronze.phosphor", "Phosphor/tin bronze / C51000", ["phosphor bronze", "tin bronze", "C51000", "CuSn5"], "bronze_or_pure_copper_sharp", "phosphor bronze"),
      grade("copper.bronze.silicon", "Silicon bronze / C65500", ["silicon bronze", "C65500", "CuSi3Mn1"], "bronze_or_pure_copper_sharp", "silicon bronze"),
      grade("copper.bronze.aluminum", "Aluminium bronze / C95400", ["aluminium bronze", "aluminum bronze", "C95400", "CW307G", "CuAl10Ni5Fe4"], "aluminum_bronze", "aluminum bronze", { upperTrialAllowed: false }),
      grade("copper.beryllium", "Beryllium copper / C17200", ["beryllium copper", "beryllium bronze", "BeCu", "C17200", "CuBe2"], "bronze_or_pure_copper_sharp", "beryllium copper", { supported: false, safetyReviewRequired: true }),
      grade("copper.cupronickel", "Copper-nickel / C70600 / C71500", ["copper nickel", "copper-nickel", "cupronickel", "C70600", "C71500", "CuNi10Fe1Mn"], "aluminum_bronze", "copper-nickel", { upperTrialAllowed: false }),
      grade("copper.nickel_silver", "Nickel silver / C75200", ["nickel silver", "C75200", "CuNi18Zn20"], "bronze_or_pure_copper_sharp", "nickel silver", { upperTrialAllowed: false }),
    ],
  },
  {
    id: "plastic",
    label: "Plastic",
    aliases: ["plastic", "plastics", "polymer", "engineering plastic", "thermoplastic"],
    isoGroup: "O",
    genericSeedKey: "plastic_reinforced_or_thermoset",
    sourceIds: ["ensinger-stock-shapes"],
    grades: [
      grade("plastic.generic", "Generic plastic (grade unknown)", ["generic plastic", "plastic", "unknown polymer"], "plastic_reinforced_or_thermoset", "unknown polymer", { upperTrialAllowed: false }),
      grade("plastic.pe_hd", "PE-HD / HDPE", ["PE-HD", "PE HD", "HDPE", "high density polyethylene"], "plastic_unfilled_sharp", "unfilled semicrystalline"),
      grade("plastic.pe_uhmw", "PE-UHMW / UHMWPE", ["PE-UHMW", "UHMWPE", "UHMW PE", "ultra high molecular weight polyethylene"], "plastic_unfilled_sharp", "unfilled semicrystalline"),
      grade("plastic.pp", "PP polypropylene", ["PP", "polypropylene"], "plastic_unfilled_sharp", "unfilled semicrystalline"),
      grade("plastic.pom_c", "POM-C acetal copolymer", ["POM-C", "POM C", "acetal copolymer", "Delrin copolymer"], "plastic_unfilled_sharp", "unfilled semicrystalline"),
      grade("plastic.pom_h", "POM-H acetal homopolymer", ["POM-H", "POM H", "acetal homopolymer", "Delrin"], "plastic_unfilled_sharp", "unfilled semicrystalline"),
      grade("plastic.pa6", "PA6 nylon (unreinforced)", ["PA6", "PA 6", "PA-6", "nylon 6", "polyamide 6"], "plastic_unfilled_sharp", "unfilled semicrystalline"),
      grade("plastic.pa66", "PA66 nylon (unreinforced)", ["PA66", "PA 66", "PA-66", "nylon 66", "polyamide 66"], "plastic_unfilled_sharp", "unfilled semicrystalline"),
      grade("plastic.pa6_cast", "PA6-G / cast nylon", ["PA6-G", "PA 6 G", "PA6 cast", "cast nylon", "PA6C"], "plastic_unfilled_sharp", "cast semicrystalline"),
      grade("plastic.pa6_gf30", "PA6-GF30 reinforced nylon", ["PA6-GF30", "PA6 GF30", "PA 6 GF 30", "30% glass filled PA6", "reinforced nylon 6"], "plastic_reinforced_or_thermoset", "glass-fiber reinforced", { abrasive: true, upperTrialAllowed: false }),
      grade("plastic.pa66_gf30", "PA66-GF30 reinforced nylon", ["PA66-GF30", "PA66 GF30", "PA 66 GF 30", "30% glass filled PA66", "reinforced nylon 66"], "plastic_reinforced_or_thermoset", "glass-fiber reinforced", { abrasive: true, upperTrialAllowed: false }),
      grade("plastic.pet", "PET polyester", ["PET", "polyethylene terephthalate"], "plastic_unfilled_sharp", "unfilled semicrystalline"),
      grade("plastic.pbt", "PBT polyester", ["PBT", "polybutylene terephthalate"], "plastic_amorphous_or_high_temp", "engineering thermoplastic"),
      grade("plastic.ptfe", "PTFE", ["PTFE", "Teflon", "polytetrafluoroethylene"], "plastic_unfilled_sharp", "fluoropolymer"),
      grade("plastic.pvc", "PVC", ["PVC", "polyvinyl chloride"], "plastic_amorphous_or_high_temp", "amorphous thermoplastic"),
      grade("plastic.pmma", "PMMA acrylic", ["PMMA", "acrylic", "Plexiglas", "Perspex"], "plastic_amorphous_or_high_temp", "amorphous thermoplastic"),
      grade("plastic.pc", "PC polycarbonate", ["PC", "polycarbonate"], "plastic_amorphous_or_high_temp", "amorphous thermoplastic"),
      grade("plastic.abs", "ABS", ["ABS", "acrylonitrile butadiene styrene"], "plastic_amorphous_or_high_temp", "amorphous thermoplastic"),
      grade("plastic.peek", "PEEK (unreinforced)", ["PEEK", "polyether ether ketone", "polyetheretherketone"], "plastic_amorphous_or_high_temp", "high-temperature semicrystalline"),
      grade("plastic.peek_gf30", "PEEK-GF30", ["PEEK-GF30", "PEEK GF30", "30% glass filled PEEK"], "plastic_reinforced_or_thermoset", "glass-fiber reinforced", { abrasive: true, upperTrialAllowed: false }),
      grade("plastic.peek_cf30", "PEEK-CF30", ["PEEK-CF30", "PEEK CF30", "30% carbon filled PEEK"], "plastic_reinforced_or_thermoset", "carbon-fiber reinforced", { abrasive: true, upperTrialAllowed: false }),
      grade("plastic.pps", "PPS", ["PPS", "polyphenylene sulfide"], "plastic_amorphous_or_high_temp", "high-temperature semicrystalline"),
      grade("plastic.pei", "PEI", ["PEI", "polyetherimide", "Ultem"], "plastic_amorphous_or_high_temp", "high-temperature amorphous"),
      grade("plastic.psu", "PSU polysulfone", ["PSU", "polysulfone"], "plastic_amorphous_or_high_temp", "high-temperature amorphous"),
      grade("plastic.ppsu", "PPSU", ["PPSU", "polyphenylsulfone"], "plastic_amorphous_or_high_temp", "high-temperature amorphous"),
      grade("plastic.pvdf", "PVDF", ["PVDF", "polyvinylidene fluoride"], "plastic_amorphous_or_high_temp", "fluoropolymer"),
      grade("plastic.pai", "PAI", ["PAI", "polyamide-imide", "Torlon"], "plastic_amorphous_or_high_temp", "high-temperature amorphous"),
      grade("plastic.pi", "PI polyimide", ["PI", "polyimide", "Vespel"], "plastic_amorphous_or_high_temp", "high-temperature thermoset-like"),
      grade("plastic.phenolic", "Phenolic laminate", ["phenolic", "phenolic laminate", "Bakelite"], "plastic_reinforced_or_thermoset", "thermoset", { abrasive: true, upperTrialAllowed: false }),
      grade("plastic.g10_fr4", "G10 / FR4 glass laminate", ["G10", "FR4", "G-10", "FR-4", "glass epoxy laminate"], "plastic_reinforced_or_thermoset", "glass-fiber reinforced thermoset", { abrasive: true, upperTrialAllowed: false }),
      grade("plastic.cfrp", "CFRP carbon-fiber composite", ["CFRP", "carbon fiber", "carbon fibre", "carbon fiber reinforced plastic"], "plastic_reinforced_or_thermoset", "carbon-fiber composite", { abrasive: true, upperTrialAllowed: false, exactSourcePreferred: true }),
    ],
  },
]);

function grade(id, label, aliases, seedKey, subfamily, flags = {}) {
  return Object.freeze({
    id,
    label,
    aliases: Object.freeze([...aliases]),
    seedKey,
    subfamily,
    supported: flags.supported !== false,
    upperTrialAllowed: flags.upperTrialAllowed !== false,
    abrasive: flags.abrasive === true,
    exactSourcePreferred: flags.exactSourcePreferred === true,
    safetyReviewRequired: flags.safetyReviewRequired === true,
  });
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function searchableTerms(item) {
  return [item.id, item.label, ...(item.aliases || [])]
    .map(normalizeSearchText)
    .filter(Boolean);
}

function containsTokenSequence(text, term) {
  const textTokens = String(text || "").split(" ").filter(Boolean);
  const termTokens = String(term || "").split(" ").filter(Boolean);
  if (!termTokens.length || termTokens.length > textTokens.length) return false;
  for (let start = 0; start <= textTokens.length - termTokens.length; start += 1) {
    if (termTokens.every((token, index) => textTokens[start + index] === token)) return true;
  }
  return false;
}

function matchScore(item, query) {
  const needle = normalizeSearchText(query);
  if (!needle) return 1;
  let best = 0;
  for (const term of searchableTerms(item)) {
    if (term === needle) best = Math.max(best, 1000 + term.length);
    else if (term.startsWith(needle)) best = Math.max(best, 700 - (term.length - needle.length));
    else if (term.includes(needle)) best = Math.max(best, 500 - term.indexOf(needle));
    else if (needle.length >= 3 && containsTokenSequence(needle, term)) best = Math.max(best, 300 + term.length);
  }
  return best;
}

function findMaterialGroup(value) {
  if (!String(value || "").trim()) return null;
  const ranked = MATERIAL_GROUPS
    .map((group) => ({ group, score: matchScore(group, value) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.group.label.localeCompare(b.group.label));
  return ranked[0]?.group || null;
}

function findGradeInGroup(group, value) {
  if (!group || !String(value || "").trim()) return null;
  const ranked = group.grades
    .map((item) => ({ item, score: matchScore(item, value) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label));
  return ranked[0]?.item || null;
}

function inferGroupFromGrade(value) {
  if (!String(value || "").trim()) return null;
  const ranked = [];
  for (const group of MATERIAL_GROUPS) {
    for (const item of group.grades) {
      const score = matchScore(item, value);
      if (score > 0) ranked.push({ group, item, score });
    }
  }
  ranked.sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label));
  return ranked[0] || null;
}

function normalizeHardness(value, scale) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return { value: numeric, scale: String(scale || "HRC").trim() || "HRC" };
}

function steelHardnessSeed(hardness) {
  if (!hardness || hardness.scale.toUpperCase() !== "HRC") return null;
  if (hardness.value > 60) return { supported: false, seedKey: null, warning: "Generic local milling above 60 HRC is outside the current engine scope." };
  if (hardness.value > 55) return { supported: true, seedKey: "steel_hardened_55_60", upperTrialAllowed: false };
  if (hardness.value > 45) return { supported: true, seedKey: "steel_hardened_45_55", upperTrialAllowed: false };
  if (hardness.value >= 38) return { supported: true, seedKey: "steel_hardened_38_45", upperTrialAllowed: true }; // gitleaks:allow -- deterministic material taxonomy key
  return null;
}

function extractTemper(value) {
  const match = String(value || "").toUpperCase().match(/(?:^|[^A-Z0-9])(T\d{1,3}(?:\d{1,2})?)(?:$|[^A-Z0-9])/);
  return match ? match[1] : null;
}

function listMaterialGroups() {
  return MATERIAL_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    aliases: [...group.aliases],
    isoGroup: group.isoGroup,
  }));
}

function listMaterialGrades(family, query = "", limit = 100) {
  const group = findMaterialGroup(family);
  if (!group) return [];
  return group.grades
    .map((item) => ({ item, score: matchScore(item, query) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label))
    .slice(0, Math.max(1, Math.min(200, Number(limit) || 100)))
    .map(({ item }) => ({
      id: item.id,
      label: item.label,
      aliases: [...item.aliases],
      subfamily: item.subfamily,
    }));
}

function resolveMaterialSelection(input = {}) {
  const familyInput = String(input.family || input.materialFamily || "").trim();
  const gradeInput = String(input.grade || input.materialGrade || "").trim();
  let group = findMaterialGroup(familyInput);
  let item = group ? findGradeInGroup(group, gradeInput) : null;
  const gradeInference = gradeInput ? inferGroupFromGrade(gradeInput) : null;
  let inferred = null;
  if (group && gradeInput && !item && gradeInference
      && gradeInference.group.id !== group.id && gradeInference.score >= 300) {
    return {
      supported: false,
      familyId: group.id,
      familyLabel: group.label,
      materialId: null,
      materialLabel: null,
      seedKey: null,
      confidence: "none",
      familyMismatch: {
        selectedFamilyId: group.id,
        selectedFamilyLabel: group.label,
        detectedFamilyId: gradeInference.group.id,
        detectedFamilyLabel: gradeInference.group.label,
        detectedMaterialId: gradeInference.item.id,
        detectedMaterialLabel: gradeInference.item.label,
      },
      warnings: [
        `"${gradeInput}" belongs to ${gradeInference.group.label}, not ${group.label}. Change the material group or the exact grade before calculating.`,
      ],
    };
  }
  if (!group && gradeInput) {
    inferred = gradeInference;
    group = inferred?.group || null;
    item = inferred?.item || null;
  }
  if (!group) {
    return {
      supported: false,
      familyId: null,
      materialId: null,
      seedKey: null,
      confidence: "none",
      warnings: ["Choose a supported broad material group before running the local method."],
    };
  }
  const matchedItem = item;
  if (!item) item = group.grades[0];

  const hardness = normalizeHardness(input.hardnessValue ?? input.hardness?.value, input.hardnessScale ?? input.hardness?.scale);
  const hardnessSeed = group.id === "steel" ? steelHardnessSeed(hardness) : null;
  const recognizedGrade = Boolean(gradeInput && matchedItem && !matchedItem.id.endsWith(".generic"));
  const generic = item.id.endsWith(".generic") || !recognizedGrade;
  const warnings = [];
  if (!gradeInput) {
    warnings.push(`Only the broad ${group.label.toLowerCase()} group was supplied; using a conservative provisional fallback.`);
  } else if (!recognizedGrade) {
    warnings.push(`"${gradeInput}" is not in the reviewed identity catalog; treating it as generic ${group.label.toLowerCase()}.`);
  }
  if (item.exactSourcePreferred) warnings.push("An exact reviewed material/tool-family source is preferred for this material.");
  if (item.abrasive) warnings.push("This material is abrasive; tool suitability and wear require operator review.");
  if (item.safetyReviewRequired) warnings.push("This material requires a separate workplace safety review before machining.");
  if (hardnessSeed?.warning) warnings.push(hardnessSeed.warning);

  const supported = item.supported && hardnessSeed?.supported !== false;
  const seedKey = supported ? (hardnessSeed?.seedKey || item.seedKey || group.genericSeedKey) : null;
  return {
    supported,
    familyId: group.id,
    familyLabel: group.label,
    materialId: recognizedGrade ? item.id : group.grades[0].id,
    materialLabel: recognizedGrade ? item.label : group.grades[0].label,
    gradeInput: gradeInput || null,
    subfamily: recognizedGrade ? item.subfamily : group.grades[0].subfamily,
    isoGroup: group.isoGroup,
    seedKey,
    hardness,
    temper: group.id === "aluminum" ? extractTemper(gradeInput) : null,
    confidence: generic ? "low" : "provisional",
    upperTrialAllowed: supported && item.upperTrialAllowed && hardnessSeed?.upperTrialAllowed !== false,
    matchedBy: inferred ? "grade" : (recognizedGrade ? "family-and-grade" : "family"),
    sourceIds: [...group.sourceIds],
    warnings,
  };
}

function getMaterialSources() {
  return MATERIAL_SOURCES.map((source) => ({ ...source }));
}

module.exports = {
  MATERIAL_GROUPS,
  MATERIAL_SOURCES,
  findMaterialGroup,
  getMaterialSources,
  listMaterialGrades,
  listMaterialGroups,
  normalizeSearchText,
  resolveMaterialSelection,
};
