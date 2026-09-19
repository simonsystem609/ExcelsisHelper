"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
function procedure(source, name) {
  const found = source.match(new RegExp(`^(?:(?:Public|Private) )?(?:Function|Sub) ${name}\\([\\s\\S]*?^End (?:Function|Sub)`, "mi"));
  assert.ok(found, name);
  return found[0];
}
const names = [
  "AskDxfRunOptions", "AskExportMode", "AskImportedFilter", "AskAssemblyExportMethod", "AskPrecutSettings", "DxfStopRequested",
  "ProcessSinglePart", "ProcessSelectedComponents", "SnapshotSelectedComponents", "SnapshotAssemblyPartInstances",
  "ProcessFullAssembly", "ProcessFullAssemblyInContext", "ProcessAssemblyCandidateSnapshot", "ExportAssemblyCandidate",
  "ExportSelectedSubassemblyParts", "ExportSelectedSubassembliesInContext", "ProcessSelectedSubassemblyContext",
  "CollectSelectedSubassemblyParts", "AddSelectedSubassemblyContext", "IsPartPath", "IsAssemblyPath",
  "OpenPartForExport", "CloseCandidateDocument", "CloseExplicitlyOpenedPartDocs", "TrackCandidateDocument", "PreserveCandidateDocument",
  "RememberOriginalConfiguration", "RestoreOriginalConfigurations", "ActivateConfigurationChecked", "ShouldRejectImportedCandidate",
  "CloseTemporaryExportDocument", "VerifyTemporaryPartClosed",
  "AskDxfOutputOptions", "DxfOwnerIdentity", "DxfCandidateScopeKey", "NormalizeVisiblePartScopes",
  "DxfPartNameKey", "DxfIdentityTag", "CleanFileName", "CandidatePreflightAllows", "BodiesMayBeSheetLike",
  "DxfAssemblyFolderStem", "RegisterDxfNameOwner", "BuildDxfNameInventory", "CandidateExportFolder", "KeepExistingDxf", "ClaimDxfOutput",
];
function adapt(source) {
  return source.replace(/\s+_\r?\n\s*/g, " ")
    .replace(/\bSet\s+(?=[A-Za-z])/g, "")
    .replace(/\bVariant\b/g, "Object").replace(/\bEmpty\b/g, "Nothing")
    .replace(/\bVbMsgBoxResult\b/g, "MsgBoxResult")
    .replace(/\b(LCase|Trim|Replace|Mid|Left|Right)\$/g, "$1")
    .replace(/\bArray\(((?:[^()\r\n]|\([^()\r\n]*\))*)\)/g, "New Object() {$1}")
    .replace(/\bDebug\.Print\b/g, "TraceRun")
    // Fake CAD objects expose the COM GetType value without .NET Object.GetType.
    .replace(/\.GetType\b/g, ".DocType")
    .replace(/^([ \t]*)(MsgBox|\w+\.ForceRebuild3) (.+)$/gm, "$1$2($3)")
    .replace(/^([ \t]*)RegisterDxfNameOwner (.+)$/gm, "$1RegisterDxfNameOwner($2)")
    .replace(/\bThen (\w+\.(?:Add|Remove|CloseDoc)|Err\.Raise|TraceRun|ActivateConfigurationChecked|ActivateModelDocument) (.+)$/gm, "Then $1($2)")
    .replace(/^([ \t]*)(\w+\.(?:Add|Remove|CloseDoc|QuitDoc)|Err\.Raise|TraceRun|DxfGetWindowThreadProcessId|PreserveCandidateDocument|TrackCandidateDocument|BeginDxfCandidate|FinishDxfCandidate|RememberOriginalConfiguration|RebuildDocumentIfNeeded|ResolveSelectedPartIfLightweight|ActivateModelDocument|ProcessFullAssemblyInContext|ProcessAssemblyCandidateSnapshot|ExportSelectedSubassemblyParts|CollectSelectedSubassemblyParts|AddSelectedSubassemblyContext|ExportSelectedSubassembliesInContext|ProcessSelectedSubassemblyContext) (.+)$/gm, "$1$2($3)")
    .replace(/^(Function|Sub) ([\s\S]*?)(?=\)\s*(?:As \w+)?\s*\r?\n)/gm, (declaration) =>
      declaration.replace(/([,(]\s*)(?!ByVal\b|ByRef\b|Optional\b)(\w+(?:\(\))? As \w+)/g, "$1ByRef $2"));
}

