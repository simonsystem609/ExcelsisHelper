"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
let sharedHelper;
let dxfHelper;
let dxfStrip;

for (const name of ["DXF_v16", "DXF_v16_ROfriendy", "BOM_v19", "BOM_v19_ROfriendy"]) {
  const source = fs.readFileSync(path.join(root, "macros", `${name}.swb`), "utf8").replace(/\r\n/g, "\n");
  const helper = source.match(/^Private Sub ExcelsisOpenExportFolder\([\s\S]*?^End Sub/m)?.[0];
  assert.ok(helper, name);
  const main = source.match(/^Private Sub ExcelsisMacroMain\([\s\S]*?^End Sub/m)?.[0];
  assert.ok(main, name);
  assert.equal((main.match(/ExcelsisOpenExportFolder /g) || []).length, 1, "Open once, not once per exported component.");
  assert.ok(main.lastIndexOf("ActivateModelDocument swModel") < main.indexOf("ExcelsisOpenExportFolder "));
  assert.doesNotMatch(helper, /\b(?:Kill|DeleteFile|CreateFolder)\b|cmd\.exe|explorer\.exe/i);
  if (name.startsWith("DXF")) {
    if (dxfHelper) assert.equal(helper, dxfHelper, "Both DXF variants must use the same checked opener.");
    dxfHelper = helper;
    dxfStrip = source.match(/^Private Function StripTrailingPathSeparator\([\s\S]*?^End Function/m)?.[0];
    assert.ok(dxfStrip);
    assert.match(source, /Declare PtrSafe Function DxfShellExecute Lib "shell32.dll" Alias "ShellExecuteW" .* As LongPtr$/m);
    assert.match(source, /Declare Function DxfShellExecute Lib "shell32.dll" Alias "ShellExecuteW" .* As Long$/m);
    assert.match(helper, /If shellResult > 32 Then Exit Sub/);
    assert.match(helper, /DxfShellExecute\(0, StrPtr\(operation\), StrPtr\(folderPath\), 0, 0, 1\)/);
    assert.doesNotMatch(helper, /CreateObject|Shell\.Application|\.FolderExists/);
    assert.match(main, /If dictDone.Count > 0 Then ExcelsisOpenExportFolder dxfFolder/);
    assert.match(main, /dxfFolder = baseFolder & "dxf_precut\\"/);
    assert.match(main, /dxfFolder = baseFolder & "dxf\\"/);
    assert.ok(main.indexOf("MsgBox completionText") >= 0);
    assert.ok(main.indexOf("MsgBox completionText") < main.indexOf("ExcelsisOpenExportFolder "));
    assert.ok(main.indexOf("baseFolder = Left") < main.indexOf("ProcessFullAssembly "));
  } else {
    if (sharedHelper) assert.equal(helper, sharedHelper, "BOM folder behavior is unchanged.");
    sharedHelper = helper;
    assert.match(main, /ElseIf exportOk Then\s+MsgBox completionMessage, vbInformation, "BOM \/ Cutlist"\s+ExcelsisOpenExportFolder folder\s+Else/);
    assert.match(main, /folder = Left\$\(assemblyPath, InStrRev\(assemblyPath, "\\"\)\)/);
  }
}

if (process.platform === "win32") {
  const compiler = path.join(process.env.WINDIR || "C:\\Windows", "Microsoft.NET", "Framework64", "v4.0.30319", "vbc.exe");
  assert.ok(fs.existsSync(compiler), "Windows VB compiler required for macro behavior tests.");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "excelsis-export-folder-tests-"));
  const input = path.join(dir, "folder.vb");
  const output = path.join(dir, "folder.exe");
  // Execute the macro's actual helper with inert Windows Shell/FSO doubles.
  const adapted = sharedHelper.replace(/\bSet\s+(?=[A-Za-z])/g, "")
    .replace(/Trim\$/g, "Trim").replace(/CreateObject\(/g, "TestCreateObject(")
    .replace(/^\s*folderShell.Open folderPath$/m, "    folderShell.Open(folderPath)")
    .replace(/^\s*Debug.Print (.+)$/m, "    Console.WriteLine($1)");
  fs.writeFileSync(input, `Option Strict Off
Imports System
Imports Microsoft.VisualBasic
Module FolderTests
Dim fsDouble As New TestFolders
Dim shellDouble As New TestShell
Dim creations As Integer
Dim failCreate As Boolean
Function TestCreateObject(name As String) As Object
  creations += 1
  If failCreate Then Throw New Exception("COM unavailable")
  If name = "Scripting.FileSystemObject" Then Return fsDouble
  If name = "Shell.Application" Then Return shellDouble
  Throw New Exception(name)
End Function
${adapted}
Sub Check(value As Boolean, label As String)
  If Not value Then Throw New Exception(label)
End Sub
Sub Main()
  ExcelsisOpenExportFolder(" ")
  Check(creations = 0, "Empty folder must not create COM objects")
  ExcelsisOpenExportFolder("C:\\missing\\")
  Check(shellDouble.Attempts = 0, "Missing folder must not open")
  fsDouble.Present = True
  For Each folder As String In New String() {"C:\\Parts\\dxf\\", "C:\\Parts\\dxf_precut\\", "\\\\server\\share\\Assembly root & (1)\\", "C:\\Parts\\" & ChrW(233) & "\\"}
    ExcelsisOpenExportFolder(folder)
    Check(shellDouble.LastPath = folder, "Pass exact path without command-line escaping")
  Next
  Check(shellDouble.Attempts = 4, "Exactly one open per successful invocation")
  shellDouble.Fail = True
  ExcelsisOpenExportFolder("C:\\Parts\\")
  Check(Err.Number = 0, "Shell failure must not escape or leave Err set")
  shellDouble.Fail = False
  fsDouble.Fail = True
  ExcelsisOpenExportFolder("C:\\Parts\\")
  Check(Err.Number = 0, "Folder lookup failure must not escape")
  failCreate = True
  ExcelsisOpenExportFolder("C:\\Parts\\")
  Check(Err.Number = 0, "COM creation failure must not escape")
  Console.WriteLine("Macro folder behavior tests passed; no real Shell or SOLIDWORKS calls.")
End Sub
End Module
Public Class TestFolders
  Public Present As Boolean
  Public Fail As Boolean
  Public Function FolderExists(folder As String) As Boolean
    If Fail Then Throw New Exception("Share unavailable")
    Return Present
  End Function
End Class
Public Class TestShell
  Public Attempts As Integer
  Public LastPath As String
  Public Fail As Boolean
  Public Sub Open(folder As String)
    Attempts += 1
    If Fail Then Throw New Exception("Explorer unavailable")
    LastPath = folder
  End Sub
End Class
`, "utf8");
  const compile = spawnSync(compiler, ["/nologo", "/target:exe", `/out:${output}`, input], { encoding: "utf8", windowsHide: true });
  assert.equal(compile.status, 0, compile.stdout + compile.stderr);
  const run = spawnSync(output, [], { encoding: "utf8", windowsHide: true, timeout: 15000 });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  process.stdout.write(run.stdout);

  const dxfInput = path.join(dir, "dxf-folder.vb");
  const dxfOutput = path.join(dir, "dxf-folder.exe");
  const dxfAdapted = `${dxfHelper}\n${dxfStrip}`
    .replace(/#If VBA7 Then\n([\s\S]*?)#Else\n[\s\S]*?#End If/g, "$1")
    .replace(/\s+_\n\s*/g, " ")
    .replace(/\bLong\b/g, "Integer").replace(/\bLongPtr\b/g, "Long")
    .replace(/\b(Trim|Left|Right)\$/g, "$1")
    .replace(/StrPtr\((\w+)\)/g, "$1")
    .replace(/^([ \t]*)TraceRun (.+)$/gm, "$1TraceRun($2)")
    .replace(/^([ \t]*)MsgBox (.+)$/gm, "$1TestWarning($2)");
  fs.writeFileSync(dxfInput, `Option Strict Off
Imports System
Imports Microsoft.VisualBasic
Module DxfFolderTests
Dim g_tracePath As String = "test-trace.log"
Dim present As Boolean = True, lookupThrows As Boolean, nativeThrows As Boolean, warningThrows As Boolean
Dim nativeResult As Long = 33, calls As Integer, warnings As Integer, lookups As Integer
Dim lastPath As String = "", lastWarning As String = ""
Dim traces As New Collections.Generic.List(Of String)
Sub Check(value As Boolean, label As String)
  If Not value Then Throw New Exception(label & Environment.NewLine & String.Join(Environment.NewLine, traces))
End Sub
Function DxfFolderExists(folder As String) As Boolean
  lookups += 1
  If lookupThrows Then Throw New Exception("Share lookup failed")
  Return present
End Function
Function DxfShellExecute(hwnd As Integer, operation As String, file As String, parameters As Integer, directory As Integer, show As Integer) As Long
  calls += 1 : lastPath = file
  Check(hwnd = 0 And operation = "open" And parameters = 0 And directory = 0 And show = 1, "Native folder open uses no command line")
  If nativeThrows Then Throw New Exception("Native open unavailable")
  Return nativeResult
End Function
Function DiagnosticLineValue(value As String) As String
  Return value
End Function
Sub TraceRun(value As String)
  traces.Add(value)
End Sub
Sub TestWarning(value As String, style As Integer, title As String)
  warnings += 1 : lastWarning = value
  Check(title = "DXF Export" And style = vbExclamation, "Nonfatal DXF warning")
  If warningThrows Then Throw New Exception("Warning unavailable")
End Sub
${dxfAdapted}
Sub Main()
  ExcelsisOpenExportFolder(" ")
  Check(calls = 0 And warnings = 0 And lookups = 0, "Empty input has no effects")
  For Each folder As String In New String() {"C:\\Parts\\dxf\\", "C:\\Parts\\dxf_precut\\", "\\\\server\\share\\Assembly root & (1)\\", "C:\\Parts\\" & ChrW(233) & ChrW(337) & ChrW(369) & "\\", "C:\\", "\\\\server\\share\\" & New String("a"c, 280) & "\\"}
    Dim before = calls
    ExcelsisOpenExportFolder(folder)
    Check(calls = before + 1 And lastPath = StripTrailingPathSeparator(folder), "Exactly one Unicode folder open with the unchanged path")
    Check(warnings = 0 And Err.Number = 0, "Accepted launch is not an export failure")
  Next
  Dim lastCalls = calls
  present = False
  ExcelsisOpenExportFolder("C:\\missing\\")
  Check(calls = lastCalls And warnings = 1 And lastWarning.Contains("C:\\missing"), "Missing folder is visible, never silently skipped")
  present = True
  For Each result As Long In New Long() {0, 2, 3, 5, 8, 26, 27, 28, 29, 30, 31, 32}
    nativeResult = result
    Dim before = warnings
    lastCalls = calls
    ExcelsisOpenExportFolder("\\\\server\\share\\dxf\\")
    Check(calls = lastCalls + 1 And warnings = before + 1, "Failed launch is attempted once, not retried")
    Check(lastWarning.Contains("Windows shell error " & result.ToString()) And lastWarning.Contains(g_tracePath), "Warning contains shell result and trace")
    Check(Err.Number = 0, "Windows error does not invalidate completed exports")
  Next
  nativeResult = 4294967297L
  Dim count = warnings
  ExcelsisOpenExportFolder("C:\\Parts\\dxf\\")
  Check(warnings = count, "Pointer-sized successful result does not overflow")
  nativeThrows = True
  ExcelsisOpenExportFolder("C:\\Parts\\dxf\\")
  Check(warnings = count + 1 And lastWarning.Contains("Native open unavailable") And Err.Number = 0, "Native exception is logged and warned")
  nativeThrows = False : lookupThrows = True
  lastCalls = calls
  ExcelsisOpenExportFolder("C:\\Parts\\dxf\\")
  Check(calls = lastCalls And lastWarning.Contains("Share lookup failed") And Err.Number = 0, "Lookup failure is nonfatal")
  warningThrows = True
  ExcelsisOpenExportFolder("C:\\Parts\\dxf\\")
  Check(Err.Number = 0, "Even warning failure must not turn success into export failure")
  Check(traces.Exists(Function(value) value.StartsWith("open-folder-request path=")), "Requested path is traced")
  Check(traces.Exists(Function(value) value = "open-folder-shell-result=32"), "Native result is traced")
  Check(traces.Exists(Function(value) value.StartsWith("WARNING open-folder-failed")), "Failure remains in the saved trace")
  Console.WriteLine("DXF checked folder opener tests passed; no real Explorer or SOLIDWORKS calls.")
End Sub
End Module
`, "utf8");
  const dxfCompile = spawnSync(compiler, ["/nologo", "/target:exe", `/out:${dxfOutput}`, dxfInput], { encoding: "utf8", windowsHide: true });
  assert.equal(dxfCompile.status, 0, dxfCompile.stdout + dxfCompile.stderr);
  const dxfRun = spawnSync(dxfOutput, [], { encoding: "utf8", windowsHide: true, timeout: 15000 });
  assert.equal(dxfRun.status, 0, dxfRun.stdout + dxfRun.stderr);
  process.stdout.write(dxfRun.stdout);
} else {
  console.log("Macro folder static checks passed; Windows behavior tests skipped on this platform.");
}
