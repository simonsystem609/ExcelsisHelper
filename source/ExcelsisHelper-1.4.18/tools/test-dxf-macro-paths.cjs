"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const names = [
  "DxfNativePath", "ReadDxfPathInfo", "DxfFileBytes", "DxfFolderExists",
  "DxfExportWorkPath", "DeliverDxfOutput", "VerifyDxfOutput", "KeepExistingDxf",
  "StripTrailingPathSeparator", "EnsureFolderPath", "EnsureSubFolder",
];
function procedure(source, name) {
  const result = source.match(new RegExp("^(?:(?:Private|Public) )?(?:Function|Sub) " + name + "\\([\\s\\S]*?^End (?:Function|Sub)", "mi"));
  assert.ok(result, name);
  return result[0];
}
function adapt(source) {
  return source.replace(/\s+_\r?\n\s*/g, " ")
    .replace(/\bSet\s+(?=[A-Za-z])/g, "")
    .replace(/\bLong\b/g, "Integer")
    .replace(/\b(\d+(?:\.\d+)?)#/g, "$1R")
    .replace(/\b(LCase|Trim|Replace|Mid|Left|Right|Environ)\$/g, "$1")
    // VBA passes StrPtr to LPCWSTR. P/Invoke marshals the same UTF-16 strings.
    .replace(/\bStrPtr\((\w+)\)/g, "$1")
    .replace(/\bThen Err\.Raise (.+)$/gm, "Then Err.Raise($1)")
    .replace(/^([ \t]*)(Err\.Raise|TraceRun|\w+\.CreateFolder) (.+)$/gm, "$1$2($3)");
}
let previous;
for (const file of ["DXF_v16.swb", "DXF_v16_ROfriendy.swb"]) {
  const source = fs.readFileSync(path.join(root, "macros", file), "utf8");
  const code = names.map((name) => procedure(source, name)).join("\n");
  if (previous) assert.equal(code, previous, "Both DXF variants share the file-delivery implementation");
  previous = code;
  const type = source.match(/^Private Type DxfFileData[\s\S]*?^End Type/m)?.[0];
  assert.ok(type);
  assert.equal((type.match(/ As Long/g) || []).length, 9, "WIN32_FILE_ATTRIBUTE_DATA is nine DWORDs");
  for (const api of ["DxfGetFileAttributesEx", "DxfCreateDirectory", "DxfCopyFile", "DxfMoveFile"]) {
    assert.match(source, new RegExp("Declare PtrSafe Function " + api + " .*ByVal \\w+ As LongPtr"));
    assert.match(source, new RegExp("Declare Function " + api + " .*ByVal \\w+ As Long"));
  }
  for (const exporter of ["ExportOnePart", "ExportOnePartInAssemblyContext"]) {
    const body = procedure(source, exporter);
    assert.match(body, /outPath = DxfExportWorkPath\(finalPath\)/);
    assert.match(body, /DeliverDxfOutput\(ok, outPath, finalPath\)/);
    assert.ok(body.indexOf("KeepExistingDxf(outPath)") < body.indexOf("DxfExportWorkPath(finalPath)"));
  }
  assert.match(procedure(source, "InitializeRunDiagnostics"), /g_outputStageRoot = "": g_outputStageSequence = 0/);
  assert.match(procedure(source, "CloseCandidateDocument"), /release-window-snapshot-begin[\s\S]*release-window-snapshot-end[\s\S]*dispatch-events-begin[\s\S]*DoEvents[\s\S]*dispatch-events-end/);
  assert.match(procedure(source, "ExportAssemblyCandidate"), /restore-parent-begin[\s\S]*ActivateModelDocument\(swModel\)[\s\S]*restore-parent-end/);
  if (process.platform !== "win32") continue;

  // Isolated files only. No SOLIDWORKS, mapped drive, UNC share, or live CAD access.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dxf-long-path-test-"));
  const sourceFile = path.join(dir, "source.dxf");
  const sourceBytes = Buffer.from("0\r\nSECTION\r\n2\r\nENTITIES\r\n0\r\nENDSEC\r\n0\r\nEOF\r\n");
  fs.writeFileSync(sourceFile, sourceBytes);
  let longParent = dir;
  for (const name of ["parent-".repeat(15), "assembly-".repeat(12)]) {
    longParent = path.join(longParent, name);
    fs.mkdirSync(longParent);
  }
  const longFolder = path.join(longParent, "subassembly");
  const finalPath = path.join(longFolder, "PLATE16_S235_2db_part_\u00e1\u0151\u0171(configuration).dxf");
  assert.ok(finalPath.length > 300);
  const vb = adapt(code);
  const input = path.join(dir, "test.vb");
  const output = path.join(dir, "test.exe");
  fs.writeFileSync(input, `Option Strict Off
Imports System
Imports System.Runtime.InteropServices
Imports Microsoft.VisualBasic
Module PathChecks
${type.replace("Private Type", "<StructLayout(LayoutKind.Sequential)> Private Structure").replace("End Type", "End Structure").replace(/\bLong\b/g, "Integer").replace(/^(\s+)(\w+ As Integer)/gm, "$1Public $2")}
<DllImport("kernel32.dll", EntryPoint:="GetFileAttributesExW", CharSet:=CharSet.Unicode, SetLastError:=True)>
Private Function NativeInfo(name As String, level As Integer, ByRef data As DxfFileData) As Integer
End Function
<DllImport("kernel32.dll", EntryPoint:="CreateDirectoryW", CharSet:=CharSet.Unicode, SetLastError:=True)>
Private Function DxfCreateDirectory(name As String, security As IntPtr) As Integer
End Function
<DllImport("kernel32.dll", EntryPoint:="CopyFileW", CharSet:=CharSet.Unicode, SetLastError:=True)>
Private Function NativeCopy(source As String, destination As String, failIfExists As Integer) As Integer
End Function
<DllImport("kernel32.dll", EntryPoint:="MoveFileExW", CharSet:=CharSet.Unicode, SetLastError:=True)>
Private Function NativeMove(source As String, destination As String, flags As Integer) As Integer
End Function
<DllImport("kernel32.dll", EntryPoint:="SetLastError", SetLastError:=True)>
Private Sub NativeSetError(value As Integer)
End Sub
Dim g_outputStageRoot As String = "", g_outputStageSequence As Integer
Dim g_missingOnly As Boolean, g_candidateExisting As Boolean, g_existingCount As Integer
Dim copyCalls As Integer, moveCalls As Integer, copyFails As Boolean, moveFails As Boolean, wrongSize As Boolean
Dim infoFails As Boolean, concurrentFile As String = ""
Dim lastPending As String = "", traces As New Collections.Generic.List(Of String)
Private Function DxfGetFileAttributesEx(name As String, level As Integer, ByRef data As DxfFileData) As Integer
  If infoFails Then
    NativeSetError(5) : Return 0
  End If
  Dim result = NativeInfo(name, level, data)
  If result <> 0 AndAlso wrongSize AndAlso name = lastPending Then data.SizeLow = 1
  Return result
End Function
Function DxfCopyFile(source As String, destination As String, failIfExists As Integer) As Integer
  copyCalls += 1 : lastPending = destination
  If copyFails Then
    NativeSetError(5) : Return 0
  End If
  Dim result = NativeCopy(source, destination, failIfExists)
  If result <> 0 AndAlso concurrentFile <> "" Then
    Check(NativeCopy(source, DxfNativePath(concurrentFile), 1) <> 0, "concurrent fixture")
  End If
  Return result
End Function
Function DxfMoveFile(source As String, destination As String, flags As Integer) As Integer
  moveCalls += 1
  If moveFails Then
    NativeSetError(32) : Return 0
  End If
  Return NativeMove(source, destination, flags)
End Function
Function Environ(name As String) As String
  Check(name = "TEMP", "no other environment reads")
  Return "${dir}"
End Function
Function ResolveMappedFolderPath(folder As String) As String
  Return folder
End Function
Function DiagnosticLineValue(value As String) As String
  Return value
End Function
Function TraceFileLabel(value As String) As String
  Return IO.Path.GetFileName(value)
End Function
Sub TraceRun(value As String)
  traces.Add(value)
End Sub
Sub Check(value As Boolean, label As String)
  If Not value Then Throw New Exception(label & Environment.NewLine & String.Join(Environment.NewLine, traces))
End Sub
${vb}
Sub Main()
  Check(Marshal.SizeOf(GetType(DxfFileData)) = 36, "attribute buffer layout")
  Check(DxfNativePath("C:\\folder\\part.dxf") = "\\\\?\\C:\\folder\\part.dxf", "drive path")
  Check(DxfNativePath("\\\\server\\share\\part.dxf") = "\\\\?\\UNC\\server\\share\\part.dxf", "UNC path conversion only")
  Check(DxfNativePath("\\\\?\\UNC\\server\\share\\part.dxf") = "\\\\?\\UNC\\server\\share\\part.dxf", "already extended")
  Dim rejected As Boolean
  Try
    DxfNativePath("relative.dxf")
  Catch
    rejected = True
  End Try
  Check(rejected, "relative paths fail closed")
  Check(DxfExportWorkPath("${dir}\\short.dxf") = "${dir}\\short.dxf", "short path route unchanged")
  Dim folder As String = "${longFolder}"
  Check(EnsureFolderPath(folder), "create a single long-path folder")
  Check(DxfFolderExists(folder), "long-path folder readable")
  Dim finalPath As String = "${finalPath}"
  Dim work As String = DxfExportWorkPath(finalPath)
  Check(work.Length < 260 AndAlso work.EndsWith(".dxf"), "short DXF staging")
  IO.File.Copy("${sourceFile}", work)
  Check(DxfExportWorkPath(finalPath) <> work, "unique stage per candidate")
  Dim sourceSize As Double = New IO.FileInfo(work).Length
  g_missingOnly = True
  Check(Not KeepExistingDxf(finalPath), "long missing output")
  Check(DeliverDxfOutput(True, work, finalPath), "long unicode file delivered")
  Check(DxfFileBytes(finalPath) = sourceSize AndAlso IO.File.Exists(work), "destination verified and recovery source retained")
  Check(KeepExistingDxf(finalPath), "long-path existing output kept")
  Dim copies As Integer = copyCalls
  Check(DeliverDxfOutput(True, work, finalPath), "repeat missing-only")
  Check(copyCalls = copies, "repeat does not write")
  g_missingOnly = False
  Check(DeliverDxfOutput(True, work, finalPath), "explicit regenerate-all")
  copies = copyCalls
  Check(Not DeliverDxfOutput(False, work, finalPath), "API false cannot claim prior file")
  Check(copyCalls = copies, "failed export never delivered")
  copyFails = True
  Check(Not DeliverDxfOutput(True, work, finalPath), "failed copy")
  Check(DxfFileBytes(finalPath) = sourceSize, "failed copy preserves destination")
  copyFails = False : moveFails = True
  Check(Not DeliverDxfOutput(True, work, finalPath), "failed commit")
  Check(DxfFileBytes(finalPath) = sourceSize, "failed commit preserves destination")
  moveFails = False : wrongSize = True
  Dim moves As Integer = moveCalls
  Check(Not DeliverDxfOutput(True, work, finalPath), "partial copy not committed")
  Check(moveCalls = moves, "size mismatch cannot replace existing output")
  wrongSize = False
  g_missingOnly = True : infoFails = True : rejected = False
  Try
    KeepExistingDxf(finalPath)
  Catch
    rejected = True
  End Try
  Check(rejected, "access failure is not treated as missing")
  infoFails = False
  concurrentFile = "${longFolder}\\concurrent.dxf"
  moves = moveCalls
  Check(DeliverDxfOutput(True, work, concurrentFile), "concurrent nonempty output kept")
  Check(moveCalls = moves, "concurrent existing output not replaced")
  concurrentFile = ""
  Dim empty As String = "${dir}\\empty.dxf"
  IO.File.WriteAllText(empty, "")
  Dim emptyFinal As String = "${longFolder}\\empty.dxf"
  Check(NativeCopy(DxfNativePath(empty), DxfNativePath(emptyFinal), 1) <> 0, "empty fixture")
  Check(Not KeepExistingDxf(emptyFinal), "empty long output retry")
  Check(DeliverDxfOutput(True, work, emptyFinal), "empty long output replaced")
  Check(Not DeliverDxfOutput(True, empty, "${longFolder}\\must-not-exist.dxf"), "empty stage rejected")
  Check(DxfFileBytes("${longFolder}\\must-not-exist.dxf") = -1, "empty stage creates no output")
  Console.WriteLine("PASS ${file}: native long-path delivery, Unicode, missing-only, overwrite, access/copy/commit failure, and cleanup trace guards.")
End Sub
End Module
`);
  const compiler = path.join(process.env.WINDIR || "C:\\Windows", "Microsoft.NET", "Framework64", "v4.0.30319", "vbc.exe");
  const build = spawnSync(compiler, ["/nologo", "/target:exe", "/out:" + output, input], { encoding: "utf8", timeout: 60000, windowsHide: true });
  assert.equal(build.status, 0, input + "\n" + build.stdout + "\n" + build.stderr);
  const result = spawnSync(output, [], { encoding: "utf8", timeout: 60000, windowsHide: true });
  assert.equal(result.status, 0, input + "\n" + result.stdout + "\n" + result.stderr);
  assert.deepEqual(fs.readFileSync(finalPath), sourceBytes, "delivered bytes are exact");
  assert.deepEqual(fs.readFileSync(path.join(longFolder, "empty.dxf")), sourceBytes);
  console.log(result.stdout.trim());
}
