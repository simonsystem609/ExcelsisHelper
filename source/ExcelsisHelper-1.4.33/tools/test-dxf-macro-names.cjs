"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const names = [
  "ClaimDxfOutput", "DxfSafeOutputStem", "DxfBoundedOutputStem", "DxfNameMapField",
  "DxfReadablePartName", "DxfShortWord", "DxfCompactWords", "DxfSemanticName", "DxfNameSourceKey", "DxfSemanticNameOwners",
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
Dim testPrefix As String = "LV"
Function ConfiguredDxfOutputPrefix() As String
  Return testPrefix
End Function
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
Function Plan(folder As String, name As String, cfg As String, part As String, Optional thickness As String = "3", Optional material As String = "S235", Optional quantity As Integer = 1, Optional suffix As String = "") As String
  Dim value = ClaimDxfOutput(folder, part, cfg, name, thickness, material, quantity, suffix)
  Dim stem = IO.Path.GetFileNameWithoutExtension(value)
  Check(stem.Length > 0 And stem.Length <= 20 And value.EndsWith(".dxf"), "20 characters before extension: " & stem)
  Check(stem.StartsWith(CStr(quantity) & "x" & testPrefix & thickness & "_" & material & "_"), "quantity-first prefix on every export: " & stem)
  Check(activeHandles = 0, "registry handle released")
  Return value
End Function
Function PreviousReadableOwner(part As String, cfg As String, name As String, Optional thickness As String = "3", Optional material As String = "S235", Optional quantity As Integer = 1, Optional suffix As String = "") As String
  Dim originalMetadata = testPrefix & thickness & "_" & material & "_" & CStr(quantity) & "db_"
  Dim compactMetadata = CStr(quantity) & "x" & testPrefix & thickness & "_" & material & "_"
  Dim originalStem = originalMetadata & DxfSafeOutputStem(name)
  If cfg <> "" And StrComp(cfg, "Default", vbTextCompare) <> 0 Then originalStem &= "(" & DxfSafeOutputStem(cfg) & ")"
  originalStem &= suffix
  Return "readable-v2" & vbTab & DxfNameMapField(LCase(part), True) & vbTab & DxfNameMapField(cfg, True) & vbTab & DxfNameMapField(originalMetadata, True) & vbTab & DxfNameMapField(compactMetadata, True) & vbTab & DxfNameMapField(originalStem, True) & vbTab & DxfNameMapField(suffix, True)
End Function
Function MustFail(folder As String, label As String) As Boolean
  Try
    ClaimDxfOutput(folder, "C:\\parts\\new.sldprt", "Default", "new-candidate", "3", "S235", 1)
  Catch
    Return True
  End Try
  Throw New Exception("Expected failure: " & label)
