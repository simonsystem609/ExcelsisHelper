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

// Execute the actual VBA predicates against geometry doubles, without COM or
// SOLIDWORKS. Only language syntax is adapted for the Windows VB compiler.
function toDotNet(source) {
  return source.replace(/\s+_\r?\n\s*/g, " ")
    .replace(/\bSet\s+(?=[A-Za-z])/g, "")
    .replace(/\bVariant\b/g, "Object")
    .replace(/\bEmpty\b/g, "Nothing")
    .replace(/\b(LCase|Trim|Replace|Mid|Left|Right|Chr)\$/g, "$1")
    .replace(/\b(\d+(?:\.\d+)?)#/g, "$1R")
    .replace(/\bDebug\.Print\b/g, "TraceRun")
    .replace(/^([ \t]*)TraceRun (.+)$/gm, "$1TraceRun($2)")
    .replace(/^([ \t]*)(\w+\.Add|CollectEligibleSubassemblyChildren) (.+)$/gm, "$1$2($3)")
    .replace(/\bArray\(([^\r\n]*)\)/g, "New Object() {$1}")
    .replace(/\bSqr\(/g, "Math.Sqrt(")
    .replace(/\b(Abs|Round)\(/g, "Math.$1(")
    .replace(/^(Function|Sub) ([\s\S]*?)(?=\)\s*(?:As \w+)?\s*\r?\n)/gm, (declaration) =>
      declaration.replace(/([,(]\s*(?:_\s*)?)(?!ByVal\b|ByRef\b)(\w+(?:\(\))? As \w+)/g, "$1ByRef $2"));
}

const functions = [
  "FindLargestPlanarFace", "FindLargestPlanarFaceInBodies", "IsPlanarFace", "TryGetPlaneNormalAndPoint", "SignedPlaneDistance",
  "GetThicknessViaBodyExtents", "GetBodiesThicknessViaExtents", "GetThinSolidThickness", "IsThinPlateLike", "HasSheetLikePlanarFaces",
  "ComponentBodiesMayBeSheetLike",
  "IsWasherLikeThinSolid", "CountPartSolidBodies", "GetExportPieceCount", "IsToolboxPartSafe",
  "IsImportedPartPath", "IsImportedGeometryPart", "ShouldRejectImportedCandidate",
  "IsComponentHiddenSafe", "ComponentHasExcludedAssemblyAncestor", "GetComponentSuppressionStateSafe",
  "IsComponentActuallySuppressedSafe", "IsComponentLightweightSafe", "IsPartPath", "IsAssemblyPath",
  "BuildQtyDict", "BuildAssemblyContextQtyDict", "CollectEligibleSubassemblyChildren",
  "BuildVisibleSubassemblyPartCandidates",
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
  assert.match(regular, /Not exportSelectedFace And Not isSM And Not isThin/);
  assert.match(regular, /ExportNormalViewToDxf\(swPart, selectedFace, outPath\)/);
  const context = procedure(source, "ExportOnePartInAssemblyContext");
  assert.match(context, /If isSM Then[\s\S]*ExportOnePart\([\s\S]*GoTo RestorePartConfiguration/);
  assert.match(context, /If selectedPlanarFaceOverride Then[\s\S]*ElseIf Not IsThinPlateLike/);
  assert.match(procedure(source, "ExportAssemblyComponentViaTemporaryPart"), /CreateFeatureFromBody3/);
  assert.match(procedure(source, "ExportCurrentViewToDxf"), /RestoreCurrentViewDisplayState:/);
  assert.match(procedure(source, "AskExportMode"), /g_generalImportedFilter = False/);
  assert.match(procedure(source, "AskMaterial"), /ConfiguredDefaultMaterial\(\)/);
  assert.doesNotMatch(procedure(source, "AskMaterial"), /\.Popup\b/);
  assert.match(procedure(source, "BuildQtyDict"), /ComponentHasExcludedAssemblyAncestor\(c, False, False\)/);
  assert.match(procedure(source, "ProcessFullAssembly"), /ComponentHasExcludedAssemblyAncestor\(swComp, False, False\)/);
  for (const route of ["ProcessSelectedComponents", "ProcessFullAssembly", "ProcessFullAssemblyInContext", "ProcessSelectedSubassemblyContext"]) {
    assert.match(procedure(source, route), /IsComponentHiddenSafe\(swComp\)/, route);
    assert.match(procedure(source, route), /ComponentHasExcludedAssemblyAncestor\(swComp,/, route);
  }
  assert.match(procedure(source, "ProcessSelectedSubassemblyContext"), /If Not visibleParts.Exists\(fullKey\) Then GoTo NextContextComponent/);
  assert.match(procedure(source, "CollectSelectedSubassemblyParts"), /If visibleParts.Exists\(partKey\) Then/);

  if (process.platform !== "win32") continue;
  const compiler = path.join(process.env.WINDIR || "C:\\Windows", "Microsoft.NET", "Framework64", "v4.0.30319", "vbc.exe");
  assert.ok(fs.existsSync(compiler), "Windows VB compiler is required for offline macro behavior tests.");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "excelsis-dxf-filter-tests-"));
  const input = path.join(dir, "predicates.vb");
  const output = path.join(dir, "predicates.exe");
  const constants = source.split(/\r?\n/).filter((line) => /^Const (?:swComponent|THICKNESS_LIMIT|THIN_PLATE_MIN_RATIO|MIN_PLANAR_AREA_RATIO|MIN_LARGEST_PLANAR_FOOTPRINT_RATIO|WASHERLIKE_)/.test(line));
  fs.writeFileSync(input, `Option Strict Off
Imports System
Imports Microsoft.VisualBasic
Module FilterTests
${toDotNet(constants.join("\n"))}
Dim g_generalImportedFilter As Boolean
Dim g_traceComponent As String = "test"
Dim fallbackCalls As Integer
Const swSolidBody As Integer = 0
Sub TraceRun(message As String)
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
  part.Bodies = New Object() {New TestBody(t)}
  Return part
End Function
Sub Main()
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
  Dim counts As Object = BuildQtyDict(asm)
  Check(CInt(counts("c:\\parts\\native.sldprt@Default")) = 1, "hidden occurrences excluded from regular quantities")
  counts = BuildAssemblyContextQtyDict(asm)
  Check(CInt(counts("c:\\parts\\native.sldprt@Default")) = 1, "hidden occurrences excluded from context quantities")
  Dim scoped As Object = BuildVisibleSubassemblyPartCandidates(asm, parent.FilePath, "Default")
  Check(scoped.Count = 0, "hidden subassembly has no allowed exports")
  parent.VisibleValue = 1
  scoped = BuildVisibleSubassemblyPartCandidates(asm, parent.FilePath, "Default")
  Check(scoped.Count = 1, "visible nested part retained")
  nested.VisibleValue = 0
  scoped = BuildVisibleSubassemblyPartCandidates(asm, parent.FilePath, "Default")
  Check(scoped.Count = 0, "snapshot excludes hidden child even if reopening later shows it")
  Dim childBranch As New TestComponent With {.VisibleValue = 0, .FilePath = "C:\\Parts\\nested.SLDASM", .Parent = parent}
  childBranch.Children = New Object() {shown}
  parent.Children = New Object() {childBranch}
  scoped = BuildVisibleSubassemblyPartCandidates(asm, parent.FilePath, "Default")
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
  Check(Not IsWasherLikeThinSolid(MakePart(3, 20, 60)), "60 mm washer bound exclusive")
  Check(Not IsWasherLikeThinSolid(MakePart(2, 24, 24)), "washer ratio 12 exclusive")
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
  Console.WriteLine("DXF geometry, thresholds, import scopes, Toolbox and quantity cases passed.")
End Sub
End Module
Class TestAssembly
  Public Components As Object()
  Function GetComponents(top As Boolean) As Object
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
  Public Name2 As String = "test instance"
  ReadOnly Property Visible As Integer
    Get
      If FailVisible Then Throw New Exception("simulated COM failure")
      Return VisibleValue
    End Get
  End Property
  Function GetSuppression2() As Integer
    Return 3
  End Function
  Function GetParent() As Object
    If FailParent Then Throw New Exception("simulated parent COM failure")
    Return Parent
  End Function
  Function GetPathName() As String
    Return FilePath
  End Function
  Function GetChildren() As Object
    Return Children
  End Function
End Class
Class TestPart
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
  Sub New(t As String, n As String)
    Kind = t : Name = n
  End Sub
  Function GetTypeName2() As String
    Return Kind
  End Function
  Function GetNextFeature() As Object
    Return Nothing
  End Function
End Class
Class TestSurface
  Public IsPlane As Boolean
  Public PlaneParams As Double()
End Class
Class TestFace
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
End Class
Class TestBody
  Public Faces As Object()
  Public Thickness As Double
  Public Offset As Double
  Public Normal As Double() = New Double() {0, 0, 1}
  Public FailExtents As Boolean
  Public IsSheetMetal As Boolean
  Public Box As Double() = New Double() {0, 0, 0, 0.003, 0.1, 0.2}
  Sub New(t As Double)
    Thickness = t / 1000
    Faces = New Object() {New TestFace(0.02, True), New TestFace(0.02, True), New TestFace(0.0018, False)}
  End Sub
  Function GetFaces() As Object
    For Each face As TestFace In Faces
      face.Surface.PlaneParams = New Double() {Normal(0), Normal(1), Normal(2), 0, 0, 0}
    Next
    Return Faces
  End Function
  Function GetBodyBox() As Object
    Return Box
  End Function
  Function GetExtremePoint(nx As Double, ny As Double, nz As Double, ByRef x As Double, ByRef y As Double, ByRef z As Double) As Boolean
    If FailExtents Then Return False
    Dim distance = Offset
    If nx * Normal(0) + ny * Normal(1) + nz * Normal(2) > 0 Then distance += Thickness
    x = Normal(0) * distance : y = Normal(1) * distance : z = Normal(2) * distance
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
