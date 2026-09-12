"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
let sharedHelper;

for (const name of ["DXF_v16", "DXF_v16_ROfriendy", "BOM_v19", "BOM_v19_ROfriendy"]) {
  const source = fs.readFileSync(path.join(root, "macros", `${name}.swb`), "utf8").replace(/\r\n/g, "\n");
  const helper = source.match(/^Private Sub ExcelsisOpenExportFolder\([\s\S]*?^End Sub/m)?.[0];
  assert.ok(helper, name);
  if (sharedHelper) assert.equal(helper, sharedHelper, "All four macros must share folder-opening behavior.");
  sharedHelper = helper;
  const main = source.match(/^Private Sub ExcelsisMacroMain\([\s\S]*?^End Sub/m)?.[0];
  assert.ok(main, name);
  assert.equal((main.match(/ExcelsisOpenExportFolder /g) || []).length, 1, "Open once, not once per exported component.");
  assert.ok(main.lastIndexOf("ActivateModelDocument swModel") < main.indexOf("ExcelsisOpenExportFolder "));
  assert.doesNotMatch(helper, /\b(?:ShellExecute|Kill|DeleteFile|CreateFolder)\b|cmd\.exe|explorer\.exe/i);
  if (name.startsWith("DXF")) {
    assert.match(main, /If dictDone.Count > 0 Then ExcelsisOpenExportFolder dxfFolder/);
    assert.match(main, /dxfFolder = baseFolder & "dxf_precut\\"/);
    assert.match(main, /dxfFolder = baseFolder & "dxf\\"/);
    assert.ok(main.indexOf('MsgBox "DXF export done.') < main.indexOf("ExcelsisOpenExportFolder "));
    assert.ok(main.indexOf("baseFolder = Left") < main.indexOf("ProcessFullAssembly "));
  } else {
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
} else {
  console.log("Macro folder static checks passed; Windows behavior tests skipped on this platform.");
}
