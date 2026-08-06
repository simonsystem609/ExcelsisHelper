"use strict";

const assert = require("node:assert/strict");
const {
  MATERIAL_GROUPS,
  getMaterialSources,
  listMaterialGrades,
  listMaterialGroups,
  normalizeSearchText,
  resolveMaterialSelection,
} = require("../machining-engine/materials.cjs");

assert.deepEqual(listMaterialGroups().map((item) => item.id), [
  "steel", "aluminum", "copper_alloy", "plastic",
]);

const broadAluminum = resolveMaterialSelection({ family: "aluminium" });
assert.equal(broadAluminum.supported, true);
assert.equal(broadAluminum.familyId, "aluminum");
assert.equal(broadAluminum.seedKey, "aluminum_wrought_general");
assert.equal(broadAluminum.confidence, "low");
assert.match(broadAluminum.warnings.join(" "), /broad aluminium/i);
assert.equal(resolveMaterialSelection({ family: "aluminum" }).familyId, "aluminum");

const perunal = resolveMaterialSelection({ family: "aluminum", grade: "Perunal" });
assert.equal(perunal.materialId, "aluminum.wrought.7075");
assert.match(perunal.materialLabel, /Perunal 215/);

const broadSteel = resolveMaterialSelection({ family: "steel" });
assert.equal(broadSteel.supported, true);
assert.equal(broadSteel.seedKey, "steel_low_alloy_or_mold_annealed");

const hardSteel = resolveMaterialSelection({
  family: "steel",
  grade: "mystery prehard steel",
  hardnessValue: 50,
  hardnessScale: "HRC",
});
assert.equal(hardSteel.seedKey, "steel_hardened_45_55");
assert.equal(hardSteel.upperTrialAllowed, false);

const tooHard = resolveMaterialSelection({
  family: "steel",
  grade: "D2",
  hardnessValue: 61,
  hardnessScale: "HRC",
});
assert.equal(tooHard.supported, false);
assert.equal(tooHard.seedKey, null);
assert.match(tooHard.warnings.join(" "), /above 60 HRC/i);

const inferredAluminum = resolveMaterialSelection({ grade: "EN AW-6082 T6" });
assert.equal(inferredAluminum.familyId, "aluminum");
assert.equal(inferredAluminum.materialId, "aluminum.wrought.6082");
assert.equal(inferredAluminum.temper, "T6");
assert.equal(inferredAluminum.matchedBy, "grade");

const aluminumTemper = resolveMaterialSelection({ family: "aluminum", grade: "6061-T6" });
assert.equal(aluminumTemper.supported, true);
assert.equal(aluminumTemper.materialId, "aluminum.wrought.6061");
assert.equal(aluminumTemper.temper, "T6");

const mismatchedFamily = resolveMaterialSelection({ family: "steel", grade: "6061-T6" });
assert.equal(mismatchedFamily.supported, false);
assert.equal(mismatchedFamily.familyMismatch.detectedFamilyId, "aluminum");
assert.match(mismatchedFamily.warnings.join(" "), /belongs to Aluminium, not Steel/i);

const reinforcedNylon = resolveMaterialSelection({ family: "plastic", grade: "PA 66 GF 30" });
assert.equal(reinforcedNylon.materialId, "plastic.pa66_gf30");
assert.equal(reinforcedNylon.seedKey, "plastic_reinforced_or_thermoset");
assert.equal(reinforcedNylon.upperTrialAllowed, false);
assert.match(reinforcedNylon.warnings.join(" "), /abrasive/i);

const peekOptions = listMaterialGrades("plastic", "peek");
assert.ok(peekOptions.length >= 3);
assert.ok(peekOptions.every((item) => normalizeSearchText(item.label).includes("peek")));

const d2Options = listMaterialGrades("steel", "1.2379");
assert.equal(d2Options[0].id, "steel.tool.d2");

const requestedSteelNames = [
  ["M200", "steel.mold.p20s", /Bohler M200/],
  ["CrMo4", "steel.alloy.crmo4_family", /CrMo4/],
  ["42CrMo4", "steel.alloy.42crmo4", /42CrMo4/],
  ["M1", "steel.hss.m1", /M1/],
  ["M2", "steel.hss.m2", /M2/],
  ["K200", "steel.bearing.100cr6", /K200/],
  ["K100", "steel.tool.d3", /K100/],
  ["K305", "steel.tool.a2", /K305/],
  ["K460", "steel.tool.o1", /K460/],
  ["M238", "steel.mold.p20ni", /M238/],
  ["M310", "steel.mold.m310", /M310/],
];
for (const [query, expectedId, expectedLabel] of requestedSteelNames) {
  const options = listMaterialGrades("steel", query, 20);
  assert.equal(options[0]?.id, expectedId, `${query} should resolve to ${expectedId}`);
  assert.match(options[0]?.label || "", expectedLabel);
  const resolved = resolveMaterialSelection({ family: "steel", grade: query });
  assert.equal(resolved.materialId, expectedId);
  assert.equal(resolved.supported, true);
}
assert.match(
  resolveMaterialSelection({ family: "steel", grade: "CrMo4" }).warnings.join(" "),
  /exact reviewed material/i,
);

const brass = resolveMaterialSelection({ family: "brass", grade: "C36000" });
assert.equal(brass.familyId, "copper_alloy");
assert.equal(brass.seedKey, "brass_free_cutting");

const unknownGrade = resolveMaterialSelection({ family: "plastic", grade: "Unknownium X42" });
assert.equal(unknownGrade.supported, true);
assert.equal(unknownGrade.materialId, "plastic.generic");
assert.equal(unknownGrade.confidence, "low");
assert.match(unknownGrade.warnings.join(" "), /not in the reviewed identity catalog/i);

const unsupportedFamily = resolveMaterialSelection({ family: "titanium" });
assert.equal(unsupportedFamily.supported, false);
assert.equal(unsupportedFamily.seedKey, null);

const ids = new Set();
for (const group of MATERIAL_GROUPS) {
  for (const item of group.grades) {
    assert.equal(ids.has(item.id), false, `Duplicate material id: ${item.id}`);
    ids.add(item.id);
    assert.ok(item.aliases.length > 0, `${item.id} has no search aliases`);
  }
}

const sources = getMaterialSources();
assert.ok(sources.length >= 9);
assert.ok(sources.every((source) => source.url.startsWith("https://")));
assert.ok(sources.every((source) => source.retrievedAt === "2026-07-16"));

console.log("Machining material taxonomy, search, broad fallback, and hardness tests passed.");
