# Excelsis-Default-Version: 1.3.2
# Creates a configured CAM folder for the active SOLIDWORKS part/component.
param(
  [string]$OutputDrive = "C:\CAM",
  [ValidateSet("project-part", "project-relative")]
  [string]$FolderMode = "project-part",
  [string[]]$SearchRoots = @("$env:USERPROFILE\Documents"),
  [string[]]$ProjectPrefixes = @(),
  [string[]]$ProjectRootNames = @("CompanyProjects", "ToolingProjects"),
  [string[]]$FallbackPaths = @()
)

Set-StrictMode -Version 1.0
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Write-Result {
  param([hashtable]$Payload)
  $Payload | ConvertTo-Json -Depth 30 -Compress
}

function Invoke-Cscript {
  param([string[]]$Arguments, [int]$TimeoutSeconds = 12)

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
  if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
    try { $process.Kill() } catch {}
    throw "SOLIDWORKS CAM-folder bridge timed out after $TimeoutSeconds seconds."
  }
  return @{
    stdout = $process.StandardOutput.ReadToEnd()
    stderr = $process.StandardError.ReadToEnd()
    exitCode = $process.ExitCode
  }
}

function Get-SolidWorksWindowTitleDocument {
  $processes = @(Get-Process -Name "SLDWORKS" -ErrorAction SilentlyContinue | Sort-Object StartTime -Descending)
  foreach ($process in $processes) {
    $title = [string]$process.MainWindowTitle
    if ([string]::IsNullOrWhiteSpace($title)) { continue }
    if ($title -match '(?i)([^\\/:*?"<>|\[\]\r\n]+?\.(?:SLDPRT|SLDASM|SLDDRW))') {
      return [ordered]@{
        title = $Matches[1]
        windowTitle = $title
        processId = [int]$process.Id
      }
    }
  }
  return $null
}

function Test-IgnoredSourcePath {
  param([string]$SourcePath)
  if ([string]::IsNullOrWhiteSpace($SourcePath)) { return $false }
  $lower = $SourcePath.ToLowerInvariant()
  return $lower.Contains("\appdata\local\solidcam temporary files\")
}

function Find-FirstProjectFallbackPath {
  param([string[]]$Paths)
  foreach ($raw in @($Paths)) {
    if ([string]::IsNullOrWhiteSpace($raw)) { continue }
    $candidate = [string]$raw
    if (Test-IgnoredSourcePath -SourcePath $candidate) { continue }
    if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) { continue }
    if (-not [string]::IsNullOrWhiteSpace((Get-ProjectNameFromPath -SourcePath $candidate))) {
      return $candidate
    }
  }
  return ""
}

