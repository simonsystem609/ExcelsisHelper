"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { inspectDxfMetadata } = require("./read-dxf-metadata.cjs");
const root = path.resolve(__dirname, "..");
const names = [
  "ClaimDxfOutput", "DxfSafeOutputStem", "DxfBoundedOutputStem", "DxfNameMapField",
  "DxfReadablePartName", "DxfShortWord", "DxfCompactWords", "DxfSemanticName", "DxfNameSourceKey", "DxfSemanticNameOwners",
  "ChooseDxfOutputStem", "ClaimShortDxfName", "CleanFileName",
  "DxfNativePath", "ReadDxfPathInfo", "DxfFileBytes", "KeepExistingDxf",
  "DxfFitNameMetadata", "DxfNumberedOutputStem", "DxfNumberToken", "DxfNumberKey",
  "DxfFoundName", "DxfUsedNameNumbers", "DxfAssignedMetadata", "DxfNewOutputNeedsNoReplace",
  "DxfUtf8Bytes", "DxfSha256", "DxfDigestValid", "DxfEmbeddedOwnerRecord", "DxfJsonString",
  "DxfMetadataJson", "DxfOwnerHex", "DxfMetadataChunks", "DxfMetadataHeader",
  "ParseDxfMetadataHeader", "ReadDxfMetadataOwner", "DxfFolderNameIndex",
  "DxfOutputMetadataOwner", "VerifyDxfClaimedIdentity", "DxfWithEmbeddedMetadata",
  "InitializeDxfGlobalNames", "RegisterDxfGlobalName", "DxfGlobalNameAvailable", "StripTrailingPathSeparator",
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
    .replace(/\b(\d+)&/g, "$1")
    .replace(/\b(LCase|Trim|Replace|Mid|Left|Right|Chr)\$/g, "$1")
    .replace(/\bStrPtr\((\w+)\)/g, "$1")
    .replace(/\bVarPtr\((\w+)\(0\)\)/g, "$1")
    .replace(/\bArray\(((?:[^()\r\n]|\([^()\r\n]*\))*)\)/g, "New Object() {$1}")
    .replace(/\bThen Err\.Raise (.+)$/gm, "Then Err.Raise($1)")
    .replace(/\bThen DxfCloseNameFile (.+)$/gm, "Then DxfCloseNameFile($1)")
    .replace(/\bThen DxfFindCloseName (.+)$/gm, "Then DxfFindCloseName($1)")
    .replace(/\bThen TraceRun (.+)$/gm, "Then TraceRun($1)")
    .replace(/^([ \t]*)(\w+\.(?:Add|Remove)) (.+)$/gm, "$1$2($3)")
    .replace(/^([ \t]*)(Err\.Raise|TraceRun|DxfCloseNameFile|VerifyDxfClaimedIdentity|RegisterDxfGlobalName|InitializeDxfGlobalNames|stream\.Write|stream\.WriteText) (.+)$/gm, "$1$2($3)");
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
  for (const api of ["DxfOpenNameFile", "DxfSeekNameFile", "DxfHashData", "DxfReadNameFile", "DxfWriteNameFile", "DxfFlushNameFile", "DxfCloseNameFile"]) {
    assert.match(source, new RegExp("Declare PtrSafe Function " + api + " .*LongPtr"));
    assert.match(source, new RegExp("Declare Function " + api + " .*Long"));
  }
  for (const api of ["DxfFindFirstName", "DxfFindNextName", "DxfFindCloseName"]) {
    assert.match(source, new RegExp("Declare PtrSafe Function " + api + " .*LongPtr"));
    assert.match(source, new RegExp("Declare Function " + api + " .*Long"));
  }
  assert.match(source, /Private Type DxfNameFindData\s+[^\n]*\n\s*raw\(0 To 607\) As Byte/);
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
  const constants = source.split(/\r?\n/).filter((line) => /^Const DXF_(?:FILENAME_LIMIT|METADATA_MAX_BYTES|NAME_INDEX_MAX_BYTES)/.test(line));
  fs.writeFileSync(input, `Option Strict Off
Imports System
Imports System.Runtime.InteropServices
Imports System.Linq
Imports Microsoft.VisualBasic
Module NameChecks
${adapt(constants.join("\n"))}
${type}
<StructLayout(LayoutKind.Sequential)> Private Structure DxfNameFindData
  <MarshalAs(UnmanagedType.ByValArray, SizeConst:=608)> Public raw As Byte()
End Structure
<DllImport("kernel32.dll", EntryPoint:="FindFirstFileW", CharSet:=CharSet.Unicode, SetLastError:=True)>
Private Function NativeFindFirst(name As String, ByRef data As DxfNameFindData) As IntPtr
End Function
<DllImport("kernel32.dll", EntryPoint:="FindNextFileW", SetLastError:=True)>
Private Function NativeFindNext(handle As IntPtr, ByRef data As DxfNameFindData) As Integer
End Function
<DllImport("kernel32.dll", EntryPoint:="FindClose", SetLastError:=True)>
Private Function NativeFindClose(handle As IntPtr) As Integer
End Function
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
<DllImport("kernel32.dll", EntryPoint:="MoveFileExW", CharSet:=CharSet.Unicode, SetLastError:=True)>
Private Function NativeMove(source As String, destination As String, flags As Integer) As Integer
End Function
<DllImport("kernel32.dll", EntryPoint:="SetFilePointer", SetLastError:=True)>
Private Function NativeSeek(handle As IntPtr, distance As Integer, ByRef high As Integer, method As Integer) As Integer
End Function
<DllImport("bcrypt.dll", EntryPoint:="BCryptHash")>
Private Function NativeHash(algorithm As IntPtr, secret As IntPtr, secretBytes As Integer, input As Byte(), inputBytes As Integer, output As Byte(), outputBytes As Integer) As Integer
End Function
<DllImport("kernel32.dll", EntryPoint:="GetFileAttributesExW", CharSet:=CharSet.Unicode, SetLastError:=True)>
Private Function DxfGetFileAttributesEx(name As String, level As Integer, ByRef data As DxfFileData) As Integer
End Function
Dim activeHandles As Integer, writeFails As Boolean, flushFails As Boolean, readFails As Boolean
Dim deliberatelyHeldHandles As Integer
Dim activeSearchHandles As Integer, g_newOutputNames As Object
Dim g_dxfNameIndexes As Object, g_dxfExpectedOwners As Object
Dim g_globalDxfNames As Object, g_globalDxfNumbers As Object, g_globalDxfRoot As String
Dim searchFirstFails As Boolean, searchNextFails As Boolean
<DllImport("kernel32.dll", EntryPoint:="SetLastError", SetLastError:=True)>
Private Sub NativeSetError(code As Integer)
End Sub
Dim g_missingOnly As Boolean, g_candidateExisting As Boolean, g_existingCount As Integer
Dim traces As New Collections.Generic.List(Of String)
Dim testPrefix As String = "LV"
Function ConfiguredDxfOutputPrefix() As String
  Return testPrefix
End Function
Function DxfStopRequested() As Boolean
  Return False
End Function
Function DxfOpenNameFile(name As String, access As Integer, sharing As Integer, security As Integer, creation As Integer, flags As Integer, template As Integer) As Long
  Dim h = NativeOpen(name, access, sharing, IntPtr.Zero, creation, flags, IntPtr.Zero)
  If h.ToInt64() <> -1 Then activeHandles += 1
  Return h.ToInt64()
End Function
Function DxfNameFileSize(handle As Object, ByRef high As Integer) As Integer
  Return NativeSize(New IntPtr(CLng(handle)), high)
End Function
Function DxfSeekNameFile(handle As Object, distance As Integer, ByRef high As Integer, method As Integer) As Integer
  Return NativeSeek(New IntPtr(CLng(handle)), distance, high, method)
End Function
Function DxfHashData(algorithm As Integer, secret As Integer, secretBytes As Integer, input As Byte(), inputBytes As Integer, output As Byte(), outputBytes As Integer) As Integer
  Return NativeHash(New IntPtr(algorithm), IntPtr.Zero, secretBytes, input, inputBytes, output, outputBytes)
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
Private Function DxfFindFirstName(name As String, ByRef data As DxfNameFindData) As Long
  If searchFirstFails Then
    NativeSetError(5) : Return -1
  End If
  data.raw = New Byte(607) {}
  Dim handle = NativeFindFirst(name, data)
  If handle.ToInt64() <> -1 Then activeSearchHandles += 1
  Return handle.ToInt64()
End Function
Private Function DxfFindNextName(handle As Object, ByRef data As DxfNameFindData) As Integer
  If searchNextFails Then
    NativeSetError(5) : Return 0
  End If
  Return NativeFindNext(New IntPtr(CLng(handle)), data)
End Function
Function DxfFindCloseName(handle As Object) As Integer
  Dim result = NativeFindClose(New IntPtr(CLng(handle)))
  If result <> 0 Then activeSearchHandles -= 1
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
  Dim metadata = CStr(quantity) & "x" & testPrefix & thickness & "_" & material & "_"
  Check(stem.StartsWith(metadata) OrElse traces.Exists(Function(t) t.StartsWith("output filename-prefix-shortened original=" & metadata)), "prefix kept or explicitly diagnosed when it alone exceeds the budget: " & stem)
  Check(activeHandles = deliberatelyHeldHandles And activeSearchHandles = 0, "owned file and filename-search handles released")
  If DxfFileBytes(value) < 0 Then
    Dim raw = "${dir}\\" & ".native-" & Guid.NewGuid().ToString("N") & ".tmp"
    IO.File.WriteAllText(raw, "0" & vbCrLf & "SECTION" & vbCrLf & "2" & vbCrLf & "ENTITIES" & vbCrLf & "0" & vbCrLf & "ENDSEC" & vbCrLf & "0" & vbCrLf & "EOF" & vbCrLf, New Text.UTF8Encoding(False))
    Dim staged = DxfWithEmbeddedMetadata(raw, CStr(g_dxfExpectedOwners(value)))
    Check(NativeMove(DxfNativePath(staged), DxfNativePath(value), 0) <> 0, "native no-replace fixture publication")
  End If
  Check(ReadDxfMetadataOwner(value) = CStr(g_dxfExpectedOwners(value)), "saved file owns its full naming request")
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
  Check(DxfSha256("abc") = "BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD", "native Windows SHA-256 known vector")
  Check(DxfSha256("") = "E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855", "empty SHA-256 known vector")
  Dim exact = Plan(folder, "bracket01", "Default", "C:\\parts\\exact.sldprt")
  Check(exact = folder & "1xLV3_S235_bracket01.dxf", "fitting full name stays unchanged")
  Check(Plan(folder, "cap", "Default", "C:\\parts\\short.sldprt") = folder & "1xLV3_S235_cap.dxf", "short name is not padded or numbered")
  Check(Plan(folder, "cap", "M6", "C:\\parts\\config.sldprt") = folder & "1xLV3_S235_cap(M6).dxf", "full short configuration retained")
  Check(Plan(folder, "alja", "Default", "C:\\parts\\alja.sldprt", "10") = folder & "1xLV10_S235_alja.dxf", "quantity-first prefix always used")
  Check(Plan(folder, "cap", "Default", "C:\\parts\\short.sldprt", "3", "S235", 12) = folder & "12xLV3_S235_cap.dxf", "multi-digit quantity prefix")
  testPrefix = ""
  Check(Plan(folder, "p_2026.09.30", "Default", "C:\\parts\\date.sldprt", "1", "X") = folder & "1x1_X_p_2026.09.30.dxf", "fitting date is not removed")
  testPrefix = "LV"
  Dim requested = "stopbracketbase_SHOP_2026.09.30"
  Dim first = Plan(folder, requested, "Default", "C:\\parts\\one.sldprt")
  Dim second = Plan(folder, requested, "Default", "C:\\parts\\two.sldprt")
  Dim third = Plan(folder, requested, "Default", "C:\\parts\\three.sldprt")
  Check(first = folder & "1xLV3_S235_stopbbase.dxf", "compound name uses complete available budget")
  Check(second.EndsWith("_02.dxf") And third.EndsWith("_03.dxf"), "unique fallback numbers skip natural 01 suffix")
  g_dxfNameIndexes = Nothing : g_dxfExpectedOwners = Nothing : g_newOutputNames = Nothing
  Check(Plan(folder, requested, "Default", "C:\\parts\\three.sldprt") = third, "disk metadata survives restart and reversed processing order")
  Check(Plan(folder, requested, "Default", "C:\\parts\\one.sldprt") = first, "disk metadata restores original assignment")
  Check(Plan(folder, requested, "Default", "C:\\parts\\two.sldprt") = second, "disk metadata restores numbered assignment")
  g_missingOnly = True
  Check(KeepExistingDxf(second), "verified owned nonempty DXF is skipped")
  IO.File.Move(second, second & ".preserved")
  Check(Not KeepExistingDxf(second) And Plan(folder, requested, "Default", "C:\\parts\\two.sldprt") = second, "missing export is rebuilt from the current-run reservation")
  g_missingOnly = False
  Check(Not KeepExistingDxf(first), "explicit regenerate-all accepts matching ownership")
  Check(Plan(folder, requested, "Alternate", "C:\\parts\\one.sldprt") <> first, "configurations have independent files")
  Check(Plan(folder, requested, "Default", "C:\\parts\\one.sldprt", "3", "S355") <> first, "changed naming metadata stays distinct")
  Check(Plan(folder, requested, "Default", "C:\\parts\\one.sldprt", "3", "S235", 1, "_PRECUT10") <> first, "precut identity stays distinct")
  Dim m10 = Plan(folder, requested, "M10", "C:\\parts\\one.sldprt", "16", "S235", 2)
  Check(m10.EndsWith("base_M10.dxf"), "short configuration retained without needless numbering")
  Dim otherThickness = Plan(folder, requested, "Default", "C:\\parts\\different-thickness.sldprt", "8")
  Check(otherThickness.EndsWith("_04.dxf"), "different sources cannot differ only in thickness")
  Dim longCfg = Plan(folder, requested & "_long_cfg", "Configuration_with_a_very_long_name", "C:\\parts\\longcfg.sldprt")
  Check(IO.Path.GetFileNameWithoutExtension(longCfg).Length = 20 And Not longCfg.Contains("2026."), "word abbreviation fills 20 characters after removing date")
  Check(DxfCompactWords("support mounting bracket", 12) = "sup_mou_brac", "all words receive budget")
  Check(DxfReadablePartName("bracket__SHOP_2026.09.30_090558") = "bracket", "date/time removed before abbreviation")
  Dim encoded = "C:\\parts\\percent%09_" & ChrW(&HE1) & ".sldprt" & vbTab & "config" & vbCrLf
  Check(DxfNameMapField(DxfNameMapField(encoded, True), False) = encoded, "identity field escaping roundtrip")
  Dim unicodeCfg = ChrW(&HE1) & "rv" & ChrW(&H171) & ChrW(34) & "\\" & vbTab & "%"
  Dim unicode = Plan(folder, requested & "_unicode", unicodeCfg, encoded)
  Dim unicodeOwner = ReadDxfMetadataOwner(unicode)
  Check(DxfMetadataJson(unicodeOwner).Contains("\\u00E1") And DxfMetadataJson(unicodeOwner).Contains("\\u0009"), "JSON Unicode and control escaping")
  Check(Plan(folder, "same(A_B)", "A/B", "C:\\parts\\same.sldprt") <> Plan(folder, "same(A_B)", "A:B", "C:\\parts\\same.sldprt"), "raw configurations remain distinct after filename sanitization")
  IO.File.WriteAllText(folder & "1xLV3_S235_pin.dxf", "unrelated content")
  IO.File.WriteAllText(folder & "1xLV3_S235_pin_2.dxf", "")
  Dim unknown = Plan(folder, "pin", "Default", "C:\\parts\\unknown.sldprt")
  Check(unknown <> folder & "1xLV3_S235_pin.dxf" And DxfNumberKey(DxfNumberToken(IO.Path.GetFileNameWithoutExtension(unknown))) <> "2", "unowned and empty files occupy names and numbers")
  Check(IO.File.ReadAllText(folder & "1xLV3_S235_pin.dxf") = "unrelated content", "unknown geometry untouched")
  IO.File.WriteAllText(folder & "1xLV3_S235_CASE.dxf", "upper-case file")
  Check(Plan(folder, "case", "Default", "C:\\parts\\case.sldprt") <> folder & "1xLV3_S235_case.dxf", "case-insensitive filesystem collision")
  Check(DxfSafeOutputStem("CON") = "_CON", "device-name guard")
  Check(Not IO.Path.GetFileNameWithoutExtension(Plan(folder, "trailing-dot....... ", "Default", "C:\\parts\\dot.sldprt")).EndsWith("."), "trailing dots trimmed")
  Check(Not Plan(folder, "control" & vbTab & "name", "Default", "C:\\parts\\tab.sldprt").Contains(vbTab), "filename controls removed")
  Dim legacy = folder & "legacy\\"
  IO.Directory.CreateDirectory(legacy)
  Dim legacyMap = "unrecognized old TSV is no longer used" & vbCrLf
  IO.File.WriteAllText(legacy & "DXF-names.tsv", legacyMap)
  IO.File.Copy(first, legacy & IO.Path.GetFileName(first))
  Dim lockedTsv = DxfOpenNameFile(DxfNativePath(legacy & "DXF-names.tsv"), &HC0000000, 0, 0, 3, 128, 0)
  deliberatelyHeldHandles = 1
  Check(Plan(legacy, requested, "Default", "C:\\parts\\one.sldprt") = legacy & IO.Path.GetFileName(first), "tagged output reuses its identity even with a malformed locked legacy TSV")
  DxfCloseNameFile(lockedTsv)
  deliberatelyHeldHandles = 0
  Check(IO.File.ReadAllText(legacy & "DXF-names.tsv") = legacyMap, "old TSV remains byte-identical")
  IO.File.WriteAllText(legacy & "1xLV3_S235_old.dxf", "old untagged export")
  Dim newLegacy = Plan(legacy, "old", "Default", "C:\\parts\\old.sldprt")
  Check(newLegacy <> legacy & "1xLV3_S235_old.dxf" And IO.File.ReadAllText(legacy & "1xLV3_S235_old.dxf") = "old untagged export", "old untagged exports are never claimed or overwritten")
  Dim longPath = Plan("${longFolder}\\", requested, "Default", "C:\\parts\\long.sldprt")
  g_dxfNameIndexes = Nothing
  Check(longPath.Length > 300 And Plan("${longFolder}\\", requested, "Default", "C:\\parts\\long.sldprt") = longPath, "native long-path persistent identity")
  Dim locked = DxfOpenNameFile(DxfNativePath(exact), &H80000000, 0, 0, 3, 128, 0)
  g_dxfNameIndexes = Nothing
  Check(locked <> -1 And MustFail(folder, "locked DXF header"), "locked identity cannot be silently ignored")
  DxfCloseNameFile(locked)
  Check(activeHandles = 0 And activeSearchHandles = 0, "failed identity lookup closes all owned handles")
  readFails = True : g_dxfNameIndexes = Nothing
  Check(MustFail(folder, "header read failure"), "incomplete native identity read fails safely")
  readFails = False : g_dxfNameIndexes = Nothing
  Dim corrupt = folder & "corrupt\\"
  IO.Directory.CreateDirectory(corrupt)
  Dim header = DxfMetadataHeader(unicodeOwner)
  For Each broken As String In New String() {header.Replace("EXCELSIS-DXF-META-V1-END", "truncated"), header.Replace("EXCELSIS-DXF-JSON ", "BROKEN "), header.Replace("EXCELSIS-DXF-CHECKSUM ", "EXCELSIS-DXF-CHECKSUM F")}
    IO.File.WriteAllText(corrupt & "bad.dxf", broken)
    g_dxfNameIndexes = Nothing
    Check(MustFail(corrupt, "corrupt embedded identity"), "corrupt identity never becomes permission to overwrite")
    Check(IO.File.ReadAllText(corrupt & "bad.dxf") = broken And activeHandles = 0 And activeSearchHandles = 0, "corrupt DXF and handles preserved")
  Next
  Dim oversizedFields = Split(unicodeOwner, vbTab)
  oversizedFields(5) = New String("N"c, DXF_METADATA_MAX_BYTES)
  Dim oversizedRefused As Boolean
  Try
    DxfMetadataHeader(String.Join(vbTab, oversizedFields))
  Catch
    oversizedRefused = True
  End Try
  Check(oversizedRefused, "metadata block bounded")
  Dim fixture = folder & "native-geometry.tmp"
  Dim geometry = New Text.UTF8Encoding(False).GetBytes("0" & vbCrLf & "SECTION" & vbCrLf & "2" & vbCrLf & "ENTITIES" & vbCrLf & "0" & vbCrLf & "ENDSEC" & vbCrLf & "0" & vbCrLf & "EOF" & vbCrLf)
  Dim withBom As New Collections.Generic.List(Of Byte)(New Byte() {239, 187, 191})
  withBom.AddRange(geometry)
  IO.File.WriteAllBytes(fixture, withBom.ToArray())
  Dim enriched = DxfWithEmbeddedMetadata(fixture, unicodeOwner)
  Check(IO.File.ReadAllBytes(fixture).SequenceEqual(withBom), "native geometry stage untouched")
  Dim enrichedBytes = IO.File.ReadAllBytes(enriched)
  Dim restored = enrichedBytes.Take(3).Concat(enrichedBytes.Skip(3 + header.Length)).ToArray()
  Check(restored.SequenceEqual(withBom) And ReadDxfMetadataOwner(enriched) = unicodeOwner, "BOM and every geometry byte preserved after stripping metadata")
  IO.File.WriteAllText(folder & "binary.tmp", "AutoCAD Binary DXF" & vbCrLf & ChrW(26) & ChrW(0))
  Dim binaryRefused As Boolean
  Try
    DxfWithEmbeddedMetadata(folder & "binary.tmp", unicodeOwner)
  Catch
    binaryRefused = True
  End Try
  Check(binaryRefused And Not IO.File.Exists(folder & "binary.tmp.identity"), "binary DXF refused before writing identity stage")
  For Each failure As String In New String() {"write", "flush"}
    Dim source = folder & failure & "-failure.tmp"
    IO.File.WriteAllBytes(source, geometry)
    writeFails = (failure = "write") : flushFails = (failure = "flush")
    Dim refused As Boolean
    Try
      DxfWithEmbeddedMetadata(source, unicodeOwner)
    Catch
      refused = True
    End Try
    writeFails = False : flushFails = False
    Check(refused And IO.File.ReadAllBytes(source).SequenceEqual(geometry) And activeHandles = 0, "failed metadata " & failure & " preserves original bytes and releases handles")
  Next
  Dim tight = folder & "tight-material\\"
  IO.Directory.CreateDirectory(tight)
  Dim side = Plan(tight, "guard_side_092026", "Default", "C:\\parts\\side.sldprt", "8", "PMMA(PLEXI)", 2)
  Dim mirror = Plan(tight, "mirrorguard_front_072026", "oldal", "C:\\parts\\mirror.sldprt", "8", "PMMA(PLEXI)")
  Dim top = Plan(tight, "guard_top_082026", "Default", "C:\\parts\\top.sldprt", "8", "PMMA(PLEXI)")
  Dim front = Plan(tight, "guard_front_072026", "Default", "C:\\parts\\front.sldprt", "8", "PMMA(PLEXI)")
  Dim config = Plan(tight, "guard_front_072026", "oldal", "C:\\parts\\front.sldprt", "8", "PMMA(PLEXI)")
  Check(mirror.EndsWith("_01.dxf") And top.EndsWith("_02.dxf") And front.EndsWith("_03.dxf") And config.EndsWith("_04.dxf"), "all five PMMA source/configuration candidates get unique bounded names")
  g_dxfNameIndexes = Nothing
  Check(Plan(tight, "guard_front_072026", "oldal", "C:\\parts\\front.sldprt", "8", "PMMA(PLEXI)") = config, "disk-only PMMA/configuration rerun stays stable")
  Check(DxfMetadataJson(ReadDxfMetadataOwner(config)).Contains("guard_front_072026") And DxfMetadataJson(ReadDxfMetadataOwner(config)).Contains("oldal"), "full name and configuration travel inside the DXF")
  Dim unnumbered = Plan(tight, "another-long-part-name", "M10", "C:\\parts\\m10-template.sldprt", "16", "S235", 2)
  Dim numbered = Plan(tight, "another-long-part-name", "M10", "C:\\parts\\m10.sldprt", "16", "S235", 2)
  Check(unnumbered.EndsWith("_M10.dxf") And numbered.Contains("_M10_05.dxf"), "configuration and part fragments retained when they fit")
  IO.File.WriteAllText(tight & "UNRELATED_0007.DXF", "")
  IO.File.WriteAllText(tight & ChrW(&HE1) & "-unrelated_08.dxf", "do not overwrite")
  Dim assigned As New Collections.Generic.HashSet(Of String)(StringComparer.OrdinalIgnoreCase)
  For Each value In New String() {mirror, top, front, config, numbered}
    assigned.Add(DxfNumberKey(DxfNumberToken(IO.Path.GetFileNameWithoutExtension(value))))
  Next
  For i = 1 To 120
    Dim value = Plan(tight, "really-long-part-name_062026", "side", "C:\\parts\\series" & CStr(i) & ".sldprt", "8", "PMMA(PLEXI)")
    Dim number = DxfNumberKey(DxfNumberToken(IO.Path.GetFileNameWithoutExtension(value)))
    Check(number <> "6" And number <> "7" And number <> "8" And assigned.Add(number), "folder-wide serial growth skips occupied numbers")
  Next
  g_dxfNameIndexes = Nothing
  Dim last = Plan(tight, "really-long-part-name_062026", "side", "C:\\parts\\series120.sldprt", "8", "PMMA(PLEXI)")
  Check(IO.Path.GetFileNameWithoutExtension(last).Length <= 20, "three-digit persistent fallback fits")
  Dim huge = Plan(tight, "full-part-name", "configuration", "C:\\parts\\huge.sldprt", "16", New String("M"c, 100), 25)
  Check(IO.Path.GetFileNameWithoutExtension(huge).Length = 20 And DxfMetadataJson(ReadDxfMetadataOwner(huge)).Contains(New String("M"c, 100)), "overlong material still has bounded filename and complete embedded name")
  Check(Plan(tight, "full-part-name", "side", "C:\\parts\\precut.sldprt", "8", "PMMA(PLEXI)", 1, "_PRECUT10").Contains("P"), "precut marker retained within fallback budget")
  Dim rejected As Boolean
  searchFirstFails = True
  Try
    DxfUsedNameNumbers(tight, CreateObject("Scripting.Dictionary"))
  Catch
    rejected = True
  End Try
  searchFirstFails = False
  Check(rejected And activeSearchHandles = 0, "first enumeration failure is not an empty folder")
  rejected = False : searchNextFails = True
  Try
    DxfUsedNameNumbers(tight, CreateObject("Scripting.Dictionary"))
  Catch
    rejected = True
  End Try
  searchNextFails = False
  Check(rejected And activeSearchHandles = 0, "incomplete enumeration closes its handle")
  Check(Not IO.File.Exists(folder & "DXF-names.tsv") And Not IO.File.Exists(tight & "DXF-names.tsv") And activeHandles = 0, "no TSV or native handle leaks")
  Dim tree = folder & "export-tree\\", aFolder = tree & "assembly-a\\", bFolder = tree & "assembly-b\\", cFolder = bFolder & "bended\\"
  IO.Directory.CreateDirectory(aFolder) : IO.Directory.CreateDirectory(cFolder)
  InitializeDxfGlobalNames(tree)
  Dim ga = Plan(aFolder, "cap", "Default", "C:\\parts\\shared.sldprt")
  Dim gb = Plan(bFolder, "cap", "Default", "C:\\parts\\shared.sldprt")
  Dim gc = Plan(cFolder, "cap", "Alternate", "C:\\parts\\shared.sldprt")
  Check(IO.Path.GetFileName(ga)<>IO.Path.GetFileName(gb) And IO.Path.GetFileName(gc)<>IO.Path.GetFileName(ga), "names are unique across parent and category folders")
  Check(gb.EndsWith("_01.dxf"), "cross-folder duplicate receives a bounded serial")
  g_dxfNameIndexes=Nothing
  InitializeDxfGlobalNames(tree)
  Check(Plan(bFolder,"cap","Default","C:\\parts\\shared.sldprt")=gb And Plan(aFolder,"cap","Default","C:\\parts\\shared.sldprt")=ga, "global disk-only reversed rerun retains unique assignments")
  IO.File.WriteAllText(tree & "1xLV3_S235_pin.dxf", "unowned root file")
  InitializeDxfGlobalNames(tree)
  Dim gp=Plan(aFolder,"pin","Default","C:\\parts\\pin.sldprt")
  Check(IO.Path.GetFileName(gp)<>"1xLV3_S235_pin.dxf" And IO.File.ReadAllText(tree & "1xLV3_S235_pin.dxf")="unowned root file", "unknown files in another folder remain occupied and untouched")
  IO.File.Copy(ga, bFolder & IO.Path.GetFileName(ga))
  Dim preserved = IO.File.ReadAllBytes(ga)
  g_dxfNameIndexes=Nothing
  InitializeDxfGlobalNames(tree)
  Dim uniqueB=Plan(bFolder,"cap","Default","C:\\parts\\shared.sldprt")
  Dim uniqueA=Plan(aFolder,"cap","Default","C:\\parts\\shared.sldprt")
  Check(uniqueA<>ga And uniqueB=gb And IO.Path.GetFileName(uniqueA)<>IO.Path.GetFileName(uniqueB), "legacy duplicates cannot be reused; an already unique owned assignment is retained")
  Check(IO.File.ReadAllBytes(ga).SequenceEqual(preserved) And IO.File.ReadAllBytes(bFolder & IO.Path.GetFileName(ga)).SequenceEqual(preserved), "pre-existing duplicate files are preserved, never renamed or overwritten")
  g_dxfNameIndexes=Nothing
  InitializeDxfGlobalNames(tree)
  Check(Plan(aFolder,"cap","Default","C:\\parts\\shared.sldprt")=uniqueA And Plan(bFolder,"cap","Default","C:\\parts\\shared.sldprt")=uniqueB, "legacy duplicates cannot cause endless new files on later runs")
  Dim reservedA=ClaimDxfOutput(aFolder,"C:\\parts\\reserved.sldprt","Default","pending","3","S235",1)
  Dim reservedB=ClaimDxfOutput(bFolder,"C:\\parts\\reserved.sldprt","Default","pending","3","S235",1)
  Check(IO.Path.GetFileName(reservedA)<>IO.Path.GetFileName(reservedB), "unpublished claims also reserve names globally")
  rejected=False : searchNextFails=True
  Try
    InitializeDxfGlobalNames(tree)
  Catch
    rejected=True
  End Try
  searchNextFails=False
  Check(rejected And g_globalDxfNames Is Nothing And activeSearchHandles=0, "incomplete global inspection fails closed and releases the native handle")
  g_globalDxfNames=Nothing : g_globalDxfNumbers=Nothing : g_globalDxfRoot=""
  Console.WriteLine("PASS ${file}: 20-character names, embedded disk-only reruns, full JSON identity, geometry/BOM preservation, binary/corruption/failure protection, PMMA and 120-item serial growth.")
End Sub
End Module
`);
  const compiler = path.join(process.env.WINDIR || "C:\\Windows", "Microsoft.NET", "Framework64", "v4.0.30319", "vbc.exe");
  const build = spawnSync(compiler, ["/nologo", "/target:exe", "/out:" + output, input], { encoding: "utf8", windowsHide: true, timeout: 60000 });
  assert.equal(build.status, 0, input + "\n" + build.stdout + "\n" + build.stderr);
  const result = spawnSync(output, [], { encoding: "utf8", windowsHide: true, timeout: 60000 });
  assert.equal(result.status, 0, input + "\n" + result.stdout + "\n" + result.stderr);
  assert.equal(fs.existsSync(path.join(dir, "DXF-names.tsv")), false);
  let nativeHeaders = 0;
  const body = Buffer.from("0\r\nSECTION\r\n2\r\nENTITIES\r\n0\r\nENDSEC\r\n0\r\nEOF\r\n");
  for (const folder of [dir, path.join(dir, "tight-material"), longFolder]) {
    for (const name of fs.readdirSync(folder)) {
      if (!/\.dxf$/i.test(name)) continue;
      const bytes = fs.readFileSync(path.join(folder, name));
      const info = inspectDxfMetadata(bytes);
      if (!info) continue;
      nativeHeaders++;
      assert.deepEqual(bytes.subarray(info.bodyOffset), body, "adding metadata cannot change original geometry");
      assert.ok(!bytes.subarray(0, info.bodyOffset).toString("ascii").includes("C:\\parts\\"));
      assert.equal(Object.keys(info.metadata).length, 5);
    }
  }
  assert.ok(nativeHeaders >= 150, "independent reader validates every native batch header");
  const bomStage = fs.readFileSync(path.join(dir, "native-geometry.tmp.identity"));
  const bomInfo = inspectDxfMetadata(bomStage);
  assert.equal(bomInfo.bomBytes, 3);
  assert.deepEqual(Buffer.concat([bomStage.subarray(0, 3), bomStage.subarray(bomInfo.bodyOffset)]),
    Buffer.concat([Buffer.from([239, 187, 191]), body]));
  assert.throws(() => inspectDxfMetadata(Buffer.from(bomStage.toString("utf8").replace("EXCELSIS-DXF-CHECKSUM ", "EXCELSIS-DXF-CHECKSUM F"))));
  assert.equal(inspectDxfMetadata(Buffer.from("0\r\nSECTION\r\n")), null);
  console.log(result.stdout.trim());
}
