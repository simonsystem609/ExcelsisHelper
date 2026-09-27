"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
function procedure(source, name) {
  const result = source.match(new RegExp(`^(?:(?:Public|Private) )?(?:Function|Sub) ${name}\\([\\s\\S]*?^End (?:Function|Sub)`, "mi"));
  assert.ok(result, name);
  return result[0];
}

// Execute actual VBA filters and queues against doubles, without SOLIDWORKS
// automation. Only language syntax is adapted for the Windows VB compiler.
function toDotNet(source) {
  return source.replace(/\s+_\r?\n\s*/g, " ")
    .replace(/\bSet\s+(?=[A-Za-z])/g, "")
    .replace(/\bVariant\b/g, "Object")
    .replace(/\bEmpty\b/g, "Nothing")
    .replace(/\b(LCase|Trim|Replace|Mid|Left|Right|Chr|Format)\$/g, "$1")
    .replace(/\b(\d+(?:\.\d+)?)#/g, "$1R")
    .replace(/\bDebug\.Print\b/g, "TraceRun")
    .replace(/\bArray\(((?:[^()\r\n]|\([^()\r\n]*\))*)\)/g, "New Object() {$1}")
    .replace(/\bThen TraceRun (.+)$/gm, "Then TraceRun($1)")
    .replace(/\bThen (\w+\.(?:Add|Remove)) (.+)$/gm, "Then $1($2)")
    .replace(/\bThen (CloseCandidateDocument|ActivateConfigurationChecked) (.+)$/gm, "$1$2($3)")
    .replace(/\bThen Err\.Raise (.+)$/gm, "Then Err.Raise($1)")
    .replace(/^([ \t]*)Err\.Raise (.+)$/gm, "$1Err.Raise($2)")
    .replace(/^([ \t]*)(BeginDxfCandidate|FinishDxfCandidate|RememberOriginalConfiguration|ResolveSelectedPartIfLightweight|RebuildDocumentIfNeeded|ActivateModelDocument|AddSelectedSubassemblyContext|CollectSelectedSubassemblyParts|ExportSelectedSubassembliesInContext|ExportSelectedSubassemblyParts|PreserveCandidateDocument) (.+)$/gm, "$1$2($3)")
    .replace(/^([ \t]*)TraceRun (.+)$/gm, "$1TraceRun($2)")
    .replace(/^([ \t]*)(\w+\.(?:Add|Remove)|CollectEligibleSubassemblyChildren|MergeDxfOccurrences|AddDxfOccurrence) (.+)$/gm, "$1$2($3)")
    .replace(/^([ \t]*)(\w+\.ForceRebuild3) (.+)$/gm, "$1$2($3)")
    .replace(/\bSqr\(/g, "Math.Sqrt(")
    .replace(/\b(Abs|Round)\(/g, "Math.$1(")
    .replace(/^(Function|Sub) ([\s\S]*?)(?=\)\s*(?:As \w+)?\s*\r?\n)/gm, (declaration) =>
      declaration.replace(/([,(]\s*(?:_\s*)?)(?!ByVal\b|ByRef\b)(\w+(?:\(\))? As \w+)/g, "$1ByRef $2"));
}

const functions = [
  "FindLargestPlanarFace", "FindLargestPlanarFaceInBodies", "IsPlanarFace", "TryGetPlaneNormalAndPoint", "SignedPlaneDistance",
  "GetThicknessViaBodyExtents", "GetBodiesThicknessViaExtents", "GetThinSolidThickness", "IsThinPlateLike", "HasSheetLikePlanarFaces",
  "GetBodyAxisSpan", "GetFaceFootprintAxis", "GetBodiesPlateDimensions", "GetPartFilterDimensions",
  "BodiesContainOutOfSlabSolid", "BodyThicknessSlabStatus", "ComponentContainsOutOfSlabSolid",
  "FormatThickness",
  "ComponentBodiesMayBeSheetLike", "ReferencedComponentBodiesMayBeSheetLike", "BodiesMayBeSheetLike",
  "DxfOwnerIdentity", "DxfCandidateScopeKey", "NormalizeVisiblePartScopes", "DxfPartNameKey", "DxfIdentityTag", "CleanFileName",
  "IsWasherLikeThinSolid", "CountPartSolidBodies", "GetExportPieceCount", "IsToolboxPartSafe",
  "IsImportedPartPath", "IsImportedGeometryPart", "ShouldRejectImportedCandidate",
  "IsImportedAssemblyComponent", "ComponentImportHint", "FeatureSuppressionState", "FeatureTreeHasImport", "SetFeatureSuppressionChecked",
  "IsSheetMetal", "IsSheetMetalSafe", "PartHasSheetMetalBody", "GetSheetMetalThickness",
  "IsComponentHiddenSafe", "ComponentHasExcludedAssemblyAncestor", "GetComponentSuppressionStateSafe",
  "IsComponentActuallySuppressedSafe", "IsComponentLightweightSafe", "IsPartPath", "IsAssemblyPath",
  "DxfOccurrenceKey", "AddDxfOccurrence", "MergeDxfOccurrences", "BuildSelectedQtyDict", "CollectEligibleSubassemblyChildren",
  "BuildVisibleSubassemblyPartCandidates",
  "SnapshotAssemblyPartInstances", "ClaimDxfOutput",
  "ActivateConfigurationChecked", "RememberOriginalConfiguration", "ProcessAssemblyCandidateSnapshot", "ExportAssemblyCandidate",
  "SnapshotSelectedComponents", "ProcessSelectedComponents", "CollectSelectedSubassemblyParts", "AddSelectedSubassemblyContext",
];
let previousPredicates;
for (const filename of ["DXF_v16.swb", "DXF_v16_ROfriendy.swb"]) {
  const source = fs.readFileSync(path.join(root, "macros", filename), "utf8");
  const predicates = functions.map((name) => procedure(source, name));
  const normalized = predicates.join("\n").replace(/'.*$/gm, "").replace(/\s+/g, "").toLowerCase();
  if (previousPredicates) assert.equal(normalized, previousPredicates, "Regular and RO must share filter semantics.");
  previousPredicates = normalized;

  for (const name of ["ExportOnePart", "ExportOnePartInAssemblyContext"]) {
    const body = procedure(source, name);
    assert.match(body, /IsToolboxPartSafe\(swPart\)/);
    assert.match(body, /ShouldRejectImportedCandidate\(swPart, candidateIsWasherLike\)/);
    assert.ok(body.indexOf("IsToolboxPartSafe") < body.indexOf("ShouldRejectImportedCandidate"));
    assert.match(body, /GetExportPieceCount\(swPart, qty\)/);
  }
  const regular = procedure(source, "ExportOnePart");
  assert.match(regular, /If Not isSM Then\s+If BodiesContainOutOfSlabSolid\(GetPartBodies\(swPart\)\)/);
  assert.ok(regular.indexOf("BodiesContainOutOfSlabSolid") < regular.indexOf("Dim isThin"), "face/precut exceptions cannot bypass the slab check");
  assert.match(regular, /Not exportSelectedFace And Not isSM And Not isThin/);
  assert.match(regular, /ExportNormalViewToDxf\(swPart, selectedFace, outPath\)/);
  const context = procedure(source, "ExportOnePartInAssemblyContext");
  assert.ok(context.indexOf("If isSM Then") < context.indexOf("ComponentContainsOutOfSlabSolid"));
  assert.ok(context.indexOf("ComponentContainsOutOfSlabSolid") < context.indexOf("If selectedPlanarFaceOverride Then"));
  assert.match(context, /If isSM Then[\s\S]*ExportOnePart\([\s\S]*GoTo RestorePartConfiguration/);
  assert.match(context, /If selectedPlanarFaceOverride Then[\s\S]*ElseIf Not IsThinPlateLike/);
  assert.match(procedure(source, "ExportAssemblyComponentViaTemporaryPart"), /CreateFeatureFromBody3/);
  assert.match(procedure(source, "ExportCurrentViewToDxf"), /RestoreCurrentViewDisplayState:/);
  assert.match(procedure(source, "AskDxfRunOptions"), /g_generalImportedFilter = False/);
  assert.match(procedure(source, "AskDxfRunOptions"), /If Not AskImportedFilter\(\) Then Exit Function/);
  assert.match(procedure(source, "AskMaterial"), /ConfiguredDefaultMaterial\(\)/);
  assert.doesNotMatch(procedure(source, "AskMaterial"), /\.Popup\b/);
  assert.match(procedure(source, "BuildSelectedQtyDict"), /ComponentHasExcludedAssemblyAncestor\(swComp, False, False\)/);
  assert.doesNotMatch(source, /Function BuildQtyDict|Function BuildAssemblyContextQtyDict/);
  assert.doesNotMatch(procedure(source, "BuildVisibleSubassemblyPartCandidates"), /GetComponents|assemblyPath|ReferencedConfiguration/);
  assert.match(procedure(source, "ExportAssemblyCandidate"), /ComponentHasExcludedAssemblyAncestor\(swComp, False, False\)/);
  for (const route of ["ProcessSelectedComponents", "ExportAssemblyCandidate"]) {
    assert.match(procedure(source, route), /IsComponentHiddenSafe\(swComp\)/, route);
    assert.match(procedure(source, route), /ComponentHasExcludedAssemblyAncestor\(swComp,/, route);
  }
  assert.match(procedure(source, "ProcessSelectedSubassemblyContext"), /ProcessAssemblyCandidateSnapshot swAssembly, dxfFolder, True, allowedScopes/);
  assert.match(procedure(source, "CollectSelectedSubassemblyParts"), /NormalizeVisiblePartScopes\(visibleParts, selectedQty\)/);
  assert.match(procedure(source, "ProcessAssemblyCandidateSnapshot"), /If Not allowedParts.Exists\(key\) Then/);
  assert.match(procedure(source, "ProcessSelectedComponents"), /Dim exported As Boolean\s+exported = False/);
  assert.doesNotMatch(source, /SetSuppression2\s+[02],\s*2,/);
  assert.match(procedure(source, "SetFeatureSuppressionChecked"), /SetSuppression2\(action, swThisConfiguration, Empty\)/);
  assert.match(procedure(source, "ActivateConfigurationChecked"), /If cfg = "" Then[\s\S]*?Exit Function/);
  assert.match(procedure(source, "ExcelsisMacroMain"), /RestoreOriginalConfigurations[\s\S]*CloseExplicitlyOpenedPartDocs/);
  assert.match(procedure(source, "InitializeRunDiagnostics"), /g_archiveTracePath = stem/);
  const selectedRoute = procedure(source, "ProcessSelectedComponents");
  assert.doesNotMatch(selectedRoute, /selMgr|GetSelectedObject|BuildVisibleSubassemblyPartCandidates/);
  const main = procedure(source, "ExcelsisMacroMain");
  assert.ok(main.indexOf("SnapshotSelectedComponents") < main.indexOf("AskMaterial"), "capture selection before any prompts or exports");
  assert.match(main, /If selectedCandidates Is Nothing Then\s+Err\.Raise/);

  if (process.platform !== "win32") continue;
  const compiler = path.join(process.env.WINDIR || "C:\\Windows", "Microsoft.NET", "Framework64", "v4.0.30319", "vbc.exe");
  assert.ok(fs.existsSync(compiler), "Windows VB compiler is required for offline macro behavior tests.");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "excelsis-dxf-filter-tests-"));
  const input = path.join(dir, "predicates.vb");
  const output = path.join(dir, "predicates.exe");
  const constants = source.split(/\r?\n/).filter((line) => /^Const (?:swComponent|swNormalBody_e|THICKNESS_LIMIT|THIN_PLATE_MIN_RATIO|MIN_PLANAR_AREA_RATIO|MIN_LARGEST_PLANAR_FOOTPRINT_RATIO|WASHERLIKE_)/.test(line));
  fs.writeFileSync(input, `Option Strict Off
Imports System
Imports Microsoft.VisualBasic
Module FilterTests
${toDotNet(constants.join("\n"))}
Dim g_generalImportedFilter As Boolean
Dim g_traceComponent As String = "test"
Dim g_importComponent As Object
Dim g_importUnknown As Boolean
Dim g_importHint As String = ""
Dim g_outputOwners As Object
Dim g_originalConfigurations As Object
Dim g_stopBatchReason As String = ""
Dim g_assemblyFolders As Boolean, g_forceIdentityTags As Boolean
Dim g_partNameOwners As Object, g_candidateResults As Object
Dim g_candidateKey As String = "", g_runRootPath As String = "C:\\fixture\\root.SLDASM", g_runRootConfiguration As String = "Default"
Dim sharedPart As TestPart
Dim exportedConfigs As New Collections.Generic.List(Of String)
Dim openedConfigs As New Collections.Generic.List(Of String)
Dim candidateEndStates As New Collections.Generic.List(Of Boolean)
Dim fallbackCalls As Integer
Dim liveSelection As TestSelection
Dim scopeToChange As TestComponent
Public selectionReads As Integer
Dim receivedFace As Object
Dim selectedSubassemblyParts As Object
Dim selectedSubassemblyContexts As Object
Dim traces As New Collections.Generic.List(Of String)
Const swSolidBody As Integer = 0
Const swThisConfiguration As Integer = 1
Const swSuppressFeature As Integer = 0
Const swUnSuppressFeature As Integer = 2
Const MODE_REGULAR As Integer = 1
Const MODE_PRECUT As Integer = 2
Const ASSEMBLY_EXPORT_CONTEXT As Integer = 2
Sub TraceRun(message As String)
  traces.Add(message)
End Sub
Function TraceFileLabel(value As String) As String
  Return IO.Path.GetFileName(value)
End Function
Function CandidatePreflightAllows(comp As Object, file As String, cfg As String, context As Boolean, mode As Integer, face As Boolean) As Boolean
  Return True
End Function
Function CandidateExportFolder(folder As String, model As Object, comp As Object) As String
  Return folder
End Function
Sub ExportSelectedSubassembliesInContext(entries As Object, folder As String, done As Object, opened As Object)
  selectedSubassemblyContexts = entries
End Sub
Sub ExportSelectedSubassemblyParts(model As Object, entries As Object, folder As String, mode As Integer, done As Object, opened As Object)
  selectedSubassemblyParts = entries
End Sub
Function DiagnosticLineValue(value As String) As String
  Return value
End Function
Function IsEmpty(value As Object) As Boolean
  Return value Is Nothing
End Function
Function IsArray(value As Object) As Boolean
  Return TypeOf value Is Array
End Function
Function GetPartBodies(part As Object) As Object
  Return part.Bodies
End Function
Function GetActiveConfigName(part As Object) As String
  Return part.ActiveConfiguration
End Function
Function GetDocumentActivationName(part As Object) As String
  Return part.FilePath
End Function
Function ActivateModelDocument(model As Object) As Boolean
  Return True
End Function
Sub BeginDxfCandidate(file As String, cfg As String, route As String)
  openedConfigs.Add(cfg)
End Sub
Sub FinishDxfCandidate(exported As Boolean)
  candidateEndStates.Add(exported)
End Sub
Sub RebuildDocumentIfNeeded(model As Object)
End Sub
Sub ResolveSelectedPartIfLightweight(comp As Object)
End Sub
Function CloseCandidateDocument(file As String, part As Object, opened As Object) As Boolean
  Return True
End Function
Sub PreserveCandidateDocument(model As Object, reason As String)
End Sub
Function DxfStopRequested() As Boolean
  Return False
End Function
Sub DoEvents()
End Sub
Function OpenPartForExport(file As String, opened As Object, Optional activate As Boolean = True) As Object
  If liveSelection IsNot Nothing Then liveSelection.Items = New Object() {}
  If scopeToChange IsNot Nothing Then scopeToChange.Children = New Object() {}
  Return sharedPart
End Function
Function ExportOnePart(part As Object, file As String, cfg As String, qty As Long, folder As String, mode As Integer, face As Object) As Boolean
  Check(part.ActiveConfiguration = cfg, "export must use exact requested configuration")
  exportedConfigs.Add(cfg & ":" & CStr(qty))
  If cfg = "RAISE" Then Throw New Exception("simulated export failure")
  Return True
End Function
Function ExportOnePartInAssemblyContext(asm As Object, comp As Object, part As Object, file As String, cfg As String, qty As Long, folder As String, face As Object) As Boolean
  receivedFace = face
  If Not ActivateConfigurationChecked(part, cfg) Then Return False
  Return ExportOnePart(part, file, cfg, qty, folder, MODE_REGULAR, face)
End Function
Function GetSortedBoxDimsMM(part As Object, ByRef a As Double, ByRef b As Double, ByRef c As Double) As Boolean
  a = part.Dims(0) : b = part.Dims(1) : c = part.Dims(2)
  Return True
End Function
Function GetThicknessAlongLargestPlaneNormal(part As Object) As Double
  fallbackCalls += 1
  Return part.Fallback
End Function
Function GetBoundingThickness(part As Object) As Double
  Return part.Dims(0)
End Function
${predicates.map(toDotNet).join("\n")}
Sub Check(value As Boolean, label As String)
  If Not value Then Throw New Exception(label)
End Sub
Function MakePart(t As Double, w As Double, length As Double) As TestPart
  Dim part As New TestPart
  part.Dims = New Double() {t, w, length}
  part.Bodies = New Object() {New TestBody(t) With {.Width = w / 1000, .Length = length / 1000}}
  Return part
End Function
Function SlabFace(area As Double, nz As Double, z As Double) As TestFace
  Dim face As New TestFace(area, True)
  face.Surface.PlaneParams = New Double() {0, 0, nz, 0, 0, z}
  Return face
End Function
Sub AssertSelectedSet(asm As TestAssembly, items As Object(), expected As TestComponent(), label As String)
  Dim frozen = SnapshotSelectedComponents(asm, New TestSelection With {.Items = items}, items.Length)
  Check(frozen IsNot Nothing, label & " captures complete selection")
  Dim actual = BuildSelectedQtyDict(frozen), wanted As Object = CreateObject("Scripting.Dictionary")
  For Each comp In expected
    Dim key = DxfCandidateScopeKey(comp.FilePath, comp.ReferencedConfiguration, comp, Nothing)
    If wanted.Exists(key) Then wanted(key) = CLng(wanted(key)) + 1 Else wanted.Add(key, 1)
  Next
  Check(actual.Count = wanted.Count, label & " exact output scopes")
  For Each key As String In wanted.Keys
    Check(actual.Exists(key) AndAlso CLng(actual(key)) = CLng(wanted(key)), label & " exact occurrence quantity: " & key)
  Next
End Sub
Sub RunQuantityRegressions()
  Dim asm As New TestAssembly With {.FailComponents = True}
  Dim one As New TestComponent With {.FilePath = "C:\\Parts\\unit.SLDASM", .Name2 = "unit-1"}
  Dim two As New TestComponent With {.FilePath = one.FilePath, .Name2 = "unit-2"}
  Dim nestedOne As New TestComponent With {.FilePath = "C:\\Parts\\nested.SLDASM", .Name2 = "unit-1/nested-1", .Parent = one}
  Dim nestedTwo As New TestComponent With {.FilePath = nestedOne.FilePath, .Name2 = "unit-2/nested-1", .Parent = two}
  Dim a1 As New TestComponent With {.Name2 = "unit-1/plate-1", .ReferencedConfiguration = "A", .Parent = one}
  Dim a2 As New TestComponent With {.Name2 = "unit-1/plate-2", .ReferencedConfiguration = "A", .Parent = one}
  Dim b1 As New TestComponent With {.Name2 = "unit-1/plate-3", .ReferencedConfiguration = "B", .Parent = one}
  Dim n1 As New TestComponent With {.Name2 = "unit-1/nested-1/plate-1", .ReferencedConfiguration = "A", .Parent = nestedOne}
  Dim a3 As New TestComponent With {.Name2 = "unit-2/plate-1", .ReferencedConfiguration = "A", .Parent = two}
  Dim a4 As New TestComponent With {.Name2 = "unit-2/plate-2", .ReferencedConfiguration = "A", .Parent = two}
  Dim b2 As New TestComponent With {.Name2 = "unit-2/plate-3", .ReferencedConfiguration = "B", .Parent = two}
  Dim n2 As New TestComponent With {.Name2 = "unit-2/nested-1/plate-1", .ReferencedConfiguration = "A", .Parent = nestedTwo}
  Dim direct As New TestComponent With {.Name2 = "plate-1", .ReferencedConfiguration = "A"}
  Dim hidden As New TestComponent With {.Parent = one, .VisibleValue = 0}
  Dim suppressed As New TestComponent With {.Parent = one, .Suppression = 0}
  Dim face As New TestFace(1, True) With {.Owner = a1}
  Dim secondFace As New TestFace(2, True) With {.Owner = a1}
  nestedOne.Children = New Object() {n1} : nestedTwo.Children = New Object() {n2}
  one.Children = New Object() {a1, a2, b1, nestedOne, hidden, suppressed}
  two.Children = New Object() {a3, a4, b2, nestedTwo}
  asm.Components = New Object() {one, two, a1, a2, b1, n1, a3, a4, b2, n2, direct}
  For Each grouped As Boolean In New Boolean() {False, True}
    g_assemblyFolders = grouped
    AssertSelectedSet(asm, New Object() {one}, New TestComponent() {a1, a2, b1, n1}, "one of repeated subassemblies")
    AssertSelectedSet(asm, New Object() {one, two}, New TestComponent() {a1, a2, b1, n1, a3, a4, b2, n2}, "two selected occurrences add up")
    AssertSelectedSet(asm, New Object() {one, one, a1, face, nestedOne, n1}, New TestComponent() {a1, a2, b1, n1}, "overlapping parent child and face selection counts once")
    AssertSelectedSet(asm, New Object() {nestedOne, n1, face, one}, New TestComponent() {a1, a2, b1, n1}, "overlap order independent")
    AssertSelectedSet(asm, New Object() {face, secondFace, a1}, New TestComponent() {a1}, "multiple faces from one occurrence count once")
    AssertSelectedSet(asm, New Object() {a1, a3}, New TestComponent() {a1, a3}, "direct parts from repeated parents")
    AssertSelectedSet(asm, New Object() {one, direct}, New TestComponent() {a1, a2, b1, n1, direct}, "mixed selected root part and subassembly")
    AssertSelectedSet(asm, New Object() {direct}, New TestComponent() {direct}, "single selected part excludes unselected copies")
    two.VisibleValue = 0
    AssertSelectedSet(asm, New Object() {one, two, a3}, New TestComponent() {a1, a2, b1, n1}, "hidden parent excludes selected descendants")
    two.VisibleValue = 1
    a2.Suppression = 1
    AssertSelectedSet(asm, New Object() {one}, New TestComponent() {a1, a2, b1, n1}, "lightweight child still counted")
    a2.Suppression = 3
  Next
  g_assemblyFolders = False
  one.FailChildren = True
  Check(SnapshotSelectedComponents(asm, New TestSelection With {.Items = New Object() {direct, one}}, 2) Is Nothing, "failed child read rejects whole selection before export")
  one.FailChildren = False
  n1.ReferencedConfiguration = ""
  Check(SnapshotSelectedComponents(asm, New TestSelection With {.Items = New Object() {one}}, 1) Is Nothing, "unknown nested configuration cannot undercount silently")
  n1.ReferencedConfiguration = "A"
  one.Name2 = ""
  Check(SnapshotSelectedComponents(asm, New TestSelection With {.Items = New Object() {one}}, 1) Is Nothing, "unknown occurrence identity cannot widen selection")
  one.Name2 = "unit-1"
  Dim frozen = SnapshotSelectedComponents(asm, New TestSelection With {.Items = New Object() {one, direct}}, 2)
  a2.VisibleValue = 0
  Dim totals = BuildSelectedQtyDict(frozen)
  Check(CLng(totals("c:\\parts\\native.sldprt@A")) = 3, "hidden after capture excluded before totals freeze")
  a2.VisibleValue = 1
  Dim plate = MakePart(3, 100, 200)
  plate.Bodies = New Object() {New TestBody(3), New TestBody(3)}
  totals = BuildSelectedQtyDict(frozen)
  Check(GetExportPieceCount(plate, CLng(totals("c:\\parts\\native.sldprt@A"))) = 8, "body multiplier applied once to selected occurrence total")
End Sub
Sub Main()
  Check(FormatThickness(0.3) = "0.3" And FormatThickness(0.75) = "0.75", "fractional sheet thickness must not become LV0 or LV1")
  Check(FormatThickness(12.4) = "12" And FormatThickness(12.5) = "13" And FormatThickness(0) = "0", "existing whole-mm half-up naming preserved")
  Dim slab As New TestBody(3), slabThickness As Double, protrusion As Double
  Check(BodyThicknessSlabStatus(slab, slabThickness, protrusion) = 1 And Math.Abs(slabThickness - 3) < 0.00001, "flat plate is inside true face-pair thickness")
  slab.HighOverhang = 10
  Check(BodiesContainOutOfSlabSolid(New Object() {slab}), "bent flange outside upper thickness plane rejected")
  slab.HighOverhang = 0 : slab.LowOverhang = 10
  Check(BodiesContainOutOfSlabSolid(New Object() {slab}), "bent flange outside lower thickness plane rejected")
  slab.Normal = New Double() {Math.Sqrt(0.5), 0, Math.Sqrt(0.5)}
  Check(BodiesContainOutOfSlabSolid(New Object() {slab}), "rotated bent body rejected without world-box assumptions")
  slab.LowOverhang = 0 : slab.Offset = 1.234
  Check(Not BodiesContainOutOfSlabSolid(New Object() {slab}), "rotated translated flat body accepted")
  slab.HighOverhang = 0.015
  Check(Not BodiesContainOutOfSlabSolid(New Object() {slab}), "small geometric tolerance allowed")
  slab.HighOverhang = 0.05
  Check(BodiesContainOutOfSlabSolid(New Object() {slab}), "measurable out-of-band geometry rejected")
  slab.IsSheetMetal = True
  Check(Not BodiesContainOutOfSlabSolid(New Object() {slab}), "true sheetmetal keeps flatten route")
  slab.IsSheetMetal = False : slab.FailExtents = True
  Check(Not BodiesContainOutOfSlabSolid(New Object() {slab}), "unreadable extents cannot invent a bent classification")
  slab = New TestBody(3) With {.ExplicitPlanes = True}
  slab.Faces = New Object() {SlabFace(0.02, 1, 0.003), SlabFace(0.011, -1, 0), SlabFace(0.009, -1, 0), SlabFace(0.0001, 1, 0.002), New TestFace(0.001, False)}
  Check(Not BodiesContainOutOfSlabSolid(New Object() {slab}), "split opposing faces, pocket floor, holes and radii within thickness accepted")
  Dim offsetSlab As New TestBody(3) With {.Offset = 0.1}
  Check(Not BodiesContainOutOfSlabSolid(New Object() {slab, offsetSlab}), "disjoint flat bodies evaluated separately, not across empty space")
  offsetSlab.HighOverhang = 5
  Check(BodiesContainOutOfSlabSolid(New Object() {slab, offsetSlab}), "one bent body rejects a mixed non-sheetmetal part")
  Dim shown As New TestComponent
  Dim hidden As New TestComponent With {.VisibleValue = 0}
  Dim parent As New TestComponent With {.VisibleValue = 0, .FilePath = "C:\\Parts\\sub.SLDASM"}
  Dim nested As New TestComponent With {.Parent = parent}
  parent.Children = New Object() {nested}
  Dim unknown As New TestComponent With {.VisibleValue = -1}
  Dim failed As New TestComponent With {.FailVisible = True}
  Check(Not IsComponentHiddenSafe(shown), "visible enum is 1")
  Check(IsComponentHiddenSafe(hidden), "hidden enum is 0, not 2")
  Check(IsComponentHiddenSafe(unknown), "unknown visibility fails closed")
  Check(IsComponentHiddenSafe(failed), "visibility API failure fails closed")
  Check(ComponentHasExcludedAssemblyAncestor(nested, False, False), "hidden parent exclusion")
  Dim parentFailure As New TestComponent With {.FailParent = True}
  Check(ComponentHasExcludedAssemblyAncestor(parentFailure, False, False), "unknown parent visibility fails closed")
  Dim cycle As New TestComponent
  cycle.Parent = cycle
  Check(ComponentHasExcludedAssemblyAncestor(cycle, False, False), "bounded ancestor cycle fails closed")
  Dim asm As New TestAssembly With {.Components = New Object() {shown, hidden, parent, nested}}
  Dim counts As Object = BuildSelectedQtyDict(SnapshotSelectedComponents(asm, New TestSelection With {.Items = asm.Components}, 4))
  Check(CInt(counts("c:\\parts\\native.sldprt@Default")) = 1, "hidden occurrences and hidden ancestors excluded from selected quantities")
  Dim scoped As Object = BuildVisibleSubassemblyPartCandidates(parent)
  Check(scoped.Count = 0, "hidden subassembly has no allowed exports")
  parent.VisibleValue = 1
  scoped = BuildVisibleSubassemblyPartCandidates(parent)
  Check(scoped.Count = 1, "visible nested part retained")
  nested.VisibleValue = 0
  scoped = BuildVisibleSubassemblyPartCandidates(parent)
  Check(scoped.Count = 0, "snapshot excludes hidden child even if reopening later shows it")
  Dim childBranch As New TestComponent With {.VisibleValue = 0, .FilePath = "C:\\Parts\\nested.SLDASM", .Parent = parent}
  childBranch.Children = New Object() {shown}
  parent.Children = New Object() {childBranch}
  scoped = BuildVisibleSubassemblyPartCandidates(parent)
  Check(scoped.Count = 0, "hidden nested subtree is never traversed")
  Dim plate = MakePart(3, 100, 200)
  Check(IsThinPlateLike(plate), "ordinary plate")
  Check(Math.Abs(GetThinSolidThickness(plate) - 3) < 0.00001, "exact thickness")
  Check(fallbackCalls = 0, "exact measurement avoids slower fallbacks")
  Dim rotated = MakePart(90, 150, 200)
  Dim tilted As New TestBody(3)
  tilted.Normal = New Double() {0.6, 0, 0.8}
  rotated.Bodies = New Object() {tilted}
  Check(Math.Abs(GetThinSolidThickness(rotated) - 3) < 0.00001, "rotation independent thickness")
  Check(IsThinPlateLike(rotated), "rotated plate eligibility")
  tilted.Box = New Double() {0, 0, 0, 0.09, 0.15, 0.2}
  Check(ComponentBodiesMayBeSheetLike(rotated), "rotated plate passes early assembly filter")
  Dim reference As New TestComponent With {.Bodies = rotated.Bodies, .BodyInfo = New Object() {1}}
  Check(ReferencedComponentBodiesMayBeSheetLike(reference, reference.FilePath, "Default"), "reference preflight keeps rotated thin plate with large world extents")
  For Each thickness As Double In New Double() {20.1, 20.1001, 80, 100}
    Dim profile = MakePart(thickness, 200, 850)
    reference.Bodies = profile.Bodies
    Check(ReferencedComponentBodiesMayBeSheetLike(reference, reference.FilePath, "Default") = (thickness <= 20.1), "reference preflight reuses exact thickness boundary")
  Next
  reference.Bodies(0).IsSheetMetal = True
  Check(ReferencedComponentBodiesMayBeSheetLike(reference, reference.FilePath, "Default"), "native bent sheet metal survives large extents")
  reference.Bodies(0).IsSheetMetal = False : reference.BodyInfo = New Object() {0}
  Check(ReferencedComponentBodiesMayBeSheetLike(reference, reference.FilePath, "Default"), "assembly user body cannot reject regular source part")
  Dim screw = MakePart(16, 16, 30)
  screw.Bodies = New Object() {New TestBody(30)}
  Check(GetThinSolidThickness(screw) = 30, "circular edges require no vertices")
  Check(Not IsThinPlateLike(screw), "thick screw rejected")
  screw.Extension.ToolboxPartType = 1
  Check(IsToolboxPartSafe(screw), "native Toolbox screw")
  Check(Not IsImportedGeometryPart(screw), "Toolbox is not imported")
  Check(Not IsThinPlateLike(MakePart(20.1001, 100, 200)), "thickness upper bound")
  Check(IsThinPlateLike(MakePart(20.1, 100, 200)), "inclusive thickness bound")
  Check(Not IsThinPlateLike(MakePart(3, 5.99, 200)), "dimension ratio lower bound")
  Check(IsThinPlateLike(MakePart(3, 6, 200)), "inclusive dimension ratio")
  Dim body As TestBody = plate.Bodies(0)
  body.Faces = New Object() {New TestFace(0.0125, True), New TestFace(0.0125, True), New TestFace(0.075, False)}
  Check(HasSheetLikePlanarFaces(plate, 100, 200), "25 percent planar inclusive")
  body.Faces(2).Area = 0.0751
  Check(Not HasSheetLikePlanarFaces(plate, 100, 200), "under 25 percent planar rejected")
  body.Faces = New Object() {New TestFace(0.0029, True), New TestFace(0.0029, True)}
  Check(Not HasSheetLikePlanarFaces(plate, 100, 200), "single body footprint limit")
  Dim second As New TestBody(3)
  second.Faces = body.Faces
  plate.Bodies = New Object() {body, second}
  Check(HasSheetLikePlanarFaces(plate, 100, 200), "disjoint bodies skip combined footprint")
  Check(GetExportPieceCount(plate, 4) = 8, "two bodies times four occurrences")
  Check(GetExportPieceCount(plate, 0) = 2, "quantity lower bound")
  second.Offset = 0.01
  Check(Math.Abs(GetThinSolidThickness(plate) - 13) < 0.00001, "all body extents included")
  second.FailExtents = True : plate.Fallback = 17
  Check(GetThinSolidThickness(plate) = 17, "no partial extents after body API failure")
  Dim washer = MakePart(3, 20, 20)
  Check(IsWasherLikeThinSolid(washer), "compact washer")
  washer.Dims = New Double() {18, 26, 28}
  Dim rotatedWasher As TestBody = washer.Bodies(0)
  rotatedWasher.Normal = New Double() {0.6, 0, 0.8}
  Check(IsWasherLikeThinSolid(washer), "rotated washer uses physical dimensions instead of world box")
  Check(IsWasherLikeThinSolid(MakePart(4, 60, 60)), "DIN 9021 M20 inclusive 60 mm")
  Check(Not IsWasherLikeThinSolid(MakePart(4, 60.01, 60.01)), "over 60 mm remains outside compact hardware scope")
  Check(IsWasherLikeThinSolid(MakePart(2, 24, 24)), "DIN 9021 M8 ratio 12 included")
  Check(IsWasherLikeThinSolid(MakePart(3, 50, 50)), "DIN 9021 M16 ratio 16.67 included")
  Check(IsWasherLikeThinSolid(MakePart(2.5, 50, 50)), "thin-tolerance washer ratio 20 included")
  Check(Not IsWasherLikeThinSolid(MakePart(2.49, 50, 50)), "ratio over 20 still outside heuristic")
  Check(Not IsWasherLikeThinSolid(MakePart(13, 60, 72.735)), "compact tail plate stays out")
  For Each dims In New Double()() {New Double() {5.2, 10, 11.547}, New Double() {6.8, 13, 15.011}, New Double() {10.8, 18, 20.785}}
    Check(IsWasherLikeThinSolid(MakePart(dims(0), dims(1), dims(2))), "ISO 4032 metric nut dimensions")
  Next
  Check(Not IsWasherLikeThinSolid(MakePart(3, 13.9, 20)), "washer aspect lower bound")
  Check(IsWasherLikeThinSolid(MakePart(3, 14, 20)), "washer aspect inclusive")
  Dim imported = MakePart(3, 100, 200)
  imported.Feature = New TestFeature("Imported", "Importalt1")
  Check(IsImportedGeometryPart(imported), "language independent imported feature type")
  g_generalImportedFilter = False
  Check(Not ShouldRejectImportedCandidate(imported, False), "default imports allowed for plates")
  Check(ShouldRejectImportedCandidate(imported, True), "default imported washers rejected")
  Check(Not ShouldRejectImportedCandidate(washer, True), "native washers retained")
  g_generalImportedFilter = True
  Check(ShouldRejectImportedCandidate(imported, False), "general imported exclusion")
  Check(Not ShouldRejectImportedCandidate(screw, True), "general import filter does not label Toolbox as imported")
  imported.Feature = New TestFeature("BaseBody", "Imported1")
  Check(IsImportedGeometryPart(imported), "imported feature name fallback")
  imported.Feature = Nothing : imported.FilePath = "C:\\Parts\\fixture.step.SLDPRT"
  Check(IsImportedGeometryPart(imported), "imported path fallback")
  imported.FilePath = "C:\\Parts\\native.SLDPRT"
  imported.Feature = New TestFeature("Folder", "Bodies") With {.Child = New TestFeature("Imported", "Body1")}
  Check(IsImportedGeometryPart(imported), "nested imported body")
  imported.Feature.Child.IsSuppressed = True
  Check(Not ShouldRejectImportedCandidate(imported, True), "suppressed import in another configuration does not poison native configuration")
  imported.Feature.Child.IsSuppressed = False : imported.Feature.Child.Kind = "ForeignBody"
  imported.Feature.Child.Is3DInterconnectFeature = True
  Check(ShouldRejectImportedCandidate(imported, False), "3D Interconnect feature")
  imported.Feature.Child.Is3DInterconnectFeature = False
  g_importComponent = New TestComponent With {.ImportedPath = "fixture.step"}
  Check(ShouldRejectImportedCandidate(imported, False), "component provenance used when part feature tree is native")
  g_importComponent.FilePath = "C:\\Parts\\different.SLDPRT"
  Check(Not ShouldRejectImportedCandidate(imported, False), "stale different component never affects candidate")
  g_importComponent = Nothing
  g_importHint = "piston.step"
  Check(ShouldRejectImportedCandidate(imported, False), "selected subassembly snapshot preserves component-only provenance")
  g_importHint = ""
  imported.Feature.FailNext = True
  Check(ShouldRejectImportedCandidate(imported, False), "incomplete required import inspection does not silently pass")
  imported.Feature.FailNext = False : imported.Feature.NextFeature = imported.Feature
  Check(ShouldRejectImportedCandidate(imported, False), "cyclic feature tree is bounded and reported incomplete")
  imported.Feature.NextFeature = Nothing
  Dim flat As New TestFeature("FlatPattern", "Flat-Pattern1") With {.IsSuppressed = True}
  Check(SetFeatureSuppressionChecked(flat, False), "unsuppress current configuration only")
  Check(flat.LastConfigOption = 1 And flat.OtherConfigurationSuppressed, "other configuration untouched")
  Check(SetFeatureSuppressionChecked(flat, True), "restore current suppression")
  Dim metal = MakePart(3, 100, 200)
  metal.Feature = New TestFeature("SheetMetal", "Sheet-Metal1") With {.IsSuppressed = True}
  Check(Not IsSheetMetalSafe(metal), "suppressed sheetmetal feature does not misclassify current solid")
  metal.Feature.IsSuppressed = False
  Check(IsSheetMetalSafe(metal), "active sheetmetal feature recognized")
  Dim a As New TestComponent With {.ReferencedConfiguration = "A"}
  Dim b As New TestComponent With {.ReferencedConfiguration = "B"}
  asm.Components = New Object() {a, b, hidden, nested}
  Dim snapshot = SnapshotAssemblyPartInstances(asm)
  Check(snapshot.Count = 2, "both visible configurations snapshotted; hidden excluded")
  a.ReferencedConfiguration = "CHANGED"
  Dim captured As Object = snapshot(1)
  Check(CStr(captured(1)) = "A", "queue configuration immutable across document switches")
  Dim firstPath = ClaimDxfOutput("C:\\dxf\\part(A_B).dxf", "C:\\Parts\\native.SLDPRT", "A/B")
  Dim nextPath = ClaimDxfOutput("C:\\dxf\\part(A_B).dxf", "C:\\Parts\\native.SLDPRT", "A:B")
  Check(firstPath <> nextPath, "sanitized configuration collision never overwrites another candidate")
  Check(nextPath = ClaimDxfOutput("C:\\dxf\\part(A_B).dxf", "C:\\Parts\\native.SLDPRT", "A:B"), "duplicate owner reuses same destination")
  a.ReferencedConfiguration = "A"
  sharedPart = MakePart(3, 100, 200)
  sharedPart.ActiveConfiguration = "ORIGINAL"
  asm.Components = New Object() {a, b, New TestComponent With {.ReferencedConfiguration = "A"}, hidden}
  Dim done As Object = CreateObject("Scripting.Dictionary")
  Dim opened As Object = CreateObject("Scripting.Dictionary")
  ProcessAssemblyCandidateSnapshot(asm, "C:\\dxf\\", False, Nothing, done, opened)
  Check(done.Count = 2, "every referenced configuration exported separately")
  Check(String.Join(",", exportedConfigs) = "A:2,B:1", "configuration-specific quantities and no duplicate export")
  Check(sharedPart.ActiveConfiguration = "ORIGINAL", "original configuration restored after each candidate")
  Check(openedConfigs.Count = 2, "hidden component never opened")
  done.RemoveAll() : exportedConfigs.Clear() : candidateEndStates.Clear()
  sharedPart.FailConfiguration = "B"
  ProcessAssemblyCandidateSnapshot(asm, "C:\\dxf\\", False, Nothing, done, opened)
  Check(done.Count = 1, "failed configuration is not marked exported from previous successful result")
  Check(candidateEndStates.Count = 2 And Not candidateEndStates(1), "failed configuration gets a failed candidate result")
  sharedPart.FailConfiguration = ""
  a.ReferencedConfiguration = "RAISE" : asm.Components = New Object() {a, b}
  done.RemoveAll() : exportedConfigs.Clear()
  ProcessAssemblyCandidateSnapshot(asm, "C:\\dxf\\", False, Nothing, done, opened)
  Check(done.Count = 1 And exportedConfigs.Contains("B:1"), "candidate API failure does not abort later configurations")
  Check(sharedPart.ActiveConfiguration = "ORIGINAL", "configuration restored after API exception")
  a.ReferencedConfiguration = "A" : asm.Components = New Object() {a, b}
  done.RemoveAll() : exportedConfigs.Clear()
  liveSelection = New TestSelection With {.Items = New Object() {a, b}}
  Dim selected = SnapshotSelectedComponents(asm, liveSelection, 2)
  ProcessSelectedComponents(asm, selected, "C:\\dxf\\", MODE_REGULAR, 1, done, opened)
  Check(done.Count = 2 And String.Join(",", exportedConfigs) = "A:1,B:1", "selected batch survives live selection clearing during first open")
  For Each route As Integer In New Integer() {1, 2, 3}
    Dim c As New TestComponent With {.ReferencedConfiguration = "C", .FilePath = "C:\\Parts\\face.SLDPRT"}
    Dim face As New TestFace(1, True) With {.Owner = c}
    Dim subPart As New TestComponent With {.FilePath = "C:\\Parts\\sub-part.SLDPRT", .ImportedPath = "piston.step"}
    Dim subHidden As New TestComponent With {.FilePath = "C:\\Parts\\hidden.SLDPRT", .VisibleValue = 0}
    Dim subAssembly As New TestComponent With {.FilePath = "C:\\Parts\\selected.SLDASM", .Children = New Object() {subPart, subHidden}}
    subPart.Parent = subAssembly : subHidden.Parent = subAssembly
    asm.Components = New Object() {a, b, c, hidden, subAssembly, subPart, subHidden}
    liveSelection = New TestSelection With {.Items = New Object() {a, b, a, hidden, face, subAssembly, New Object()}}
    selected = SnapshotSelectedComponents(asm, liveSelection, 7)
    Check(selected IsNot Nothing AndAlso selected.Count = 5, "all valid selected parts, faces and subassemblies captured; hidden/unsupported excluded")
    Dim readCount = selectionReads
    scopeToChange = subAssembly
    done.RemoveAll() : exportedConfigs.Clear() : traces.Clear() : receivedFace = Nothing
    Dim selectedMode As Integer = If(route = 3, MODE_PRECUT, MODE_REGULAR)
    Dim method As Integer = If(route = 2, ASSEMBLY_EXPORT_CONTEXT, 1)
    ProcessSelectedComponents(asm, selected, "C:\\dxf\\", selectedMode, method, done, opened)
    Check(done.Count = 3 And String.Join(",", exportedConfigs) = "A:1,B:1,C:1", "mixed selected queue exports each part/configuration once in every mode")
    Check(selectionReads = readCount, "export loop never rereads live selection")
    Check(traces.Contains("selected-queue complete captured=5 visited=5"), "queue completion accounts for every captured selection")
    If route = 2 Then
      Check(receivedFace Is face, "assembly face override survives prior exports clearing selection")
      Check(selectedSubassemblyContexts.Count = 1, "context subassembly retained after live selection cleared")
      Dim contextInfo As Object = selectedSubassemblyContexts("c:\\parts\\selected.sldasm@Default")
      scoped = NormalizeVisiblePartScopes(contextInfo(2), contextInfo(3))
    Else
      scoped = selectedSubassemblyParts
    End If
    Check(scoped.Count = 1 AndAlso scoped.Exists("c:\\parts\\sub-part.sldprt@Default"), "deferred subassembly uses original visible-child scope")
    Dim scopedPart As Object = scoped("c:\\parts\\sub-part.sldprt@Default")
    Check(CStr(scopedPart(3)) = "piston.step", "subassembly import provenance preserved")
    scopeToChange = Nothing
  Next
  liveSelection = New TestSelection With {.Items = New Object() {a, b}}
  Check(SnapshotSelectedComponents(asm, liveSelection, 3) Is Nothing, "changed selection count aborts rather than exporting a partial batch")
  liveSelection.FailIndex = 2
  Check(SnapshotSelectedComponents(asm, liveSelection, 2) Is Nothing, "selection API failure rejects incomplete queue")
  liveSelection = New TestSelection With {.Items = New Object() {a, b}}
  selected = SnapshotSelectedComponents(asm, liveSelection, 2)
  a.VisibleValue = 0
  done.RemoveAll() : exportedConfigs.Clear()
  ProcessSelectedComponents(asm, selected, "C:\\dxf\\", MODE_REGULAR, 1, done, opened)
  Check(done.Count = 1 And String.Join(",", exportedConfigs) = "B:1", "component hidden after capture remains excluded")
  a.VisibleValue = 1
  RunQuantityRegressions()
  Console.WriteLine("DXF geometry, thresholds, import scopes, Toolbox, quantities and selection cases passed.")
End Sub
End Module
Class TestSelection
  Public Items As Object()
  Public FailIndex As Integer
  Function GetSelectedObjectCount2(mark As Integer) As Integer
    Return Items.Length
  End Function
  Function GetSelectedObject6(index As Integer, mark As Integer) As Object
    FilterTests.selectionReads += 1
    If index = FailIndex Then Throw New Exception("selection read failed")
    If index < 1 Or index > Items.Length Then Return Nothing
    Return Items(index - 1)
  End Function
  Function GetSelectedObjectType3(index As Integer, mark As Integer) As Integer
    Dim item = GetSelectedObject6(index, mark)
    If TypeOf item Is TestComponent Then Return 20
    If TypeOf item Is TestFace Then Return 2
    Return -1
  End Function
  Function GetSelectedObjectsComponent4(index As Integer, mark As Integer) As Object
    Dim item = GetSelectedObject6(index, mark)
    If TypeOf item Is TestComponent Then Return item
    If TypeOf item Is TestFace Then Return item.GetComponent()
    Return Nothing
  End Function
End Class
Class TestAssembly
  Public Components As Object()
  Public FailComponents As Boolean
  Function GetComponents(top As Boolean) As Object
    If FailComponents Then Throw New Exception("selection must not enumerate all matching assembly instances")
    Return Components
  End Function
End Class
Class TestComponent
  Public VisibleValue As Integer = 1
  Public FailVisible As Boolean
  Public FailParent As Boolean
  Public Parent As TestComponent
  Public Children As Object() = New Object() {}
  Public FilePath As String = "C:\\Parts\\native.SLDPRT"
  Public ReferencedConfiguration As String = "Default"
  Public ImportedPath As String = ""
  Private Shared nextIdentity As Integer
  Public Name2 As String
  Public FailChildren As Boolean
  Public Suppression As Integer = 3
  Sub New()
    nextIdentity += 1
    Name2 = "instance-" & CStr(nextIdentity)
  End Sub
  Public Bodies As Object(), BodyInfo As Object
  Function GetBodies3(kind As Integer, ByRef info As Object) As Object
    info = BodyInfo
    Return Bodies
  End Function
  ReadOnly Property Visible As Integer
    Get
      If FailVisible Then Throw New Exception("simulated COM failure")
      Return VisibleValue
    End Get
  End Property
  Function GetSuppression2() As Integer
    Return Suppression
  End Function
  Function GetParent() As Object
    If FailParent Then Throw New Exception("simulated parent COM failure")
    Return Parent
  End Function
  Function GetPathName() As String
    Return FilePath
  End Function
  Function GetImportedPath() As String
    Return ImportedPath
  End Function
  Function GetChildren() As Object
    If FailChildren Then Throw New Exception("selected subtree unavailable")
    Return Children
  End Function
End Class
Class TestPart
  Public ActiveConfiguration As String = "Default"
  Public FailConfiguration As String = ""
  Function ShowConfiguration2(cfg As String) As Boolean
    If cfg = FailConfiguration Then Return False
    ActiveConfiguration = cfg
    Return True
  End Function
  Sub EditRebuild3()
  End Sub
  Sub ForceRebuild3(all As Boolean)
  End Sub
  Public Bodies As Object()
  Public Dims As Double()
  Public Fallback As Double
  Public Extension As New TestExtension
  Public Feature As TestFeature
  Public FilePath As String = "C:\\Parts\\native.SLDPRT"
  Function FirstFeature() As Object
    Return Feature
  End Function
  Function GetPathName() As String
    Return FilePath
  End Function
  Function GetBodies3(kind As Integer, ByRef bodyInfo As Object) As Object
    Return Bodies
  End Function
End Class
Class TestExtension
  Public ToolboxPartType As Integer
End Class
Class TestFeature
  Public Name As String
  Public Kind As String
  Public Child As TestFeature
  Public NextFeature As TestFeature
  Public FailNext As Boolean
  Public IsSuppressed As Boolean
  Public Is3DInterconnectFeature As Boolean
  Public LastConfigOption As Integer
  Public OtherConfigurationSuppressed As Boolean = True
  Sub New(t As String, n As String)
    Kind = t : Name = n
  End Sub
  Function GetTypeName2() As String
    Return Kind
  End Function
  Function GetNextFeature() As Object
    If FailNext Then Throw New Exception("simulated feature traversal failure")
    Return NextFeature
  End Function
  Function GetFirstSubFeature() As Object
    Return Child
  End Function
  Function GetNextSubFeature() As Object
    Return NextFeature
  End Function
  Function IsSuppressed2(config As Integer, names As Object) As Object
    Return New Boolean() {IsSuppressed}
  End Function
  Function SetSuppression2(action As Integer, config As Integer, names As Object) As Boolean
    LastConfigOption = config
    IsSuppressed = action = 0
    If config = 2 Then OtherConfigurationSuppressed = IsSuppressed
    Return True
  End Function
End Class
Class TestSurface
  Public IsPlane As Boolean
  Public PlaneParams As Double()
End Class
Class TestFace
  Public Owner As TestComponent
  Function GetComponent() As Object
    Return Owner
  End Function
  Public Area As Double
  Public Surface As New TestSurface
  Public FaceInSurfaceSense As Boolean
  Sub New(a As Double, planar As Boolean)
    Area = a : Surface.IsPlane = planar
    Surface.PlaneParams = New Double() {0, 0, 1, 0, 0, 0}
  End Sub
  Function GetSurface() As Object
    Return Surface
  End Function
  Function GetArea() As Double
    Return Area
  End Function
  Function GetEdges() As Object
    Return Nothing
  End Function
End Class
Class TestBody
  Public Faces As Object()
  Public Thickness As Double
  Public Width As Double = 0.1
  Public Length As Double = 0.2
  Public Offset As Double
  Public HighOverhang As Double, LowOverhang As Double
  Public ExplicitPlanes As Boolean
  Public Normal As Double() = New Double() {0, 0, 1}
  Public FailExtents As Boolean
  Public IsSheetMetal As Boolean
  Public Box As Double() = New Double() {0, 0, 0, 0.003, 0.1, 0.2}
  Sub New(t As Double)
    Thickness = t / 1000
    Faces = New Object() {New TestFace(0.02, True), New TestFace(0.02, True), New TestFace(0.0018, False)}
  End Sub
  Function GetFaces() As Object
    If Not ExplicitPlanes Then
      For i As Integer = 0 To Faces.Length - 1
        Dim face As TestFace = Faces(i), pos = If(i = 0, Offset + Thickness, Offset)
        face.Surface.PlaneParams = New Double() {Normal(0), Normal(1), Normal(2), Normal(0) * pos, Normal(1) * pos, Normal(2) * pos}
        face.FaceInSurfaceSense = (i = 1)
      Next
    End If
    Return Faces
  End Function
  Function GetBodyBox() As Object
    Return Box
  End Function
  Function GetExtremePoint(nx As Double, ny As Double, nz As Double, ByRef x As Double, ByRef y As Double, ByRef z As Double) As Boolean
    If FailExtents Then Return False
    Dim distance = Offset - LowOverhang / 1000
    If nx * Normal(0) + ny * Normal(1) + nz * Normal(2) > 0 Then distance = Offset + Thickness + HighOverhang / 1000
    Dim ux = Normal(2), uy = 0.0, uz = -Normal(0)
    Dim vx = 0.0, vy = 1.0, vz = 0.0
    Dim du = If(nx * ux + ny * uy + nz * uz > 0, Length, 0.0)
    Dim dv = If(nx * vx + ny * vy + nz * vz > 0, Width, 0.0)
    x = Normal(0) * distance + ux * du + vx * dv
    y = Normal(1) * distance + uy * du + vy * dv
    z = Normal(2) * distance + uz * du + vz * dv
    Return True
  End Function
End Class
`, "utf8");
  const built = spawnSync(compiler, ["/nologo", "/nowarn", "/target:exe", `/out:${output}`, input], { encoding: "utf8", windowsHide: true, timeout: 15000 });
  assert.equal(built.status, 0, `${filename}: ${built.stdout}\n${built.stderr}`);
  const run = spawnSync(output, [], { encoding: "utf8", windowsHide: true, timeout: 15000 });
  assert.equal(run.status, 0, `${filename}: ${run.stdout}\n${run.stderr}`);
}
console.log("Both DXF variants: route contracts and offline geometry/filter behavior passed (no SOLIDWORKS writes).");