function Find-FirstProjectPathByFileName {
  param([string]$FileName, [string[]]$Roots)
  if ([string]::IsNullOrWhiteSpace($FileName)) { return "" }

  $year = (Get-Date).Year
  $candidateRoots = New-Object System.Collections.Generic.List[string]
  foreach ($root in $Roots) {
    if ([string]::IsNullOrWhiteSpace($root)) { continue }
    $trimmed = $root.TrimEnd("\")
    foreach ($candidate in @(
      (Join-Path $trimmed ([string]$year)),
      (Join-Path $trimmed ([string]($year - 1))),
      $trimmed
    )) {
      if ((Test-Path -LiteralPath $candidate -PathType Container) -and -not $candidateRoots.Contains($candidate)) {
        $candidateRoots.Add($candidate)
      }
    }
  }

  foreach ($root in $candidateRoots) {
    try {
      $match = Get-ChildItem -LiteralPath $root -Recurse -File -Filter $FileName -ErrorAction SilentlyContinue |
        Select-Object -First 1
      if ($null -ne $match) { return [string]$match.FullName }
    } catch {
    }
  }
  return ""
}

function Get-ProjectNameFromPath {
  param([string]$SourcePath)
  if ([string]::IsNullOrWhiteSpace($SourcePath)) { return "" }
  $parts = [string[]]($SourcePath -split '[\\/]+')
  # The last segment is the document file name and is never a project candidate.
  $escapedPrefixes = @(
    $ProjectPrefixes |
      Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) } |
      ForEach-Object { [regex]::Escape(([string]$_).Trim()) } |
      Sort-Object { $_.Length } -Descending
  )
  if ($escapedPrefixes.Count -gt 0) {
    $pattern = '^(?:{0})-\d{{2}}-\d{{2,3}}([_\-\s].*)?$' -f ($escapedPrefixes -join '|')
    for ($i = 0; $i -lt ($parts.Count - 1); $i++) {
      if ($parts[$i] -match $pattern) { return $parts[$i] }
    }
  }

  # Prefixes are optional. When the source path sits below a configured project
  # root, the first child folder is the project name.
  foreach ($rootName in @($ProjectRootNames)) {
    if ([string]::IsNullOrWhiteSpace([string]$rootName)) { continue }
    for ($i = 0; $i -lt ($parts.Count - 2); $i++) {
      if ($parts[$i] -ieq ([string]$rootName).Trim()) { return $parts[$i + 1] }
    }
  }
  return ""
}

