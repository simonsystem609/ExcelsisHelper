param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("status", "run", "connect", "reload-doc", "save-close-cam-docs", "exit-solidworks", "kill-solidworks", "create-blank-part")]
  [string]$Action,

  [string]$MacroPath = "",
  [string]$ModuleName = "",
  [string]$ProcedureName = "",

  [int]$BridgeTimeoutSeconds = 0
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Write-BridgeJson {
  param([hashtable]$Payload)
  $Payload | ConvertTo-Json -Depth 12 -Compress
  exit 0
}

function Get-SolidWorksWindowFallback {
  $windows = @()
  $activeDocument = $null
  $processes = @(Get-Process -Name "SLDWORKS" -ErrorAction SilentlyContinue |
    Sort-Object StartTime -Descending)

  foreach ($process in $processes) {
    $title = [string]$process.MainWindowTitle
    if ([string]::IsNullOrWhiteSpace($title)) { continue }

    $documentTitle = ""
    if ($title -match '(?i)([^\\/:*?"<>|\[\]\r\n]+?\.(?:SLDPRT|SLDASM|SLDDRW))') {
      $documentTitle = $Matches[1]
    }

    $window = [pscustomobject]@{
      processId = [int]$process.Id
      title = $title
      documentTitle = $documentTitle
    }
    $windows += $window

    if ($null -eq $activeDocument -and -not [string]::IsNullOrWhiteSpace($documentTitle)) {
      $activeDocument = [pscustomobject]@{
        hasActiveDocument = $true
        title = $documentTitle
        path = ""
        type = ""
        source = "WindowTitle"
        inferred = $true
      }
    }
  }

  return @{
    connected = $processes.Count -gt 0
    windows = $windows
    activeDocument = $activeDocument
  }
}

function Get-WindowsActivitySnapshot {
  try {
    if (-not ("Excelsis.Win32Activity" -as [type])) {
      Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;

namespace Excelsis {
  public static class Win32Activity {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

    [StructLayout(LayoutKind.Sequential)]
    public struct LASTINPUTINFO {
      public uint cbSize;
      public uint dwTime;
    }

    [DllImport("user32.dll")]
    public static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);

    [DllImport("kernel32.dll")]
    public static extern ulong GetTickCount64();
  }
}
"@
    }

    $hwnd = [Excelsis.Win32Activity]::GetForegroundWindow()
    [uint32]$foregroundPid = 0
    if ($hwnd -ne [IntPtr]::Zero) {
      [void][Excelsis.Win32Activity]::GetWindowThreadProcessId($hwnd, [ref]$foregroundPid)
    }

    $titleBuilder = New-Object System.Text.StringBuilder 512
    if ($hwnd -ne [IntPtr]::Zero) {
      [void][Excelsis.Win32Activity]::GetWindowText($hwnd, $titleBuilder, $titleBuilder.Capacity)
    }

    $processName = ""
    $processPath = ""
    if ($foregroundPid -gt 0) {
      $process = Get-Process -Id ([int]$foregroundPid) -ErrorAction SilentlyContinue
      if ($null -ne $process) {
        $processName = [string]$process.ProcessName
        try { $processPath = [string]$process.Path } catch { $processPath = "" }
      }
    }

    $lastInput = New-Object Excelsis.Win32Activity+LASTINPUTINFO
    $lastInput.cbSize = [System.Runtime.InteropServices.Marshal]::SizeOf($lastInput)
    $inputOk = [Excelsis.Win32Activity]::GetLastInputInfo([ref]$lastInput)
    $idleMs = $null
    if ($inputOk) {
      $idleMs = [int64]([Excelsis.Win32Activity]::GetTickCount64() - [uint64]$lastInput.dwTime)
    }

    return [ordered]@{
      ok = $true
      sampledAt = (Get-Date).ToString("o")
      foregroundPid = [int]$foregroundPid
      foregroundProcessName = $processName
      foregroundProcessPath = $processPath
      foregroundTitle = [string]$titleBuilder.ToString()
      idleMs = $idleMs
    }
  } catch {
    return [ordered]@{
      ok = $false
      sampledAt = (Get-Date).ToString("o")
      error = $_.Exception.Message
    }
  }
}

function Add-WindowFallback {
  param([string]$JsonText, $ReconcileInfo = $null)
  $fallback = Get-SolidWorksWindowFallback
  try {
    $payload = $JsonText | ConvertFrom-Json
    $payload | Add-Member -NotePropertyName solidWorksWindows -NotePropertyValue $fallback.windows -Force
    if (($null -eq $payload.activeDocument -or -not [bool]$payload.activeDocument.hasActiveDocument) -and $null -ne $fallback.activeDocument) {
      $payload.activeDocument = $fallback.activeDocument
    }
    if (-not $payload.connected -and $fallback.connected) {
      $payload.connected = $true
    }
    if ($null -ne $ReconcileInfo) {
      $payload | Add-Member -NotePropertyName reconcileInfo -NotePropertyValue $ReconcileInfo -Force
    }
    $payload | Add-Member -NotePropertyName windowsActivity -NotePropertyValue (Get-WindowsActivitySnapshot) -Force
    return ($payload | ConvertTo-Json -Depth 20 -Compress)
  } catch {
    return $JsonText
  }
}

function Invoke-CscriptBridge {
  param([string[]]$Arguments, [int]$TimeoutSeconds)

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = "cscript.exe"
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.Arguments = (($Arguments | ForEach-Object {
    '"' + ([string]$_).Replace('"', '\"') + '"'
  }) -join " ")

  $process = [System.Diagnostics.Process]::Start($psi)
  $timedOut = $false
  if ($TimeoutSeconds -gt 0) {
    if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
      $timedOut = $true
      try { $process.Kill() } catch {}
      try { $process.WaitForExit(1000) | Out-Null } catch {}
    }
  } else {
    $process.WaitForExit()
  }

  return @{
    timedOut = $timedOut
    stdout = $process.StandardOutput.ReadToEnd()
    stderr = $process.StandardError.ReadToEnd()
    exitCode = $(if ($timedOut) { -1 } else { $process.ExitCode })
  }
}

$bridgeScript = @'
Option Explicit
On Error Resume Next

Dim action, macroPath, moduleName, procedureName, outputPath
action = WScript.Arguments(0)
macroPath = DecodeArg(WScript.Arguments(1))
moduleName = DecodeArg(WScript.Arguments(2))
procedureName = DecodeArg(WScript.Arguments(3))
outputPath = WScript.Arguments(4)

Function DecodeArg(value)
  If CStr(value) = "__EXCELSIS_EMPTY__" Then
    DecodeArg = ""
  Else
    DecodeArg = CStr(value)
  End If
End Function

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
  If CBool(value) Then
    JsonBool = "true"
  Else
    JsonBool = "false"
  End If
End Function

Function JsonArrayFromDictionary(dict)
  Dim json, key, first
  json = "["
  first = True
  For Each key In dict.Keys
    If Not first Then json = json & ","
    json = json & JsonString(dict.Item(key))
    first = False
  Next
  json = json & "]"
  JsonArrayFromDictionary = json
