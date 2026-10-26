# set-ecoqos.ps1 — tag a process with Windows EcoQoS (PROCESS_POWER_THROTTLING
# EXECUTION_SPEED). This asks the scheduler to treat the process as "efficiency"
# work, which on hybrid Intel CPUs (P/E cores) biases it onto the E-cores.
# Used by Excelsis Helper to keep its own process tree and helper workers off
# the performance cores. Best-effort: silently no-ops on pre-2004 Windows.
param(
  [int]$TargetPid,
  [string]$TargetPids = '',
  [int]$OwnerPid = 0,
  [switch]$IncludeChildren,
  [switch]$Verify
)

$ErrorActionPreference = 'SilentlyContinue'
$rootIds = @()
if ($TargetPid -gt 0) { $rootIds += $TargetPid }
foreach ($text in ($TargetPids -split ',')) {
  $processId = 0
  if ([int]::TryParse($text, [ref]$processId) -and $processId -gt 0) { $rootIds += $processId }
}
if (-not $rootIds.Count) { return }

$code = @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class EcoQoS {
  [StructLayout(LayoutKind.Sequential)]
  struct PROCESS_POWER_THROTTLING_STATE {
    public uint Version;
    public uint ControlMask;
    public uint StateMask;
  }
  [DllImport("kernel32.dll", SetLastError = true)]
  static extern bool SetProcessInformation(IntPtr hProcess, int ProcessInformationClass,
    ref PROCESS_POWER_THROTTLING_STATE ProcessInformation, uint ProcessInformationSize);
  [DllImport("kernel32.dll", SetLastError = true)]
  static extern bool GetProcessInformation(IntPtr hProcess, int ProcessInformationClass,
    ref PROCESS_POWER_THROTTLING_STATE ProcessInformation, uint ProcessInformationSize);
  [DllImport("kernel32.dll", SetLastError = true)]
  static extern IntPtr OpenProcess(uint dwDesiredAccess, bool bInheritHandle, uint dwProcessId);
  [DllImport("kernel32.dll")]
  static extern bool CloseHandle(IntPtr hObject);
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  struct PROCESSENTRY32 {
    public uint dwSize, cntUsage, th32ProcessID;
    public IntPtr th32DefaultHeapID;
    public uint th32ModuleID, cntThreads, th32ParentProcessID;
    public int pcPriClassBase;
    public uint dwFlags;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string szExeFile;
  }
  [DllImport("kernel32.dll", SetLastError = true)]
  static extern IntPtr CreateToolhelp32Snapshot(uint flags, uint processId);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true, ExactSpelling = true)]
  static extern bool Process32FirstW(IntPtr snapshot, ref PROCESSENTRY32 entry);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true, ExactSpelling = true)]
  static extern bool Process32NextW(IntPtr snapshot, ref PROCESSENTRY32 entry);

  public sealed class ProcessEntry {
    public int Id, ParentId;
    public string Name;
    public ProcessEntry(int id, int parentId, string name) { Id = id; ParentId = parentId; Name = name; }
  }

  static bool IsHelperWorker(string name) {
    switch ((name ?? "").ToLowerInvariant()) {
      case "excelsis helper.exe": case "electron.exe": case "node.exe":
      case "powershell.exe": case "pwsh.exe": case "cscript.exe": case "wscript.exe":
      case "conhost.exe": case "openconsole.exe": case "cmd.exe":
      case "reg.exe": case "net.exe": case "attrib.exe":
      case "capture-sw-assembly-geometry.exe": case "date-assembly-files.exe": return true;
      default: return false;
    }
  }

  static bool BelongsToOwner(int processId, int ownerId, Dictionary<int, ProcessEntry> entries) {
    if (ownerId <= 0) return true;
    var seen = new HashSet<int>();
    while (seen.Add(processId)) {
      ProcessEntry entry;
      if (!entries.TryGetValue(processId, out entry) || !IsHelperWorker(entry.Name)) return false;
      if (processId == ownerId) return true;
      processId = entry.ParentId;
    }
    return false;
  }

  public static int[] SelectTargets(int[] roots, ProcessEntry[] processes, bool includeChildren, int ownerId = 0) {
    var entries = new Dictionary<int, ProcessEntry>();
    var children = new Dictionary<int, List<ProcessEntry>>();
    foreach (var entry in processes) {
      entries[entry.Id] = entry;
      if (!children.ContainsKey(entry.ParentId)) children[entry.ParentId] = new List<ProcessEntry>();
      children[entry.ParentId].Add(entry);
    }
    var queue = new Queue<int>();
    foreach (int root in roots) {
      ProcessEntry entry;
      if (entries.TryGetValue(root, out entry) && IsHelperWorker(entry.Name)
        && BelongsToOwner(root, ownerId, entries)) queue.Enqueue(root);
    }
    var seen = new HashSet<int>();
    var result = new List<int>();
    while (queue.Count > 0) {
      int id = queue.Dequeue();
      if (!seen.Add(id)) continue;
      result.Add(id);
      List<ProcessEntry> descendants;
      if (includeChildren && children.TryGetValue(id, out descendants)) {
        foreach (var child in descendants) {
          // Stop at external applications; never traverse through SOLIDWORKS or Explorer.
          if (IsHelperWorker(child.Name)) queue.Enqueue(child.Id);
        }
      }
    }
    return result.ToArray();
  }

  public static int[] TargetProcesses(int[] roots, bool includeChildren, int ownerId) {
    var processes = new List<ProcessEntry>();
    IntPtr snapshot = CreateToolhelp32Snapshot(2, 0);
    if (snapshot == new IntPtr(-1)) return new int[0];
    try {
      var entry = new PROCESSENTRY32();
      entry.dwSize = (uint)Marshal.SizeOf(typeof(PROCESSENTRY32));
      if (Process32FirstW(snapshot, ref entry)) {
        do { processes.Add(new ProcessEntry((int)entry.th32ProcessID, (int)entry.th32ParentProcessID, entry.szExeFile)); }
        while (Process32NextW(snapshot, ref entry));
      }
    } finally { CloseHandle(snapshot); }
    return SelectTargets(roots, processes.ToArray(), includeChildren, ownerId);
  }

  const int ProcessPowerThrottling = 4;                              // PROCESS_INFORMATION_CLASS
  const uint EXECUTION_SPEED = 0x1;                                  // PROCESS_POWER_THROTTLING_EXECUTION_SPEED
  const uint CURRENT_VERSION = 1;                                    // PROCESS_POWER_THROTTLING_CURRENT_VERSION
  const uint PROCESS_SET_INFORMATION = 0x0200;
  const uint PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;

  public static bool Throttle(uint processId) {
    IntPtr h = OpenProcess(PROCESS_SET_INFORMATION, false, processId);
    if (h == IntPtr.Zero) return false;
    try {
      var s = new PROCESS_POWER_THROTTLING_STATE();
      s.Version = CURRENT_VERSION;
      s.ControlMask = EXECUTION_SPEED;
      s.StateMask = EXECUTION_SPEED;
      return SetProcessInformation(h, ProcessPowerThrottling, ref s,
        (uint)Marshal.SizeOf(typeof(PROCESS_POWER_THROTTLING_STATE)));
    } finally {
      CloseHandle(h);
    }
  }

  public static bool IsThrottled(uint processId) {
    IntPtr h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, processId);
    if (h == IntPtr.Zero) return false;
    try {
      var s = new PROCESS_POWER_THROTTLING_STATE();
      s.Version = CURRENT_VERSION;
      if (!GetProcessInformation(h, ProcessPowerThrottling, ref s,
        (uint)Marshal.SizeOf(typeof(PROCESS_POWER_THROTTLING_STATE)))) return false;
      return (s.ControlMask & EXECUTION_SPEED) != 0
        && (s.StateMask & EXECUTION_SPEED) != 0;
    } finally {
      CloseHandle(h);
    }
  }
}
'@

