# activity-watcher.ps1 (0.8.5, item A)
# Long-lived companion to solidworks-watcher.vbs. Reports the Windows foreground
# app + input idle time to a file on a self-paced loop, so the main process can
# decide "is the user actively in SOLIDWORKS right now" spawn-free and fast
# (every ~1.5s) instead of waiting on the slow full-bridge refresh. Mirrors the
# Get-WindowsActivitySnapshot fields in solidworks-bridge.ps1 so the existing
# isSolidWorksForegroundActivity / shouldCountSolidWorksActivity logic works
# unchanged. The Win32 type is compiled ONCE (persistent process) — no per-tick
# Add-Type recompile.
param([string]$OutPath, [int]$IntervalMs = 1500)

$ErrorActionPreference = 'SilentlyContinue'
if (-not $OutPath) { exit 1 }
if ($IntervalMs -lt 250) { $IntervalMs = 250 }

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class ExcelsisAct {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [StructLayout(LayoutKind.Sequential)] public struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
  [DllImport("user32.dll")] public static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);
  [DllImport("kernel32.dll")] public static extern ulong GetTickCount64();
}
"@

# UTF-8 WITHOUT BOM — Node's JSON.parse rejects a leading BOM.
$enc = New-Object System.Text.UTF8Encoding($false)

while ($true) {
  try {
    $hwnd = [ExcelsisAct]::GetForegroundWindow()
    [uint32]$fpid = 0
    if ($hwnd -ne [IntPtr]::Zero) { [void][ExcelsisAct]::GetWindowThreadProcessId($hwnd, [ref]$fpid) }

    $sb = New-Object System.Text.StringBuilder 512
    if ($hwnd -ne [IntPtr]::Zero) { [void][ExcelsisAct]::GetWindowText($hwnd, $sb, $sb.Capacity) }

    $pname = ""
    $ppath = ""
    if ($fpid -gt 0) {
      $proc = Get-Process -Id ([int]$fpid) -ErrorAction SilentlyContinue
      if ($proc) { $pname = [string]$proc.ProcessName; try { $ppath = [string]$proc.Path } catch {} }
    }

    $lii = New-Object ExcelsisAct+LASTINPUTINFO
    $lii.cbSize = [System.Runtime.InteropServices.Marshal]::SizeOf($lii)
    $idleMs = $null
    if ([ExcelsisAct]::GetLastInputInfo([ref]$lii)) {
      $idleMs = [int64]([ExcelsisAct]::GetTickCount64() - [uint64]$lii.dwTime)
    }

    $obj = [ordered]@{
      ok = $true
      sampledAt = (Get-Date).ToString("o")
      foregroundPid = [int]$fpid
      foregroundProcessName = $pname
      foregroundProcessPath = $ppath
      foregroundTitle = $sb.ToString()
      idleMs = $idleMs
    }
    [System.IO.File]::WriteAllText($OutPath, ($obj | ConvertTo-Json -Compress), $enc)
  } catch {}
  Start-Sleep -Milliseconds $IntervalMs
}
