"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const names = [
  "ClaimDxfOutput", "DxfSafeOutputStem", "DxfBoundedOutputStem", "DxfNameMapField",
  "LoadDxfNameRegistry", "ChooseDxfOutputStem", "ReadDxfNameRegistry",
  "AppendDxfNameRegistry", "ClaimShortDxfName", "CleanFileName",
  "DxfNativePath", "ReadDxfPathInfo", "DxfFileBytes", "KeepExistingDxf",
];
function procedure(source, name) {
  const found = source.match(new RegExp("^(?:(?:Private|Public) )?(?:Function|Sub) " + name + "\\([\\s\\S]*?^End (?:Function|Sub)", "mi"));
  assert.ok(found, name);
  return found[0];
}
function adapt(source) {
  return source.replace(/\s+_\r?\n\s*/g, " ")
    .replace(/\bSet\s+(?=[A-Za-z])/g, "")
    .replace(/\bVariant\b/g, "Object")
    .replace(/\bLong\b/g, "Integer")
    .replace(/\b(\d+(?:\.\d+)?)#/g, "$1R")
    .replace(/\b(LCase|Trim|Replace|Mid|Left|Right|Chr)\$/g, "$1")
    .replace(/\bStrPtr\((\w+)\)/g, "$1")
    .replace(/\bVarPtr\(bytes\(0\)\)/g, "bytes")
    .replace(/\bArray\(((?:[^()\r\n]|\([^()\r\n]*\))*)\)/g, "New Object() {$1}")
    .replace(/\bThen Err\.Raise (.+)$/gm, "Then Err.Raise($1)")
    .replace(/\bThen DxfCloseNameFile (.+)$/gm, "Then DxfCloseNameFile($1)")
    .replace(/\bThen TraceRun (.+)$/gm, "Then TraceRun($1)")
    .replace(/^([ \t]*)(Err\.Raise|TraceRun|LoadDxfNameRegistry|AppendDxfNameRegistry|DxfCloseNameFile|stream\.Write|stream\.WriteText) (.+)$/gm, "$1$2($3)");
}
let previous;
for (const file of ["DXF_v16.swb", "DXF_v16_ROfriendy.swb"]) {
  const source = fs.readFileSync(path.join(root, "macros", file), "utf8");
  const code = names.map((name) => procedure(source, name)).join("\n");
  if (previous) assert.equal(code, previous, "Both DXF variants use the same short-name allocator");
  previous = code;
  assert.match(source, /^Const DXF_FILENAME_LIMIT As Long = 20$/m);
  assert.doesNotMatch(source, /g_outputOwners|g_partNameOwners|DxfPartNameKey|"_variant"/);
  for (const exporter of ["ExportOnePart", "ExportOnePartInAssemblyContext"]) {
    const body = procedure(source, exporter);
    assert.ok(body.indexOf("ClaimDxfOutput(") < body.indexOf("KeepExistingDxf(outPath)"), exporter);
  }
  for (const api of ["DxfOpenNameFile", "DxfNameFileSize", "DxfReadNameFile", "DxfWriteNameFile", "DxfFlushNameFile", "DxfCloseNameFile"]) {
    assert.match(source, new RegExp("Declare PtrSafe Function " + api + " .*LongPtr"));
    assert.match(source, new RegExp("Declare Function " + api + " .*Long"));
  }
  if (process.platform !== "win32") continue;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dxf-name-test-"));
  const longFolder = path.join(dir, "parent-".repeat(15), "assembly-".repeat(12), "exports");
  fs.mkdirSync(longFolder, { recursive: true });
  assert.ok(longFolder.length > 260);
  const input = path.join(dir, "names.vb"), output = path.join(dir, "names.exe");
  const type = source.match(/^Private Type DxfFileData[\s\S]*?^End Type/m)[0]
    .replace("Private Type", "<StructLayout(LayoutKind.Sequential)> Private Structure")
    .replace("End Type", "End Structure").replace(/\bLong\b/g, "Integer")
    .replace(/^(\s+)(\w+ As Integer)/gm, "$1Public $2");
  const constants = source.split(/\r?\n/).filter((line) => /^Const DXF_(?:FILENAME_LIMIT|NAME_MAP_MAX_BYTES)/.test(line));
  fs.writeFileSync(input, `Option Strict Off
Imports System
Imports System.Runtime.InteropServices
Imports Microsoft.VisualBasic
Module NameChecks
${adapt(constants.join("\n"))}
${type}
<DllImport("kernel32.dll", EntryPoint:="CreateFileW", CharSet:=CharSet.Unicode, SetLastError:=True)>
Private Function NativeOpen(name As String, access As Integer, sharing As Integer, security As IntPtr, creation As Integer, flags As Integer, template As IntPtr) As IntPtr
End Function
<DllImport("kernel32.dll", EntryPoint:="GetFileSize", SetLastError:=True)>
Private Function NativeSize(handle As IntPtr, ByRef high As Integer) As Integer
End Function
<DllImport("kernel32.dll", EntryPoint:="ReadFile", SetLastError:=True)>
Private Function NativeRead(handle As IntPtr, <Out> buffer As Byte(), count As Integer, ByRef transferred As Integer, overlapped As IntPtr) As Integer
End Function
<DllImport("kernel32.dll", EntryPoint:="WriteFile", SetLastError:=True)>
Private Function NativeWrite(handle As IntPtr, buffer As Byte(), count As Integer, ByRef transferred As Integer, overlapped As IntPtr) As Integer
End Function
<DllImport("kernel32.dll", EntryPoint:="FlushFileBuffers", SetLastError:=True)>
Private Function NativeFlush(handle As IntPtr) As Integer
End Function
<DllImport("kernel32.dll", EntryPoint:="CloseHandle", SetLastError:=True)>
Private Function NativeClose(handle As IntPtr) As Integer
End Function
<DllImport("kernel32.dll", EntryPoint:="GetFileAttributesExW", CharSet:=CharSet.Unicode, SetLastError:=True)>
Private Function DxfGetFileAttributesEx(name As String, level As Integer, ByRef data As DxfFileData) As Integer
End Function
Dim activeHandles As Integer, writeFails As Boolean, flushFails As Boolean, readFails As Boolean
Dim g_missingOnly As Boolean, g_candidateExisting As Boolean, g_existingCount As Integer
Dim traces As New Collections.Generic.List(Of String)
Function DxfOpenNameFile(name As String, access As Integer, sharing As Integer, security As Integer, creation As Integer, flags As Integer, template As Integer) As Long
  Dim h = NativeOpen(name, access, sharing, IntPtr.Zero, creation, flags, IntPtr.Zero)
  If h.ToInt64() <> -1 Then activeHandles += 1
  Return h.ToInt64()
End Function
Function DxfNameFileSize(handle As Object, ByRef high As Integer) As Integer
  Return NativeSize(New IntPtr(CLng(handle)), high)
End Function
Function DxfReadNameFile(handle As Object, buffer As Byte(), count As Integer, ByRef transferred As Integer, overlapped As Integer) As Integer
  If readFails Then Return 0
  Return NativeRead(New IntPtr(CLng(handle)), buffer, count, transferred, IntPtr.Zero)
End Function
Function DxfWriteNameFile(handle As Object, buffer As Byte(), count As Integer, ByRef transferred As Integer, overlapped As Integer) As Integer
  If writeFails Then Return 0
  Return NativeWrite(New IntPtr(CLng(handle)), buffer, count, transferred, IntPtr.Zero)
End Function
Function DxfFlushNameFile(handle As Object) As Integer
  If flushFails Then Return 0
  Return NativeFlush(New IntPtr(CLng(handle)))
End Function
Function DxfCloseNameFile(handle As Object) As Integer
  Dim result = NativeClose(New IntPtr(CLng(handle)))
  If result <> 0 Then activeHandles -= 1
  Return result
End Function
Sub TraceRun(value As String)
  traces.Add(value)
End Sub
Function DiagnosticLineValue(value As String) As String
  Return value
End Function
Function TraceFileLabel(value As String) As String
  Return IO.Path.GetFileName(value)
End Function
Sub Check(value As Boolean, label As String)
  If Not value Then Throw New Exception(label & Environment.NewLine & String.Join(Environment.NewLine, traces.ToArray()))
End Sub
${adapt(code)}
Function Plan(folder As String, stem As String, cfg As String, part As String) As String
  Dim value = ClaimDxfOutput(folder & stem & ".dxf", part, cfg)
  Dim name = IO.Path.GetFileNameWithoutExtension(value)
  Check(name.Length > 0 And name.Length <= 20 And value.EndsWith(".dxf"), "20 characters before extension: " & name)
  Check(activeHandles = 0, "registry handle released")
  Return value
End Function
Function MustFail(folder As String, label As String) As Boolean
  Try
    ClaimDxfOutput(folder & "new-candidate.dxf", "C:\\parts\\new.sldprt", "Default")
  Catch
    Return True
  End Try
  Throw New Exception("Expected failure: " & label)
End Function
Sub Main()
  Dim folder As String = "${dir}\\"
  Dim exact As String = "12345678901234567890"
  Check(Plan(folder, exact, "Default", "C:\\parts\\exact.sldprt") = folder & exact & ".dxf", "exactly 20 characters unchanged")
  Check(Plan(folder, "short-part", "Default", "C:\\parts\\short.sldprt") = folder & "short-part.dxf", "short names unchanged")
  Dim requested = "LV3_S235_4db_some_long_part_name(Default)"
  Dim first = Plan(folder, requested, "Default", "C:\\parts\\one.sldprt")
  Dim second = Plan(folder, requested & "tail", "Default", "C:\\parts\\two.sldprt")
  Dim third = Plan(folder, requested & "extra", "Default", "C:\\parts\\three.sldprt")
  Check(first = folder & requested.Substring(0, 20) & ".dxf", "plain left truncation first")
  Check(second = folder & requested.Substring(0, 12) & "_Default.dxf", "configuration added only after collision")
  Check(third = folder & requested.Substring(0, 10) & "_Default_2.dxf", "number added after configuration collision")
  IO.File.WriteAllText(first, "first DXF")
  IO.File.WriteAllText(second, "second DXF")
  IO.File.WriteAllText(third, "third DXF")
  Check(Plan(folder, requested & "extra", "Default", "C:\\parts\\three.sldprt") = third, "rerun reverse order third")
  Check(Plan(folder, requested & "tail", "Default", "C:\\parts\\two.sldprt") = second, "rerun reverse order second")
  Check(Plan(folder, requested, "Default", "C:\\parts\\one.sldprt") = first, "rerun first stable")
  g_missingOnly = True
  Check(KeepExistingDxf(second), "same mapped nonempty export is skipped")
  IO.File.WriteAllText(second, "")
  Check(Not KeepExistingDxf(second), "same mapped empty export is retried")
  Check(Plan(folder, requested & "tail", "Default", "C:\\parts\\two.sldprt") = second, "empty export keeps its assigned name")
  IO.File.Move(second, second & ".preserved")
  Check(Not KeepExistingDxf(second) And Plan(folder, requested & "tail", "Default", "C:\\parts\\two.sldprt") = second, "removed export is recreated under the same name")
  g_missingOnly = False
  Check(Not KeepExistingDxf(first) And Plan(folder, requested, "Default", "C:\\parts\\one.sldprt") = first, "regenerate-all reuses owned output")
  Check(Plan(folder, requested, "Alternate", "C:\\parts\\one.sldprt") <> first, "same source file with another configuration stays distinct")
  Check(Plan(folder, requested & "_different_material_quantity", "Default", "C:\\parts\\one.sldprt") <> first, "changed output metadata cannot skip an unrelated old export")
  Check(Plan(folder, requested & "_PRECUT10", "Default", "C:\\parts\\one.sldprt") <> first, "precut cannot reuse a regular output after truncation")
  Dim cfg = "Configuration_with_a_very_long_name"
  Dim longCfg = Plan(folder, requested & "_long_cfg", cfg, "C:\\parts\\longcfg.sldprt")
  Check(longCfg.EndsWith("_" & cfg.Substring(0, 18) & ".dxf"), "long config shortened to fit")
  Check(Plan(folder, requested & "_long_cfg2", cfg & "_more", "C:\\parts\\longcfg2.sldprt").EndsWith("_2.dxf"), "long configuration collision numbered")
  Dim encoded = "C:\\parts\\percent%09_" & ChrW(&HE1) & ".sldprt" & vbTab & "config" & vbCrLf
  Check(DxfNameMapField(DxfNameMapField(encoded, True), False) = encoded, "UTF-8/tab/newline/percent identity roundtrip")
  Dim unicode = Plan(folder, requested & "_unicode", ChrW(&HE1) & "rv" & ChrW(&H171), encoded)
  Check(Plan(folder, requested & "_unicode", ChrW(&HE1) & "rv" & ChrW(&H171), encoded) = unicode, "Unicode identity persisted")
  Dim sanitizedA = Plan(folder, "same(A_B)", "A/B", "C:\\parts\\same.sldprt")
  Dim sanitizedB = Plan(folder, "same(A_B)", "A:B", "C:\\parts\\same.sldprt")
  Check(sanitizedA <> sanitizedB And Plan(folder, "same(A_B)", "A:B", "C:\\parts\\same.sldprt") = sanitizedB, "different raw configurations stay distinct")
  Dim unknownStem = "untracked_existing_longer_than_limit"
  IO.File.WriteAllText(folder & unknownStem.Substring(0, 20) & ".dxf", "unrelated content")
  IO.File.WriteAllText(folder & unknownStem.Substring(0, 12) & "_Default.dxf", "")
  Dim unknown = Plan(folder, unknownStem, "Default", "C:\\parts\\unknown.sldprt")
  Check(unknown.EndsWith("_Default_2.dxf"), "untracked nonempty and empty names are occupied")
  Check(IO.File.ReadAllText(folder & unknownStem.Substring(0, 20) & ".dxf") = "unrelated content", "existing unrelated DXF preserved")
  IO.File.WriteAllText(folder & "CASEFILE.dxf", "upper-case file")
  Check(Plan(folder, "casefile", "Default", "C:\\parts\\case.sldprt") <> folder & "casefile.dxf", "filesystem collisions are case insensitive")
  Check(Plan(folder, "CON", "Default", "C:\\parts\\device.sldprt") = folder & "_CON.dxf", "Windows device name guarded")
  Check(Not IO.Path.GetFileNameWithoutExtension(Plan(folder, "trailing-dot....... ", "Default", "C:\\parts\\dot.sldprt")).EndsWith("."), "trailing dots trimmed")
  Check(Plan(folder, "control" & vbTab & "name", "Default", "C:\\parts\\tab.sldprt").EndsWith("control_name.dxf"), "control characters removed from filename")
  Dim otherFolder = folder & "other\\"
  IO.Directory.CreateDirectory(otherFolder)
  Check(Plan(otherFolder, requested, "Default", "C:\\parts\\two.sldprt") = otherFolder & requested.Substring(0, 20) & ".dxf", "collision scope is one output folder")
  Dim longPath = Plan("${longFolder}\\", requested, "Default", "C:\\parts\\long-path.sldprt")
  Check(longPath.Length > 300 And Plan("${longFolder}\\", requested, "Default", "C:\\parts\\long-path.sldprt") = longPath, "native long-path map and reuse")
  Dim registry = folder & "DXF-names.tsv"
  Dim before = IO.File.ReadAllText(registry)
  Dim lock = DxfOpenNameFile(DxfNativePath(registry), &HC0000000, 0, 0, 4, 128, 0)
  Check(lock <> -1 And MustFail(folder, "exclusive map lock"), "concurrent allocator fails without overwriting")
  Check(activeHandles = 1, "only deliberately held lock remains")
  DxfCloseNameFile(lock)
  Check(activeHandles = 0 And IO.File.ReadAllText(registry) = before, "concurrent failure releases its handles and preserves registry")
  readFails = True
  Check(MustFail(folder, "read failed"), "read errors refuse allocation")
  readFails = False
  Check(activeHandles = 0 And IO.File.ReadAllText(registry) = before, "read failure closes handle")
  writeFails = True
  Check(MustFail(folder, "write failed"), "write errors refuse allocation")
  writeFails = False
  Check(activeHandles = 0 And IO.File.ReadAllText(registry) = before, "write failure closes handle and leaves no assignment")
  flushFails = True
  Check(MustFail(folder, "flush failed"), "flush error refuses export")
  flushFails = False
  Check(activeHandles = 0, "flush failure closes handle")
  Check(Plan(folder, "new-candidate", "Default", "C:\\parts\\new.sldprt").EndsWith("new-candidate.dxf"), "complete reservation reused after flush failure")
  Dim badFolder = folder & "bad\\"
  IO.Directory.CreateDirectory(badFolder)
  For Each invalid In New String() {"bad header" & vbCrLf, "Excelsis-DXF-names-v1" & vbCrLf & "partial", "Excelsis-DXF-names-v1" & vbCrLf & "..\\escape" & vbTab & "owner" & vbCrLf, "Excelsis-DXF-names-v1" & vbCrLf & "same" & vbTab & "owner" & vbCrLf & "SAME" & vbTab & "another" & vbCrLf}
    IO.File.WriteAllText(badFolder & "DXF-names.tsv", invalid, New Text.UTF8Encoding(False))
    Check(MustFail(badFolder, "malformed registry"), "corrupt/traversal/conflicting map rejected")
    Check(activeHandles = 0 And IO.File.ReadAllText(badFolder & "DXF-names.tsv") = invalid, "malformed map preserved")
  Next
  Using oversized = New IO.FileStream(badFolder & "DXF-names.tsv", IO.FileMode.Create)
    oversized.SetLength(DXF_NAME_MAP_MAX_BYTES + 1)
  End Using
  Check(MustFail(badFolder, "oversized registry") And activeHandles = 0, "bounded map read")
  Dim capacityFile = folder & "capacity-test.tsv"
  Using nearLimit = New IO.FileStream(capacityFile, IO.FileMode.Create)
    nearLimit.SetLength(DXF_NAME_MAP_MAX_BYTES - 2)
  End Using
  Dim capacityHandle = DxfOpenNameFile(DxfNativePath(capacityFile), &HC0000000, 0, 0, 4, 128, 0)
  Dim capacityRefused As Boolean
  Try
    AppendDxfNameRegistry(capacityHandle, "too large")
  Catch
    capacityRefused = True
  Finally
    DxfCloseNameFile(capacityHandle)
  End Try
  Check(capacityRefused And activeHandles = 0 And New IO.FileInfo(capacityFile).Length = DXF_NAME_MAP_MAX_BYTES - 2, "append refuses to grow past the read limit without changing the file")
  Dim batch = folder & "batch\\"
  IO.Directory.CreateDirectory(batch)
  Dim assigned As New Collections.Generic.HashSet(Of String)(StringComparer.OrdinalIgnoreCase)
  For i = 1 To 120
    Check(assigned.Add(Plan(batch, "abcdefghijklmnopqrst-more", "Default", "C:\\parts\\batch" & i & ".sldprt")), "unique batch name")
  Next
  Dim last = Plan(batch, "abcdefghijklmnopqrst-more", "Default", "C:\\parts\\batch120.sldprt")
  Check(last.EndsWith("_Default_119.dxf"), "number growth stays within 20")
  Check(activeHandles = 0, "no file handle left after batch")
  Console.WriteLine("PASS ${file}: 20-character names, config/number collisions, persistent reruns, unrelated files, Unicode, long paths, locks and failure cleanup.")
End Sub
End Module
`);
  const compiler = path.join(process.env.WINDIR || "C:\\Windows", "Microsoft.NET", "Framework64", "v4.0.30319", "vbc.exe");
  const build = spawnSync(compiler, ["/nologo", "/target:exe", "/out:" + output, input], { encoding: "utf8", windowsHide: true, timeout: 60000 });
  assert.equal(build.status, 0, input + "\n" + build.stdout + "\n" + build.stderr);
  const result = spawnSync(output, [], { encoding: "utf8", windowsHide: true, timeout: 60000 });
  assert.equal(result.status, 0, input + "\n" + result.stdout + "\n" + result.stderr);
  assert.ok(fs.readFileSync(path.join(dir, "DXF-names.tsv"), "utf8").startsWith("Excelsis-DXF-names-v1\r\n"));
  console.log(result.stdout.trim());
}
