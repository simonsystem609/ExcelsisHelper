# Excelsis-Default-Version: 1.3.2
# Converts .swb macros to .swp by driving SOLIDWORKS' Edit Macro dialog
# in batch. PROVEN flow (sandbox-verified on SW 2025 / Win 11):
#
#   For each .swb file:
#     1. Set-Clipboard the swb path
#     2. Background cscript fires sw.RunCommand(swCommands_EditMacro=84)
#     3. Wait for the "Open" dialog via UIA (max 5s)
#     4. Win32 SetForegroundWindow on the dialog's HWND (with the
#        AttachThreadInput trick so Windows doesn't ignore us)
#     5. Re-set the clipboard (defensive)
#     6. SendKeys Ctrl+V then ENTER
#     7. Poll for the .swp file to appear (up to PerMacroTimeoutSeconds)
#
# Critical: we do NOT close the VBA editor or any "convert?" popup
# between iterations. The first conversion takes ~25s (VBA IDE spin-up)
# but every subsequent conversion takes ~2s because the IDE is already
# loaded. After all files are done, the VBA editor stays open with
# every converted macro as a module; the user closes it manually.
#
# Earlier attempts that did NOT work:
#   - sw.EditMacro(path) -> method not supported on SW 2025
#   - SendInput before SetForegroundWindow -> focus drifted, keys went nowhere
#   - AppActivate(SLDWORKS pid) -> stole focus from the dialog to SW's
#     main window
#   - ShellExecute on .swb -> .swb has no file association
#   - Per-iteration VBA editor close -> unnecessary; SW handles it fine

param(
  [Parameter(Mandatory = $true)][string]$MacroRoot,
  [int]$DialogAppearTimeoutMs = 5000,
  [int]$PerMacroTimeoutSeconds = 60
)

Set-StrictMode -Version 1.0
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -AssemblyName UIAutomationClient -ErrorAction Stop
Add-Type -AssemblyName UIAutomationTypes -ErrorAction Stop
Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop

# Win32 imports for the foreground-steal dance. SetForegroundWindow
# alone is blocked by Windows' focus-stealing prevention unless we
# briefly attach our thread input to the foreground thread.
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class ExcelsisW32 {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a, uint b, bool f);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
}
'@

function Write-Result {
  param([hashtable]$Payload)
  $Payload | ConvertTo-Json -Depth 30 -Compress
}

function Wait-ForDialog {
  param([int]$TimeoutMs)
  $deadline = (Get-Date).AddMilliseconds($TimeoutMs)
  while ((Get-Date) -lt $deadline) {
    $root = [System.Windows.Automation.AutomationElement]::RootElement
    $cond = New-Object System.Windows.Automation.PropertyCondition(
      [System.Windows.Automation.AutomationElement]::NameProperty, "Open")
    $d = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond)
    if ($null -ne $d) {
      try { $h = $d.Current.NativeWindowHandle } catch { $h = 0 }
      if ($h -ne 0) { return @{ element = $d; hwnd = [IntPtr]$h } }
    }
    Start-Sleep -Milliseconds 200
  }
  return $null
}

function Force-Foreground {
  param([IntPtr]$Hwnd)
  $tid = [ExcelsisW32]::GetCurrentThreadId()
  $pidOut = [uint32]0
  $dtid = [ExcelsisW32]::GetWindowThreadProcessId($Hwnd, [ref]$pidOut)
  [void][ExcelsisW32]::AttachThreadInput($tid, $dtid, $true)
  [void][ExcelsisW32]::BringWindowToTop($Hwnd)
  $ok = [ExcelsisW32]::SetForegroundWindow($Hwnd)
  [void][ExcelsisW32]::AttachThreadInput($tid, $dtid, $false)
  return [bool]$ok
}

