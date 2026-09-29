param(
  [Parameter(Mandatory = $true)][ValidateSet("load","unload")][string]$Action,
  [Parameter(Mandatory = $true)][string]$DllPath,
  [string]$Clsid = ""
)

# Loads or unloads a SOLIDWORKS add-in by DLL path through a cscript/VBScript
# bridge, providing robust late-bound access to a running SOLIDWORKS session.

Set-StrictMode -Version 1.0
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Write-Result {
  param([hashtable]$Payload)
  $Payload | ConvertTo-Json -Depth 8 -Compress
}

function Normalize-ClsidText {
  param([string]$Value)
  $clean = ([string]$Value).Trim()
  if (-not $clean) { return "" }
  $clean = $clean.Trim("{", "}")
  if (-not ($clean -match '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')) {
    return ""
  }
  return "{$($clean.ToLowerInvariant())}"
}

function Set-AddInStartupOff {
  param([string]$AddInClsid)
  $normalized = Normalize-ClsidText $AddInClsid
  if (-not $normalized) {
    return [ordered]@{
      attempted = $false
      ok = $false
      clsid = $AddInClsid
      error = "No valid CLSID supplied."
    }
  }

  $subKey = "Software\SolidWorks\AddInsStartup\$normalized"
  try {
    $key = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey($subKey)
    if ($null -eq $key) { throw "CreateSubKey returned null." }
    try {
      $key.SetValue("", 0, [Microsoft.Win32.RegistryValueKind]::DWord)
      $value = $key.GetValue("", $null)
    } finally {
      $key.Close()
    }
    return [ordered]@{
      attempted = $true
      ok = $true
      clsid = $normalized
      registryPath = "HKCU:\$subKey"
      value = $value
    }
  } catch {
    return [ordered]@{
      attempted = $true
      ok = $false
      clsid = $normalized
      registryPath = "HKCU:\$subKey"
      error = $_.Exception.Message
    }
  }
}

$startupBefore = Set-AddInStartupOff $Clsid

if (-not (Test-Path -LiteralPath $DllPath -PathType Leaf)) {
  Write-Result @{
    ok = $false
    action = $Action
    dllPath = $DllPath
    clsid = $Clsid
    startupBefore = $startupBefore
    error = "Add-in DLL not found at the specified path."
  }
  return
}

# ISldWorks::LoadAddIn returns swLoadAddInError_e (Long):
#   0 = swLoadAddIn_Success
#   1 = swLoadAddIn_FailHResult
#   2 = swLoadAddIn_FailIDispatch
#   3 = swLoadAddIn_FailInConnect
# UnloadAddIn returns 0 on success or an error code otherwise.

$vbs = @'
Option Explicit
On Error Resume Next
Dim sw, dll, action, rc
action = WScript.Arguments(0)
dll = WScript.Arguments(1)
Set sw = GetObject(, "SldWorks.Application")
If sw Is Nothing Or Err.Number <> 0 Then
  WScript.StdErr.WriteLine "bind-failed:" & Err.Description
  WScript.Quit 2
End If
sw.Visible = True
Err.Clear
If action = "load" Then
  rc = sw.LoadAddIn(dll)
ElseIf action = "unload" Then
  rc = sw.UnloadAddIn(dll)
Else
  WScript.StdErr.WriteLine "bad-action:" & action
  WScript.Quit 3
End If
If Err.Number <> 0 Then
  WScript.StdErr.WriteLine "call-raised:" & Err.Description
  WScript.Quit 4
End If
WScript.StdOut.WriteLine CStr(rc)
WScript.Quit 0
'@

$vbsPath = Join-Path ([System.IO.Path]::GetTempPath()) ("excelsis-swaddin-{0}.vbs" -f ([Guid]::NewGuid().ToString("N")))
Set-Content -LiteralPath $vbsPath -Value $vbs -Encoding ASCII

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "cscript.exe"
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.Arguments = '//NoLogo "' + $vbsPath + '" "' + $Action + '" "' + ($DllPath -replace '"','""') + '"'

$proc = [System.Diagnostics.Process]::Start($psi)
$timeoutMs = if ($Action -eq "load") { 120000 } else { 30000 }
if (-not $proc.WaitForExit($timeoutMs)) {
  try { $proc.Kill() } catch {}
  Remove-Item -LiteralPath $vbsPath -Force -ErrorAction SilentlyContinue
  $startupAfter = Set-AddInStartupOff $Clsid
  Write-Result @{
    ok = $false
    action = $Action
    dllPath = $DllPath
    clsid = $Clsid
    startupBefore = $startupBefore
    startupAfter = $startupAfter
    error = "cscript timed out after $([int]($timeoutMs / 1000))s (SOLIDWORKS may be busy or unresponsive)."
  }
  return
}

$stdout = $proc.StandardOutput.ReadToEnd().Trim()
$stderr = $proc.StandardError.ReadToEnd().Trim()
$exitCode = $proc.ExitCode
Remove-Item -LiteralPath $vbsPath -Force -ErrorAction SilentlyContinue

if ($exitCode -ne 0) {
  $startupAfter = Set-AddInStartupOff $Clsid
  Write-Result @{
    ok = $false
    action = $Action
    dllPath = $DllPath
    clsid = $Clsid
    startupBefore = $startupBefore
    startupAfter = $startupAfter
    exitCode = $exitCode
    stderr = $stderr
    error = if ($stderr) { $stderr } else { "cscript exited with code $exitCode" }
  }
  return
}

# Parse the return code from sw.LoadAddIn / UnloadAddIn.
$rc = $null
try { $rc = [int]$stdout } catch {}

# For LoadAddIn, 0 means success. For UnloadAddIn the docs are vague -
# treat 0 as a perfect unload and non-zero as a soft unload warning.
$loadOk = ($rc -eq 0)
$startupAfter = Set-AddInStartupOff $Clsid
$reportedError = ""
if ($Action -eq "load" -and -not $loadOk) {
  $reportedError = "SOLIDWORKS LoadAddIn returned code $rc."
}
Write-Result @{
  ok = if ($Action -eq "load") { $loadOk } else { $true }
  action = $Action
  dllPath = $DllPath
  clsid = $Clsid
  returnCode = $rc
  perfectSuccess = $loadOk
  startupBefore = $startupBefore
  startupAfter = $startupAfter
  stdout = $stdout
  stderr = $stderr
  error = $reportedError
}
