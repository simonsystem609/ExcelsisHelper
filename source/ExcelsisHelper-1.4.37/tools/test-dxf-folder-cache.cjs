"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {spawnSync} = require("node:child_process");
const root = path.resolve(__dirname, "..");
const names = ["DxfRawFileStamp", "DxfVisibleBodySignature", "GetPartBodies", "DxfGeometryCacheKey", "TryDxfCachedGeometry",
  "StoreDxfCachedGeometry", "ExportThinSolidRegularDxf"];
function procedure(source, name) {
  const match = source.match(new RegExp(`^(?:(?:Private|Public) )?(?:Function|Sub) ${name}\\([\\s\\S]*?^End (?:Function|Sub)`, "mi"));
  assert.ok(match, name);
  return match[0];
}
function adapt(text) {
  return text.replace(/\s+_\r?\n\s*/g, " ")
    .replace(/\bSet\s+(?=[A-Za-z])/g, "").replace(/\bVariant\b/g, "Object")
    .replace(/\bLong\b/g, "Integer").replace(/\b(\d+(?:\.\d+)?)#/g, "$1R")
    .replace(/\b(LCase|Left|Right)\$/g, "$1").replace(/\bStrPtr\((\w+)\)/g, "$1")
    .replace(/\bArray\(((?:[^()\r\n]|\([^()\r\n]*\))*)\)/g, "New Object() {$1}")
    .replace(/\bDebug\.Print /g, "TraceRun ")
    .replace(/\bThen StoreDxfCachedGeometry (.+)$/gm, "Then StoreDxfCachedGeometry($1)")
    .replace(/^([ \t]*)(TraceRun|\w+\.Add) (.+)$/gm, "$1$2($3)");
}
let prior;
for (const file of ["DXF_v16.swb", "DXF_v16_ROfriendy.swb"]) {
  const source = fs.readFileSync(path.join(root, "macros", file), "utf8");
  const code = names.map(name => procedure(source, name)).join("\n");
  if (prior) assert.equal(code, prior);
  prior = code;
  const part = procedure(source, "ExportOnePart");
  assert.equal((part.match(/ExportThinSolidRegularDxf\(/g) || []).length, 1);
  assert.match(part, /ElseIf isSM Then[\s\S]*ExportSMFlatPattern[\s\S]*Else[\s\S]*ExportThinSolidRegularDxf/);
  assert.doesNotMatch(procedure(source, "ExportOnePartInAssemblyContext"), /TryDxfCachedGeometry|ExportThinSolidRegularDxf/);
  assert.match(procedure(source, "DxfGeometryCacheKey"), /GetUpdateStamp/);
  assert.match(procedure(source, "InitializeRunDiagnostics"), /Set g_dxfGeometryCache = Nothing/);
  if (process.platform !== "win32") continue;
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "dxf-folder-cache-"));
  const input = path.join(folder, "test.vb"), output = path.join(folder, "test.exe");
  const type = source.match(/^Private Type DxfFileData[\s\S]*?^End Type/m)[0]
    .replace("Private Type", "<StructLayout(LayoutKind.Sequential)> Private Structure")
    .replace("End Type", "End Structure").replace(/\bLong\b/g, "Integer")
    .replace(/^(\s+)(\w+ As Integer)/gm, "$1Public $2");
  fs.writeFileSync(input, `Option Strict Off
Imports System
Imports System.IO
Imports System.Linq
Imports System.Runtime.InteropServices
Imports Microsoft.VisualBasic
Module CacheChecks
${type}
<DllImport("kernel32.dll", EntryPoint:="GetFileAttributesExW", CharSet:=CharSet.Unicode, SetLastError:=True)>
Private Function DxfGetFileAttributesEx(name As String, level As Integer, ByRef data As DxfFileData) As Integer
End Function
<DllImport("kernel32.dll", EntryPoint:="CopyFileW", CharSet:=CharSet.Unicode, SetLastError:=True)>
Private Function NativeCopy(source As String, destination As String, noReplace As Integer) As Integer
End Function
Dim g_assemblyFolders As Boolean=True, g_outputStageRoot As String=${JSON.stringify(folder)}
Const swSolidBody As Integer=0
Dim g_dxfGeometryCache As Object, g_dxfGeometryCacheBytes As Double, g_dxfGeometryCacheHits As Integer
Dim g_stopBatchReason As String="", exports As Integer, sequence As Integer, failCopy As Boolean, partialCopy As Boolean
Dim traces As New Collections.Generic.List(Of String)
Function DxfCopyFile(source As String, target As String, noReplace As Integer) As Integer
  Check(noReplace=1,"cache copies cannot replace any file")
  If partialCopy Then File.WriteAllText(target,"partial") : Return 0
  If failCopy Then Return 0
  Return NativeCopy(source,target,noReplace)
End Function
Function DxfNativePath(value As String) As String
  Return value
End Function
Function DxfFileBytes(value As String) As Double
  If Not File.Exists(value) Then Return -1
  Return New FileInfo(value).Length
End Function
Function GetActiveConfigName(model As Object) As String
  Return model.Configuration
End Function
Function DxfExportBodyProfiles(model As Object, bodies As Object, preferredFace As Object, target As String) As Boolean
  Check(Not File.Exists(target),"native fallback cannot overwrite a partial or existing stage")
  exports+=1
  File.WriteAllText(target,"native-geometry:" & model.Configuration)
  If model.ChangeDuringExport Then model.Stamp+=1
  Return True
End Function
Sub TraceRun(value As String)
  traces.Add(value)
End Sub
Sub Check(ok As Boolean,label As String)
  If Not ok Then Throw New Exception(label & Environment.NewLine & String.Join(Environment.NewLine,traces))
End Sub
Function Stage() As String
  sequence+=1
  Return Path.Combine(g_outputStageRoot,"stage-" & sequence & ".dxf")
End Function
${adapt(code)}
Sub Main()
  Dim model As New FakeModel()
  model.Source=Path.Combine(g_outputStageRoot,"source.SLDPRT")
  File.WriteAllText(model.Source,"fake saved CAD; no SOLIDWORKS calls")
  Dim first=Stage(), second=Stage()
  Check(ExportThinSolidRegularDxf(model,first),"first folder exports")
  Check(ExportThinSolidRegularDxf(model,second),"second folder exports")
  Check(exports=1 And g_dxfGeometryCacheHits=1,"same source/configuration reuses geometry without native export")
  Check(File.ReadAllBytes(first).SequenceEqual(File.ReadAllBytes(second)),"geometry bytes copied exactly")
  model.Configuration="Alternate"
  Dim other=Stage()
  Check(ExportThinSolidRegularDxf(model,other) And exports=2,"different configurations cannot reuse geometry")
  Check(File.ReadAllText(other).EndsWith("Alternate"),"configuration-specific geometry retained")
  model.Stamp+=1
  other=Stage()
  Check(ExportThinSolidRegularDxf(model,other) And exports=3,"geometry update invalidates cache")
  File.AppendAllText(model.Source," externally changed")
  other=Stage()
  Check(ExportThinSolidRegularDxf(model,other) And exports=4,"saved source changes invalidate cache")
  failCopy=True : other=Stage()
  Check(ExportThinSolidRegularDxf(model,other) And exports=5,"copy failures fall back to native export")
  failCopy=False : partialCopy=True : other=Stage()
  Dim partialStage=other
  Check(ExportThinSolidRegularDxf(model,other) And exports=6,"partial copy falls back to a fresh stage")
  Check(other<>partialStage And File.ReadAllText(partialStage)="partial", "partial stage preserved, never overwritten")
  partialCopy=False
  g_assemblyFolders=False : other=Stage()
  Check(ExportThinSolidRegularDxf(model,other) And exports=7,"flat folder keeps its original export route")
  g_assemblyFolders=True : model.Status=1 : other=Stage()
  Check(ExportThinSolidRegularDxf(model,other) And exports=8,"pending rebuild cannot hit the cache")
  model.Status=0 : model.ThrowStamp=True : other=Stage()
  Check(ExportThinSolidRegularDxf(model,other) And exports=9,"unknown update stamps cannot hit the cache")
  model.ThrowStamp=False : model.ChangeDuringExport=True : g_dxfGeometryCache=Nothing : g_dxfGeometryCacheBytes=0
  other=Stage() : Check(ExportThinSolidRegularDxf(model,other),"changing source still exports normally")
  Check(g_dxfGeometryCache Is Nothing,"a model changed during export is not cached")
  model.ChangeDuringExport=False : g_dxfGeometryCacheBytes=268435456
  other=Stage() : Check(ExportThinSolidRegularDxf(model,other),"cache size limit cannot reject an export")
  Check(g_dxfGeometryCache Is Nothing,"cache size limit respected")
  g_dxfGeometryCacheBytes=0
  model.VisibleBodyName="other-visible-body" : model.Stamp+=1
  other=Stage() : Check(ExportThinSolidRegularDxf(model,other),"new visible-body set exports")
  Dim beforeVisibilityChange=exports
  model.VisibleBodyName="original-visible-body"
  other=Stage() : Check(ExportThinSolidRegularDxf(model,other),"visible-body set changes without model stamp")
  Check(exports=beforeVisibilityChange+1,"visibility changes cannot reuse old geometry even with unchanged update stamp")
  model.FailBodies=True
  Check(DxfGeometryCacheKey(model)="","unknown visible-body set bypasses cache")
  model.FailBodies=False : model.VisibleBodyName=""
  Check(DxfGeometryCacheKey(model)="","unnamed visible-body set bypasses cache")
  Console.WriteLine("PASS folder geometry cache: exact copies, configuration/model/disk guards, unknown/dirty-source bypass, copy failures, partial preservation and size bounds; no SOLIDWORKS calls.")
End Sub
End Module
Class FakeModel
  Public VisibleBodyName As String="original-visible-body", FailBodies As Boolean
  Function GetBodies2(kind As Integer, visibleOnly As Boolean) As Object
    If Not visibleOnly Then Throw New Exception("hidden bodies must never enter geometry cache identity")
    If FailBodies Then Throw New Exception("body list unavailable")
    Return New Object() {New FakeBody With {.Name=VisibleBodyName}}
  End Function
  Public Source As String, Configuration As String="Default", Stamp As Integer=21, Status As Integer
  Public ThrowStamp As Boolean, ChangeDuringExport As Boolean
  ReadOnly Property Extension As Object
    Get
      Return Me
    End Get
  End Property
  ReadOnly Property NeedsRebuild2 As Integer
    Get
      Return Status
    End Get
  End Property
  Function GetPathName() As String
    Return Source
  End Function
  Function GetUpdateStamp() As Integer
    If ThrowStamp Then Throw New Exception("unavailable")
    Return Stamp
  End Function
End Class
Class FakeBody
  Public Name As String
End Class
`);
  const compiler = path.join(process.env.WINDIR, "Microsoft.NET", "Framework", "v4.0.30319", "vbc.exe");
  const build = spawnSync(compiler,["/nologo","/target:exe",`/out:${output}`,input],{encoding:"utf8",windowsHide:true,timeout:15000});
  assert.equal(build.status,0,build.stdout+build.stderr);
  const result = spawnSync(output,[],{encoding:"utf8",windowsHide:true,timeout:15000});
  assert.equal(result.status,0,result.stdout+result.stderr);
  console.log(file+": "+result.stdout.trim());
}