function Convert-OneSwbToSwp {
  param([string]$SwbPath)

  $swpPath = [System.IO.Path]::ChangeExtension($SwbPath, ".swp")
  $result = [ordered]@{
    swb = $SwbPath
    swp = $swpPath
    ok = $false
    error = ""
    elapsedSeconds = 0
  }
  $startedAt = Get-Date

  # If a stale .swp exists and the VBA editor is holding it open, the
  # delete will fail. Don't fail hard - SOLIDWORKS will overwrite when
  # it writes the new .swp (it loads the .swb as a fresh project).
  if (Test-Path -LiteralPath $swpPath) {
    try { Remove-Item -LiteralPath $swpPath -Force -ErrorAction Stop } catch {}
  }

  Set-Clipboard -Value $SwbPath

  # Fire RunCommand in background. cscript blocks until RunCommand
  # returns (which is when the dialog dismisses), so we MUST run it
  # async or we'd deadlock waiting for ourselves to dismiss it.
  $vbs = @'
Option Explicit
On Error Resume Next
Dim sw
Set sw = GetObject(, "SldWorks.Application")
If sw Is Nothing Then WScript.Quit 2
sw.RunCommand 84, "Edit Macro"
'@
  $tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("excelsis-rcmd-{0}.vbs" -f ([Guid]::NewGuid().ToString("N")))
  Set-Content -LiteralPath $tmp -Value $vbs -Encoding ASCII
  $rcmd = Start-Process cscript.exe -ArgumentList @('//NoLogo', $tmp) -WindowStyle Hidden -PassThru

  $dialog = Wait-ForDialog -TimeoutMs $DialogAppearTimeoutMs
  if ($null -eq $dialog) {
    $result.error = "Edit Macro dialog never appeared (RunCommand may have failed silently)."
    try { $rcmd.Kill() } catch {}
    Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
    $result.elapsedSeconds = [math]::Round(((Get-Date) - $startedAt).TotalSeconds, 2)
    return $result
  }

  [void](Force-Foreground -Hwnd $dialog.hwnd)
  Start-Sleep -Milliseconds 300

  # Defensive: re-set clipboard now that focus is settled. Window
  # transitions can occasionally clear it.
  Set-Clipboard -Value $SwbPath

  # Paste and Enter. The dialog's focus is on the file-filter combo
  # (AutomationId 1148) when it opens; pasting a full path into that
  # control, then pressing Enter, causes Windows to treat the path as
  # the file to open. Confirmed working on Win 11 + SW 2025.
  [System.Windows.Forms.SendKeys]::SendWait("^v")
  Start-Sleep -Milliseconds 400
  [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")

  # Poll for .swp creation. First file takes ~25s (VBA IDE spin-up);
  # subsequent files are fast (~2s).
  $deadline = (Get-Date).AddSeconds($PerMacroTimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if ((Test-Path -LiteralPath $swpPath -PathType Leaf)) {
      $item = Get-Item -LiteralPath $swpPath -ErrorAction SilentlyContinue
      if ($null -ne $item -and $item.Length -gt 0) {
        $result.ok = $true
        break
      }
    }
    Start-Sleep -Milliseconds 250
  }

  if (-not $result.ok) {
    $result.error = "Timed out waiting for SOLIDWORKS to write .swp (waited $PerMacroTimeoutSeconds s)."
    # Dismiss any stuck dialog so the next iteration starts fresh.
    [System.Windows.Forms.SendKeys]::SendWait("{ESC}")
  }

  # Don't wait for cscript to exit cleanly - if a popup is up that we
  # didn't expect, cscript stays blocked on RunCommand. That's fine;
  # we move on. cscript exits when the dialog/popup dismisses.
  if (-not $rcmd.WaitForExit(1500)) {
    # Leave cscript running - SOLIDWORKS will return from RunCommand
    # eventually. Don't kill it because that could leave SW in a weird
    # state.
  }
  Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
  $result.elapsedSeconds = [math]::Round(((Get-Date) - $startedAt).TotalSeconds, 2)
  return $result
}

try {
  $root = [System.IO.Path]::GetFullPath($MacroRoot)
  if (-not (Test-Path -LiteralPath $root -PathType Container)) {
    throw "Macro folder not found: $root"
  }

  $swbFiles = @(Get-ChildItem -LiteralPath $root -Recurse -File -Filter "*.swb" -ErrorAction Stop |
    Sort-Object FullName)

  if ($swbFiles.Count -eq 0) {
    Write-Result @{
      ok = $true
      macroRoot = $root
      swbCount = 0
      converted = @()
      failed = @()
      message = "No .swb macros found to convert."
    }
    return
  }

  $converted = New-Object System.Collections.Generic.List[object]
  $failed = New-Object System.Collections.Generic.List[object]

  foreach ($swb in $swbFiles) {
    $r = Convert-OneSwbToSwp -SwbPath $swb.FullName
    if ($r.ok) {
      $converted.Add($r)
    } else {
      $failed.Add($r)
    }
  }

  Write-Result @{
    ok = ($failed.Count -eq 0)
    macroRoot = $root
    swbCount = $swbFiles.Count
    converted = $converted.ToArray()
    failed = $failed.ToArray()
    message = if ($failed.Count -eq 0) {
      "Converted $($converted.Count) .swb files. The VBA editor stays open with the loaded modules; close it when you're done."
    } else {
      "$($converted.Count) succeeded, $($failed.Count) failed. See failed[].error for details."
    }
  }
} catch {
  Write-Result @{
    ok = $false
    macroRoot = $MacroRoot
    error = $_.Exception.Message
  }
}