End Function
Sub Main()
  Dim folder As String = "${dir}\\"
  Check(Plan(folder, "bracket01", "Default", "C:\\parts\\exact.sldprt") = folder & "1xLV3_S235_bracket01.dxf", "exactly 20 characters preserved with the standard prefix")
  Check(Plan(folder, "cap", "Default", "C:\\parts\\short.sldprt") = folder & "1xLV3_S235_cap.dxf", "short part name preserved with the standard prefix, no padding or numbering")
  Check(Plan(folder, "cap", "M6", "C:\\parts\\short-config.sldprt") = folder & "1xLV3_S235_cap(M6).dxf", "short full part/config preserved without abbreviation")
  Check(Plan(folder, "alja", "Default", "C:\\parts\\alja.sldprt", "10") = folder & "1xLV10_S235_alja.dxf", "alja uses 1x even though its full name fits")
  Check(Plan(folder, "cap", "Default", "C:\\parts\\short.sldprt", "3", "S235", 12) = folder & "12xLV3_S235_cap.dxf", "multi-digit quantities use the same standard prefix")
  testPrefix = ""
  Check(Plan(folder, "p_2026.09.30", "Default", "C:\\parts\\short-date.sldprt", "1", "X") = folder & "1x1_X_p_2026.09.30.dxf", "date retained if the full name already fits")
  testPrefix = "LV"
  Dim requested = "stopbracketbase_SHOP_2026.09.30"
  Dim first = Plan(folder, requested, "Default", "C:\\parts\\one.sldprt")
  Dim second = Plan(folder, requested, "Default", "C:\\parts\\two.sldprt")
  Dim third = Plan(folder, requested, "Default", "C:\\parts\\three.sldprt")
  Check(first = folder & "1xLV3_S235_stopbbase.dxf", "full 20-character budget preserves compound name beginning and end")
  Check(second.EndsWith("_2.dxf") And third.EndsWith("_3.dxf"), "only actual part/name collisions numbered")
  IO.File.WriteAllText(first, "first DXF")
  IO.File.WriteAllText(second, "second DXF")
  IO.File.WriteAllText(third, "third DXF")
  Check(Plan(folder, requested, "Default", "C:\\parts\\three.sldprt") = third, "rerun reverse order third")
  Check(Plan(folder, requested, "Default", "C:\\parts\\two.sldprt") = second, "rerun reverse order second")
  Check(Plan(folder, requested, "Default", "C:\\parts\\one.sldprt") = first, "rerun first stable")
  g_missingOnly = True
  Check(KeepExistingDxf(second), "same mapped nonempty export is skipped")
  IO.File.WriteAllText(second, "")
  Check(Not KeepExistingDxf(second), "same mapped empty export is retried")
  Check(Plan(folder, requested, "Default", "C:\\parts\\two.sldprt") = second, "empty export keeps its assigned name")
  IO.File.Move(second, second & ".preserved")
  Check(Not KeepExistingDxf(second) And Plan(folder, requested, "Default", "C:\\parts\\two.sldprt") = second, "removed export is recreated under the same name")
  g_missingOnly = False
  Check(Not KeepExistingDxf(first) And Plan(folder, requested, "Default", "C:\\parts\\one.sldprt") = first, "regenerate-all reuses owned output")
  Check(Plan(folder, requested, "Alternate", "C:\\parts\\one.sldprt") <> first, "same source file with another configuration stays distinct")
  Dim otherMetadata = Plan(folder, requested, "Default", "C:\\parts\\one.sldprt", "3", "S355")
  Check(otherMetadata <> first And Not otherMetadata.EndsWith("_2.dxf"), "changed metadata is distinct without unnecessary numbering of the same source")
  Check(Plan(folder, requested, "Default", "C:\\parts\\one.sldprt", "3", "S235", 1, "_PRECUT10") <> first, "precut cannot reuse a regular output after truncation")
  Dim m10 = Plan(folder, requested, "M10", "C:\\parts\\one.sldprt", "16", "S235", 2)
  Check(m10.EndsWith("base_M10.dxf"), "non-default configuration always present even without filename collision")
  Dim otherThickness = Plan(folder, requested, "Default", "C:\\parts\\different-thickness.sldprt", "8")
  Check(otherThickness.EndsWith("_4.dxf"), "different sources cannot differ only in thickness")
  Dim cfg = "Configuration_with_a_very_long_name"
  Dim longCfg = Plan(folder, requested & "_long_cfg", cfg, "C:\\parts\\longcfg.sldprt")
  Check(Not longCfg.Contains("2026.") And Not longCfg.Contains("Default") And IO.Path.GetFileNameWithoutExtension(longCfg).Length = 20, "long part/config abbreviations fill the available budget")
  Check(DxfCompactWords("support mounting bracket", 12) = "sup_mou_brac", "each word receives a budget instead of dropping later words")
  Check(DxfReadablePartName("bracket__SHOP_2026.09.30_090558") = "bracket", "date/time and company tag removed before abbreviation")
  Dim encoded = "C:\\parts\\percent%09_" & ChrW(&HE1) & ".sldprt" & vbTab & "config" & vbCrLf
  Check(DxfNameMapField(DxfNameMapField(encoded, True), False) = encoded, "UTF-8/tab/newline/percent identity roundtrip")
  Dim unicode = Plan(folder, requested & "_unicode", ChrW(&HE1) & "rv" & ChrW(&H171), encoded)
  Check(Plan(folder, requested & "_unicode", ChrW(&HE1) & "rv" & ChrW(&H171), encoded) = unicode, "Unicode identity persisted")
  Dim sanitizedA = Plan(folder, "same(A_B)", "A/B", "C:\\parts\\same.sldprt")
  Dim sanitizedB = Plan(folder, "same(A_B)", "A:B", "C:\\parts\\same.sldprt")
  Check(sanitizedA <> sanitizedB And Plan(folder, "same(A_B)", "A:B", "C:\\parts\\same.sldprt") = sanitizedB, "different raw configurations stay distinct")
  IO.File.WriteAllText(folder & "1xLV3_S235_pin.dxf", "unrelated content")
  IO.File.WriteAllText(folder & "1xLV3_S235_pin_2.dxf", "")
  Dim unknown = Plan(folder, "pin", "Default", "C:\\parts\\unknown.sldprt")
  Check(unknown.EndsWith("pin_3.dxf"), "untracked nonempty and empty names are occupied")
  Check(IO.File.ReadAllText(folder & "1xLV3_S235_pin.dxf") = "unrelated content", "existing unrelated DXF preserved")
  IO.File.WriteAllText(folder & "1xLV3_S235_CASE.dxf", "upper-case file")
  Check(Plan(folder, "case", "Default", "C:\\parts\\case.sldprt").EndsWith("case_2.dxf"), "filesystem collisions are case insensitive")
  Check(DxfSafeOutputStem("CON") = "_CON", "Windows device name guarded")
  Check(Not IO.Path.GetFileNameWithoutExtension(Plan(folder, "trailing-dot....... ", "Default", "C:\\parts\\dot.sldprt")).EndsWith("."), "trailing dots trimmed")
  Check(Not Plan(folder, "control" & vbTab & "name", "Default", "C:\\parts\\tab.sldprt").Contains(vbTab), "control characters removed from filename")
  Dim otherFolder = folder & "other\\"
  IO.Directory.CreateDirectory(otherFolder)
  Check(IO.Path.GetFileName(Plan(otherFolder, requested, "Default", "C:\\parts\\two.sldprt")) = IO.Path.GetFileName(first), "collision scope is one output folder")
  Dim legacyFolder = folder & "legacy\\"
  IO.Directory.CreateDirectory(legacyFolder)
  Dim legacyMap = "Excelsis-DXF-names-v1" & vbCrLf & "LV3_S235_1db_stopbra" & vbTab & DxfNameMapField("C:\\parts\\one.sldprt" & vbTab & "Default" & vbTab & "LV3_S235_1db_" & requested & "(Default)", True) & vbCrLf
  Dim legacyShort = "LV3_S235_1db_cap(M6)"
  legacyMap &= legacyShort & vbTab & DxfNameMapField("c:\\parts\\cap.sldprt" & vbTab & "M6" & vbTab & legacyShort, True) & vbCrLf
  IO.File.WriteAllText(legacyFolder & "DXF-names.tsv", legacyMap, New Text.UTF8Encoding(False))
  IO.File.WriteAllText(legacyFolder & "LV3_S235_1db_stopbra.dxf", "old export")
  Dim migrated = Plan(legacyFolder, requested, "Default", "C:\\parts\\one.sldprt")
  Check(IO.Path.GetFileName(migrated) = IO.Path.GetFileName(first), "old name reservations do not pin the improved name to a clipped label")
  Check(IO.File.ReadAllText(legacyFolder & "DXF-names.tsv").StartsWith(legacyMap) And IO.File.ReadAllText(legacyFolder & "LV3_S235_1db_stopbra.dxf") = "old export", "legacy map and output preserved")
  IO.File.WriteAllText(legacyFolder & legacyShort & ".dxf", "unchanged short export")
  Check(Plan(legacyFolder, "cap", "M6", "C:\\parts\\cap.sldprt") = legacyFolder & "1xLV3_S235_cap(M6).dxf", "old short db-format assignments do not override the standard prefix")
  Check(IO.File.ReadAllText(legacyFolder & legacyShort & ".dxf") = "unchanged short export", "old short-format file remains untouched")
  Dim currentLegacyStem = "1xLV3_S235_tip(M6)"
  Dim currentLegacyOwner = "c:\\parts\\tip.sldprt" & vbTab & "M6" & vbTab & currentLegacyStem
  IO.File.AppendAllText(legacyFolder & "DXF-names.tsv", currentLegacyStem & vbTab & DxfNameMapField(currentLegacyOwner, True) & vbCrLf, New Text.UTF8Encoding(False))
  Check(Plan(legacyFolder, "tip", "M6", "C:\\parts\\tip.sldprt") = legacyFolder & currentLegacyStem & ".dxf", "a full legacy assignment already using the standard prefix is reused")
  Dim previousFolder = folder & "previous-readable\\"
  IO.Directory.CreateDirectory(previousFolder)
  Dim previousMap = "Excelsis-DXF-names-v1" & vbCrLf
  previousMap &= IO.Path.GetFileNameWithoutExtension(first) & vbTab & DxfNameMapField(PreviousReadableOwner("C:\\parts\\one.sldprt", "Default", requested), True) & vbCrLf
  previousMap &= IO.Path.GetFileNameWithoutExtension(second) & vbTab & DxfNameMapField(PreviousReadableOwner("C:\\parts\\two.sldprt", "Default", requested), True) & vbCrLf
  previousMap &= IO.Path.GetFileNameWithoutExtension(m10) & vbTab & DxfNameMapField(PreviousReadableOwner("C:\\parts\\one.sldprt", "M10", requested, "16", "S235", 2), True) & vbCrLf
  Dim previousAlja = "LV10_S235_1db_alja"
  previousMap &= previousAlja & vbTab & DxfNameMapField(PreviousReadableOwner("C:\\parts\\alja.sldprt", "Default", "alja_SHOP_2026.09.30", "10"), True) & vbCrLf
  IO.File.WriteAllText(previousFolder & "DXF-names.tsv", previousMap, New Text.UTF8Encoding(False))
  IO.File.WriteAllText(previousFolder & previousAlja & ".dxf", "old alja export")
  Check(IO.Path.GetFileName(Plan(previousFolder, requested, "Default", "C:\\parts\\two.sldprt")) = IO.Path.GetFileName(second), "previous readable numbered quantity-first assignment survives reordered reruns")
  Check(IO.Path.GetFileName(Plan(previousFolder, requested, "Default", "C:\\parts\\one.sldprt")) = IO.Path.GetFileName(first), "previous readable quantity-first assignment remains stable")
  Check(IO.Path.GetFileName(Plan(previousFolder, requested, "M10", "C:\\parts\\one.sldprt", "16", "S235", 2)) = IO.Path.GetFileName(m10), "previous readable configuration assignment remains stable")
  Check(IO.File.ReadAllText(previousFolder & "DXF-names.tsv") = previousMap, "compatible assignments are reused without rewriting the map")
  Dim newAlja = Plan(previousFolder, "alja_SHOP_2026.09.30", "Default", "C:\\parts\\alja.sldprt", "10")
  Check(newAlja = previousFolder & "1xLV10_S235_alja.dxf", "previous readable db-format alja moves to the standard prefix")
  Check(Plan(previousFolder, "alja_SHOP_2026.09.30", "Default", "C:\\parts\\alja.sldprt", "10") = newAlja, "new prefix reservation stays stable after migration")
  Check(IO.File.ReadAllText(previousFolder & "DXF-names.tsv").StartsWith(previousMap) And IO.File.ReadAllText(previousFolder & previousAlja & ".dxf") = "old alja export", "old readable reservations and DXFs are preserved")
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
  Dim afterFlush = Plan(folder, "new-candidate", "Default", "C:\\parts\\new.sldprt")
  Check(Plan(folder, "new-candidate", "Default", "C:\\parts\\new.sldprt") = afterFlush, "complete reservation reused after flush failure")
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
  Check(last.EndsWith("_120.dxf"), "number growth stays within 20")
  Check(activeHandles = 0, "no file handle left after batch")
  Console.WriteLine("PASS ${file}: uniform quantity-first prefixes, readable 20-character names, unshortened fitting part/config names, cross-thickness collision numbering, persistent reruns and compatible map migration.")
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