for (const file of ["DXF_v16.swb", "DXF_v16_ROfriendy.swb"]) {
  const source = fs.readFileSync(path.join(root, "macros", file), "utf8");
  const main = procedure(source, "ExcelsisMacroMain");
  assert.equal((main.match(/AskDxfRunOptions\(/g) || []).length, 1);
  assert.doesNotMatch(source, /ExcelsisTaskDialog|AskFullAssemblyImportedFilter|ClosePartOpenedForCandidate/);
  assert.doesNotMatch(procedure(source, "RememberOriginalConfiguration"), /Array\(swModel/);
  for (const route of ["ProcessSelectedComponents", "ProcessAssemblyCandidateSnapshot", "ExportSelectedSubassemblyParts"]) {
    assert.match(procedure(source, route), /ExportAssemblyCandidate\(/);
    assert.match(procedure(source, route), /DxfStopRequested\(\)/);
  }
  assert.match(procedure(source, "ProcessSelectedSubassemblyContext"), /CloseCandidateDocument\(/);
  assert.match(procedure(source, "ExportAssemblyComponentViaTemporaryPart"), /Set swTempPart = newPartResult/);
  assert.match(procedure(source, "ExportAssemblyComponentViaTemporaryPart"), /CloseTemporaryExportDocument\(/);
  const tempClose = procedure(source, "CloseTemporaryExportDocument");
  assert.ok(tempClose.indexOf("swApp.CloseDoc") < tempClose.indexOf("VerifyTemporaryPartClosed("));
  assert.match(procedure(source, "main"), /If g_userCancelled Then\s+WriteDxfRunResult "CANCELLED"/);
  const runner = procedure(source, "ExportAssemblyCandidate");
  assert.ok(runner.indexOf("CandidatePreflightAllows(") < runner.indexOf("OpenPartForExport("));
  assert.match(runner, /openedPath = CStr\(swPart.GetPathName\)/);
  for (const name of ["ExportOnePart", "ExportOnePartInAssemblyContext"]) {
    const exporter = procedure(source, name);
    assert.match(exporter, /KeepExistingDxf\(outPath\)/);
    const exportCalls = name === "ExportOnePart"
      ? ["ok = ExportNormalViewToDxf", "ok = ExportSMFlatPattern", "ok = ExportThinSolidRegularDxf", "ok = ExportPartPrecut"]
      : ["ok = ExportAssemblyContextThinSolidDxf"];
    for (const call of exportCalls) assert.ok(exporter.indexOf("KeepExistingDxf(outPath)") < exporter.indexOf(call));
  }
  if (process.platform !== "win32") continue;

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "excelsis-dxf-lifecycle-"));
  const input = path.join(dir, "lifecycle.vb");
  fs.writeFileSync(path.join(dir, "existing.dxf"), "existing export must not change");
  fs.writeFileSync(path.join(dir, "empty.dxf"), "");
  const output = path.join(dir, "lifecycle.exe");
  const compiler = path.join(process.env.WINDIR || "C:\\Windows", "Microsoft.NET", "Framework64", "v4.0.30319", "vbc.exe");
  // Only language syntax is adapted. Documents, prompts and keys are in-memory
  // doubles: no SOLIDWORKS attachment, native hotkeys or production file writes.
  fs.writeFileSync(input, `Option Strict Off
Imports System
Imports Microsoft.VisualBasic
Module Lifecycle
Public swApp As TestApp
Dim g_generalImportedFilter As Boolean, g_userCancelled As Boolean
Dim g_traceComponent As String, g_stopBatchReason As String, g_importHint As String
Dim g_importUnknown As Boolean, g_importComponent As Object
Dim g_initiallyVisibleDocuments As Object, g_candidateOwnership As Object, g_originalConfigurations As Object
Dim g_preflightToolbox As Object, g_preflightRejected As Object, g_partNameOwners As Object, g_folderNameOwners As Object, g_outputOwners As Object
Dim g_candidateResults As Object, g_candidateKey As String = "", g_existingCount As Long
Dim g_missingOnly As Boolean, g_assemblyFolders As Boolean, g_candidateExisting As Boolean, g_forceIdentityTags As Boolean
Dim g_runRootPath As String, g_runRootConfiguration As String
Dim g_precutOffset_mm As Double, g_precutKeepFeats As Boolean
Public exports As Collections.Generic.List(Of String)
Public traces As Collections.Generic.List(Of String)
Public stopAfter As Integer, pressed As Boolean, controlDown As Boolean, foregroundPid As Long = 99
Public windowsReadable As Boolean = True
Public lastFace As Object, contextCalls As Integer
Public modeAnswer As MsgBoxResult, importAnswer As MsgBoxResult, methodAnswer As MsgBoxResult
Public promptTitles As Collections.Generic.List(Of String)
Public exportedFolders As Collections.Generic.List(Of String)
Public groupAnswer As MsgBoxResult
Const swDocPART As Long = 1, swDocASSEMBLY As Long = 2
Const MODE_REGULAR As Integer = 1, MODE_PRECUT As Integer = 2
Const ASSEMBLY_EXPORT_REGULAR As Integer = 1, ASSEMBLY_EXPORT_CONTEXT As Integer = 2
Const swOpenDocOptions_Silent As Long = 1, swOpenDocOptions_ReadOnly As Long = 2
Const swSolidBody As Integer = 0, THICKNESS_LIMIT As Double = 20.1, THIN_PLATE_MIN_RATIO As Double = 2
Function Dict() As Object
  Return CreateObject("Scripting.Dictionary")
End Function
Sub Check(ok As Boolean, label As String)
  If Not ok Then Throw New Exception(label & Environment.NewLine & String.Join(Environment.NewLine, traces.ToArray()))
End Sub
Sub TraceRun(message As String)
  traces.Add(message)
End Sub
Function DiagnosticLineValue(value As String) As String
  Return value
End Function
Function TraceFileLabel(value As String) As String
  Return IO.Path.GetFileName(value)
End Function
Function IsEmpty(value As Object) As Boolean
  Return value Is Nothing
End Function
Function IsArray(value As Object) As Boolean
  Return TypeOf value Is Array
End Function
Function MsgBox(prompt As Object, Optional style As MsgBoxStyle = 0, Optional title As Object = Nothing) As MsgBoxResult
  promptTitles.Add(CStr(title))
  Select Case CStr(title)
    Case "Export type" : Return modeAnswer
    Case "Imported parts filter" : Return importAnswer
    Case "Assembly DXF method" : Return methodAnswer
    Case "Crude precut" : Return vbYes
    Case "Existing DXFs" : Return vbYes
    Case "DXF folder layout" : Return groupAnswer
  End Select
  Throw New Exception("unexpected prompt")
End Function
Function InputBox(prompt As String, title As String, value As String) As String
  Return "20"
End Function
Function DxfGetAsyncKeyState(key As Long) As Integer
  If key = &H11 Then Return If(controlDown, -32768, 0)
  Return If(pressed, -32768, 0)
End Function
Function DxfGetForegroundWindow() As Long
  Return 1
End Function
Function DxfGetWindowThreadProcessId(hwnd As Long, ByRef pid As Long) As Long
  pid = foregroundPid : Return 1
End Function
Function ExcelsisGetCurrentProcessId() As Long
  Return 99
End Function
Sub DoEvents()
End Sub
Sub BeginDxfCandidate(file As String, cfg As String, route As String)
  g_importHint = ""
End Sub
Sub FinishDxfCandidate(ok As Boolean)
End Sub
Sub RebuildDocumentIfNeeded(model As Object)
End Sub
Sub ResolveSelectedPartIfLightweight(comp As Object)
End Sub
Function IsComponentHiddenSafe(comp As Object) As Boolean
  Return comp.Hidden
End Function
Function IsComponentActuallySuppressedSafe(comp As Object) As Boolean
  Return comp.Suppressed
End Function
Function ComponentHasExcludedAssemblyAncestor(comp As Object, a As Boolean, b As Boolean) As Boolean
  Return comp.ExcludedParent
End Function
Function IsComponentLightweightSafe(comp As Object) As Boolean
  Return False
End Function
Function ComponentBodiesMayBeSheetLike(comp As Object) As Boolean
  Return BodiesMayBeSheetLike(comp.Model.GetBodies2(0, False))
End Function
Function GetBodiesPlateDimensions(bodies As Object, ByRef t As Double, ByRef w As Double, ByRef length As Double) As Boolean
  Dim body As TestBody = bodies(0)
  t = body.Thickness : w = body.Width : length = body.Length
  Return body.Readable
End Function
Function EnsureSubFolder(folder As String, name As String) As String
  Return folder & name & "\\"
End Function
Function IsPlanarFace(item As Object) As Boolean
  Return TypeOf item Is TestFace
End Function
Function IsImportedGeometryPart(model As Object) As Boolean
  Return model.Imported
End Function
Function IsImportedAssemblyComponent(comp As Object) As Boolean
  Return comp.Imported
End Function
Function GetActiveConfigName(model As Object) As String
  Return model.Config
End Function
Function GetDocumentActivationName(model As Object) As String
  Return model.GetTitle()
End Function
Function GetDocumentWindowKey(model As Object) As String
  Return "path|" & CStr(model.DocType) & "|" & LCase(model.FilePath)
End Function
Function VisibleDocumentSnapshotContains(entries As Object, model As Object) As Boolean
  If entries Is Nothing Or model Is Nothing Then Return False
  Return entries.Exists(GetDocumentWindowKey(model))
End Function
Function GetModelWindowDocuments(ByRef ok As Boolean) As Collection
  ok = windowsReadable
  If Not ok Then Return Nothing
  Dim result As New Collection
  For Each model As TestDoc In swApp.Docs.Items
    If model.WindowOpen Then result.Add(model)
  Next
  Return result
End Function
Function ActivateModelDocument(model As Object) As Boolean
  If model Is Nothing Then Return False
  model.WindowOpen = True : swApp.ActiveDoc = model : swApp.Measure()
  Return True
End Function
Function BuildVisibleSubassemblyPartCandidates(model As Object, file As String, cfg As String) As Object
  Dim result As Object = Dict()
  Dim child As TestDoc = swApp.Docs(LCase(file))
  For Each comp As TestComponent In child.Components
    If Not comp.Hidden Then
      Dim key = DxfCandidateScopeKey(comp.FilePath, comp.ReferencedConfiguration, comp, model, True)
      If result.Exists(key) Then
        Dim entry As Object = result(key) : entry(2) = CLng(entry(2)) + 1 : result(key) = entry
      Else
        result.Add(key, New Object() {comp.FilePath, comp.ReferencedConfiguration, 1, If(comp.Imported, "source.step", ""), comp})
      End If
    End If
  Next
  Return result
End Function
Function ExportOnePart(model As Object, file As String, cfg As String, qty As Long, folder As String, mode As Integer, face As Object) As Boolean
  Check(model.Config = cfg, "wrong export configuration")
  If model.Toolbox Or ShouldRejectImportedCandidate(model, model.Washer) Then Return False
  ActivateModelDocument(model)
  lastFace = face
  If model.ExportError Then Throw New Exception("export failed")
  exports.Add(file & "@" & cfg & ":" & CStr(mode))
  exportedFolders.Add(folder & ":" & CStr(qty))
  model.Dirty = True
  If model.BreakRestore Then model.FailConfig = "ORIGINAL"
  If stopAfter > 0 And exports.Count >= stopAfter Then pressed = True
  Return True
End Function
Function ExportOnePartInAssemblyContext(model As Object, comp As Object, part As Object, file As String, cfg As String, qty As Long, folder As String, face As Object) As Boolean
  contextCalls += 1
  If Not ActivateConfigurationChecked(part, cfg) Then Return False
  Return ExportOnePart(part, file, cfg, qty, folder, MODE_REGULAR, face)
End Function
${names.map((n) => adapt(procedure(source, n))).join("\n")}
Function ResetFixture() As TestDoc
  swApp = New TestApp : exports = New Collections.Generic.List(Of String) : traces = New Collections.Generic.List(Of String)
  promptTitles = New Collections.Generic.List(Of String)
  g_initiallyVisibleDocuments = Dict() : g_candidateOwnership = Dict() : g_originalConfigurations = Dict()
  g_preflightToolbox = Dict() : g_preflightRejected = Dict() : g_partNameOwners = Dict() : g_folderNameOwners = Dict() : g_outputOwners = Dict() : g_candidateResults = Dict()
  g_candidateKey = "" : g_existingCount = 0 : g_missingOnly = True : g_assemblyFolders = False : g_candidateExisting = False : g_forceIdentityTags = False
  exportedFolders = New Collections.Generic.List(Of String) : groupAnswer = vbNo
  g_stopBatchReason = "" : g_userCancelled = False : g_importHint = "" : g_importComponent = Nothing
  g_generalImportedFilter = False : stopAfter = 0 : pressed = False : controlDown = False : foregroundPid = 99 : windowsReadable = True
  contextCalls = 0 : lastFace = Nothing : modeAnswer = vbYes : importAnswer = vbNo : methodAnswer = vbNo
  Dim model As New TestDoc With {.FilePath = "C:\\fixture\\root.SLDASM", .DocType = 2, .Loaded = True, .WindowOpen = True}
  swApp.Docs.Add(LCase(model.FilePath), model) : swApp.ActiveDoc = model
  g_runRootPath = model.FilePath : g_runRootConfiguration = model.Config
  g_initiallyVisibleDocuments.Add(GetDocumentWindowKey(model), True)
  Return model
End Function
Function Part(name As String, Optional loaded As Boolean = False) As TestDoc
  Dim model As New TestDoc With {.FilePath = "C:\\fixture\\" & name & ".SLDPRT", .Loaded = loaded, .Referenced = loaded}
  swApp.Docs.Add(LCase(model.FilePath), model)
  Return model
End Function
Function Component(model As TestDoc, Optional cfg As String = "A") As TestComponent
  Return New TestComponent With {.FilePath = model.FilePath, .ReferencedConfiguration = cfg, .Model = model}
End Function
Sub Main()
  For Each kind In New String() {"single", "face", "selected", "selected-face", "subassembly", "full"}
    For Each method In New Integer() {1, 2, 3}
      If kind = "full" And method = 3 Then Continue For
      For Each strict As Boolean In New Boolean() {False, True}
        Dim model = ResetFixture(), target = Part("target", True)
        target.Imported = True : target.Washer = False
        Dim comp = Component(target), selected As New Collection, face As New TestFace With {.Owner = comp}
        Dim count As Long = If(kind = "full" Or kind = "single", 0, 1)
        Dim docType As Long = If(kind = "single" Or kind = "face", 1, 2)
        If docType = 1 Then
          target.WindowOpen = True : swApp.ActiveDoc = target
          g_initiallyVisibleDocuments.Add(GetDocumentWindowKey(target), True)
        End If
        model.Components = New Object() {comp}
        Dim selectedObject As Object = If(kind = "selected-face", DirectCast(face, Object), comp)
        Dim subDoc As TestDoc = Nothing
        If kind = "subassembly" Then
          subDoc = New TestDoc With {.FilePath = "C:\\fixture\\child.SLDASM", .DocType = 2, .Loaded = True, .Referenced = True, .Components = New Object() {comp}}
          swApp.Docs.Add(LCase(subDoc.FilePath), subDoc)
          selectedObject = Component(subDoc)
          model.Components = New Object() {selectedObject, comp}
        End If
        If docType = 2 And count > 0 Then selected = SnapshotSelectedComponents(model, New TestSelection With {.Items = New Object() {selectedObject}}, 1)
        modeAnswer = If(method = 3, vbNo, vbYes) : methodAnswer = If(method = 2, vbYes, vbNo) : importAnswer = If(strict, vbYes, vbNo)
        Dim mode As Integer, asmMethod As Integer
        Check(AskDxfRunOptions(docType, count, mode, asmMethod), "route options accepted")
        Check(promptTitles.FindAll(Function(t) t = "Imported parts filter").Count = 1, "every route must ask import scope exactly once")
        Check(g_generalImportedFilter = strict, "chosen import scope retained")
        Dim done As Object = Dict(), opened As Object = Dict(), qty As Object = Dict()
        qty.Add(LCase(target.FilePath) & "@A", 1)
        Select Case kind
          Case "single", "face"
            ProcessSinglePart(target, target.FilePath, "A", 1, "C:\\out\\", mode, done, If(kind = "face", face, Nothing))
          Case "full"
            ProcessFullAssembly(model, "C:\\out\\", asmMethod, done, opened)
          Case Else
            ProcessSelectedComponents(model, selected, "C:\\out\\", mode, asmMethod, qty, done, opened)
        End Select
        Check(exports.Count = If(strict, 0, 1), "import scope enforced for " & kind & "/" & method)
        Check(g_stopBatchReason = "", "route cleanup unexpectedly stopped")
        Check(opened.Count = 0, "route leaves no owned document pending")
        If docType = 2 Then Check(Not target.WindowOpen, "batch part window closed, even when preloaded")
        If subDoc IsNot Nothing Then Check(Not subDoc.WindowOpen, "selected subassembly window closed")
        Check(model.WindowOpen, "original assembly preserved")
        If kind = "selected-face" And method = 2 And Not strict Then Check(lastFace Is face, "selected context face preserved")
        If docType = 2 Then Check(target.Config = "ORIGINAL", "candidate configuration restored")
      Next
    Next
  Next
  Dim root = ResetFixture(), p = Part("batch", True), a = Component(p), b = Component(p, "B")
  Dim doneBatch As Object = Dict(), openedBatch As Object = Dict()
  For i As Integer = 1 To 120
    Check(ExportAssemblyCandidate(root, a, p.FilePath, "A", 1, "C:\\out\\", False, openedBatch), "long batch candidate")
    Check(Not p.WindowOpen And openedBatch.Count = 0, "every candidate releases its window")
    Check(g_originalConfigurations.Count = 0, "closed candidate retains no document/configuration entries")
  Next
  Check(swApp.PeakWindows <= 2, "120 candidates cannot accumulate 120 windows")
  Check(swApp.CloseCalls.Count = 120 And p.Loaded, "preloaded referenced data retained while UI resources close")
  root = ResetFixture() : p = Part("new") : a = Component(p) : openedBatch = Dict()
  Check(ExportAssemblyCandidate(root, a, p.FilePath, "A", 1, "C:\\out\\", False, openedBatch), "new document export")
  Check(Not p.Loaded And Not p.WindowOpen, "new unreferenced document unloaded")
  Check(swApp.LastOpenOptions = ${file.includes("ROfriendy") ? 3 : 1}, "variant read-only option retained")
  For Each dirty As Boolean In New Boolean() {False, True}
    root = ResetFixture() : p = Part("protected", True) : a = Component(p) : openedBatch = Dict()
    p.Dirty = dirty : p.WindowOpen = Not dirty
    If p.WindowOpen Then g_initiallyVisibleDocuments.Add(GetDocumentWindowKey(p), True)
    Check(ExportAssemblyCandidate(root, a, p.FilePath, "A", 1, "C:\\out\\", False, openedBatch), "protected document export")
    Check(p.WindowOpen And swApp.CloseCalls.Count = 0, "pre-existing window or unsaved document is not closed")
  Next
  For Each failure In New String() {"export", "configuration", "close", "restore"}
    root = ResetFixture() : p = Part("failure", True) : a = Component(p) : openedBatch = Dict()
    p.ExportError = failure = "export" : p.IgnoreClose = failure = "close" : p.BreakRestore = failure = "restore"
    If failure = "configuration" Then p.FailConfig = "A"
    Check(Not ExportAssemblyCandidate(root, a, p.FilePath, "A", 1, "C:\\out\\", False, openedBatch), "failed candidate must not report success")
    If failure = "close" Or failure = "restore" Then
      Check(g_stopBatchReason <> "" And p.WindowOpen, "unsafe cleanup stops batch and leaves document available")
      Dim priorCount = exports.Count
      Check(Not ExportAssemblyCandidate(root, a, p.FilePath, "A", 1, "C:\\out\\", False, openedBatch), "unsafe cleanup blocks subsequent candidates")
      Check(exports.Count = priorCount, "no new exports after cleanup failure")
    Else
      Check(Not p.WindowOpen And openedBatch.Count = 0, "failure still closes owned part")
    End If
  Next
  root = ResetFixture() : p = Part("stop", True) : a = Component(p) : b = Component(p, "B")
  root.Components = New Object() {a, b} : doneBatch = Dict() : openedBatch = Dict() : stopAfter = 1
  ProcessFullAssembly(root, "C:\\out\\", 1, doneBatch, openedBatch)
  Check(g_userCancelled And exports.Count = 1 And Not p.WindowOpen, "Alt+S stops after first export and closes it")
  pressed = False : Check(DxfStopRequested(), "stop remains latched after keys released")
  ResetFixture() : pressed = True : foregroundPid = 100
  Check(Not DxfStopRequested(), "shortcut in another application does not stop macro")
  foregroundPid = 99 : controlDown = True
  Check(Not DxfStopRequested(), "Ctrl+Alt+S is not Alt+S")
  controlDown = False : Check(DxfStopRequested(), "Alt+S in SOLIDWORKS is recognized")
  ResetFixture() : importAnswer = vbCancel
  Dim cancelledMode As Integer, cancelledMethod As Integer
  Check(Not AskDxfRunOptions(1, 0, cancelledMode, cancelledMethod), "filter cancel aborts before export")
  Check(promptTitles.Count = 2, "no later dialogs after import cancel")
  ResetFixture() : p = Part("temp") : p.WindowOpen = True
  Check(Not VerifyTemporaryPartClosed(p.FilePath, p.GetTitle()) And g_stopBatchReason <> "", "leftover temporary window stops batch")
  For Each unsaved As Boolean In New Boolean() {False, True}
    root = ResetFixture() : p = Part("temp", True) : p.Referenced = False : p.WindowOpen = True : swApp.IgnoreQuit = True
    Dim intendedPath = p.FilePath
    If unsaved Then p.FilePath = ""
    Check(CloseTemporaryExportDocument(intendedPath, p.GetTitle()), "temporary CloseDoc fallback works after QuitDoc failure")
    Check(Not p.WindowOpen And Not p.Loaded And root.WindowOpen, "only temporary document is closed")
    root = ResetFixture() : p = Part("temp", True) : p.WindowOpen = True : p.IgnoreClose = True
    intendedPath = p.FilePath
    If unsaved Then p.FilePath = ""
    Check(Not CloseTemporaryExportDocument(intendedPath, p.GetTitle()), "unclosed temporary document fails verification even after failed save")
    Check(g_stopBatchReason <> "" And root.WindowOpen, "temporary closure failure stops batch without closing root")
  Next
  For Each reason In New String() {"toolbox", "solid-section"}
    root = ResetFixture() : p = Part("preflight", True) : p.Config = "A" : a = Component(p) : b = Component(p)
    p.Toolbox = reason = "toolbox"
    If reason = "solid-section" Then p.Body.Thickness = 40 : p.Body.Width = 40 : p.Body.Length = 600
    root.Components = New Object() {a, b} : doneBatch = Dict() : openedBatch = Dict()
    ProcessFullAssembly(root, "C:\\out\\", 1, doneBatch, openedBatch)
    Check(exports.Count = 0 And swApp.LastOpenOptions = 0 And swApp.PeakWindows <= 1 And Not p.WindowOpen, "known " & reason & " never opened/activated")
    Check(traces.Exists(Function(t) t.Contains("preflight reject=")), "early rejection is diagnosed")
  Next
  For Each exception In New String() {"sheetmetal", "unknown", "other-configuration", "selected-face", "precut"}
    root = ResetFixture() : p = Part("defer", True) : p.Config = "A" : a = Component(p) : openedBatch = Dict()
    p.Body.Thickness = 40 : p.Body.Width = 40 : p.Body.Length = 600
    p.Body.IsSheetMetal = exception = "sheetmetal" : p.Body.Readable = exception <> "unknown"
    If exception = "other-configuration" Then p.Config = "OTHER"
    Dim preferred As Object = If(exception = "selected-face", New TestFace With {.Owner = a}, Nothing)
    Check(ExportAssemblyCandidate(root, a, p.FilePath, "A", 1, "C:\\out\\", exception = "selected-face", openedBatch, If(exception = "precut", 2, 1), preferred), "early filter must preserve " & exception)
    Check(exports.Count = 1, "uncertain/explicit exception reaches normal exporter")
  Next
  For Each group As Boolean In New Boolean() {False, True}
    For Each route In New String() {"full", "selected", "subassembly", "subassembly-context"}
      root = ResetFixture() : p = Part("shared", True)
      Dim parentA As New TestComponent With {.FilePath = "C:\\fixture\\unitA.SLDASM", .ReferencedConfiguration = "Default"}
      Dim parentB As New TestComponent With {.FilePath = "C:\\fixture\\unitB.SLDASM", .ReferencedConfiguration = "Default"}
      a = Component(p) : a.Parent = parentA : b = Component(p) : b.Parent = parentA
      Dim c = Component(p) : c.Parent = parentB
      root.Components = New Object() {a, b, c}
      Dim subDoc As New TestDoc With {.FilePath = "C:\\fixture\\scope.SLDASM", .DocType = 2, .Loaded = True, .Referenced = True, .Components = root.Components}
      swApp.Docs.Add(LCase(subDoc.FilePath), subDoc)
      Dim selected As Collection
      If route.StartsWith("subassembly") Then
        selected = SnapshotSelectedComponents(root, New TestSelection With {.Items = New Object() {Component(subDoc)}}, 1)
      Else
        selected = SnapshotSelectedComponents(root, New TestSelection With {.Items = root.Components}, 3)
      End If
      groupAnswer = If(group, vbYes, vbNo)
      Check(AskDxfOutputOptions(2), "output options accepted")
      Check(g_assemblyFolders = group And g_missingOnly, "layout and missing-only defaults")
      BuildDxfNameInventory(root)
      doneBatch = Dict() : openedBatch = Dict()
      If route = "full" Then
        ProcessFullAssembly(root, "C:\\out\\", 1, doneBatch, openedBatch)
      Else
        Dim counts As Object = Dict()
        For Each comp As TestComponent In root.Components
          Dim key = DxfCandidateScopeKey(comp.FilePath, comp.ReferencedConfiguration, comp, root)
          If counts.Exists(key) Then counts(key) = CLng(counts(key)) + 1 Else counts.Add(key, 1)
        Next
        ProcessSelectedComponents(root, selected, "C:\\out\\", 1, If(route = "subassembly-context", 2, 1), counts, doneBatch, openedBatch)
      End If
      Check(doneBatch.Count = If(group, 2, 1), "shared part dedupes per chosen folder in " & route)
      If group Then
        Check(exportedFolders.Contains("C:\\out\\unita\\:2") And exportedFolders.Contains("C:\\out\\unitb\\:1"), "per-parent occurrence quantities in " & route)
      Else
        Check(exportedFolders.Contains("C:\\out\\:3"), "flat occurrence total in " & route)
      End If
      Check(openedBatch.Count = 0 And Not p.WindowOpen And Not subDoc.WindowOpen, "grouping retains cleanup in " & route)
    Next
  Next
  root = ResetFixture()
  Check(KeepExistingDxf("${path.join(dir, "existing.dxf")}"), "nonempty output is kept")
  Check(g_candidateExisting And g_existingCount = 1, "existing count is separate")
  Check(Not KeepExistingDxf("${path.join(dir, "empty.dxf")}"), "empty output gets retried")
  Check(Not KeepExistingDxf("${path.join(dir, "missing.dxf")}"), "deleted/new output gets exported")
  g_missingOnly = False
  Check(Not KeepExistingDxf("${path.join(dir, "existing.dxf")}"), "regenerate-all bypasses existing detection")
  root = ResetFixture() : p = Part("collision", True) : a = Component(p, "A/B") : b = Component(p, "A:B")
  root.Components = New Object() {a, b}
  BuildDxfNameInventory(root)
  Dim pathA = ClaimDxfOutput("C:\\out\\collision(A_B).dxf", p.FilePath, "A/B")
  Dim pathB = ClaimDxfOutput("C:\\out\\collision(A_B).dxf", p.FilePath, "A:B")
  g_outputOwners = Dict()
  Check(pathB = ClaimDxfOutput("C:\\out\\collision(A_B).dxf", p.FilePath, "A:B"), "collision filename stable when order reverses")
  Check(pathA = ClaimDxfOutput("C:\\out\\collision(A_B).dxf", p.FilePath, "A/B") And pathA <> pathB, "sanitized configurations do not reuse wrong existing output")
  g_assemblyFolders = True
  a.Parent = New TestComponent With {.FilePath = "C:\\one\\unit.SLDASM", .ReferencedConfiguration = "Default"}
  b.Parent = New TestComponent With {.FilePath = "C:\\two\\unit.SLDASM", .ReferencedConfiguration = "Default"}
  BuildDxfNameInventory(root)
  Check(CandidateExportFolder("C:\\out\\", root, a) <> CandidateExportFolder("C:\\out\\", root, b), "same-name assemblies in different directories have different folders")
  Console.WriteLine("DXF option/route matrix, 120-candidate cleanup, failures, protected documents and cancellation passed.")
End Sub
End Module
Class TestApp
  Public Docs As Object = CreateObject("Scripting.Dictionary")
  Public ActiveDoc As TestDoc
  Public CloseCalls As New Collections.Generic.List(Of String)
  Public PeakWindows As Integer, LastOpenOptions As Long
  Public IgnoreQuit As Boolean
  Function GetOpenDocumentByName(file As String) As Object
    For Each model As TestDoc In Docs.Items
      If model.Loaded And (String.Equals(model.FilePath, file, StringComparison.OrdinalIgnoreCase) Or String.Equals(model.GetTitle(), file, StringComparison.OrdinalIgnoreCase)) Then Return model
    Next
    Return Nothing
  End Function
  Function OpenDoc6(file As String, kind As Long, options As Long, cfg As String, ByRef errs As Long, ByRef warns As Long) As Object
    LastOpenOptions = options
    Dim model As TestDoc = Docs(LCase(file))
    model.Loaded = True : model.WindowOpen = True : ActiveDoc = model : Measure()
    Return model
  End Function
  Sub CloseDoc(file As String)
    Lifecycle.Check(file <> "", "never close unnamed active document")
    Dim model As TestDoc = GetOpenDocumentByName(file)
    CloseCalls.Add(file)
    If model Is Nothing Then Return
    If model.IgnoreClose Then Return
    model.WindowOpen = False : model.Loaded = model.Referenced
  End Sub
  Sub QuitDoc(title As String)
    If Not IgnoreQuit Then CloseDoc(title)
  End Sub
  Sub Measure()
    Dim count As Integer
    For Each model As TestDoc In Docs.Items
      If model.WindowOpen Then count += 1
    Next
    PeakWindows = Math.Max(PeakWindows, count)
  End Sub
End Class
Class TestDoc
  Public FilePath As String, DocType As Long = 1, Config As String = "ORIGINAL", FailConfig As String = ""
  Public Loaded As Boolean, Referenced As Boolean, WindowOpen As Boolean, Dirty As Boolean
  Public Imported As Boolean, Washer As Boolean, Toolbox As Boolean, ExportError As Boolean, IgnoreClose As Boolean, BreakRestore As Boolean
  Public Components As Object() = New Object() {}
  Public Body As New TestBody
  ReadOnly Property Extension As TestExtension
    Get
      Return New TestExtension With {.ToolboxPartType = If(Toolbox, 1, 0)}
    End Get
  End Property
  Function GetBodies2(kind As Integer, visible As Boolean) As Object
    Return New Object() {Body}
  End Function
  Function GetPathName() As String
    Return FilePath
  End Function
  Function GetTitle() As String
    If FilePath = "" Then Return "PartTemp"
    Return IO.Path.GetFileName(FilePath)
  End Function
  Function GetSaveFlag() As Boolean
    Return Dirty
  End Function
  Function GetComponents(top As Boolean) As Object
    Return Components
  End Function
  Function ShowConfiguration2(value As String) As Boolean
    If value = FailConfig Then Return False
    Config = value : Return True
  End Function
  Sub EditRebuild3()
  End Sub
  Sub ForceRebuild3(top As Boolean)
  End Sub
End Class
Class TestComponent
  Public FilePath As String, ReferencedConfiguration As String, Name2 As String = "fixture-instance"
  Public Hidden As Boolean, Suppressed As Boolean, ExcludedParent As Boolean, Imported As Boolean
  Public Parent As TestComponent, Model As TestDoc
  Function GetParent() As Object
    Return Parent
  End Function
  Function GetModelDoc2() As Object
    Return If(Model.Loaded, Model, Nothing)
  End Function
  Function GetPathName() As String
    Return FilePath
  End Function
End Class
Class TestExtension
  Public ToolboxPartType As Long
End Class
Class TestBody
  Public Thickness As Double = 3, Width As Double = 100, Length As Double = 200
  Public IsSheetMetal As Boolean, Readable As Boolean = True
End Class
Class TestFace
  Public Owner As TestComponent
  Function GetComponent() As Object
    Return Owner
  End Function
End Class
Class TestSelection
  Public Items As Object()
  Function GetSelectedObjectCount2(mark As Integer) As Long
    Return Items.Length
  End Function
  Function GetSelectedObject6(index As Long, mark As Integer) As Object
    Return Items(index - 1)
  End Function
  Function GetSelectedObjectType3(index As Long, mark As Integer) As Long
    Return If(TypeOf Items(index - 1) Is TestFace, 2, 20)
  End Function
  Function GetSelectedObjectsComponent4(index As Long, mark As Integer) As Object
    If TypeOf Items(index - 1) Is TestFace Then Return Items(index - 1).GetComponent()
    Return Items(index - 1)
  End Function
End Class
`, "utf8");
  const compiled = spawnSync(compiler, ["/nologo", "/quiet", "/optionstrict-", `/out:${output}`, input], { encoding: "utf8", windowsHide: true, timeout: 30000 });
  assert.equal(compiled.status, 0, `${file}: ${compiled.stdout}\n${compiled.stderr}`);
  const result = spawnSync(output, [], { encoding: "utf8", windowsHide: true, timeout: 30000 });
  assert.equal(result.status, 0, `${file}: ${result.stdout}\n${result.stderr}`);
  assert.equal(fs.readFileSync(path.join(dir, "existing.dxf"), "utf8"), "existing export must not change");
}
console.log("Both DXF variants: lifecycle, prompt, route and cooperative-stop tests passed (no SOLIDWORKS automation).");