function Test-SourcePathOnDrive {
  param([string]$SourcePath, [string]$DriveLetter)
  if ([string]::IsNullOrWhiteSpace($SourcePath) -or [string]::IsNullOrWhiteSpace($DriveLetter)) { return $false }
  $root = [System.IO.Path]::GetPathRoot($SourcePath)
  return ($root -ieq (($DriveLetter.TrimEnd(":") + ":\")))
}

function Get-ImmediateParentFolderName {
  param([string]$SourcePath)
  if ([string]::IsNullOrWhiteSpace($SourcePath)) { return "" }
  $parent = [System.IO.Path]::GetDirectoryName($SourcePath)
  if ([string]::IsNullOrWhiteSpace($parent)) { return "" }
  return [System.IO.Path]::GetFileName($parent.TrimEnd("\", "/"))
}

function ConvertTo-AsciiFolderText {
  param([string]$Text)
  if ([string]::IsNullOrWhiteSpace($Text)) { return "" }
  $normalized = ([string]$Text).Normalize([System.Text.NormalizationForm]::FormD)
  $builder = New-Object System.Text.StringBuilder
  foreach ($ch in $normalized.ToCharArray()) {
    $category = [System.Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch)
    if ($category -eq [System.Globalization.UnicodeCategory]::NonSpacingMark) { continue }
    $code = [int][char]$ch
    if ($code -ge 32 -and $code -le 126) {
      [void]$builder.Append($ch)
    } else {
      [void]$builder.Append("_")
    }
  }
  return $builder.ToString()
}

function Get-CamPartFolderName {
  param([string]$SourcePath)
  $base = [System.IO.Path]::GetFileNameWithoutExtension($SourcePath)
  $base = ($base -replace '\s*\([^)]*\)\s*$', '').Trim()
  return Get-SafeFolderName -Name $base
}

function Get-SafeFolderName {
  param([string]$Name)
  $safe = ConvertTo-AsciiFolderText -Text ([string]$Name)
  foreach ($c in [System.IO.Path]::GetInvalidFileNameChars()) {
    $safe = $safe.Replace([string]$c, "_")
  }
  $safe = ($safe -replace '[^\x20-\x7E]', '_')
  $safe = ($safe -replace '\s+', ' ').Trim()
  $safe = $safe.TrimEnd(".")
  if ([string]::IsNullOrWhiteSpace($safe)) { return "_" }
  return $safe
}

function Get-ProjectRelativeFolders {
  param([string]$SourcePath, [string]$ProjectName)
  if ([string]::IsNullOrWhiteSpace($SourcePath) -or [string]::IsNullOrWhiteSpace($ProjectName)) { return @() }
  $parts = [string[]]($SourcePath -split '[\\/]+')
  $projectIndex = -1
  for ($i = 0; $i -lt $parts.Count; $i++) {
    if ($parts[$i] -ieq $ProjectName) {
      $projectIndex = $i
      break
    }
  }
  if ($projectIndex -lt 0) { return @() }

  $folders = New-Object System.Collections.Generic.List[string]
  for ($i = $projectIndex + 1; $i -lt ($parts.Count - 1); $i++) {
    $safe = Get-SafeFolderName -Name $parts[$i]
    if (-not [string]::IsNullOrWhiteSpace($safe)) { $folders.Add($safe) }
  }
  return $folders.ToArray()
}

$bridgeScript = @'
Option Explicit
On Error Resume Next

Dim outputPath
outputPath = WScript.Arguments(0)

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

Sub WriteUtf8(filePath, text)
  Dim stream, fsoLocal, file
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
  Set fsoLocal = CreateObject("Scripting.FileSystemObject")
  Set file = fsoLocal.CreateTextFile(filePath, True, False)
  file.Write text
  file.Close
End Sub

Function DocTypeLabel(docType)
  If CStr(docType) = "1" Then
    DocTypeLabel = "part"
  ElseIf CStr(docType) = "2" Then
    DocTypeLabel = "assembly"
  ElseIf CStr(docType) = "3" Then
    DocTypeLabel = "drawing"
  Else
    DocTypeLabel = ""
  End If
End Function

Dim sw, doc, selMgr, comp, i, count, title, docPath, docType, selectedPath, selectedName, connectedError
connectedError = ""
Err.Clear
Set sw = GetObject(, "SldWorks.Application")
If Err.Number <> 0 Or sw Is Nothing Then
  connectedError = CStr(Err.Number) & " " & Err.Description
  Err.Clear
End If

If sw Is Nothing Then
  WriteUtf8 outputPath, "{""ok"":false,""connected"":false,""error"":" & JsonString("Could not connect to SOLIDWORKS. " & connectedError) & "}"
  WScript.Quit 0
End If

Set doc = sw.ActiveDoc
If doc Is Nothing Then
  WriteUtf8 outputPath, "{""ok"":true,""connected"":true,""hasActiveDocument"":false,""activeDocument"":{""hasActiveDocument"":false}}"
  WScript.Quit 0
End If

title = ""
docPath = ""
docType = ""
selectedPath = ""
selectedName = ""

Err.Clear
title = CStr(doc.GetTitle())
If Err.Number <> 0 Then title = "" : Err.Clear
Err.Clear
docPath = CStr(doc.GetPathName())
If Err.Number <> 0 Then docPath = "" : Err.Clear
Err.Clear
docType = CStr(doc.GetType())
If Err.Number <> 0 Then docType = "" : Err.Clear

Err.Clear
Set selMgr = doc.SelectionManager
If Err.Number = 0 And Not selMgr Is Nothing Then
  Err.Clear
  count = CLng(selMgr.GetSelectedObjectCount2(-1))
  If Err.Number <> 0 Then count = 0 : Err.Clear
  For i = 1 To count
    Err.Clear
    Set comp = selMgr.GetSelectedObjectsComponent4(i, -1)
    If Err.Number <> 0 Then Set comp = Nothing : Err.Clear
    If Not comp Is Nothing Then
      Err.Clear
      selectedPath = CStr(comp.GetPathName())
      If Err.Number <> 0 Then selectedPath = "" : Err.Clear
      Err.Clear
      selectedName = CStr(comp.Name2)
      If Err.Number <> 0 Then selectedName = "" : Err.Clear
      If Len(selectedPath) > 0 Then Exit For
    End If
  Next
End If

WriteUtf8 outputPath, "{""ok"":true,""connected"":true,""hasActiveDocument"":true" & _
  ",""activeDocument"":{""hasActiveDocument"":true,""title"":" & JsonString(title) & ",""path"":" & JsonString(docPath) & ",""type"":" & JsonString(docType) & ",""typeLabel"":" & JsonString(DocTypeLabel(docType)) & "}" & _
  ",""selectedComponent"":{""name"":" & JsonString(selectedName) & ",""path"":" & JsonString(selectedPath) & "}}"
'@

try {
  $scriptPath = Join-Path ([System.IO.Path]::GetTempPath()) ("excelsis-create-cam-folder-{0}.vbs" -f ([System.Guid]::NewGuid().ToString("N")))
  $outputPath = Join-Path ([System.IO.Path]::GetTempPath()) ("excelsis-create-cam-folder-{0}.json" -f ([System.Guid]::NewGuid().ToString("N")))
  Set-Content -LiteralPath $scriptPath -Value $bridgeScript -Encoding ASCII

  try {
    $bridge = Invoke-Cscript @("//NoLogo", $scriptPath, $outputPath)
    if (-not (Test-Path -LiteralPath $outputPath -PathType Leaf)) {
      throw "SOLIDWORKS bridge did not produce JSON. stderr=$($bridge.stderr)"
    }
    $solidWorksInfo = Get-Content -LiteralPath $outputPath -Raw -Encoding UTF8 | ConvertFrom-Json
  } finally {
    Remove-Item -LiteralPath $scriptPath -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $outputPath -Force -ErrorAction SilentlyContinue
  }

  if (-not [bool]$solidWorksInfo.connected) {
    Write-Result @{ ok = $false; error = $solidWorksInfo.error; solidWorks = $solidWorksInfo }
    return
  }

  $candidatePath = ""
  $candidateSource = ""
  $ignoredTempPath = ""
  if ($solidWorksInfo.selectedComponent -and -not [string]::IsNullOrWhiteSpace([string]$solidWorksInfo.selectedComponent.path)) {
    $candidatePath = [string]$solidWorksInfo.selectedComponent.path
    $candidateSource = "selected-component"
  } elseif ($solidWorksInfo.activeDocument -and -not [string]::IsNullOrWhiteSpace([string]$solidWorksInfo.activeDocument.path)) {
    $candidatePath = [string]$solidWorksInfo.activeDocument.path
    $candidateSource = "active-document"
  }

  if (Test-IgnoredSourcePath -SourcePath $candidatePath) {
    $ignoredTempPath = $candidatePath
    $candidatePath = ""
    $candidateSource = ""
  }

  $windowDoc = $null
  if ([string]::IsNullOrWhiteSpace($candidatePath)) {
    $windowDoc = Get-SolidWorksWindowTitleDocument
    if ($windowDoc) {
      $candidateSource = "solidworks-window-title"
      $candidatePath = Find-FirstProjectPathByFileName -FileName $windowDoc.title -Roots $SearchRoots
    }
  }

  if ([string]::IsNullOrWhiteSpace($candidatePath) -or -not (Test-Path -LiteralPath $candidatePath -PathType Leaf)) {
    $title = ""
    if ($solidWorksInfo.activeDocument) { $title = [string]$solidWorksInfo.activeDocument.title }
    if (-not [string]::IsNullOrWhiteSpace($title)) {
      $fileName = if ($title -match '(?i)([^\\/:*?"<>|\[\]\r\n]+?\.(?:SLDPRT|SLDASM|SLDDRW))') { $Matches[1] } else { $title }
      $found = Find-FirstProjectPathByFileName -FileName $fileName -Roots $SearchRoots
      if (-not [string]::IsNullOrWhiteSpace($found)) {
        $candidatePath = $found
        $candidateSource = "configured-root-search"
      }
    }
  }

  if ([string]::IsNullOrWhiteSpace($candidatePath) -or -not (Test-Path -LiteralPath $candidatePath -PathType Leaf)) {
    $fallback = Find-FirstProjectFallbackPath -Paths $FallbackPaths
    if (-not [string]::IsNullOrWhiteSpace($fallback)) {
      $candidatePath = $fallback
      $candidateSource = "recent-solidworks-document"
    }
  }

  if ([string]::IsNullOrWhiteSpace($candidatePath)) {
    Write-Result @{
      ok = $false
      error = "Could not determine a saved SOLIDWORKS part/component path. Save the part or select a component from a saved assembly."
      solidWorks = $solidWorksInfo
      windowDocument = $windowDoc
      ignoredTempPath = $ignoredTempPath
    }
    return
  }

  $sourceIsLocalC = Test-SourcePathOnDrive -SourcePath $candidatePath -DriveLetter "C"
  $projectName = Get-ProjectNameFromPath -SourcePath $candidatePath
  $projectNameSource = "project-folder"
  if ([string]::IsNullOrWhiteSpace($projectName) -and $sourceIsLocalC) {
    $projectName = Get-ImmediateParentFolderName -SourcePath $candidatePath
    $projectNameSource = "source-parent-folder"
  }
  if ([string]::IsNullOrWhiteSpace($projectName)) {
    Write-Result @{
      ok = $false
      error = "Could not identify a project folder in the source path or configured CAM search locations. Configure project roots, or add project-code prefixes."
      sourcePath = $candidatePath
      source = $candidateSource
      solidWorks = $solidWorksInfo
      windowDocument = $windowDoc
      ignoredTempPath = $ignoredTempPath
    }
    return
  }

  $partFolderName = Get-CamPartFolderName -SourcePath $candidatePath
  if ([string]::IsNullOrWhiteSpace($partFolderName)) {
    Write-Result @{ ok = $false; error = "Could not derive a CAM part folder name."; sourcePath = $candidatePath }
    return
  }
  $camProjectFolderName = Get-SafeFolderName -Name $projectName

  $driveRoot = $OutputDrive
  if ($driveRoot.Length -eq 2 -and $driveRoot[1] -eq ':') { $driveRoot += "\" }
  if (-not (Test-Path -LiteralPath $driveRoot -PathType Container)) {
    Write-Result @{ ok = $false; error = "Output drive/folder does not exist: $driveRoot"; sourcePath = $candidatePath }
    return
  }

  $camProjectFolder = Join-Path $driveRoot $camProjectFolderName
  $camParentFolder = $camProjectFolder
  $relativeFolders = @()
  if ($FolderMode -eq "project-relative" -and -not $sourceIsLocalC) {
    $relativeFolders = @(Get-ProjectRelativeFolders -SourcePath $candidatePath -ProjectName $projectName)
    foreach ($folderPart in $relativeFolders) {
      $camParentFolder = Join-Path $camParentFolder $folderPart
    }
  }
  $camPartFolder = Join-Path $camParentFolder $partFolderName
  $projectExisted = Test-Path -LiteralPath $camProjectFolder -PathType Container
  $partExisted = Test-Path -LiteralPath $camPartFolder -PathType Container

  New-Item -ItemType Directory -Force -Path $camPartFolder | Out-Null

  Write-Result @{
    ok = $true
    source = $candidateSource
    sourcePath = $candidatePath
    projectName = $projectName
    projectNameSource = $projectNameSource
    camProjectFolderName = $camProjectFolderName
    partFolderName = $partFolderName
    folderMode = $FolderMode
    relativeFolders = $relativeFolders
    camProjectFolder = $camProjectFolder
    camParentFolder = $camParentFolder
    camPartFolder = $camPartFolder
    createdProjectFolder = -not $projectExisted
    createdPartFolder = -not $partExisted
    solidWorks = $solidWorksInfo
    windowDocument = $windowDoc
    ignoredTempPath = $ignoredTempPath
  }
} catch {
  Write-Result @{ ok = $false; error = $_.Exception.Message }
}
