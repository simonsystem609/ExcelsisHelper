' solidworks-watcher.vbs (0.8.4, item A2-full)
' Long-lived COM holder for the Doc/Work-logger status path. Connects ONCE to a
' user-started SOLIDWORKS (never launches one) and, on a self-paced loop, writes
' the active document plus a cached open-document inventory as UTF-8 JSON. Only
' two inventory documents are advanced per tick; this keeps the active heartbeat
' responsive even when dozens of documents are open. The Electron main process
' reads the file spawn-free, so polling SOLIDWORKS no longer costs a
' powershell+cscript spawn per tick. COM reads stay in VBScript because
' PowerShell late binding cannot read the SOLIDWORKS document model.
'
' Args: 0 = output file path, 1 = interval ms (optional, default 1500)
Option Explicit
On Error Resume Next

Dim outPath, intervalMs
outPath = WScript.Arguments(0)
If WScript.Arguments.Count > 1 Then
  intervalMs = CLng(WScript.Arguments(1))
Else
  intervalMs = 1500
End If
If intervalMs < 250 Then intervalMs = 250

Dim watcherInstanceId, connectionGeneration, watcherSessionId, nextDocumentToken
Dim previousDocs(), previousTokens(), previousJson(), previousPaths(), previousDocCount
Dim currentDocs(), currentTokens(), currentJson(), currentPaths(), currentDocCount
Dim scanCandidate, scanInProgress
Const OPEN_DOCUMENTS_PER_TICK = 2
Randomize
watcherInstanceId = CStr(Year(Now)) & Right("0" & CStr(Month(Now)), 2) & _
  Right("0" & CStr(Day(Now)), 2) & "-" & CStr(Int(Timer * 1000)) & _
  "-" & CStr(Int(Rnd * 1000000))
connectionGeneration = 0
watcherSessionId = ""
nextDocumentToken = 0
previousDocCount = 0
currentDocCount = 0
ReDim previousDocs(0)
ReDim previousTokens(0)
ReDim previousJson(0)
ReDim previousPaths(0)
ReDim currentDocs(0)
ReDim currentTokens(0)
ReDim currentJson(0)
ReDim currentPaths(0)
Set scanCandidate = Nothing
scanInProgress = False

