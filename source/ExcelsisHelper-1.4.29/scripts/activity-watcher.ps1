# activity-watcher.ps1 (0.8.5, item A)
# Long-lived companion to solidworks-watcher.vbs. Reports the Windows foreground
# app + input idle time to a file on a self-paced loop, so the main process can
# decide "is the user actively in SOLIDWORKS right now" spawn-free and fast
# (every ~2s) instead of waiting on a COM status bridge. Mirrors the
# Get-WindowsActivitySnapshot fields in solidworks-bridge.ps1 so the existing
# isSolidWorksForegroundActivity / shouldCountSolidWorksActivity logic works
# unchanged. The Win32 type is compiled ONCE (persistent process) — no per-tick
# Add-Type recompile.
param([string]$OutPath, [int]$IntervalMs = 2000)

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
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassName(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern IntPtr GetParent(IntPtr hWnd);
  public delegate bool EnumWindowProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr parent, EnumWindowProc callback, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr hWnd, uint message, IntPtr wParam, IntPtr lParam);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int left, top, right, bottom; }
  [StructLayout(LayoutKind.Sequential)] public struct GUITHREADINFO {
    public int cbSize, flags;
    public IntPtr hwndActive, hwndFocus, hwndCapture, hwndMenuOwner, hwndMoveSize, hwndCaret;
    public RECT rcCaret;
  }
  [DllImport("user32.dll")] public static extern bool GetGUIThreadInfo(uint threadId, ref GUITHREADINFO info);
  [StructLayout(LayoutKind.Sequential)] public struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
  [DllImport("user32.dll")] public static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);
  [DllImport("kernel32.dll")] public static extern ulong GetTickCount64();

  public static bool IsSolidCamTreeFocused(IntPtr foreground) {
    uint processId;
    uint threadId = GetWindowThreadProcessId(foreground, out processId);
    var info = new GUITHREADINFO();
    info.cbSize = Marshal.SizeOf(typeof(GUITHREADINFO));
    if (threadId == 0 || !GetGUIThreadInfo(threadId, ref info)) return false;
    bool inActiveXView = false;
    for (IntPtr node = info.hwndFocus; node != IntPtr.Zero; node = GetParent(node)) {
      var className = new StringBuilder(128);
      var title = new StringBuilder(128);
      GetClassName(node, className, className.Capacity);
      GetWindowText(node, title, title.Capacity);
      if (title.ToString() == "uiFeatureMgrActiveXView_c") inActiveXView = true;
      if (inActiveXView && className.ToString() == "SysTabControl32") {
        long selected = SendMessage(node, 0x130B, IntPtr.Zero, IntPtr.Zero).ToInt64();
        long count = SendMessage(node, 0x1304, IntPtr.Zero, IntPtr.Zero).ToInt64();
        return selected == 5 && count == 6;
      }
    }
    return false;
  }

  public static bool IsSolidCamTabActive(IntPtr foreground) {
    if (IsSolidCamTreeFocused(foreground)) return true;
    bool active = false;
    EnumChildWindows(foreground, (node, ignored) => {
      var title = new StringBuilder(128);
      GetWindowText(node, title, title.Capacity);
      if (title.ToString() != "uiFeatureMgrActiveXView_c" || !IsWindowVisible(node)) return true;
      for (IntPtr parent = GetParent(node); parent != IntPtr.Zero; parent = GetParent(parent)) {
        var className = new StringBuilder(128);
        GetClassName(parent, className, className.Capacity);
        if (className.ToString() != "SysTabControl32") continue;
        long selected = SendMessage(parent, 0x130B, IntPtr.Zero, IntPtr.Zero).ToInt64();
        long count = SendMessage(parent, 0x1304, IntPtr.Zero, IntPtr.Zero).ToInt64();
        if (selected == 5 && count == 6) { active = true; return false; }
        break;
      }
      return true;
    }, IntPtr.Zero);
    return active;
  }
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
    $camTreeActive = $pname -eq 'SLDWORKS' -and [ExcelsisAct]::IsSolidCamTabActive($hwnd)

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
      camTreeActive = [bool]$camTreeActive
      idleMs = $idleMs
    }
    [System.IO.File]::WriteAllText($OutPath, ($obj | ConvertTo-Json -Compress), $enc)
  } catch {}
  Start-Sleep -Milliseconds $IntervalMs
}
