"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "macros", "CNCDXF_v1.swb"), "utf8");
function procedure(name) {
  const match = source.match(new RegExp(`^(?:(?:Private|Public) )?(?:Function|Sub) ${name}\\([\\s\\S]*?^End (?:Function|Sub)`, "mi"));
  assert.ok(match, name);
  return match[0];
}
assert.doesNotMatch(source, /BrowseForFolder|ReplaceFileW|Const MOVEFILE_REPLACE_EXISTING/);
const main = procedure("ExcelsisMacroMain");
assert.match(main, /selCount <> 1/);
assert.match(main, /BuildCamOutputFolder\(selectedPartPath, ConfiguredCamOutputRoot\(\), ConfiguredCamFolderMode\(\)\)/);
assert.match(main, /ValidateStampedDxfFile\(pendingTempPath/);
assert.match(main, /CommitTemporaryDxf\(pendingTempPath, outPath, reusedOutput\)/);
assert.match(main, /RestoreConfigurationChecked\(selectedOwnerForRestore, originalOwnerConfig\)/);
assert.match(main, /CloseVisibleDocumentsOpenedByMacro dictInitiallyVisibleDocumentWindows/);
assert.match(procedure("ExcelsisResetMacroSettings"), /gCncCamSettingsJson = ""/);
assert.match(procedure("CommitTemporaryDxf"), /MoveFileExW\(StrPtr\(tempPath\), StrPtr\(candidate\), MOVEFILE_WRITE_THROUGH\)/);
assert.doesNotMatch(procedure("CommitTemporaryDxf"), /DeleteFile|Kill |CopyFile|ReplaceFile/);
assert.match(procedure("CncDxfComparisonKey"), /Case Else\s+Exit Function/);
assert.match(procedure("CncReadComparisonKey"), /CNC_COMPARE_MAX_BYTES/);
assert.match(procedure("CncDxfComparisonKey"), /Join\(chunks, vbLf\)/);
if (process.platform !== "win32") {
  console.log("CNC DXF static route and no-overwrite guards passed; Windows execution skipped.");
  process.exit(0);
}

// Execute the production helpers with only VBA/.NET syntax and native-pointer
// adapters. All files are disposable local fixtures; no SW attachment or NAS I/O.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cncdxf-output-check-"));
fs.mkdirSync(path.join(dir, "Macros"));
const cases = [
  { source: "M:\\Projects\\PRJ-26-01_Example\\Models\\plate.SLDPRT", mode: "project-part" },
  { source: "M:\\Projects\\PRJ-26-01_Example\\Models\\plate.SLDPRT", mode: "project-relative" },
  { source: "\\\\server\\share\\Projects\\PRJ-26-076_Project\\Models\\Nest\\assy.SLDASM", mode: "project-relative" },
  { source: "M:\\Projects\\Alpha Project\\Models\\part (Default).SLDPRT", mode: "project-part", prefixes: [] },
  { source: "C:\\Staged files\\part (Default).SLDPRT", mode: "project-relative" },
  { source: "C:\\Projects\\PRJ-26-01_Example\\Models\\part.SLDPRT", mode: "project-relative" },
  { source: "M:\\Projects\\JOB-26-10_Szersz\u00e1m\\F\u00farsz\\h\u00faz\u00f3 \u0151\u0171.SLDPRT", mode: "project-relative" },
  { source: "M:\\Projects\\A+B-26-01.Example\\plate.SLDPRT", mode: "project-part", prefixes: ["A+B"] },
  { source: "M:/Projects//PRJ-26-01_Example///Models/assy.SLDASM", mode: "project-relative" },
  { source: "M:\\Projects\\\u65e5\u672c a\u0301 \u05b0 .\\part (extra) (Default).SLDPRT", mode: "project-part", prefixes: [] },
  { source: "M:\\Projects\\Root A\\ToolingProjects\\Root B\\part.SLDPRT", mode: "project-relative", prefixes: [], roots: ["ToolingProjects", "Projects"] },
];
for (const item of cases) {
  item.prefixes ??= ["PRJ", "JOB"];
  item.roots ??= ["Projects", "ToolingProjects"];
}
fs.writeFileSync(path.join(dir, "cases.json"), JSON.stringify(cases));
const reference = path.join(dir, "reference.ps1");
fs.writeFileSync(reference, `param([string]$SourceScript, [string]$FixtureRoot)
$ErrorActionPreference = 'Stop'
$tokens = $null; $errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($SourceScript, [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw 'CAM script syntax failed' }
foreach ($name in @('Get-ProjectNameFromPath','Get-SafeFolderName','ConvertTo-AsciiFolderText','Get-CamPartFolderName','Get-ProjectRelativeFolders','Test-SourcePathOnDrive','Get-ImmediateParentFolderName')) {
  $fn = $ast.Find({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name }, $true)
  if ($null -eq $fn) { throw "Missing CAM function: $name" }
  Invoke-Expression $fn.Extent.Text
}
$results = @()
foreach ($item in (Get-Content -LiteralPath (Join-Path $FixtureRoot 'cases.json') -Raw -Encoding UTF8 | ConvertFrom-Json)) {
  $script:ProjectPrefixes = @($item.prefixes)
  $script:ProjectRootNames = @($item.roots)
  $project = Get-ProjectNameFromPath $item.source
  $localC = Test-SourcePathOnDrive $item.source 'C'
  if (-not $project -and $localC) { $project = Get-ImmediateParentFolderName $item.source }
  $folder = Join-Path $FixtureRoot (Get-SafeFolderName $project)
  if ($item.mode -eq 'project-relative' -and -not $localC) {
    foreach ($part in @(Get-ProjectRelativeFolders $item.source $project)) { $folder = Join-Path $folder $part }
  }
  $results += Join-Path $folder (Get-CamPartFolderName $item.source)
}
$results | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $FixtureRoot 'expected.json') -Encoding UTF8
`);
function run(file, args) {
  const result = spawnSync(file, args, { encoding: "utf8", timeout: 60000, windowsHide: true });
  assert.equal(result.status, 0, `${file}\n${result.stdout}\n${result.stderr}`);
  return result.stdout.trim();
}
run("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", reference,
  "-SourceScript", path.join(root, "scripts", "automation-defaults", "create-cam-folder.ps1"), "-FixtureRoot", dir]);