Function JsonEscape(value)
  Dim text
  text = CStr(value)
  text = Replace(text, "\", "\\")
  text = Replace(text, """", "\""")
  text = Replace(text, vbCrLf, "\n")
  text = Replace(text, vbCr, "\n")
  text = Replace(text, vbLf, "\n")
  text = Replace(text, vbTab, "\t")
  JsonEscape = text
End Function

Function JsonString(value)
  JsonString = """" & JsonEscape(value) & """"
End Function

Function JsonBool(value)
  If CBool(value) Then JsonBool = "true" Else JsonBool = "false"
End Function

Sub ResetDocumentRegistry()
  Dim i
  For i = 0 To previousDocCount - 1
    Set previousDocs(i) = Nothing
  Next
  For i = 0 To currentDocCount - 1
    Set currentDocs(i) = Nothing
  Next
  previousDocCount = 0
  currentDocCount = 0
  nextDocumentToken = 0
  ReDim previousDocs(0)
  ReDim previousTokens(0)
  ReDim previousJson(0)
  ReDim previousPaths(0)
  ReDim currentDocs(0)
  ReDim currentTokens(0)
  ReDim currentJson(0)
  ReDim currentPaths(0)
  Set scanCandidate = Nothing
  scanInProgress = False
End Sub

Sub BeginDocumentRegistrySample()
  Dim i
  For i = 0 To currentDocCount - 1
    Set currentDocs(i) = Nothing
  Next
  currentDocCount = 0
  ReDim currentDocs(0)
  ReDim currentTokens(0)
  ReDim currentJson(0)
  ReDim currentPaths(0)
End Sub

Function DocumentTokenFor(doc)
  Dim i, token
  token = ""
  If doc Is Nothing Then DocumentTokenFor = token : Exit Function

  For i = 0 To currentDocCount - 1
    If doc Is currentDocs(i) Then DocumentTokenFor = currentTokens(i) : Exit Function
  Next
  For i = 0 To previousDocCount - 1
    If doc Is previousDocs(i) Then token = previousTokens(i) : Exit For
  Next
  If Len(token) = 0 Then
    nextDocumentToken = nextDocumentToken + 1
    token = "d" & CStr(nextDocumentToken)
  End If

  If currentDocCount > 0 Then
    ReDim Preserve currentDocs(currentDocCount)
    ReDim Preserve currentTokens(currentDocCount)
    ReDim Preserve currentJson(currentDocCount)
    ReDim Preserve currentPaths(currentDocCount)
  End If
  Set currentDocs(currentDocCount) = doc
  currentTokens(currentDocCount) = token
  currentJson(currentDocCount) = ""
  currentPaths(currentDocCount) = ""
  currentDocCount = currentDocCount + 1
  DocumentTokenFor = token
End Function

Sub CommitDocumentRegistrySample()
  Dim i
  For i = 0 To previousDocCount - 1
    Set previousDocs(i) = Nothing
  Next
  previousDocCount = currentDocCount
  If previousDocCount > 0 Then
    ReDim previousDocs(previousDocCount - 1)
    ReDim previousTokens(previousDocCount - 1)
    ReDim previousJson(previousDocCount - 1)
    ReDim previousPaths(previousDocCount - 1)
    For i = 0 To previousDocCount - 1
      Set previousDocs(i) = currentDocs(i)
      previousTokens(i) = currentTokens(i)
      previousJson(i) = currentJson(i)
      previousPaths(i) = currentPaths(i)
      Set currentDocs(i) = Nothing
    Next
  Else
    ReDim previousDocs(0)
    ReDim previousTokens(0)
    ReDim previousJson(0)
    ReDim previousPaths(0)
  End If
  currentDocCount = 0
  ReDim currentDocs(0)
  ReDim currentTokens(0)
  ReDim currentJson(0)
  ReDim currentPaths(0)
End Sub

Sub SetCurrentDocumentMetadata(doc, json, pathName)
  Dim i
  If doc Is Nothing Then Exit Sub
  For i = 0 To currentDocCount - 1
    If doc Is currentDocs(i) Then
      currentJson(i) = json
      currentPaths(i) = pathName
      Exit Sub
    End If
  Next
End Sub

Function GetDocumentSnapshotJson(doc, source, identityTrusted, ByRef docToken, ByRef pathName, ByRef valid)
  Dim title, docType, json
  title = "" : pathName = "" : docType = "" : docToken = "" : valid = False
  GetDocumentSnapshotJson = ""
  If doc Is Nothing Then Exit Function

  ' GetType is the liveness probe. A closed/stale COM document must not be
  ' carried into the current identity snapshot.
  Err.Clear
  docType = CStr(doc.GetType())
  If Err.Number <> 0 Then Err.Clear : Exit Function

  Err.Clear : title = CStr(doc.GetTitle()) : If Err.Number <> 0 Then title = "" : Err.Clear
  Err.Clear : pathName = CStr(doc.GetPathName()) : If Err.Number <> 0 Then pathName = "" : Err.Clear
  docToken = DocumentTokenFor(doc)
  json = "{""hasActiveDocument"":true,""title"":" & JsonString(title) & _
    ",""path"":" & JsonString(pathName) & ",""type"":" & JsonString(docType) & _
    ",""source"":" & JsonString(source) & ",""documentToken"":" & JsonString(docToken) & _
    ",""identityTrusted"":" & JsonBool(identityTrusted) & "}"
  SetCurrentDocumentMetadata doc, json, pathName
  valid = True
  GetDocumentSnapshotJson = json
End Function

Function CurrentContainsDocument(doc)
  Dim i
  CurrentContainsDocument = False
  If doc Is Nothing Then Exit Function
  For i = 0 To currentDocCount - 1
    If doc Is currentDocs(i) Then
      CurrentContainsDocument = True
      Exit Function
    End If
  Next
End Function

Function GetCachedOpenDocumentsJson()
  Dim json, first, i
  json = "[" : first = True

  ' Current-scan entries come first and include unsaved recently-active
  ' documents. This is what makes wrong-document Save As transitions fail
  ' closed without re-reading every open document on every heartbeat.
  For i = 0 To currentDocCount - 1
    If Len(currentJson(i)) > 0 Then
      If Not first Then json = json & ","
      json = json & currentJson(i)
      first = False
    End If
  Next

  ' Preserve the last completed inventory while the next bounded scan advances.
  ' Unsaved entries are intentionally omitted from this stale half; the prior
  ' active document is refreshed into currentDocs before every active sample.
  For i = 0 To previousDocCount - 1
    If Len(previousJson(i)) > 0 And Len(Trim(previousPaths(i))) > 0 Then
      If Not CurrentContainsDocument(previousDocs(i)) Then
        If Not first Then json = json & ","
        json = json & previousJson(i)
        first = False
      End If
    End If
  Next

  GetCachedOpenDocumentsJson = json & "]"
End Function

Sub BeginOpenDocumentsSample(sw)
  BeginDocumentRegistrySample
  Set scanCandidate = Nothing
  scanInProgress = True
  Err.Clear
  Set scanCandidate = sw.GetFirstDocument()
  If Err.Number <> 0 Then
    Err.Clear
    scanInProgress = False
    Set scanCandidate = Nothing
  End If
End Sub

Sub ContinueOpenDocumentsSample()
  Dim processed, candidate, nextCandidate, nextFailed
  Dim snapshot, docToken, pathName, valid
  If Not scanInProgress Then Exit Sub
  processed = 0

  Do While processed < OPEN_DOCUMENTS_PER_TICK
    If scanCandidate Is Nothing Then
      CommitDocumentRegistrySample
      scanInProgress = False
      Exit Do
    End If

    Set candidate = scanCandidate
    Err.Clear
    Set nextCandidate = candidate.GetNext()
    nextFailed = (Err.Number <> 0)
    If nextFailed Then Err.Clear

    snapshot = GetDocumentSnapshotJson(candidate, "GetFirstDocument", False, docToken, pathName, valid)
    processed = processed + 1

    If nextFailed Then
      scanInProgress = False
      Set scanCandidate = Nothing
      Exit Do
    End If
    Set scanCandidate = nextCandidate
  Loop

  If scanInProgress And scanCandidate Is Nothing Then
    CommitDocumentRegistrySample
    scanInProgress = False
  End If
End Sub

Sub RefreshRecentActiveDocument(doc)
  Dim snapshot, docToken, pathName, valid
  If doc Is Nothing Then Exit Sub
  snapshot = GetDocumentSnapshotJson(doc, "RecentActiveDocument", False, docToken, pathName, valid)
End Sub

' Mirrors GetActiveDocumentJsonCore in solidworks-bridge.ps1 (ActiveDoc, then
' IActiveDoc2, then optional GetFirstDocument fallback).
Function GetActiveDocumentJson(sw, ByRef activeDoc, ByRef activeToken)
  Dim doc, pathName, source, identityTrusted, valid, json
  pathName = "" : source = "ActiveDoc"
  activeToken = ""
  Set activeDoc = Nothing

  Err.Clear
  Set doc = sw.ActiveDoc
  If Err.Number <> 0 Then Err.Clear : Set doc = Nothing
  If doc Is Nothing Then
    Err.Clear
    Set doc = sw.IActiveDoc2
    source = "IActiveDoc2"
    If Err.Number <> 0 Then Err.Clear : Set doc = Nothing
  End If
  If doc Is Nothing Then
    Err.Clear
    Set doc = sw.GetFirstDocument()
    If Err.Number = 0 And Not doc Is Nothing Then
      source = "GetFirstDocument"
    Else
      Err.Clear : Set doc = Nothing
    End If
  End If

  If doc Is Nothing Then
    GetActiveDocumentJson = "{""hasActiveDocument"":false,""title"":"""",""path"":"""",""type"":"""",""source"":""none"",""documentToken"":"""",""identityTrusted"":false}"
    Exit Function
  End If

  Set activeDoc = doc
  identityTrusted = (source = "ActiveDoc" Or source = "IActiveDoc2")
  json = GetDocumentSnapshotJson(doc, source, identityTrusted, activeToken, pathName, valid)
  If Not valid Then
    Set activeDoc = Nothing
    activeToken = ""
    GetActiveDocumentJson = "{""hasActiveDocument"":false,""title"":"""",""path"":"""",""type"":"""",""source"":""none"",""documentToken"":"""",""identityTrusted"":false}"
    Exit Function
  End If
  GetActiveDocumentJson = json
End Function

' UTF-8 atomic-ish write (ADODB.Stream, overwrite). Paths can contain non-ASCII.
Sub WriteStatus(targetPath, text)
  Dim stream
  Err.Clear
  Set stream = CreateObject("ADODB.Stream")
  If Err.Number <> 0 Then Err.Clear : Exit Sub
  stream.Type = 2
  stream.Charset = "utf-8"
  stream.Open
  stream.WriteText text
  stream.SaveToFile targetPath, 2   ' adSaveCreateOverWrite
  stream.Close
  If Err.Number <> 0 Then Err.Clear
End Sub

Dim sw, probe, payload, adoc, odocs, activeDoc, activeToken
Set sw = Nothing
Set activeDoc = Nothing

Do
  ' Liveness probe: a cheap property read fails if the held instance is gone
  ' (SOLIDWORKS closed/restarted) — drop the reference so we reconnect.
  If Not sw Is Nothing Then
    Err.Clear
    probe = sw.Visible
    If Err.Number <> 0 Then
      Err.Clear
      Set sw = Nothing
      watcherSessionId = ""
      ResetDocumentRegistry
    End If
  End If

  If sw Is Nothing Then
    Err.Clear
    Set sw = GetObject(, "SldWorks.Application")
    If Err.Number <> 0 Then Err.Clear : Set sw = Nothing
    If Not sw Is Nothing Then
      connectionGeneration = connectionGeneration + 1
      watcherSessionId = watcherInstanceId & "-c" & CStr(connectionGeneration)
      ResetDocumentRegistry
    End If
  End If

  If sw Is Nothing Then
    payload = "{""ok"":true,""connected"":false,""watcherSessionId"":"""",""activeDocument"":{""hasActiveDocument"":false,""title"":"""",""path"":"""",""source"":""none"",""documentToken"":"""",""identityTrusted"":false},""openDocuments"":[]}"
  Else
    If Not scanInProgress Then BeginOpenDocumentsSample sw
    ' Keep the immediately previous active COM identity in the current sample.
    ' This preserves wrong-document rejection and Save As relinking even when a
    ' full open-document inventory spans many lightweight heartbeat ticks.
    RefreshRecentActiveDocument activeDoc
    adoc = GetActiveDocumentJson(sw, activeDoc, activeToken)
    ContinueOpenDocumentsSample
    odocs = GetCachedOpenDocumentsJson()
    payload = "{""ok"":true,""connected"":true,""watcherSessionId"":" & JsonString(watcherSessionId) & _
      ",""activeDocument"":" & adoc & ",""openDocuments"":" & odocs & _
      ",""openDocumentsScanInProgress"":" & JsonBool(scanInProgress) & "}"
  End If

  WriteStatus outPath, payload
  WScript.Sleep intervalMs
Loop