End Function

Sub AddUnique(dict, value)
  Dim key, clean
  clean = Trim(CStr(value))
  If Len(clean) = 0 Then Exit Sub
  key = LCase(clean)
  If Not dict.Exists(key) Then dict.Add key, clean
End Sub

Sub WriteUtf8(filePath, text)
  Dim stream
  Err.Clear
  Set stream = CreateObject("ADODB.Stream")
  If Err.Number = 0 Then
    stream.Type = 2
    stream.Charset = "utf-8"
    stream.Open
    stream.WriteText text
    stream.SaveToFile filePath, 2
    stream.Close
    Exit Sub
  End If

  Err.Clear
  Dim fso, file
  Set fso = CreateObject("Scripting.FileSystemObject")
  Set file = fso.CreateTextFile(filePath, True, False)
  file.Write text
  file.Close
End Sub

Function GetActiveDocumentJsonCore(sw, ByRef doc, ByRef title, allowFirstDocumentFallback)
  Dim path, docType, source
  Set doc = Nothing
  title = ""
  path = ""
  docType = ""
  source = "ActiveDoc"

  Err.Clear
  Set doc = sw.ActiveDoc
  If Err.Number <> 0 Then
    Err.Clear
    Set doc = sw.IActiveDoc2
    source = "IActiveDoc2"
  End If

  If doc Is Nothing And allowFirstDocumentFallback Then
    Err.Clear
    Set doc = sw.GetFirstDocument()
    If Err.Number = 0 And Not doc Is Nothing Then source = "GetFirstDocument"
  End If

  If doc Is Nothing Then
    GetActiveDocumentJsonCore = "{""hasActiveDocument"":false,""title"":"""",""path"":"""",""source"":""none""}"
    Exit Function
  End If

  Err.Clear
  title = CStr(doc.GetTitle())
  If Err.Number <> 0 Then title = "" : Err.Clear

  Err.Clear
  path = CStr(doc.GetPathName())
  If Err.Number <> 0 Then path = "" : Err.Clear

  Err.Clear
  docType = CStr(doc.GetType())
  If Err.Number <> 0 Then docType = "" : Err.Clear

  GetActiveDocumentJsonCore = "{""hasActiveDocument"":true,""title"":" & JsonString(title) & ",""path"":" & JsonString(path) & ",""type"":" & JsonString(docType) & ",""source"":" & JsonString(source) & "}"
End Function

Function GetActiveDocumentJson(sw, ByRef doc, ByRef title)
  GetActiveDocumentJson = GetActiveDocumentJsonCore(sw, doc, title, True)
End Function

Function GetStrictActiveDocumentJson(sw, ByRef doc, ByRef title)
  GetStrictActiveDocumentJson = GetActiveDocumentJsonCore(sw, doc, title, False)
End Function

Function GetOpenDocumentsJson(sw)
  Dim candidate, title, path, docType, json, first
  json = "["
  first = True

  Err.Clear
  Set candidate = sw.GetFirstDocument()
  If Err.Number <> 0 Then
    Err.Clear
    GetOpenDocumentsJson = "[]"
    Exit Function
  End If

  Do While Not candidate Is Nothing
    title = ""
    path = ""
    docType = ""

    Err.Clear
    title = CStr(candidate.GetTitle())
    If Err.Number <> 0 Then title = "" : Err.Clear

    Err.Clear
    path = CStr(candidate.GetPathName())
    If Err.Number <> 0 Then path = "" : Err.Clear

    Err.Clear
    docType = CStr(candidate.GetType())
    If Err.Number <> 0 Then docType = "" : Err.Clear

    If Len(Trim(path)) > 0 Then
      If Not first Then json = json & ","
      json = json & "{""hasActiveDocument"":true,""title"":" & JsonString(title) & ",""path"":" & JsonString(path) & ",""type"":" & JsonString(docType) & ",""source"":""GetFirstDocument""}"
      first = False
    End If

    Err.Clear
    Set candidate = candidate.GetNext()
    If Err.Number <> 0 Then Err.Clear : Exit Do
  Loop

  json = json & "]"
  GetOpenDocumentsJson = json
End Function

Function FindOpenDocumentByPath(sw, targetPath)
  Dim candidate, candidatePath
  Set FindOpenDocumentByPath = Nothing

  Err.Clear
  Set candidate = sw.GetOpenDocumentByName(targetPath)
  If Err.Number = 0 And Not candidate Is Nothing Then
    Set FindOpenDocumentByPath = candidate
    Exit Function
  End If
  Err.Clear

  Err.Clear
  Set candidate = sw.GetFirstDocument()
  If Err.Number <> 0 Then Err.Clear
  Do While Not candidate Is Nothing
    Err.Clear
    candidatePath = CStr(candidate.GetPathName())
    If Err.Number = 0 Then
      If StrComp(candidatePath, targetPath, vbTextCompare) = 0 Then
        Set FindOpenDocumentByPath = candidate
        Exit Function
      End If
    End If
    Err.Clear
    Set candidate = candidate.GetNext()
    If Err.Number <> 0 Then Err.Clear : Exit Do
  Loop
End Function

Function WaitForOpenDocumentByPath(sw, targetPath, maxLoops, sleepMs)
  Dim waitIndex, foundDoc
  Set WaitForOpenDocumentByPath = Nothing
  For waitIndex = 1 To maxLoops
    Set foundDoc = FindOpenDocumentByPath(sw, targetPath)
    If Not foundDoc Is Nothing Then
      Set WaitForOpenDocumentByPath = foundDoc
      Exit Function
    End If
    WScript.Sleep sleepMs
  Next
End Function

Function ShellOpenPath(targetPath)
  Dim shellApp, shellRun
  ShellOpenPath = False

  Err.Clear
  Set shellApp = CreateObject("Shell.Application")
  If Err.Number = 0 And Not shellApp Is Nothing Then
    shellApp.ShellExecute targetPath, "", "", "open", 1
    If Err.Number = 0 Then
      ShellOpenPath = True
      Exit Function
    End If
  End If

  Err.Clear
  Set shellRun = CreateObject("WScript.Shell")
  If Err.Number = 0 And Not shellRun Is Nothing Then
    shellRun.Run """" & targetPath & """", 1, False
    If Err.Number = 0 Then ShellOpenPath = True
  End If
  Err.Clear
End Function