const expected = JSON.parse(fs.readFileSync(path.join(dir, "expected.json"), "utf8").replace(/^\uFEFF/, ""));
const vbString = (value) => '"' + value.replace(/"/g, '""') + '"';
function adapt(code) {
  return code.replace(/\s+_\r?\n\s*/g, " ")
    .replace(/\bSet\s+(?=[A-Za-z])/g, "")
    .replace(/\bLong\b/g, "Integer").replace(/\bVariant\b/g, "Object")
    .replace(/\b(LCase|UCase|Trim|Replace|Mid|Left|Right|String|Chr)\$/g, "$1")
    .replace(/\bString\((?!\))/g, "StrDup(")
    .replace(/\bStrPtr\((\w+)\)/g, "$1")
    .replace(/\bErr\.LastDllError\b/g, "lastNativeError")
    .replace(/\bDebug\.Print (.+)$/gm, "Console.WriteLine($1)")
    .replace(/\bThen Err\.Raise (.+)$/gm, "Then Err.Raise($1)")
    .replace(/^([ \t]*)(Err\.Raise|MsgBox|\w+\.(?:CreateFolder|LoadFromFile)) (.+)$/gm, "$1$2($3)");
}
const helpers = [
  "ExcelsisReadUtf8Text", "ExcelsisResetMacroSettings", "ExcelsisJsonStringValue", "ExcelsisMacroSetting",
  "ConfiguredProjectPrefixes", "ConfiguredProjectRootNames", "ConfiguredCamSettingsJson", "ConfiguredCamOutputRoot",
  "ConfiguredCamFolderMode", "CncJsonObjectValue", "DeriveProjectFolderName", "CncRegexTest", "CncRegexEscape",
  "CncPathSegments", "CncSafeCamFolderName", "CncCamPartFolderName", "BuildCamOutputFolder", "EnsureTrailingBackslash",
  "PathFileName", "PathFileNameNoExt", "EnsureFolder", "SplitDxfLines", "CncDxfComparisonKey", "CncDxfNumericGroup",
  "CncReadComparisonKey", "CncDxfNumberedPath", "CommitTemporaryDxf", "BuildTemporaryDxfPath", "BuildDxfPath",
].map(procedure).join("\n");
const caseChecks = cases.map((item, i) => `
IO.File.WriteAllText(IO.Path.Combine(fixture, "Macros", "macro-settings.json"), ${vbString(JSON.stringify({ projectCodePrefixesText: item.prefixes.join(";"), projectRootNamesText: item.roots.join(";") }))})
ExcelsisResetMacroSettings()
Check(BuildCamOutputFolder(${vbString(item.source)}, fixture, ${vbString(item.mode)}) = ${vbString(expected[i])}, "CAM parity case ${i + 1}")
`).join("");
function dxf({ x = "12.0", y = "8.0", stamp = "100", handle = "A1", units = "4", extra = [] } = {}) {
  return ["0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", units, "9", "$TDUPDATE", "40", stamp,
    "9", "$HANDSEED", "5", handle, "0", "ENDSEC", "0", "SECTION", "2", "ENTITIES",
    "0", "LINE", "5", handle, "330", handle, "8", "0", "10", "0.0", "20", "0.0", "11", x, "21", y,
    "0", "CIRCLE", "8", "0", "10", "6.0", "20", "4.0", "40", "3.5", ...extra, "0", "ENDSEC", "0", "EOF", ""].join("\r\n");
}
const fixtures = {
  a: dxf(), repeat: dxf({ stamp: "200", handle: "FF" }).replace(/\r\n/g, "\n"),
  b: dxf({ x: "24.0" }), sameBounds: dxf({ extra: ["0", "LINE", "8", "0", "10", "2.0", "20", "2.0", "11", "4.0", "21", "2.0"] }),
  units: dxf({ units: "1" }), unknown: dxf({ extra: ["0", "INSERT", "2", "MissingBlock", "10", "0.0", "20", "0.0"] }),
  xdata: dxf({ extra: ["1001", "CustomData"] }),
};
for (const [name, text] of Object.entries(fixtures)) fs.writeFileSync(path.join(dir, `${name}.txt`), text);
fs.writeFileSync(path.join(dir, "settings.json"), JSON.stringify({ cam: { outputRoot: dir, folderMode: "project-relative" } }));
const input = path.join(dir, "test.vb");
const output = path.join(dir, "test.exe");
fs.writeFileSync(input, `Option Strict Off
Imports System
Imports System.Runtime.InteropServices
Imports Microsoft.VisualBasic
Module CncChecks
Const OUTPUT_ROOT As String = "C:\\CAM", PROJECT_PREFIXES As String = "", PROJECT_ROOT_NAMES As String = "Projects"
Const CNC_MAX_OUTPUTS As Integer = 10000, CNC_COMPARE_MAX_BYTES As Integer = 16777216, MOVEFILE_WRITE_THROUGH As Integer = 8
Dim gExcelsisMacroSettingsLoaded As Boolean, gExcelsisMacroSettingsJson As String = "", gExcelsisMacroSettingsReadError As String = "", gCncCamSettingsJson As String = ""
Dim fixture As String = ${vbString(dir)}, lastNativeError As Integer, raceDestination As String = "", moveFailure As Boolean
Dim moveCalls As Integer
<DllImport("normaliz.dll", EntryPoint:="NormalizeString", CharSet:=CharSet.Unicode, SetLastError:=True)>
Function NativeNormalize(form As Integer, source As String, sourceLength As Integer, destination As Text.StringBuilder, destinationLength As Integer) As Integer
End Function
<DllImport("kernel32.dll", EntryPoint:="GetStringTypeW", CharSet:=CharSet.Unicode, SetLastError:=True)>
Function CncGetStringType(infoType As Integer, source As String, sourceLength As Integer, ByRef characterType As Short) As Integer
End Function
<DllImport("kernel32.dll", EntryPoint:="MoveFileExW", CharSet:=CharSet.Unicode, SetLastError:=True)>
Function NativeMove(source As String, destination As String, flags As Integer) As Integer
End Function
Function CncNormalizeString(form As Integer, source As String, sourceLength As Integer, ByRef destination As Object, destinationLength As Integer) As Integer
  Dim result As Integer
  If destinationLength = 0 Then
    result = NativeNormalize(form, source, sourceLength, Nothing, 0)
  Else
    Dim buffer As New Text.StringBuilder(destinationLength)
    result = NativeNormalize(form, source, sourceLength, buffer, destinationLength)
    destination = buffer.ToString()
  End If
  lastNativeError = Marshal.GetLastWin32Error() : Return result
End Function
Function MoveFileExW(source As String, destination As String, flags As Integer) As Integer
  Check(flags = 8, "native publish must not request replacement")
  moveCalls += 1
  If moveFailure Then
    lastNativeError = 5 : Return 0
  End If
  If destination = raceDestination Then
    IO.File.WriteAllText(destination, "concurrent output must survive")
    raceDestination = ""
  End If
  Dim result = NativeMove(source, destination, flags)
  lastNativeError = Marshal.GetLastWin32Error() : Return result
End Function
Function ExcelsisMacroRoot() As String
  Return fixture
End Function
Function ExcelsisGetCurrentProcessId() As Integer
  Return 999
End Function
Function ReadBinaryTextFile(file As String, ByRef value As String) As Boolean
  Try
    value = IO.File.ReadAllText(file, Text.Encoding.GetEncoding(1252)) : Return value.Length > 0
  Catch
    Return False
  End Try
End Function
Sub Check(ok As Boolean, label As String)
  If Not ok Then Throw New Exception(label)
End Sub
Function Stage(name As String, content As String) As String
  Dim file = IO.Path.Combine(fixture, name & ".dxf")
  IO.File.WriteAllText(file, content, Text.Encoding.ASCII) : Return file
End Function
${adapt(helpers)}
Sub Main()
  ${caseChecks}
  Check(ConfiguredCamOutputRoot() = fixture, "CAM root read from existing settings")
  Check(ConfiguredCamFolderMode() = "project-relative", "CAM mode read from existing settings")
  Check(ExcelsisJsonStringValue("{""path"":""C:\\\\caf\\u00e9\\u0151""}", "path", "bad") = "C:\\caf" & ChrW(&HE9) & ChrW(&H151), "JSON Unicode escapes")
  Check(ExcelsisJsonStringValue("{""path"":null,""other"":""wrong""}", "path", "fallback") = "fallback", "non-string setting cannot steal following value")
  Check(CncJsonObjectValue("{""note"":""braces { } and \\""quotes\\"""",""cam"":{""folderMode"":""project-part""}}", "cam") = "{""folderMode"":""project-part""}", "quoted JSON braces")
  IO.File.WriteAllText(IO.Path.Combine(fixture, "settings.json"), "{""cam"":{""outputRoot"":""C:\\\\CAM"",""folderMode"":""project-part""}}")
  ExcelsisResetMacroSettings()
  Check(ConfiguredCamOutputRoot() = "C:\\CAM" And ConfiguredCamFolderMode() = "project-part", "cached module rereads settings on next run")
  Dim rejected As Boolean
  Try
    BuildCamOutputFolder("M:\\NoProject\\PRJ-not-a-project\\part.SLDPRT", fixture, "project-part")
  Catch
    rejected = True
  End Try
  Check(rejected, "unknown project fails without a guessed destination")
  rejected = False
  Try
    BuildCamOutputFolder("C:\\Staged\\part.SLDPRT", fixture & "\\absent-root", "project-part")
  Catch
    rejected = True
  End Try
  Check(rejected, "missing root is not created or replaced")
  rejected = False
  Try
    BuildCamOutputFolder("C:\\Staged\\part.SLDPRT", "relative-root", "project-part")
  Catch
    rejected = True
  End Try
  Check(rejected, "relative root rejected")
  Check(EnsureFolder(fixture & "\\created\\nested\\"), "create owned output with trailing separator")
  Check(EnsureFolder(fixture & "\\created\\nested\\"), "existing folder accepted")
  Dim basePath = fixture & "\\part.dxf", finalPath As String = basePath, reused As Boolean
  Dim a = IO.File.ReadAllText(fixture & "\\a.txt"), b = IO.File.ReadAllText(fixture & "\\b.txt")
  Dim repeat = IO.File.ReadAllText(fixture & "\\repeat.txt")
  Check(CncDxfComparisonKey(a) <> "", "simple projected DXF comparable")
  Check(CncDxfComparisonKey(a) = CncDxfComparisonKey(repeat), "timestamps, handles and line endings do not create duplicates")
  Check(CncDxfComparisonKey(a) <> CncDxfComparisonKey(IO.File.ReadAllText(fixture & "\\sameBounds.txt")), "different internal geometry with same bounds is different")
  Check(CncDxfComparisonKey(a) <> CncDxfComparisonKey(IO.File.ReadAllText(fixture & "\\units.txt")), "units remain significant")
  Check(CncDxfComparisonKey(IO.File.ReadAllText(fixture & "\\unknown.txt")) = "", "linked entity cannot be assumed identical")
  Check(CncDxfComparisonKey(IO.File.ReadAllText(fixture & "\\xdata.txt")) = "", "XDATA cannot be assumed identical")
  Check(CncDxfComparisonKey("0" & vbLf & "EOF") = "", "empty DXF not comparable")
  Check(CncDxfComparisonKey(a.Replace("ENDSEC", "BROKEN")) = "", "malformed sections not comparable")
  Dim temp = Stage(".new-a", a)
  Check(CommitTemporaryDxf(temp, finalPath, reused) And Not reused And finalPath = basePath, "first output gets plain name")
  Check(Not IO.File.Exists(temp), "new output moved, no stage left")
  Dim savedA = IO.File.ReadAllBytes(basePath)
  temp = Stage(".new-b", b) : finalPath = basePath
  Check(CommitTemporaryDxf(temp, finalPath, reused) And Not reused And finalPath = fixture & "\\part_2.dxf", "different face is numbered")
  Check(Convert.ToBase64String(IO.File.ReadAllBytes(basePath)) = Convert.ToBase64String(savedA), "first output unchanged")
  temp = Stage(".repeat-a", repeat) : finalPath = basePath
  Dim beforeMoves = moveCalls
  Check(CommitTemporaryDxf(temp, finalPath, reused) And reused And finalPath = basePath, "identical existing output reused")
  Check(moveCalls = beforeMoves And IO.File.Exists(temp), "reuse does not replace or remove files")
  temp = Stage(".repeat-b", b) : finalPath = basePath
  Check(CommitTemporaryDxf(temp, finalPath, reused) And reused And finalPath = fixture & "\\part_2.dxf", "second face reused")
  IO.File.Move(basePath, fixture & "\\preserved-first.txt")
  temp = Stage(".repeat-gap", b) : finalPath = basePath
  Check(CommitTemporaryDxf(temp, finalPath, reused) And reused And finalPath = fixture & "\\part_2.dxf", "same output found beyond numbering gap")
  temp = Stage(".gap-fill", a) : finalPath = basePath
  Check(CommitTemporaryDxf(temp, finalPath, reused) And Not reused And finalPath = basePath, "missing base regenerated")
  Dim lock = New IO.FileStream(basePath, IO.FileMode.Open, IO.FileAccess.ReadWrite, IO.FileShare.None)
  temp = Stage(".locked-a", a) : finalPath = basePath
  Check(CommitTemporaryDxf(temp, finalPath, reused) And Not reused And finalPath = fixture & "\\part_3.dxf", "unreadable occupied output preserved")
  lock.Dispose()
  raceDestination = fixture & "\\race.dxf" : finalPath = raceDestination
  temp = Stage(".racing", a)
  Check(CommitTemporaryDxf(temp, finalPath, reused) And Not reused And finalPath = fixture & "\\race_2.dxf", "concurrent writer causes numbered retry")
  Check(IO.File.ReadAllText(fixture & "\\race.dxf") = "concurrent output must survive", "concurrent bytes preserved")
  IO.Directory.CreateDirectory(fixture & "\\directory.dxf") : finalPath = fixture & "\\directory.dxf"
  temp = Stage(".directory", a)
  Check(CommitTemporaryDxf(temp, finalPath, reused) And finalPath = fixture & "\\directory_2.dxf", "folder collision preserved")
  moveFailure = True : finalPath = fixture & "\\denied.dxf" : temp = Stage(".denied", a)
  Check(Not CommitTemporaryDxf(temp, finalPath, reused), "publish access failure reported")
  Check(IO.File.Exists(temp) And Not IO.File.Exists(finalPath), "failed publish retains stage and creates no false output")
  moveFailure = False
  Dim large = New IO.FileStream(fixture & "\\large.dxf", IO.FileMode.CreateNew)
  large.SetLength(CNC_COMPARE_MAX_BYTES + 1) : large.Dispose()
  Check(CncReadComparisonKey(fixture & "\\large.dxf") = "", "comparison byte cap")
  Check(BuildTemporaryDxfPath(basePath).Length < (fixture & "\\" & ".cncdxf_tmp_20261009_120000_999_100.dxf").Length, "short same-folder staging")
  Console.WriteLine("CNC DXF: ${cases.length} CAM-script parity cases; settings reread/Unicode; content comparison; numbering, gaps, locks, race and failed-write preservation passed.")
End Sub
End Module
`);
const compiler = path.join(process.env.WINDIR || "C:\\Windows", "Microsoft.NET", "Framework64", "v4.0.30319", "vbc.exe");
run(compiler, ["/nologo", "/target:exe", "/out:" + output, input]);
console.log(run(output, []));
console.log("Fixtures retained at " + dir);
