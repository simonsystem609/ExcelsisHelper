"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "macros", "Radius_v9.swb"), "utf8");
function procedure(name) {
  const match = source.match(new RegExp(`^(?:Public |Private )?(?:Sub|Function) ${name}\\b[\\s\\S]*?^End (?:Sub|Function)`, "m"));
  assert.ok(match, `Missing ${name}`);
  return match[0];
}
const main = procedure("ExcelsisMacroMain");
assert.ok(main.indexOf("CollectAssemblyFaceTargets") < main.indexOf("AskEdgeTreatmentMode()"));
assert.ok(main.indexOf("AskEdgeTreatmentMode()") < main.indexOf("AskEdgeSizeMm(operationMode)"));
assert.ok(main.indexOf("AskEdgeSizeMm(operationMode)") < main.indexOf("AskCornerScope()"));
assert.match(procedure("AskCornerScope"), /vbDefaultButton2/);
assert.match(procedure("AskCornerScope"), /vbNo[\s\S]*CORNERS_ALL/);
assert.match(procedure("AskEdgeSizeMm"), /InputBox\(prompt, "Auto radius \/ chamfer", "10"\)/);
assert.match(procedure("AskEdgeTreatmentMode"), /YES = Radius[\s\S]*NO = Chamfer/);
assert.doesNotMatch(source, /GetLargestFace|IsOuterBoundingCornerEdge|GetAccuratePartBox|IsCandidateRadiusEdge|RADIUS_MODE_/);
assert.doesNotMatch(source, /CollectSelectedFaceEdges/);
assert.doesNotMatch(procedure("OriginalEdgeFallback"), /CollectOutlineCornerEdges|GetEdges|GetBodies/);
assert.match(procedure("CollectOutlineCornerEdges"), /faceLoop\.IsOuter[\s\S]*faceLoop\.GetVertices[\s\S]*vertex\.GetEdges/);
assert.doesNotMatch(procedure("CollectOutlineCornerEdges"), /face\.GetEdges|GetBodies|GetBox/);
assert.match(procedure("ProcessAssemblyTargets"), /ProcessPartDocument\(swPart, configName, sizeMm, operationMode, cornerScope,/);
assert.match(procedure("OriginalEdgeFallback"), /If i > MAX_SINGLE_TRIES Then Exit For/);
assert.match(main, /made > 0 And Len\(stateWarning\) = 0/);
assert.match(procedure("ProcessAssemblyTargets"), /made > 0 And Len\(stateWarning\) = 0/);
assert.match(procedure("ProcessPartDocument"), /Any partial result was left open and unsaved/);
assert.doesNotMatch(procedure("ProcessPartDocument"), /skipped because it already has unsaved changes/);
assert.match(procedure("ProcessPartDocument"), /hadUnsavedChanges = IsDocumentDirty[\s\S]*If hadUnsavedChanges Then[\s\S]*Left open and unsaved/);

if (process.platform !== "win32") {
  console.log("Selected-face radius/chamfer source contracts passed; Windows behavior tests skipped.");
  process.exit(0);
}
function toDotNet(text) {
  return text.replace(/\s+_\r?\n\s*/g, " ")
    .replace(/\bSet\s+(?=[A-Za-z])/g, "")
    .replace(/\bVariant\b/g, "Object")
    .replace(/\bVbMsgBoxResult\b/g, "MsgBoxResult")
    .replace(/\bMsgBox\(/g, "FakeMsgBox(")
    .replace(/\bvbYesNoCancel\b/g, "MsgBoxStyle.YesNoCancel")
    .replace(/\bvbQuestion\b/g, "MsgBoxStyle.Question")
    .replace(/\bvbDefaultButton2\b/g, "MsgBoxStyle.DefaultButton2")
    .replace(/\bvbYes\b/g, "MsgBoxResult.Yes")
    .replace(/\bvbNo\b/g, "MsgBoxResult.No")
    .replace(/\bEmpty\b/g, "Nothing")
    .replace(/\bAs Long\b/g, "As Integer")
    .replace(/\((?:0|1) To ([^)]+)\)/g, "($1)")
    .replace(/\b(Trim|Replace|LCase|Right|Left|Mid)\$/g, "$1")
    .replace(/\b(\d+(?:\.\d+)?)#/g, "$1R")
    .replace(/\.GetType\b/g, ".GetDocumentType")
    .replace(/\b(Abs|Round)\(/g, "Math.$1(")
    .replace(/\bSqr\(/g, "Math.Sqrt(")
    .replace(/= Array\((.*)\)$/gm, "= New Object() {$1}")
    .replace(/^([ \t]*)Debug\.Print (.+)$/gm, "$1System.Diagnostics.Debug.Print(CStr($2))")
    .replace(/^([ \t]*)([A-Za-z]\w*(?:\.\w+)*)( (?!As\b).+)$/gm, (line, indent, name, args) => {
      if (/^(?:tokens\.Add|faceTokens\.Add|targets\.Add|target\.Add|partTokens\.Add|token\.Add|CollectOutlineCornerEdges|swPart\.ClearSelection2|Err\.Raise|AddRadiusIssue|PreserveModelWindow)$/.test(name))
        return `${indent}${name}(${args.trim()})`;
      return line;
    });
}
const names = ["CollectSelectedFaceTokens", "CollectAssemblyFaceTargets", "AddSelectedPartTarget",
  "CreateFaceToken", "BuildPartFaceTokens", "CollectOutlineCornerEdges", "OriginalEdgeFallback",
  "GetPlanarUnitNormal", "VectorDot3", "IsOutlineCornerEdge", "AskCornerScope",
  "TryCreateEdgeTreatment", "CreateFilletFeature", "ZeroDoubleArray", "EdgeTreatmentBaseName",
  "EdgeTreatmentName", "IsPartPath", "FormatNumberForText", "ParseEdgeSizeMm", "ProcessPartDocument",
  "ProcessAssemblyTargets"];
const constants = source.split(/\r?\n/).filter((line) => /^Private Const /.test(line));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "excelsis-radius-tests-"));
const input = path.join(dir, "radius-tests.vb");
const output = path.join(dir, "radius-tests.exe");
fs.writeFileSync(input, String.raw`Option Strict Off
Imports System
Imports System.Collections.Generic
Imports Microsoft.VisualBasic
Module Tests
${toDotNet(constants.join("\n"))}
Public Selected As New List(Of TestEdge)
Public NextPromptResult As MsgBoxResult
Public LastPromptStyle As MsgBoxStyle
Public TestDocuments As New Dictionary(Of String, TestPart)
Public SavedDocuments As New List(Of String)
Public PreservedDocuments As New List(Of String)
${names.map((name) => toDotNet(procedure(name))).join("\n")}
Function FakeMsgBox(prompt As String, style As MsgBoxStyle, title As String) As MsgBoxResult
  LastPromptStyle = style
  Return NextPromptResult
End Function
Function IsEmpty(value As Object) As Boolean
  Return value Is Nothing
End Function
Function IsArray(value As Object) As Boolean
  Return TypeOf value Is System.Array
End Function
Function ResolveFaceTokenToPart(part As Object, token As Object) As Object
  Return token("fallbackFace")
End Function
Function MakeUniqueFeatureName(part As Object, baseName As String) As String
  Return baseName
End Function
Function IsDocumentDirty(part As Object, ByRef known As Boolean) As Boolean
  known = part.DirtyKnown
  Return part.Dirty
End Function
Function GetOpenOrLoadedPart(filename As String, ByRef opened As Boolean) As Object
  opened = False
  Return TestDocuments(filename)
End Function
Function SavePartDocument(part As Object, ByRef details As String) As Boolean
  Check(Not part.Dirty, "Never auto-save pre-existing user edits")
  SavedDocuments.Add(part.GetTitle())
  Return True
End Function
Sub PreserveModelWindow(preserve As Object, part As Object)
  PreservedDocuments.Add(part.GetTitle())
End Sub
Sub AddRadiusIssue(issues As Collection, issue As String)
  issues.Add(issue)
End Sub
Function ActivatePartConfig(part As Object, name As String, ByRef previous As String) As Boolean
  previous = "original"
  part.Activations += 1
  Return Not part.FailConfig
End Function
Function ActivateModelDocument(part As Object) As Boolean
  Return Not part.FailActivation
End Function
Function RestorePartConfig(part As Object, previous As String) As Boolean
  part.Restorations += 1
  Return True
End Function
Sub Check(value As Boolean, message As String)
  If Not value Then Throw New Exception(message)
End Sub
Function FaceTokens(part As TestPart) As Collection
  Dim detail As String = ""
  Return CollectSelectedFaceTokens(part, detail)
End Function
Sub Main()
  Dim detail As String = ""
  NextPromptResult = MsgBoxResult.No
  Check(AskCornerScope() = CORNERS_ALL, "No selects all corner angles")
  Check((LastPromptStyle And MsgBoxStyle.DefaultButton2) <> 0, "All corners is the focused default")
  NextPromptResult = MsgBoxResult.Yes
  Check(AskCornerScope() = CORNERS_RIGHT_ANGLE, "Yes selects only 90-degree corners")
  NextPromptResult = MsgBoxResult.Cancel
  Check(AskCornerScope() = 0, "Cancel aborts")
  Dim p As New TestPart
  Check(CollectSelectedFaceTokens(p, detail) Is Nothing, "Empty selection must fail")
  p.SelectionManager.Items.Add(New Pick With {.Kind = 20, .Component = New TestComponent})
  Check(CollectSelectedFaceTokens(p, detail) Is Nothing, "Part-only selection must fail")
  p.SelectionManager.Items.Clear()
  p.SelectionManager.Items.Add(New Pick With {.Face = p.Face})
  Check(FaceTokens(p).Count = 1, "One selected face")
  p.SelectionManager.Items.Add(New Pick With {.Face = p.Face})
  Check(CollectSelectedFaceTokens(p, detail) Is Nothing, "Two faces in one part must fail")
  p.SelectionManager.Items.RemoveAt(1)
  Dim emptyTokens As New Collection
  Check(BuildPartFaceTokens(p, emptyTokens, detail) Is Nothing, "No largest-face fallback")
  Check(BuildPartFaceTokens(p, Nothing, detail) Is Nothing, "Missing selection never broadens scope")

  Dim a As New TestPart
  Dim c1 As New TestComponent With {.FilePath = "C:\Parts\one.SLDPRT"}
  Dim c2 As New TestComponent With {.FilePath = "C:\Parts\two.SLDPRT"}
  a.SelectionManager.Items.Add(New Pick With {.Face = p.Face, .Component = c1})
  a.SelectionManager.Items.Add(New Pick With {.Face = p.Face, .Component = c2})
  Dim targets As Object = CollectAssemblyFaceTargets(a, detail)
  Check(targets IsNot Nothing AndAlso targets.Count = 2, "One face in each of two parts")
  Check(targets(c1.FilePath)("config") = "Default", "Referenced configuration retained")
  c2.FilePath = c1.FilePath.ToUpperInvariant()
  c2.Config = "Other config"
  Check(CollectAssemblyFaceTargets(a, detail) Is Nothing, "Repeated file in another config must fail")
  c2.FilePath = "C:\Parts\two.SLDPRT"
  a.SelectionManager.Items(1).Kind = 20
  Check(CollectAssemblyFaceTargets(a, detail) Is Nothing, "Mixed faces and components abort the whole selection")
  a.SelectionManager.Items(1).Kind = 2
  c2.Suppressed = True
  Check(CollectAssemblyFaceTargets(a, detail) Is Nothing, "Suppressed target must fail")

  Check(ParseEdgeSizeMm("10") = 10, "Default size")
  Check(ParseEdgeSizeMm("2,5") = 2.5 AndAlso ParseEdgeSizeMm("2.5") = 2.5, "Both decimal separators")
  For Each invalid As String In New String() {"", "0", "-1", "1e3", "1.2.3", "ten", "10mm"}
    Check(ParseEdgeSizeMm(invalid) = 0, "Invalid size " & invalid)
  Next
  Dim edges() As Object = Nothing
  Dim refs() As Object = Nothing
  Dim count As Integer
  CollectOutlineCornerEdges(p, FaceTokens(p), CORNERS_ALL, edges, refs, count, detail)
  Check(count = 2, "Thickness corners collected once; face rim excluded")
  Check(Not Array.Exists(edges, Function(e) e Is p.Face.Edges(0)), "Never fillet broad face perimeter")
  Check(Not Array.Exists(edges, Function(e) e Is p.UnselectedEdge), "Other faces excluded")
  Check(TryCreateEdgeTreatment(p, edges, count, 10, EDGE_MODE_RADIUS), "Radius branch")
  Check(p.FeatureManager.LastOptions = 130 AndAlso (p.FeatureManager.LastOptions And 1) = 0, "Fillet propagation disabled")
  Check(p.FeatureManager.LastMark = 1 AndAlso p.FeatureManager.LastSize = 0.01, "Fillet mark and mm conversion")
  Check(TryCreateEdgeTreatment(p, edges, count, 10, EDGE_MODE_CHAMFER), "Chamfer branch")
  Check(p.FeatureManager.LastOptions = 2 AndAlso (p.FeatureManager.LastOptions And 4) = 0, "Chamfer propagation disabled")
  Check(p.FeatureManager.LastMark = 0 AndAlso p.FeatureManager.LastSize = 0.01, "Chamfer mark and mm conversion")
  Check(Math.Abs(p.FeatureManager.LastAngle - Math.PI / 4) < 0.000000001, "45 degree chamfer")

  p.FeatureManager.Attempts.Clear()
  p.FeatureManager.FailBatch = True
  p.FeatureManager.ChangeFaceAfterSuccess = True
  p.Extension.References("A") = p.EdgeA
  p.Extension.References("B") = p.EdgeB
  Check(OriginalEdgeFallback(p, refs, count, 10, EDGE_MODE_RADIUS) = 2, "Bounded original-edge fallback")
  Check(String.Join(",", p.FeatureManager.Attempts) = "A,B", "Never collects newly created or other-face edges")
  p.Extension.References.Remove("B")
  Check(OriginalEdgeFallback(p, refs, count, 10, EDGE_MODE_RADIUS) = 1, "Missing original edge is skipped")
  Check(Selected.Count = 0, "Selections cleared after feature calls")

  Dim q As New TestPart
  q.SelectionManager.Items.Add(New Pick With {.Face = q.Face})
  q.FeatureManager.FailAll = True
  Dim candidates As Integer, made As Integer, warning As String = "", reason As String = ""
  Check(ProcessPartDocument(q, "Default", 10, EDGE_MODE_CHAMFER, CORNERS_ALL, FaceTokens(q), candidates, made, reason, warning), "Kernel rejection is reported")
  Check(candidates = 2 AndAlso made = 0 AndAlso warning.Contains("unsaved"), "Failure must not claim success or save")
  Check(q.Restorations = 1, "Configuration restored after rejected geometry")
  q.Dirty = True
  q.FeatureManager.FailAll = False
  Check(ProcessPartDocument(q, "Default", 10, EDGE_MODE_RADIUS, CORNERS_ALL, FaceTokens(q), candidates, made, reason, warning), "Pre-existing unsaved edits do not block the operation")
  Check(q.Activations = 2 AndAlso candidates = 2 AndAlso made = 2, "Dirty part's selected corners treated")
  Check(reason = "" AndAlso warning.Contains("save manually"), "Successful dirty result remains unsaved")
  q.Dirty = False
  q.DirtyKnown = False
  Check(Not ProcessPartDocument(q, "Default", 10, EDGE_MODE_RADIUS, CORNERS_ALL, FaceTokens(q), candidates, made, reason, warning), "Unreadable save state still fails closed")
  Check(q.Activations = 2, "Unknown-state part not changed")
  q.DirtyKnown = True
  q.FailActivation = True
  Check(Not ProcessPartDocument(q, "Default", 10, EDGE_MODE_RADIUS, CORNERS_ALL, FaceTokens(q), candidates, made, reason, warning), "Activation failure must stop")
  Check(q.Restorations = 3, "Configuration restored on activation failure")

  Dim dirtyPart As New TestPart With {.TestName = "dirty.SLDPRT", .Dirty = True}
  Dim cleanPart As New TestPart With {.TestName = "clean.SLDPRT"}
  Dim batchAssembly As New TestPart
  Dim dirtyComponent As New TestComponent With {.FilePath = "C:\Parts\dirty.SLDPRT"}
  Dim cleanComponent As New TestComponent With {.FilePath = "C:\Parts\clean.SLDPRT"}
  batchAssembly.SelectionManager.Items.Add(New Pick With {.Face = dirtyPart.Face, .Component = dirtyComponent})
  batchAssembly.SelectionManager.Items.Add(New Pick With {.Face = cleanPart.Face, .Component = cleanComponent})
  TestDocuments.Add(dirtyComponent.FilePath, dirtyPart)
  TestDocuments.Add(cleanComponent.FilePath, cleanPart)
  Dim batchTargets As Object = CollectAssemblyFaceTargets(batchAssembly, detail)
  Dim done As Integer, saved As Integer, skipped As Integer, totalCandidates As Integer, totalEdges As Integer
  Dim issues As New Collection
  Check(ProcessAssemblyTargets(batchTargets, 10, EDGE_MODE_CHAMFER, CORNERS_ALL,
    done, saved, skipped, totalCandidates, totalEdges, issues, New Object()), "Mixed clean/dirty assembly batch")
  Check(done = 2 AndAlso skipped = 0 AndAlso totalEdges = 4, "Both assembly parts processed despite unsaved edits")
  Check(saved = 1 AndAlso String.Join(",", SavedDocuments) = "clean.SLDPRT", "Only previously clean part auto-saved")
  Check(String.Join(",", PreservedDocuments) = "dirty.SLDPRT", "Unsaved part window explicitly preserved")
  Check(issues.Count = 1 AndAlso CStr(issues(1)).Contains("save manually"), "Summary explains manual save without calling part skipped")
  Check(dirtyPart.Dirty AndAlso dirtyPart.Restorations = 1 AndAlso cleanPart.Restorations = 1, "Existing dirty state and config restoration retained")

  Dim rectangle As Double()() = {New Double() {0, 0}, New Double() {0.12, 0}, New Double() {0.12, 0.06}, New Double() {0, 0.06}}
  Dim trapezoid As Double()() = {New Double() {0, 0}, New Double() {0.12, 0}, New Double() {0.09, 0.06}, New Double() {0, 0.06}}
  Dim concave As Double()() = {New Double() {0, 0}, New Double() {0.12, 0}, New Double() {0.12, 0.02},
    New Double() {0.04, 0.02}, New Double() {0.04, 0.08}, New Double() {0, 0.08}}
  For Each rotated In New Boolean() {False, True}
    For Each reverseNormal In New Boolean() {False, True}
      Dim plate = MakePlate(rectangle, rotated, reverseNormal)
      CollectOutlineCornerEdges(plate, FaceTokens(plate), CORNERS_ALL, edges, refs, count, detail)
      Check(count = 4, "Rectangle has four thickness corners in every orientation")
      For i As Integer = 1 To count
        Check(DirectCast(edges(i), TestEdge).Id = "CORNER" & (i - 1), "Corner selection, not rim/back/hole/other-body edge")
      Next
      Check(TryCreateEdgeTreatment(plate, edges, count, 10, EDGE_MODE_RADIUS), "10 mm outline radius on 4 mm plate")
      Check(String.Join(",", plate.FeatureManager.Attempts) = "CORNER0,CORNER1,CORNER2,CORNER3", "Only thickness edges reach fillet API")
      CollectOutlineCornerEdges(plate, FaceTokens(plate), CORNERS_RIGHT_ANGLE, edges, refs, count, detail)
      Check(count = 4, "90-degree mode retains rectangle corners")

      plate = MakePlate(trapezoid, rotated, reverseNormal)
      CollectOutlineCornerEdges(plate, FaceTokens(plate), CORNERS_ALL, edges, refs, count, detail)
      Check(count = 4, "All mode keeps acute and obtuse outline corners")
      CollectOutlineCornerEdges(plate, FaceTokens(plate), CORNERS_RIGHT_ANGLE, edges, refs, count, detail)
      Check(count = 2, "90-degree mode rejects both angled trapezoid corners")
      Check(DirectCast(edges(1), TestEdge).Id = "CORNER0" AndAlso DirectCast(edges(2), TestEdge).Id = "CORNER3", "Correct two right angles")

      plate = MakePlate(concave, rotated, reverseNormal)
      CollectOutlineCornerEdges(plate, FaceTokens(plate), CORNERS_ALL, edges, refs, count, detail)
      Check(count = 6, "Non-rectangular outline includes reentrant corner without bbox filters")
    Next
  Next
  Dim guarded = MakePlate(rectangle, False, False)
  DirectCast(guarded.CornerEdges(0).Adjacent(0), TestFace).Planar = False
  CollectOutlineCornerEdges(guarded, FaceTokens(guarded), CORNERS_ALL, edges, refs, count, detail)
  Check(count = 2, "Existing curved corner blend junctions are not reprocessed")
  guarded = MakePlate(rectangle, False, False)
  guarded.CornerEdges(0).Adjacent(1) = guarded.CornerEdges(0).Adjacent(0)
  CollectOutlineCornerEdges(guarded, FaceTokens(guarded), CORNERS_ALL, edges, refs, count, detail)
  Check(count = 3, "Coplanar seam is not a corner")
  guarded = MakePlate(rectangle, False, False)
  guarded.CornerEdges(0).Adjacent(1) = guarded.Face
  CollectOutlineCornerEdges(guarded, FaceTokens(guarded), CORNERS_ALL, edges, refs, count, detail)
  Check(count = 3, "Selected face itself cannot be a lateral adjacent face")
  guarded = MakePlate(rectangle, False, False)
  guarded.Face.Planar = False
  CollectOutlineCornerEdges(guarded, FaceTokens(guarded), CORNERS_ALL, edges, refs, count, detail)
  Check(count = 0 AndAlso detail.Contains("planar"), "Curved selected face fails closed")
  guarded = MakePlate(rectangle, False, False)
  guarded.CornerEdges(1).FailRead = True
  CollectOutlineCornerEdges(guarded, FaceTokens(guarded), CORNERS_ALL, edges, refs, count, detail)
  Check(count = 0 AndAlso edges Is Nothing AndAlso detail.Contains("inspect"), "Read failure clears partially collected candidates")
  guarded = MakePlate(rectangle, False, False)
  guarded.Face.Loops = Nothing
  CollectOutlineCornerEdges(guarded, FaceTokens(guarded), CORNERS_ALL, edges, refs, count, detail)
  Check(count = 0, "No loop data never falls back to whole face or body")
  Console.WriteLine("Outline-corner geometry, angle prompt/default, selection scope, API arguments, fixed-edge fallback and document guards passed.")
End Sub

Function Rotate(v As Double(), rotated As Boolean, position As Boolean) As Double()
  Dim x = v(0), y = v(1), z = v(2)
  If rotated Then
    Dim a = 0.645771823237902, b = 0.401425727958696
    Dim x1 = Math.Cos(a) * x + Math.Sin(a) * z
    Dim z1 = -Math.Sin(a) * x + Math.Cos(a) * z
    x = x1
    z = Math.Sin(b) * y + Math.Cos(b) * z1
    y = Math.Cos(b) * y - Math.Sin(b) * z1
  End If
  If position Then Return New Double() {x + 1.2, y - 0.7, z + 3.0}
  Return New Double() {x, y, z}
End Function
Function MakePlate(points As Double()(), rotated As Boolean, reverseNormal As Boolean) As TestPart
  Dim p As New TestPart, n = points.Length
  Dim front(n - 1) As TestVertex, back(n - 1) As TestVertex, sides(n - 1) As TestFace
  Dim rim(n - 1) As Object, rear(n - 1) As Object
  ReDim p.CornerEdges(n - 1)
  p.Face.Normal = Rotate(New Double() {0, 0, If(reverseNormal, -1, 1)}, rotated, False)
  For i As Integer = 0 To n - 1
    Dim j = (i + 1) Mod n
    front(i) = New TestVertex With {.Point = Rotate(New Double() {points(i)(0), points(i)(1), 0}, rotated, True)}
    back(i) = New TestVertex With {.Point = Rotate(New Double() {points(i)(0), points(i)(1), -0.004}, rotated, True)}
    Dim dx = points(j)(0) - points(i)(0), dy = points(j)(1) - points(i)(1)
    Dim length = Math.Sqrt(dx * dx + dy * dy)
    sides(i) = New TestFace With {.Normal = Rotate(New Double() {dy / length, -dx / length, 0}, rotated, False)}
  Next
  For i As Integer = 0 To n - 1
    Dim j = (i + 1) Mod n, previous = (i + n - 1) Mod n
    rim(i) = New TestEdge With {.Id = "RIM" & i, .StartVertex = front(i), .EndVertex = front(j), .Adjacent = New Object() {p.Face, sides(i)}}
    rear(i) = New TestEdge With {.Id = "BACK" & i, .StartVertex = back(i), .EndVertex = back(j), .Adjacent = New Object() {New TestFace, sides(i)}}
    p.CornerEdges(i) = New TestEdge With {.Id = "CORNER" & i, .StartVertex = front(i), .EndVertex = back(i), .Adjacent = New Object() {sides(previous), sides(i)}}
  Next
  For i As Integer = 0 To n - 1
    front(i).Edges = New Object() {rim(i), rim((i + n - 1) Mod n), p.CornerEdges(i), p.CornerEdges(i)}
    back(i).Edges = New Object() {rear(i), rear((i + n - 1) Mod n), p.CornerEdges(i)}
  Next
  p.Face.Edges = rim
  p.Face.Loops = New Object() {New TestLoop With {.Outer = False, .FailRead = True}, New TestLoop With {.Vertices = front}}
  p.SelectionManager.Items.Add(New Pick With {.Face = p.Face})
  Return p
End Function
End Module
Public Class Pick
  Public Kind As Integer = 2
  Public Face As Object
  Public Component As Object
End Class
Public Class SelectionData
  Public Mark As Integer
End Class
Public Class TestSelections
  Public Items As New List(Of Pick)
  Public Function GetSelectedObjectCount2(mark As Integer) As Integer
    Return Items.Count
  End Function
  Public Function GetSelectedObjectType3(index As Integer, mark As Integer) As Integer
    Return Items(index - 1).Kind
  End Function
  Public Function GetSelectedObject6(index As Integer, mark As Integer) As Object
    Return Items(index - 1).Face
  End Function
  Public Function GetSelectedObjectsComponent4(index As Integer, mark As Integer) As Object
    Return Items(index - 1).Component
  End Function
  Public Function CreateSelectData() As Object
    Return New SelectionData
  End Function
End Class
Public Class TestComponent
  Public FilePath As String = "C:\Parts\one.SLDPRT"
  Public Config As String = "Default"
  Public Suppressed As Boolean
  Public Function IsSuppressed() As Boolean
    Return Suppressed
  End Function
  Public Function GetPathName() As String
    Return FilePath
  End Function
  Public ReadOnly Property ReferencedConfiguration As String
    Get
      Return Config
    End Get
  End Property
End Class
Public Class TestFace
  Public Edges As Object()
  Public Loops As Object()
  Public Planar As Boolean = True
  Public Normal As Object = New Double() {0, 0, 1}
  Public Function GetEdges() As Object
    Return Edges
  End Function
  Public Function GetLoops() As Object
    Return Loops
  End Function
  Public Function GetSurface() As Object
    Return New TestSurface With {.Plane = Planar}
  End Function
End Class
Public Class TestSurface
  Public Plane As Boolean = True
  Public Function IsPlane() As Boolean
    Return Plane
  End Function
End Class
Public Class TestCurve
  Public Line As Boolean = True
  Public Function IsLine() As Boolean
    Return Line
  End Function
End Class
Public Class TestVertex
  Public Point As Object = New Double() {0, 0, 0}
  Public Edges As Object()
  Public Function GetPoint() As Object
    Return Point
  End Function
  Public Function GetEdges() As Object
    Return Edges
  End Function
End Class
Public Class TestLoop
  Public Outer As Boolean = True
  Public FailRead As Boolean
  Public Vertices As Object()
  Public Function IsOuter() As Boolean
    Return Outer
  End Function
  Public Function GetVertices() As Object
    If FailRead Then Throw New Exception("Inner loop must never be inspected")
    Return Vertices
  End Function
End Class
Public Class TestEdge
  Public Id As String
  Public Mark As Integer
  Public FailRead As Boolean
  Public Curve As New TestCurve
  Public StartVertex As New TestVertex
  Public EndVertex As New TestVertex With {.Point = New Double() {0, 0, -0.004}}
  Public Adjacent As Object() = {New TestFace With {.Normal = New Double() {1, 0, 0}}, New TestFace With {.Normal = New Double() {0, 1, 0}}}
  Public Function GetCurve() As Object
    If FailRead Then Throw New Exception("Unreadable edge")
    Return Curve
  End Function
  Public Function GetStartVertex() As Object
    Return StartVertex
  End Function
  Public Function GetEndVertex() As Object
    Return EndVertex
  End Function
  Public Function GetTwoAdjacentFaces2() As Object
    Return Adjacent
  End Function
  Public Function Select4(append As Boolean, data As Object) As Boolean
    If Not append Then Tests.Selected.Clear()
    Mark = data.Mark
    Tests.Selected.Add(Me)
    Return True
  End Function
End Class
Public Class TestExtension
  Public References As New Dictionary(Of String, Object)
  Public Function GetPersistReference3(entity As Object) As Object
    If TypeOf entity Is TestFace Then Return "face"
    References(entity.Id) = entity
    Return entity.Id
  End Function
  Public Function GetObjectByPersistReference3(reference As Object, ByRef errorCode As Integer) As Object
    errorCode = 1
    If Not References.ContainsKey(CStr(reference)) Then Return Nothing
    errorCode = 0
    Return References(CStr(reference))
  End Function
End Class
Public Class TestFeature
  Public Name As String
End Class
Public Class TestFeatureManager
  Public Part As TestPart
  Public LastOptions As Integer, LastMark As Integer
  Public LastSize As Double, LastAngle As Double
  Public FailAll As Boolean, FailBatch As Boolean, ChangeFaceAfterSuccess As Boolean
  Public Attempts As New List(Of String)
  Public Function InsertFeatureChamfer(options As Integer, kind As Integer, width As Double, angle As Double,
      other As Double, d1 As Double, d2 As Double, d3 As Double) As Object
    If kind <> 1 Then Throw New Exception("Chamfer type")
    LastAngle = angle
    Return MakeFeature(options, width)
  End Function
  Public Function FeatureFillet3(ParamArray values() As Object) As Object
    If values.Length <> 14 Then Throw New Exception("Fillet arity")
    Return MakeFeature(CInt(values(0)), CDbl(values(1)))
  End Function
  Private Function MakeFeature(options As Integer, size As Double) As Object
    LastOptions = options : LastSize = size
    If Tests.Selected.Count = 0 Then Throw New Exception("No selected edges")
    LastMark = Tests.Selected(0).Mark
    For Each edge In Tests.Selected
      Attempts.Add(edge.Id)
    Next
    If FailAll OrElse (FailBatch AndAlso Tests.Selected.Count > 1) Then Return Nothing
    If ChangeFaceAfterSuccess Then Part.Face.Loops = Nothing
    Return New TestFeature
  End Function
End Class
Public Class TestPart
  Public TestName As String = "test.SLDPRT"
  Public SelectionManager As New TestSelections
  Public Extension As New TestExtension
  Public FeatureManager As New TestFeatureManager
  Public Face As New TestFace
  Public EdgeA As New TestEdge With {.Id = "A"}
  Public EdgeB As New TestEdge With {.Id = "B"}
  Public UnselectedEdge As New TestEdge With {.Id = "UNSELECTED"}
  Public CornerEdges As TestEdge()
  Public Dirty As Boolean, DirtyKnown As Boolean = True
  Public FailConfig As Boolean, FailActivation As Boolean
  Public Activations As Integer, Restorations As Integer
  Public Sub New()
    FeatureManager.Part = Me
    Dim rim As New TestEdge With {.Id = "RIM", .EndVertex = New TestVertex With {.Point = New Double() {0.1, 0, 0}}}
    Face.Edges = New Object() {rim}
    EdgeA.StartVertex.Edges = New Object() {rim, EdgeA, EdgeA}
    EdgeB.StartVertex.Edges = New Object() {rim, EdgeB}
    Face.Loops = New Object() {New TestLoop With {.Vertices = New Object() {EdgeA.StartVertex, EdgeB.StartVertex}}}
  End Sub
  Public Function GetDocumentType() As Integer
    Return 1
  End Function
  Public Function GetTitle() As String
    Return TestName
  End Function
  Public Sub ClearSelection2(all As Boolean)
    Tests.Selected.Clear()
  End Sub
  Public Sub EditRebuild3()
  End Sub
End Class
`, "utf8");
const compiler = path.join(process.env.WINDIR || "C:\\Windows", "Microsoft.NET", "Framework64", "v4.0.30319", "vbc.exe");
for (const [command, args] of [[compiler, ["/nologo", "/nowarn:42353,42030", "/target:exe", `/out:${output}`, input]], [output, []]]) {
  const result = spawnSync(command, args, { encoding: "utf8", windowsHide: true, timeout: 30000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  if (result.stdout.trim()) console.log(result.stdout.trim());
}
