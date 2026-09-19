Option Explicit
On Error Resume Next

Dim sw, doc, afterDoc, activePath, wantedPath, outputPath, net, drives, ok
If WScript.Arguments.Count <> 2 Then WScript.Quit 1
wantedPath = WScript.Arguments(0)
outputPath = WScript.Arguments(1)
Set drives = Nothing
Set net = CreateObject("WScript.Network")
Set drives = net.EnumNetworkDrives
Err.Clear

Function PathKey(value)
  Dim key, index
  key = LCase(Replace(CStr(value), "/", "\"))
  If Left(key, 8) = "\\?\unc\" Then key = "\\" & Mid(key, 9)
  If Left(key, 4) = "\\?\" Then key = Mid(key, 5)
  If Mid(key, 2, 2) = ":\" Then
    If Not drives Is Nothing Then
      For index = 0 To drives.Count - 1 Step 2
        If LCase(drives.Item(index)) = Left(key, 2) Then
          key = LCase(drives.Item(index + 1)) & Mid(key, 3)
          Exit For
        End If
      Next
    End If
  End If
  PathKey = key
End Function

Set sw = GetObject(, "SldWorks.Application")
If sw Is Nothing Then
  WScript.StdErr.WriteLine "SOLIDWORKS COM is unavailable."
  WScript.Quit 2
End If
Err.Clear
Set doc = sw.ActiveDoc
If doc Is Nothing Then
  WScript.StdErr.WriteLine "SOLIDWORKS has no active document."
  WScript.Quit 3
End If
Err.Clear
activePath = CStr(doc.GetPathName())
If Err.Number <> 0 Or Len(activePath) = 0 Then
  WScript.StdErr.WriteLine "Could not identify the active SOLIDWORKS document."
  WScript.Quit 4
End If
If PathKey(activePath) <> PathKey(wantedPath) Then
  WScript.StdErr.WriteLine "Activate the requested document in SOLIDWORKS, frame its view, then retry."
  WScript.Quit 5
End If

' SaveBMP captures only the CAD view using its current window dimensions.
' Do not activate, open, fit, rotate, redraw, deselect, or change display flags.
Err.Clear
ok = CBool(doc.SaveBMP(outputPath, 0, 0))
If Err.Number <> 0 Or Not ok Then
  WScript.StdErr.WriteLine "SOLIDWORKS could not capture the current viewport. " & Err.Description
  WScript.Quit 6
End If
Err.Clear
Set afterDoc = sw.ActiveDoc
activePath = ""
If Not afterDoc Is Nothing Then activePath = CStr(afterDoc.GetPathName())
If Err.Number <> 0 Or PathKey(activePath) <> PathKey(wantedPath) Then
  WScript.StdErr.WriteLine "The active document changed during capture. Existing thumbnail kept."
  WScript.Quit 7
End If
Set afterDoc = Nothing
Set doc = Nothing
Set sw = Nothing
WScript.StdOut.WriteLine "captured"
WScript.Quit 0
