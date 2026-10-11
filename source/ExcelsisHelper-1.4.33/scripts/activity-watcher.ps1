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
using System.Diagnostics;
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
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool IsChild(IntPtr parent, IntPtr child);
  [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint message, IntPtr wParam, IntPtr lParam,
    uint flags, uint timeout, out UIntPtr result);
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

  const int CamProbeBudgetMs = 150;
  const uint TabMessageTimeoutMs = 35;
  static IntPtr cachedForeground, cachedView, cachedTab;
  static uint cachedProcessId;

  static string WindowClass(IntPtr node) {
    var value = new StringBuilder(128);
    GetClassName(node, value, value.Capacity);
    return value.ToString();
  }

  static string WindowTitle(IntPtr node) {
    var value = new StringBuilder(128);
    GetWindowText(node, value, value.Capacity);
    return value.ToString();
  }

  static bool TabValue(IntPtr tab, uint message, Stopwatch clock, out long value) {
    value = -1;
    int remaining = CamProbeBudgetMs - (int)clock.ElapsedMilliseconds;
    if (remaining <= 0) return false;
    UIntPtr result;
    // ABORTIFHUNG | ERRORONEXIT; never use NOTIMEOUTIFNOTHUNG.
    if (SendMessageTimeout(tab, message, IntPtr.Zero, IntPtr.Zero, 0x02 | 0x20,
      Math.Min(TabMessageTimeoutMs, (uint)remaining), out result) == IntPtr.Zero) return false;
    value = unchecked((long)result.ToUInt64());
    return true;
  }

  static bool ReadCamTab(IntPtr tab, Stopwatch clock, out bool active) {
    active = false;
    long selected, count;
    if (!TabValue(tab, 0x130B, clock, out selected) || !TabValue(tab, 0x1304, clock, out count)) return false;
    active = selected == 5 && count == 6;
    return true;
  }

  static bool ValidCachedTab(IntPtr foreground, uint processId) {
    uint viewProcessId, tabProcessId;
    return cachedForeground == foreground && cachedProcessId == processId
      && IsWindow(cachedView) && IsWindow(cachedTab) && IsWindowVisible(cachedView)
      && IsChild(foreground, cachedView) && IsChild(cachedTab, cachedView)
      && GetWindowThreadProcessId(cachedView, out viewProcessId) != 0 && viewProcessId == processId
      && GetWindowThreadProcessId(cachedTab, out tabProcessId) != 0 && tabProcessId == processId
      && WindowTitle(cachedView) == "uiFeatureMgrActiveXView_c" && WindowClass(cachedTab) == "SysTabControl32";
  }

  static void CacheTab(IntPtr foreground, uint processId, IntPtr view, IntPtr tab) {
    cachedForeground = foreground; cachedProcessId = processId; cachedView = view; cachedTab = tab;
  }

  static bool IsSolidCamTreeFocused(IntPtr foreground, uint processId, Stopwatch clock) {
    uint foregroundProcessId;
    uint threadId = GetWindowThreadProcessId(foreground, out foregroundProcessId);
    var info = new GUITHREADINFO();
    info.cbSize = Marshal.SizeOf(typeof(GUITHREADINFO));
    if (threadId == 0 || !GetGUIThreadInfo(threadId, ref info)) return false;
    IntPtr activeView = IntPtr.Zero;
    int depth = 0;
    for (IntPtr node = info.hwndFocus; node != IntPtr.Zero && depth++ < 64
      && clock.ElapsedMilliseconds < CamProbeBudgetMs; node = GetParent(node)) {
      if (WindowTitle(node) == "uiFeatureMgrActiveXView_c") activeView = node;
      if (activeView != IntPtr.Zero && WindowClass(node) == "SysTabControl32") {
        bool active;
        if (!ReadCamTab(node, clock, out active)) return false;
        if (active) CacheTab(foreground, processId, activeView, node);
        return active;
      }
    }
    return false;
  }

  public static bool IsSolidCamTabActive(IntPtr foreground) {
    var clock = Stopwatch.StartNew();
    uint processId;
    if (foreground == IntPtr.Zero || GetWindowThreadProcessId(foreground, out processId) == 0) return false;
    if (ValidCachedTab(foreground, processId)) {
      bool cachedActive;
      return ReadCamTab(cachedTab, clock, out cachedActive) && cachedActive;
    }
    cachedView = cachedTab = cachedForeground = IntPtr.Zero;
    if (IsSolidCamTreeFocused(foreground, processId, clock)) return true;
    if (clock.ElapsedMilliseconds >= CamProbeBudgetMs) return false;
    bool active = false;
    EnumChildWindows(foreground, (node, ignored) => {
      if (clock.ElapsedMilliseconds >= CamProbeBudgetMs) return false;
      if (!IsWindowVisible(node) || WindowTitle(node) != "uiFeatureMgrActiveXView_c") return true;
      int depth = 0;
      for (IntPtr parent = GetParent(node); parent != IntPtr.Zero && depth++ < 64
        && clock.ElapsedMilliseconds < CamProbeBudgetMs; parent = GetParent(parent)) {
        if (WindowClass(parent) != "SysTabControl32") continue;
        if (!ReadCamTab(parent, clock, out active)) return false;
        if (active) { CacheTab(foreground, processId, node, parent); return false; }
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
      # LASTINPUTINFO uses a 32-bit tick, even when Windows uptime exceeds 49 days.
      $idleMs = [int64](([ExcelsisAct]::GetTickCount64() - [uint64]$lii.dwTime) -band [uint64]4294967295)
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
