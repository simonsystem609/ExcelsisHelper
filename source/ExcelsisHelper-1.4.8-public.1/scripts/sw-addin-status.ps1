param(
  [string]$DllPath = "",
  [string]$Clsid = "",
  [string]$Title = ""
)

Set-StrictMode -Version 1.0
$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Write-Result {
  param([hashtable]$Payload)
  $Payload | ConvertTo-Json -Depth 8 -Compress
}

function Normalize-PathText {
  param([string]$Value)
  if ([string]::IsNullOrWhiteSpace($Value)) { return "" }
  try { return ([System.IO.Path]::GetFullPath($Value)).TrimEnd('\').ToLowerInvariant() } catch { return $Value.Trim().TrimEnd('\').ToLowerInvariant() }
}

$targetDll = Normalize-PathText $DllPath
$moduleLoaded = $null
$moduleError = ""
$swProcessCount = 0

if ($targetDll) {
  try {
    $swProcesses = @(Get-Process -Name "SLDWORKS" -ErrorAction SilentlyContinue)
    $swProcessCount = $swProcesses.Count
    if ($swProcesses.Count -eq 0) {
      $moduleLoaded = $false
    } else {
      $moduleLoaded = $false
      foreach ($proc in $swProcesses) {
        try {
          foreach ($module in @($proc.Modules)) {
            if ((Normalize-PathText $module.FileName) -eq $targetDll) {
              $moduleLoaded = $true
              break
            }
          }
        } catch {
          $moduleError = $_.Exception.Message
        }
        if ($moduleLoaded) { break }
      }
    }
  } catch {
    $moduleError = $_.Exception.Message
  }
}

$comConnected = $false
$objectLoaded = $null
$comError = ""

if (-not [string]::IsNullOrWhiteSpace($Clsid)) {
  $vbs = @'
Option Explicit
On Error Resume Next
Dim sw, clsid, obj
clsid = WScript.Arguments(0)
Set sw = GetObject(, "SldWorks.Application")
If sw Is Nothing Or Err.Number <> 0 Then
  WScript.StdOut.WriteLine "connected=false"
  WScript.StdOut.WriteLine "error=" & Err.Description
  WScript.Quit 0
End If
WScript.StdOut.WriteLine "connected=true"
Err.Clear
Set obj = sw.GetAddInObject(clsid)
If Err.Number <> 0 Then
  WScript.StdOut.WriteLine "loaded=unknown"
  WScript.StdOut.WriteLine "error=" & Err.Description
ElseIf obj Is Nothing Then
  WScript.StdOut.WriteLine "loaded=false"
Else
  WScript.StdOut.WriteLine "loaded=true"
End If
'@

  $vbsPath = Join-Path ([System.IO.Path]::GetTempPath()) ("excelsis-swaddin-status-{0}.vbs" -f ([Guid]::NewGuid().ToString("N")))
  Set-Content -LiteralPath $vbsPath -Value $vbs -Encoding ASCII
  try {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "cscript.exe"
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.Arguments = '//NoLogo "' + $vbsPath + '" "' + ($Clsid -replace '"','""') + '"'

    $proc = [System.Diagnostics.Process]::Start($psi)
    if (-not $proc.WaitForExit(15000)) {
      try { $proc.Kill() } catch {}
      $comError = "cscript timed out after 15s"
    } else {
      $stdout = $proc.StandardOutput.ReadToEnd()
      $stderr = $proc.StandardError.ReadToEnd().Trim()
      if ($stderr) { $comError = $stderr }
      foreach ($line in ($stdout -split "`r?`n")) {
        if ($line -eq "connected=true") { $comConnected = $true }
        elseif ($line -eq "connected=false") { $comConnected = $false }
        elseif ($line -eq "loaded=true") { $objectLoaded = $true }
        elseif ($line -eq "loaded=false") { $objectLoaded = $false }
        elseif ($line -eq "loaded=unknown") { $objectLoaded = $null }
        elseif ($line.StartsWith("error=") -and -not $comError) { $comError = $line.Substring(6) }
      }
    }
  } catch {
    $comError = $_.Exception.Message
  } finally {
    Remove-Item -LiteralPath $vbsPath -Force -ErrorAction SilentlyContinue
  }
}

$loaded = $null
if (-not [string]::IsNullOrWhiteSpace($Clsid) -and $null -ne $objectLoaded) {
  # SOLIDWORKS can keep an unloaded add-in DLL mapped in-process, so the
  # COM add-in object is the stronger signal when a CLSID is configured.
  $loaded = [bool]$objectLoaded
} elseif ($moduleLoaded -eq $true -or $objectLoaded -eq $true) {
  $loaded = $true
} elseif ($moduleLoaded -eq $false -or $objectLoaded -eq $false) {
  $loaded = $false
}

Write-Result @{
  ok = $true
  connected = $comConnected -or ($swProcessCount -gt 0)
  loaded = $loaded
  swProcessCount = $swProcessCount
  moduleLoaded = $moduleLoaded
  objectLoaded = $objectLoaded
  dllPath = $DllPath
  clsid = $Clsid
  title = $Title
  moduleError = $moduleError
  comError = $comError
}
