Option Explicit
On Error Resume Next

Dim sw, doc, selection, selected, sourcePath, sourceType, sourceFile
Dim fso, target, sourceBytes, sourceModified, saveStatus, started, elapsed

Function HexUtf16(value)
  Dim index, code, result
  result = ""
  For index = 1 To Len(value)
    code = AscW(Mid(value, index, 1))
    If code < 0 Then code = code + 65536
    result = result & Right("0000" & Hex(code), 4)
  Next
  HexUtf16 = result
End Function

If WScript.Arguments.Count <> 1 Then WScript.Echo "ERROR=Expected one GLB output path.": WScript.Quit 1
target = CStr(WScript.Arguments(0))
If LCase(Right(target, 4)) <> ".glb" Then WScript.Echo "ERROR=Output must be a GLB file.": WScript.Quit 1
Set fso = CreateObject("Scripting.FileSystemObject")
If Not fso.FolderExists(fso.GetParentFolderName(target)) Or fso.FileExists(target) Then
  WScript.Echo "ERROR=Output folder is missing or the GLB already exists."
  WScript.Quit 1
End If

Err.Clear
Set sw = GetObject(, "SldWorks.Application")
If Err.Number <> 0 Or sw Is Nothing Then WScript.Echo "ERROR=SOLIDWORKS is unavailable.": WScript.Quit 1
Err.Clear
Set doc = sw.ActiveDoc
If Err.Number <> 0 Or doc Is Nothing Then WScript.Echo "ERROR=No active SOLIDWORKS document.": WScript.Quit 1

Err.Clear
sourceType = CLng(doc.GetType())
sourcePath = CStr(doc.GetPathName())
If Err.Number <> 0 Or (sourceType <> 1 And sourceType <> 2) Or Len(sourcePath) = 0 Then
  WScript.Echo "ERROR=Open a saved part or assembly before exporting."
  WScript.Quit 1
End If
Set selection = doc.SelectionManager
selected = CLng(selection.GetSelectedObjectCount2(-1))
If Err.Number <> 0 Or selected <> 0 Then
  WScript.Echo "ERROR=Clear selections before exporting the full model."
  WScript.Quit 1
End If
Set sourceFile = fso.GetFile(sourcePath)
If Err.Number <> 0 Then WScript.Echo "ERROR=Cannot read the source document.": WScript.Quit 1
sourceBytes = sourceFile.Size
sourceModified = sourceFile.DateLastModified

WScript.Echo "SOURCE_PATH_HEX=" & HexUtf16(sourcePath)
If sourceType = 2 Then
  WScript.Echo "SOURCE_TYPE=assembly"
Else
  WScript.Echo "SOURCE_TYPE=part"
End If
WScript.Echo "EXPORT_STARTED=1"
started = Timer
Err.Clear
saveStatus = doc.SaveAs3(target, 0, 1)
elapsed = Timer - started
If elapsed < 0 Then elapsed = elapsed + 86400
If Err.Number <> 0 Or saveStatus <> 0 Or Not fso.FileExists(target) Then
  WScript.Echo "ERROR=SOLIDWORKS could not save the GLB (status " & CStr(saveStatus) & ")."
  WScript.Quit 1
End If

Err.Clear
Set sourceFile = fso.GetFile(sourcePath)
If Err.Number <> 0 Then WScript.Echo "ERROR=Cannot verify the source document.": WScript.Quit 1
WScript.Echo "SOURCE_UNCHANGED=" & CStr(sourceFile.Size = sourceBytes And sourceFile.DateLastModified = sourceModified)
WScript.Echo "ACTIVE_UNCHANGED=" & CStr(sw.ActiveDoc.GetPathName() = sourcePath)
WScript.Echo "EXPORT_MS=" & CLng(elapsed * 1000)
WScript.Echo "RESULT_STATUS=OK"