Function ReloadActiveDocumentJson(sw, activeDoc, activeDocumentJson)
  Dim reloadPath, reloadTitle, reloadType, saveFlag, closeErr, openErr, openWarn, reopenedDoc, activateErr
  Dim closeWaitIndex, openAttempt, openExceptionNumber, openExceptionText, stillOpenDoc, reopenedTitle
  Dim shellOpenAttempted, shellOpenOk
  reloadPath = ""
  reloadTitle = ""
  reloadType = 0
  saveFlag = False
  closeErr = 0
  openErr = 0
  openWarn = 0
  activateErr = 0
  openExceptionNumber = 0
  openExceptionText = ""
  shellOpenAttempted = False
  shellOpenOk = False

  If activeDoc Is Nothing Then
    ReloadActiveDocumentJson = "{""ok"":false,""connected"":true,""error"":""No active SOLIDWORKS document was found."",""activeDocument"":" & activeDocumentJson & "}"
    Exit Function
  End If

  Err.Clear
  reloadPath = CStr(activeDoc.GetPathName())
  If Err.Number <> 0 Then reloadPath = "" : Err.Clear
  If Len(Trim(reloadPath)) = 0 Then
    ReloadActiveDocumentJson = "{""ok"":false,""connected"":true,""error"":""The active document does not have a saved file path yet."",""activeDocument"":" & activeDocumentJson & "}"
    Exit Function
  End If

  Err.Clear
  reloadTitle = CStr(activeDoc.GetTitle())
  If Err.Number <> 0 Then reloadTitle = "" : Err.Clear

  Err.Clear
  reloadType = CLng(activeDoc.GetType())
  If Err.Number <> 0 Then reloadType = 0 : Err.Clear
  If reloadType <> 1 And reloadType <> 2 Then
    ReloadActiveDocumentJson = "{""ok"":false,""connected"":true,""error"":""CAM reload only works for parts and assemblies, not drawings."",""path"":" & JsonString(reloadPath) & ",""activeDocument"":" & activeDocumentJson & "}"
    Exit Function
  End If

  Err.Clear
  saveFlag = CBool(activeDoc.GetSaveFlag())
  If Err.Number <> 0 Then saveFlag = False : Err.Clear
  If saveFlag Then
    ReloadActiveDocumentJson = "{""ok"":false,""connected"":true,""error"":""The active document has unsaved changes. Save or discard them before CAM reload."",""path"":" & JsonString(reloadPath) & ",""activeDocument"":" & activeDocumentJson & "}"
    Exit Function
  End If

  Err.Clear
  sw.CloseDoc reloadTitle
  closeErr = Err.Number
  If closeErr <> 0 Then
    ReloadActiveDocumentJson = "{""ok"":false,""connected"":true,""error"":" & JsonString("SOLIDWORKS could not close the current document. " & Err.Description) & ",""path"":" & JsonString(reloadPath) & ",""activeDocument"":" & activeDocumentJson & "}"
    Err.Clear
    Exit Function
  End If

  ' CloseDoc is asynchronous. Wait for this exact path to disappear, then
  ' return the saved path to Electron. The app reopens it with the same
  ' shell.openPath route used by Recent SOLIDWORKS Documents, which has
  ' proven more reliable than OpenDoc6 inside this bridge.
  For closeWaitIndex = 1 To 12
    WScript.Sleep 250
    Set stillOpenDoc = FindOpenDocumentByPath(sw, reloadPath)
    If stillOpenDoc Is Nothing Then Exit For
  Next

  ReloadActiveDocumentJson = "{""ok"":true,""connected"":true,""path"":" & JsonString(reloadPath) & ",""title"":" & JsonString(reloadTitle) & ",""closed"":true,""needsExternalOpen"":true,""activeDocument"":" & activeDocumentJson & "}"
End Function

Sub AppendJsonItem(ByRef json, ByRef first, ByVal item)
  If Not first Then json = json & ","
  json = json & item
  first = False
End Sub

Function ParentFolderOf(ByVal filePath)
  Dim fsoLocal, clean
  ParentFolderOf = ""
  clean = Trim(CStr(filePath))
  If Len(clean) = 0 Then Exit Function
  Err.Clear
  Set fsoLocal = CreateObject("Scripting.FileSystemObject")
  If Err.Number = 0 And Not fsoLocal Is Nothing Then
    ParentFolderOf = CStr(fsoLocal.GetParentFolderName(clean))
  End If
  If Err.Number <> 0 Then ParentFolderOf = "" : Err.Clear
End Function

Function FindOpenDocumentByTitle(sw, ByVal targetTitle)
  Dim candidate, candidateTitle
  Set FindOpenDocumentByTitle = Nothing
  If Len(Trim(CStr(targetTitle))) = 0 Then Exit Function

  Err.Clear
  Set candidate = sw.GetFirstDocument()
  If Err.Number <> 0 Then Err.Clear
  Do While Not candidate Is Nothing
    Err.Clear
    candidateTitle = CStr(candidate.GetTitle())
    If Err.Number = 0 Then
      If StrComp(candidateTitle, targetTitle, vbTextCompare) = 0 Then
        Set FindOpenDocumentByTitle = candidate
        Exit Function
      End If
    End If
    Err.Clear
    Set candidate = candidate.GetNext()
    If Err.Number <> 0 Then Err.Clear : Exit Do
  Loop
End Function

Function FindOpenDocumentForTarget(sw, ByVal targetPath, ByVal targetTitle)
  Set FindOpenDocumentForTarget = Nothing
  If Len(Trim(CStr(targetPath))) > 0 Then
    Set FindOpenDocumentForTarget = FindOpenDocumentByPath(sw, CStr(targetPath))
    If Not FindOpenDocumentForTarget Is Nothing Then Exit Function
  End If
  If Len(Trim(CStr(targetTitle))) > 0 Then
    Set FindOpenDocumentForTarget = FindOpenDocumentByTitle(sw, CStr(targetTitle))
  End If
End Function

Sub AddCloseTarget(targets, ByVal targetPath, ByVal targetTitle, ByVal reason)
  Dim cleanPath, cleanTitle, key, previous
  cleanPath = Trim(CStr(targetPath))
  cleanTitle = Trim(CStr(targetTitle))
  If Len(cleanPath) = 0 And Len(cleanTitle) = 0 Then Exit Sub

  If Len(cleanPath) > 0 Then
    key = "p:" & LCase(cleanPath)
  Else
    key = "t:" & LCase(cleanTitle)
  End If

  If targets.Exists(key) Then
    previous = CStr(targets.Item(key))
    If InStr(1, previous, CStr(reason), vbTextCompare) = 0 Then
      targets.Item(key) = previous & "," & CStr(reason)
    End If
  Else
    targets.Add key, cleanPath & vbTab & cleanTitle & vbTab & CStr(reason)
  End If
End Sub