if (-not ('EcoQoS' -as [type])) {
  try { Add-Type -TypeDefinition $code -ErrorAction Stop }
  catch { if ($Verify) { throw }; return }
}

$verification = @()
# The short-lived policy host and its console are Helper work as well.
if (-not $Verify) { $rootIds += $PID }
$targets = [EcoQoS]::TargetProcesses([int[]]$rootIds, [bool]$IncludeChildren, $OwnerPid)
foreach ($processId in ($targets | Select-Object -Unique)) {
  $priorityNormal = $false
  $applied = $false
  $ecoQos = $false
  $target = $null
  try {
    $target = Get-Process -Id $processId -ErrorAction Stop
    $target.PriorityClass = 'Normal'
    $priorityNormal = $target.PriorityClass -eq 'Normal'
  } catch {} finally { if ($target) { $target.Dispose() } }
  try { $applied = [EcoQoS]::Throttle([uint32]$processId) } catch {}
  if ($Verify) {
    try { $ecoQos = [EcoQoS]::IsThrottled([uint32]$processId) } catch {}
    $verification += [pscustomobject]@{
      ProcessId = [int]$processId
      PriorityNormal = [bool]$priorityNormal
      Applied = [bool]$applied
      EcoQos = [bool]$ecoQos
    }
  }
}
if ($Verify) {
  $verification | ConvertTo-Json -Compress
  if (-not $verification -or @($verification | Where-Object { -not $_.PriorityNormal -or -not $_.EcoQos }).Count -gt 0) {
    exit 1
  }
}