Function SaveAndCloseDocumentJson(sw, ByVal targetPath, ByVal targetTitle, ByVal reason, ByRef failed)
  Dim doc, docPath, docTitle, docType, docVisible, saveErrors, saveWarnings, saveOk, closeErr, closeText
  Dim waitIndex, stillOpenDoc, saveFlag
  Set doc = FindOpenDocumentForTarget(sw, targetPath, targetTitle)
  If doc Is Nothing Then
    SaveAndCloseDocumentJson = "{""ok"":true,""alreadyClosed"":true,""path"":" & JsonString(targetPath) & ",""title"":" & JsonString(targetTitle) & ",""reason"":" & JsonString(reason) & "}"
    Exit Function
  End If

  docPath = ""
  docTitle = ""
  docType = 0
  docVisible = False
  saveFlag = False
  Err.Clear
  docPath = CStr(doc.GetPathName())
  If Err.Number <> 0 Then docPath = "" : Err.Clear
  Err.Clear
  docTitle = CStr(doc.GetTitle())
  If Err.Number <> 0 Then docTitle = CStr(targetTitle) : Err.Clear
  Err.Clear
  docType = CLng(doc.GetType())
  If Err.Number <> 0 Then docType = 0 : Err.Clear
  Err.Clear
  docVisible = CBool(doc.Visible)
  If Err.Number <> 0 Then docVisible = False : Err.Clear
  Err.Clear
  saveFlag = CBool(doc.GetSaveFlag())
  If Err.Number <> 0 Then saveFlag = False : Err.Clear

  If Len(Trim(docPath)) = 0 Then
    failed = True
    SaveAndCloseDocumentJson = "{""ok"":false,""closed"":false,""error"":""Open SOLIDWORKS document has no saved file path; leaving it open."",""path"":"""",""title"":" & JsonString(docTitle) & ",""type"":" & CStr(docType) & ",""visible"":" & JsonBool(docVisible) & ",""reason"":" & JsonString(reason) & "}"
    Exit Function
  End If

  saveErrors = 0
  saveWarnings = 0
  Err.Clear
  saveOk = CBool(doc.Save3(1, saveErrors, saveWarnings))
  If Err.Number <> 0 Then
    failed = True
    SaveAndCloseDocumentJson = "{""ok"":false,""closed"":false,""error"":" & JsonString("Save3 raised: " & Err.Description) & ",""path"":" & JsonString(docPath) & ",""title"":" & JsonString(docTitle) & ",""type"":" & CStr(docType) & ",""visible"":" & JsonBool(docVisible) & ",""saveErrors"":" & CStr(saveErrors) & ",""saveWarnings"":" & CStr(saveWarnings) & ",""reason"":" & JsonString(reason) & "}"
    Err.Clear
    Exit Function
  End If
  If Not saveOk Or CLng(saveErrors) <> 0 Then
    failed = True
    SaveAndCloseDocumentJson = "{""ok"":false,""closed"":false,""error"":""Save3 failed; leaving document open."",""path"":" & JsonString(docPath) & ",""title"":" & JsonString(docTitle) & ",""type"":" & CStr(docType) & ",""visible"":" & JsonBool(docVisible) & ",""saveErrors"":" & CStr(saveErrors) & ",""saveWarnings"":" & CStr(saveWarnings) & ",""reason"":" & JsonString(reason) & "}"
    Exit Function
  End If

  Err.Clear
  sw.CloseDoc docTitle
  closeErr = Err.Number
  closeText = Err.Description
  If closeErr <> 0 Then
    failed = True
    SaveAndCloseDocumentJson = "{""ok"":false,""closed"":false,""error"":" & JsonString("CloseDoc raised: " & closeText) & ",""path"":" & JsonString(docPath) & ",""title"":" & JsonString(docTitle) & ",""type"":" & CStr(docType) & ",""visible"":" & JsonBool(docVisible) & ",""saveErrors"":" & CStr(saveErrors) & ",""saveWarnings"":" & CStr(saveWarnings) & ",""reason"":" & JsonString(reason) & "}"
    Err.Clear
    Exit Function
  End If

  For waitIndex = 1 To 16
    WScript.Sleep 250
    Set stillOpenDoc = FindOpenDocumentByPath(sw, docPath)
    If stillOpenDoc Is Nothing Then Exit For
  Next

  SaveAndCloseDocumentJson = "{""ok"":true,""saved"":true,""closed"":" & JsonBool(stillOpenDoc Is Nothing) & ",""path"":" & JsonString(docPath) & ",""title"":" & JsonString(docTitle) & ",""type"":" & CStr(docType) & ",""visible"":" & JsonBool(docVisible) & ",""wasDirty"":" & JsonBool(saveFlag) & ",""saveErrors"":" & CStr(saveErrors) & ",""saveWarnings"":" & CStr(saveWarnings) & ",""reason"":" & JsonString(reason) & "}"
End Function

Function SaveCloseCamDocumentsJson(sw, activeDocumentJson)
  Dim sc, scAvailable, scError, closeTargets, docInfos, candidate, candidatePath, candidateTitle, candidateType, candidateVisible
  Dim key, parts, info, activateErrors, activateException, active, isCamPart, camType, camPath, refModel, saveFolder, savedCamPath
  Dim camOpsJson, camOpsFirst, closeJson, closeFirst, closeFailed, camFailed, closeItemJson, camCloseErr, camCloseText
  Dim docCount, camCount, targetCount, folderForSave

  scAvailable = False
  scError = ""
  Set closeTargets = CreateObject("Scripting.Dictionary")
  closeTargets.CompareMode = 1
  Set docInfos = CreateObject("Scripting.Dictionary")

  Err.Clear
  Set sc = CreateObject("SolidCAM.Automation")
  If Err.Number = 0 And Not sc Is Nothing Then
    scAvailable = True
  Else
    scError = CStr(Err.Description)
    Err.Clear
  End If

  docCount = 0
  Err.Clear
  Set candidate = sw.GetFirstDocument()
  If Err.Number <> 0 Then Err.Clear
  Do While Not candidate Is Nothing
    candidatePath = ""
    candidateTitle = ""
    candidateType = 0
    candidateVisible = False
    Err.Clear
    candidatePath = CStr(candidate.GetPathName())
    If Err.Number <> 0 Then candidatePath = "" : Err.Clear
    Err.Clear
    candidateTitle = CStr(candidate.GetTitle())
    If Err.Number <> 0 Then candidateTitle = "" : Err.Clear
    Err.Clear
    candidateType = CLng(candidate.GetType())
    If Err.Number <> 0 Then candidateType = 0 : Err.Clear
    Err.Clear
    candidateVisible = CBool(candidate.Visible)
    If Err.Number <> 0 Then candidateVisible = False : Err.Clear

    If candidateVisible And (candidateType = 1 Or candidateType = 2) And Len(candidateTitle) > 0 Then
      docInfos.Add CStr(docInfos.Count), candidatePath & vbTab & candidateTitle & vbTab & CStr(candidateType)
    End If
    docCount = docCount + 1

    Err.Clear
    Set candidate = candidate.GetNext()
    If Err.Number <> 0 Then Err.Clear : Exit Do
  Loop

  camOpsJson = "["
  camOpsFirst = True
  camFailed = False
  camCount = 0

  If scAvailable Then
    Set active = Nothing
    Err.Clear
    Set active = sw.ActiveDoc
    If Err.Number <> 0 Then Err.Clear

    candidatePath = ""
    candidateTitle = ""
    candidateType = 0
    If Not active Is Nothing Then
      Err.Clear
      candidatePath = CStr(active.GetPathName())
      If Err.Number <> 0 Then candidatePath = "" : Err.Clear
      Err.Clear
      candidateTitle = CStr(active.GetTitle())
      If Err.Number <> 0 Then candidateTitle = "" : Err.Clear
      Err.Clear
      candidateType = CLng(active.GetType())
      If Err.Number <> 0 Then candidateType = 0 : Err.Clear
    End If

    isCamPart = False
    camType = -999
    camPath = ""
    refModel = ""
    If Not active Is Nothing Then
      Err.Clear
      isCamPart = CBool(sc.IsActiveDocCamPart)
      If Err.Number <> 0 Then isCamPart = False : Err.Clear
      Err.Clear
      camType = CLng(sc.Type)
      If Err.Number <> 0 Then camType = -999 : Err.Clear
    End If

    If isCamPart Or camType > 0 Then
      camCount = 1
      Err.Clear
      camPath = CStr(sc.Path)
      If Err.Number <> 0 Then camPath = "" : Err.Clear
      Err.Clear
      refModel = CStr(sc.ReferenceModel)
      If Err.Number <> 0 Then refModel = "" : Err.Clear

      saveFolder = ParentFolderOf(camPath)
      If Len(saveFolder) = 0 Then saveFolder = ParentFolderOf(candidatePath)
      If Len(saveFolder) = 0 Then saveFolder = ParentFolderOf(refModel)

      ' SolidCAM.Automation.Save(folder) can block when the active CAM-Part
      ' is already in the temporary compressed
      ' PRZ workspace. SolidCAM's documented CAM-Part Close command
      ' updates the compressed CAM-Part when needed, so use Close as the
      ' CAM save/commit step and save SOLIDWORKS model documents below
      ' with ModelDoc2.Save3 before CloseDoc.
      savedCamPath = camPath

      camCloseErr = 0
      camCloseText = ""
      Err.Clear
      sc.Close()
      camCloseErr = Err.Number
      camCloseText = Err.Description
      If camCloseErr <> 0 Then
        camFailed = True
        Err.Clear
      End If

      AddCloseTarget closeTargets, candidatePath, candidateTitle, "active-cam-document"
      AddCloseTarget closeTargets, refModel, "", "reference-model"

      AppendJsonItem camOpsJson, camOpsFirst, "{""documentTitle"":" & JsonString(candidateTitle) & ",""documentPath"":" & JsonString(candidatePath) & ",""camPath"":" & JsonString(camPath) & ",""referenceModel"":" & JsonString(refModel) & ",""saveFolder"":" & JsonString(saveFolder) & ",""savedCamPath"":" & JsonString(savedCamPath) & ",""saveMethod"":""SolidCAM.Close"",""closed"":" & JsonBool(camCloseErr = 0) & ",""camType"":" & CStr(camType) & ",""exception"":" & JsonString(camCloseText) & "}"
    End If
  End If
  camOpsJson = camOpsJson & "]"

  closeJson = "["
  closeFirst = True
  closeFailed = False
  targetCount = closeTargets.Count
  For Each key In closeTargets.Keys
    parts = Split(CStr(closeTargets.Item(key)), vbTab)
    candidatePath = ""
    candidateTitle = ""
    folderForSave = ""
    If UBound(parts) >= 0 Then candidatePath = parts(0)
    If UBound(parts) >= 1 Then candidateTitle = parts(1)
    If UBound(parts) >= 2 Then folderForSave = parts(2)
    closeItemJson = SaveAndCloseDocumentJson(sw, candidatePath, candidateTitle, folderForSave, closeFailed)
    AppendJsonItem closeJson, closeFirst, closeItemJson
  Next
  closeJson = closeJson & "]"

  SaveCloseCamDocumentsJson = "{""ok"":" & JsonBool(Not camFailed And Not closeFailed) & _
    ",""connected"":true" & _
    ",""solidCamAutomationAvailable"":" & JsonBool(scAvailable) & _
    ",""solidCamAutomationError"":" & JsonString(scError) & _
    ",""openDocumentCount"":" & CStr(docCount) & _
    ",""visibleModelCount"":" & CStr(docInfos.Count) & _
    ",""camPartCount"":" & CStr(camCount) & _
    ",""closeTargetCount"":" & CStr(targetCount) & _
    ",""camOperations"":" & camOpsJson & _
    ",""closedDocuments"":" & closeJson & _
    ",""activeDocument"":" & activeDocumentJson & "}"
End Function

Function AttemptJson(moduleCandidate, procedureCandidate, methodName, ok, runError, errNumber, errDescription)
  AttemptJson = "{""moduleName"":" & JsonString(moduleCandidate) & _
    ",""procedureName"":" & JsonString(procedureCandidate) & _
    ",""method"":" & JsonString(methodName) & _
    ",""ok"":" & JsonBool(ok) & _
    ",""runMacroError"":" & CStr(runError) & _
    ",""exception"":" & JsonString(CStr(errNumber) & " " & errDescription) & "}"
End Function

Dim sw, startedSolidWorks, connectedError
startedSolidWorks = False
connectedError = ""

Err.Clear
Set sw = GetObject(, "SldWorks.Application")
If Err.Number <> 0 Or sw Is Nothing Then
  connectedError = CStr(Err.Number) & " " & Err.Description
  Err.Clear
  ' Never auto-spawn SOLIDWORKS through COM. Starting SW via COM can leave
  ' the session half-initialized (template prompts, wrong defaults, stale ROT
  ' entries). Excelsis should bind only to a user-started SOLIDWORKS session
  ' or open documents through normal Windows/SOLIDWORKS file association.
End If

If Err.Number <> 0 Or sw Is Nothing Then
  WriteUtf8 outputPath, "{""ok"":false,""connected"":false,""error"":" & JsonString("Could not connect to SOLIDWORKS. " & connectedError & " " & Err.Description) & "}"
  WScript.Quit 0
End If

Dim activeDoc, activeTitle, activeDocumentJson

If action = "reload-doc" Then
  ' Reload is destructive: only use SOLIDWORKS' real foreground document.
  ' Status/macro paths may fall back to GetFirstDocument for display, but
  ' reload must never close a merely first-open background file.
  activeDocumentJson = GetStrictActiveDocumentJson(sw, activeDoc, activeTitle)
  WriteUtf8 outputPath, ReloadActiveDocumentJson(sw, activeDoc, activeDocumentJson)
  WScript.Quit 0
End If

If action = "create-blank-part" Then
  ' Generates the neutral "CAM loader" scratch part on demand instead of
  ' depending on a bundled .SLDPRT. It asks SOLIDWORKS for its own configured
  ' default part template (Tools > Options > Default Templates), so this works on
  ' any machine/SW install without any file needing to be distributed.
  ' The destination path is reused from the -MacroPath bridge parameter.
  Dim blankTargetPath, blankTemplatePath, blankNewDoc, blankErrNum, blankErrText
  Dim blankSaveErrNum, blankSaveErrText, blankFso, blankDocTitle, blankTemplatesFolder

  blankTargetPath = macroPath

  If Len(Trim(blankTargetPath)) = 0 Then
    WriteUtf8 outputPath, "{""ok"":false,""connected"":true,""error"":""No target path was given for the blank part.""}"
    WScript.Quit 0
  End If

  Set blankFso = CreateObject("Scripting.FileSystemObject")

  Err.Clear
  blankTemplatePath = CStr(sw.GetUserPreferenceStringValue(8)) ' swDefaultTemplatePart
  If Err.Number <> 0 Then blankTemplatePath = "" : Err.Clear

  If Len(Trim(blankTemplatePath)) = 0 Or Not blankFso.FileExists(blankTemplatePath) Then
    ' Some installs don't have a single "default" template configured (SW
    ' prompts every time instead) - fall back to the standard Part template
    ' inside SOLIDWORKS' own configured templates folder.
    Err.Clear
    blankTemplatesFolder = CStr(sw.GetUserPreferenceStringValue(6)) ' swFileLocationsDocumentTemplates
    If Err.Number <> 0 Then blankTemplatesFolder = "" : Err.Clear
    If Len(Trim(blankTemplatesFolder)) > 0 Then
      If Right(blankTemplatesFolder, 1) <> "\" Then blankTemplatesFolder = blankTemplatesFolder & "\"
      blankTemplatePath = blankTemplatesFolder & "Part.prtdot"
    End If
  End If

  If Len(Trim(blankTemplatePath)) = 0 Or Not blankFso.FileExists(blankTemplatePath) Then
    WriteUtf8 outputPath, "{""ok"":false,""connected"":true,""error"":""No usable SOLIDWORKS part template was found (checked the configured default template and the templates folder)."",""templatePath"":" & JsonString(blankTemplatePath) & "}"
    WScript.Quit 0
  End If

  Err.Clear
  Set blankNewDoc = sw.NewDocument(blankTemplatePath, 0, 0, 0)
  blankErrNum = Err.Number
  blankErrText = Err.Description
  If blankNewDoc Is Nothing Or blankErrNum <> 0 Then
    WriteUtf8 outputPath, "{""ok"":false,""connected"":true,""error"":" & JsonString("NewDocument failed: " & CStr(blankErrNum) & " " & blankErrText) & ",""templatePath"":" & JsonString(blankTemplatePath) & "}"
    WScript.Quit 0
  End If

  Err.Clear
  blankNewDoc.SaveAs3 blankTargetPath, 0, 1 ' swSaveAsOptions_Silent
  blankSaveErrNum = Err.Number
  blankSaveErrText = Err.Description

  If blankSaveErrNum <> 0 Or Not blankFso.FileExists(blankTargetPath) Then
    Err.Clear
    sw.CloseDoc blankNewDoc.GetTitle()
    Err.Clear
    WriteUtf8 outputPath, "{""ok"":false,""connected"":true,""error"":" & JsonString("Could not save the blank part: " & CStr(blankSaveErrNum) & " " & blankSaveErrText) & ",""templatePath"":" & JsonString(blankTemplatePath) & ",""targetPath"":" & JsonString(blankTargetPath) & "}"
    WScript.Quit 0
  End If

  Err.Clear
  blankDocTitle = CStr(blankNewDoc.GetTitle())
  If Err.Number <> 0 Then blankDocTitle = "" : Err.Clear

  Err.Clear
  sw.CloseDoc blankDocTitle
  Err.Clear

  WriteUtf8 outputPath, "{""ok"":true,""connected"":true,""templatePath"":" & JsonString(blankTemplatePath) & ",""documentPath"":" & JsonString(blankTargetPath) & "}"
  WScript.Quit 0
End If

activeDocumentJson = GetActiveDocumentJson(sw, activeDoc, activeTitle)

If action = "save-close-cam-docs" Then
  Dim saveCloseJsonText, saveCloseErrNumber, saveCloseErrText
  Err.Clear
  saveCloseJsonText = SaveCloseCamDocumentsJson(sw, activeDocumentJson)
  saveCloseErrNumber = Err.Number
  saveCloseErrText = Err.Description
  If Len(Trim(CStr(saveCloseJsonText))) > 0 Then
    WriteUtf8 outputPath, saveCloseJsonText
  ElseIf saveCloseErrNumber <> 0 Then
    Err.Clear
    WriteUtf8 outputPath, "{""ok"":false,""connected"":true,""error"":" & JsonString("Save/close CAM bridge error: " & CStr(saveCloseErrNumber) & " " & saveCloseErrText) & ",""activeDocument"":" & activeDocumentJson & "}"
  Else
    WriteUtf8 outputPath, "{""ok"":false,""connected"":true,""error"":""Save/close CAM bridge returned an empty result."",""activeDocument"":" & activeDocumentJson & "}"
  End If
  WScript.Quit 0
End If

If action = "exit-solidworks" Then
  Dim exitErrNumber, exitErrText
  Err.Clear
  sw.ExitApp
  exitErrNumber = Err.Number
  exitErrText = Err.Description
  If exitErrNumber <> 0 Then
    Err.Clear
    WriteUtf8 outputPath, "{""ok"":false,""connected"":true,""error"":" & JsonString("SOLIDWORKS ExitApp failed: " & CStr(exitErrNumber) & " " & exitErrText) & ",""activeDocument"":" & activeDocumentJson & "}"
  Else
    WriteUtf8 outputPath, "{""ok"":true,""connected"":true,""exiting"":true,""activeDocument"":" & activeDocumentJson & "}"
  End If
  WScript.Quit 0
End If

If action = "status" Or action = "connect" Then
  WriteUtf8 outputPath, "{""ok"":true,""connected"":true,""startedSolidWorks"":" & JsonBool(startedSolidWorks) & ",""activeDocument"":" & activeDocumentJson & ",""openDocuments"":" & GetOpenDocumentsJson(sw) & "}"
  WScript.Quit 0
End If

Dim fso
Set fso = CreateObject("Scripting.FileSystemObject")
If Len(Trim(macroPath)) = 0 Or Not fso.FileExists(macroPath) Then
  WriteUtf8 outputPath, "{""ok"":false,""connected"":true,""error"":""Macro file was not found."",""macroPath"":" & JsonString(macroPath) & ",""activeDocument"":" & activeDocumentJson & "}"
  WScript.Quit 0
End If

' Carefully manage the active-doc handoff before invoking RunMacro. Calling
' ActivateDoc3 on an already active document can leave SOLIDWORKS in a
' transient "no active document" state, which causes
' macros to see swApp.ActiveDoc = Nothing even though the doc is visibly
' open. So: inspect the current active doc directly, and only re-activate
' if needed. Capture the before/after state so the caller can diagnose.
Dim activateInfoJson, activateBeforeTitle, activateAfterTitle
Dim activateAttempted, activateErrors, activateExceptionNumber, activateExceptionText
Dim currentActive, postActive
activateAttempted = False
activateErrors = 0
activateExceptionNumber = 0
activateExceptionText = ""
activateBeforeTitle = ""
activateAfterTitle = ""

If Len(activeTitle) > 0 Then
  Err.Clear
  Set currentActive = sw.ActiveDoc
  If Err.Number = 0 And Not currentActive Is Nothing Then
    Err.Clear
    activateBeforeTitle = CStr(currentActive.GetTitle())
    If Err.Number <> 0 Then activateBeforeTitle = "" : Err.Clear
  End If
  Err.Clear

  If StrComp(activateBeforeTitle, activeTitle, vbTextCompare) <> 0 Then
    activateAttempted = True
    Err.Clear
    Set currentActive = sw.ActivateDoc3(activeTitle, True, 0, activateErrors)
    activateExceptionNumber = Err.Number
    activateExceptionText = CStr(Err.Description)
    If activateExceptionNumber <> 0 Then Err.Clear
  End If

  Err.Clear
  Set postActive = sw.ActiveDoc
  If Err.Number = 0 And Not postActive Is Nothing Then
    Err.Clear
    activateAfterTitle = CStr(postActive.GetTitle())
    If Err.Number <> 0 Then activateAfterTitle = "" : Err.Clear
  End If
  Err.Clear
End If

activateInfoJson = "{""expectedTitle"":" & JsonString(activeTitle) & _
  ",""beforeTitle"":" & JsonString(activateBeforeTitle) & _
  ",""attempted"":" & JsonBool(activateAttempted) & _
  ",""activateErrors"":" & CStr(activateErrors) & _
  ",""exceptionNumber"":" & CStr(activateExceptionNumber) & _
  ",""exception"":" & JsonString(activateExceptionText) & _
  ",""afterTitle"":" & JsonString(activateAfterTitle) & "}"

Dim moduleCandidates, procedureCandidates, macroMethods, fileBase, extensionName, rawMethods, methodText, dotIndex, methodModule, methodProcedure
Set moduleCandidates = CreateObject("Scripting.Dictionary")
Set procedureCandidates = CreateObject("Scripting.Dictionary")
Set macroMethods = CreateObject("Scripting.Dictionary")
moduleCandidates.CompareMode = 1
procedureCandidates.CompareMode = 1
macroMethods.CompareMode = 1

fileBase = fso.GetBaseName(macroPath)
extensionName = LCase(fso.GetExtensionName(macroPath))

Err.Clear
rawMethods = sw.GetMacroMethods(macroPath, 1)
If Err.Number = 0 Then
  If IsArray(rawMethods) Then
    For Each methodText In rawMethods
      methodText = CStr(methodText)
      If Len(Trim(methodText)) > 0 Then
        AddUnique macroMethods, methodText
        dotIndex = InStr(1, methodText, ".", vbTextCompare)
        If dotIndex > 1 Then
          methodModule = Left(methodText, dotIndex - 1)
          methodProcedure = Mid(methodText, dotIndex + 1)
          AddUnique moduleCandidates, methodModule
          AddUnique procedureCandidates, methodProcedure
        End If
      End If
    Next
  End If
End If
Err.Clear

Dim optionsValue
If extensionName = "dll" Then
  optionsValue = 0
  AddUnique moduleCandidates, moduleName
  AddUnique moduleCandidates, ""
  AddUnique procedureCandidates, procedureName
  AddUnique procedureCandidates, "Main"
Else
  optionsValue = 1
  AddUnique moduleCandidates, moduleName
  AddUnique moduleCandidates, fileBase
  AddUnique moduleCandidates, fileBase & "1"
  AddUnique moduleCandidates, "Macro1"
  AddUnique moduleCandidates, "Module1"
  AddUnique procedureCandidates, procedureName
  AddUnique procedureCandidates, "main"
  AddUnique procedureCandidates, "Main"
End If

Dim attemptsJson, firstAttempt, selectedModule, selectedProcedure, selectedMethod, selectedError, selectedOk, moduleKey, procedureKey
attemptsJson = "["
firstAttempt = True
selectedModule = ""
selectedProcedure = ""
selectedMethod = ""
selectedError = 0
selectedOk = False

For Each moduleKey In moduleCandidates.Keys
  If selectedOk Then Exit For
  For Each procedureKey In procedureCandidates.Keys
    If selectedOk Then Exit For

    Dim m, p, runError, runOk, errNumber, errDescription, attempt
    m = moduleCandidates.Item(moduleKey)
    p = procedureCandidates.Item(procedureKey)

    Err.Clear
    runError = 0
    runOk = False
    runOk = CBool(sw.RunMacro2(macroPath, m, p, optionsValue, runError))
    errNumber = Err.Number
    errDescription = Err.Description
    If errNumber <> 0 Then Err.Clear
    attempt = AttemptJson(m, p, "RunMacro2", runOk And errNumber = 0, runError, errNumber, errDescription)
    If Not firstAttempt Then attemptsJson = attemptsJson & ","
    attemptsJson = attemptsJson & attempt
    firstAttempt = False

    If runOk And errNumber = 0 Then
      selectedOk = True
      selectedModule = m
      selectedProcedure = p
      selectedMethod = "RunMacro2"
      selectedError = runError
      Exit For
    End If

    Err.Clear
    runOk = False
    runOk = CBool(sw.RunMacro(macroPath, m, p))
    errNumber = Err.Number
    errDescription = Err.Description
    If errNumber <> 0 Then Err.Clear
    attempt = AttemptJson(m, p, "RunMacro", runOk And errNumber = 0, 0, errNumber, errDescription)
    If Not firstAttempt Then attemptsJson = attemptsJson & ","
    attemptsJson = attemptsJson & attempt
    firstAttempt = False

    If runOk And errNumber = 0 Then
      selectedOk = True
      selectedModule = m
      selectedProcedure = p
      selectedMethod = "RunMacro"
      selectedError = 0
      Exit For
    End If
  Next
Next
attemptsJson = attemptsJson & "]"

Dim errorText
If selectedOk Then
  errorText = ""
Else
  errorText = "SOLIDWORKS could not run the macro. Check macro security and the module/procedure names."
End If

WriteUtf8 outputPath, "{""ok"":" & JsonBool(selectedOk) & _
  ",""connected"":true" & _
  ",""startedSolidWorks"":" & JsonBool(startedSolidWorks) & _
  ",""macroPath"":" & JsonString(macroPath) & _
  ",""moduleName"":" & JsonString(selectedModule) & _
  ",""procedureName"":" & JsonString(selectedProcedure) & _
  ",""runMacroError"":" & CStr(selectedError) & _
  ",""runMethod"":" & JsonString(selectedMethod) & _
  ",""activeDocument"":" & activeDocumentJson & _
  ",""activateInfo"":" & activateInfoJson & _
  ",""macroMethods"":" & JsonArrayFromDictionary(macroMethods) & _
  ",""attempts"":" & attemptsJson & _
  ",""error"":" & JsonString(errorText) & "}"
'@

$scriptPath = Join-Path ([System.IO.Path]::GetTempPath()) ("excelsis-solidworks-bridge-{0}.vbs" -f ([System.Guid]::NewGuid().ToString("N")))
$outputPath = Join-Path ([System.IO.Path]::GetTempPath()) ("excelsis-solidworks-bridge-{0}.json" -f ([System.Guid]::NewGuid().ToString("N")))

function Get-SolidWorksProcessHint {
  param($Process, [switch]$IncludeDiagnostics)
  $title = [string]$Process.MainWindowTitle
  $hasDoc = $false
  $reason = "no-window-title"
  if (-not [string]::IsNullOrWhiteSpace($title)) {
    $hasDoc = ($title -match '\[[^\[\]]+\]')
    $reason = if ($hasDoc) { "document-in-title" } else { "no-document-brackets" }
  }
  $info = [ordered]@{
    id = [int]$Process.Id
    title = $title
    hasDocument = $hasDoc
    reason = $reason
  }
  if ($IncludeDiagnostics) {
    # Pull WMI/CIM data so we can see WHO spawned this orphan and HOW.
    # Win32_Process gives ParentProcessId + CommandLine + CreationDate.
    try {
      $cim = Get-CimInstance Win32_Process -Filter "ProcessId=$($Process.Id)" -ErrorAction SilentlyContinue
      if ($null -ne $cim) {
        $info.parentProcessId = [int]$cim.ParentProcessId
        $info.commandLine = [string]$cim.CommandLine
        try {
          $parent = Get-Process -Id $cim.ParentProcessId -ErrorAction SilentlyContinue
          if ($null -ne $parent) {
            $info.parentProcessName = [string]$parent.ProcessName
            try { $info.parentProcessPath = [string]$parent.Path } catch { $info.parentProcessPath = "" }
          } else {
            $info.parentProcessName = "(parent exited)"
            $info.parentProcessPath = ""
          }
        } catch {}
      }
      try { $info.startTime = $Process.StartTime.ToString("o") } catch {}
      try { $info.processName = [string]$Process.ProcessName } catch {}
      try { $info.processPath = [string]$Process.Path } catch {}
      try { $info.workingSetMb = [math]::Round($Process.WorkingSet64 / 1MB, 1) } catch {}
    } catch {
      $info.diagnosticsError = $_.Exception.Message
    }
  }
  return [pscustomobject]$info
}

function Invoke-KillSolidWorksInstances {
  $procs = @(Get-Process -Name "SLDWORKS" -ErrorAction SilentlyContinue)
  $hints = @($procs | ForEach-Object { Get-SolidWorksProcessHint $_ -IncludeDiagnostics })
  $killed = New-Object System.Collections.Generic.List[object]
  $failed = New-Object System.Collections.Generic.List[object]
  foreach ($hint in $hints) {
    try {
      Stop-Process -Id $hint.id -Force -ErrorAction Stop
      $killed.Add($hint)
    } catch {
      $failed.Add(([ordered]@{ id = $hint.id; error = $_.Exception.Message; hint = $hint }))
    }
  }
  if ($killed.Count -gt 0) { Start-Sleep -Milliseconds 750 }
  $survivorProcs = @(Get-Process -Name "SLDWORKS" -ErrorAction SilentlyContinue)
  return [ordered]@{
    schema = "excelsis-kill-sw-v1"
    totalInstances = $procs.Count
    killed = $killed.ToArray()
    failed = $failed.ToArray()
    survivors = @($survivorProcs | ForEach-Object { Get-SolidWorksProcessHint $_ -IncludeDiagnostics })
  }
}

function Reconcile-SolidWorksInstances {
  $procs = @(Get-Process -Name "SLDWORKS" -ErrorAction SilentlyContinue)
  $result = [ordered]@{
    instances = @($procs | ForEach-Object { Get-SolidWorksProcessHint $_ })
    killed = @()
    action = "none"
  }
  if ($procs.Count -le 1) {
    $result.action = "single-or-none"
    return $result
  }
  $withDoc = @($result.instances | Where-Object { $_.hasDocument })
  if ($withDoc.Count -eq 0) {
    $result.action = "no-instance-has-doc"
    return $result
  }
  $result.action = "multiple-instances-observed"
  return $result
}

try {
  # The main process exposes this action only after a fresh health check has
  # classified the session as killable and the user has confirmed the action.
  if ($Action -eq "kill-solidworks") {
    $result = Invoke-KillSolidWorksInstances
    $result | Add-Member -NotePropertyName ok -NotePropertyValue $true -Force
    $result | ConvertTo-Json -Depth 12 -Compress
    exit 0
  }

  Set-Content -LiteralPath $scriptPath -Value $bridgeScript -Encoding ASCII
  function Convert-ToBridgeArg {
    param([string]$Value)
    if ([string]::IsNullOrEmpty($Value)) { return "__EXCELSIS_EMPTY__" }
    return $Value
  }

  # Record a read-only process summary before talking to COM. Window-title
  # hints are diagnostic only and are never used to terminate a process.
  $reconcileInfo = $null
  try {
    $reconcileInfo = Reconcile-SolidWorksInstances
  } catch {
    $reconcileInfo = [ordered]@{ action = "reconcile-failed"; error = $_.Exception.Message }
  }

  $arguments = @(
    "//NoLogo",
    $scriptPath,
    $Action,
    (Convert-ToBridgeArg $MacroPath),
    (Convert-ToBridgeArg $ModuleName),
    (Convert-ToBridgeArg $ProcedureName),
    $outputPath
  )
  $processResult = Invoke-CscriptBridge $arguments $BridgeTimeoutSeconds

  if ($processResult.timedOut) {
    $fallback = Get-SolidWorksWindowFallback
    Write-BridgeJson @{
      ok = [bool]$fallback.connected
      connected = [bool]$fallback.connected
      startedSolidWorks = $false
      solidWorksBusy = $true
      activeDocument = $(if ($null -ne $fallback.activeDocument) {
        $fallback.activeDocument
      } else {
        @{
          hasActiveDocument = $false
          title = ""
          path = ""
          source = "none"
        }
      })
      solidWorksWindows = $fallback.windows
      reconcileInfo = $reconcileInfo
      windowsActivity = (Get-WindowsActivitySnapshot)
      error = "SOLIDWORKS did not answer the quick status check before the timeout."
    }
  }

  if (Test-Path -LiteralPath $outputPath -PathType Leaf) {
    $raw = Get-Content -LiteralPath $outputPath -Raw -Encoding UTF8
    Add-WindowFallback $raw $reconcileInfo
    exit 0
  }

  Write-BridgeJson @{
    ok = $false
    connected = $false
    error = "SOLIDWORKS bridge did not produce a response."
    detail = (($processResult.stdout, $processResult.stderr) -join "`n")
    reconcileInfo = $reconcileInfo
    windowsActivity = (Get-WindowsActivitySnapshot)
  }
} catch {
  Write-BridgeJson @{
    ok = $false
    connected = $false
    error = $_.Exception.Message
    macroPath = $MacroPath
    reconcileInfo = $reconcileInfo
    windowsActivity = (Get-WindowsActivitySnapshot)
  }
} finally {
  Remove-Item -LiteralPath $scriptPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $outputPath -Force -ErrorAction SilentlyContinue
}
