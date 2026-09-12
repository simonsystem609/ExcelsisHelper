param(
  [string]$FilterPattern = ""
)

# Enumerates SOLIDWORKS add-ins from the registry. Each SW add-in
# registers a subkey under HKLM\SOFTWARE\SolidWorks\AddIns\{CLSID}
# (sometimes HKCU). We pull the title from there and the actual DLL
# path from the CLSID's InprocServer32 entry.
#
# If $FilterPattern is non-empty, only addins whose title or DLL path
# match (case-insensitive regex) are returned.
#
# Output: JSON array of { clsid, title, dllPath, hive }.

Set-StrictMode -Version 1.0
$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$result = New-Object System.Collections.Generic.List[object]

$bases = @(
  "HKLM:\SOFTWARE\SolidWorks\AddIns",
  "HKCU:\SOFTWARE\SolidWorks\AddIns",
  "HKLM:\SOFTWARE\WOW6432Node\SolidWorks\AddIns"
)

foreach ($base in $bases) {
  if (-not (Test-Path $base)) { continue }
  $children = @(Get-ChildItem $base -ErrorAction SilentlyContinue)
  foreach ($child in $children) {
    $clsid = $child.PSChildName
    $props = $null
    try { $props = Get-ItemProperty $child.PSPath -ErrorAction Stop } catch { continue }

    $title = ""
    if ($props.PSObject.Properties.Name -contains "Title") {
      try { $title = [string]$props.Title } catch {}
    }

    # Look up the actual COM server (DLL) path so we can pass it to
    # ISldWorks::LoadAddIn / UnloadAddIn (those want the file path,
    # not the CLSID).
    $dllPath = ""
    $clsRoots = @(
      "HKLM:\SOFTWARE\Classes\CLSID\$clsid\InprocServer32",
      "HKLM:\SOFTWARE\WOW6432Node\Classes\CLSID\$clsid\InprocServer32",
      "HKCU:\Software\Classes\CLSID\$clsid\InprocServer32"
    )
    foreach ($r in $clsRoots) {
      if (Test-Path $r) {
        try {
          $dp = (Get-ItemProperty $r -ErrorAction Stop).'(default)'
          if ($dp) { $dllPath = [string]$dp; break }
        } catch {}
      }
    }

    # Apply optional filter.
    if (-not [string]::IsNullOrWhiteSpace($FilterPattern)) {
      $hit = $false
      try { if ($title -imatch $FilterPattern) { $hit = $true } } catch {}
      try { if ($dllPath -imatch $FilterPattern) { $hit = $true } } catch {}
      if (-not $hit) { continue }
    }

    $result.Add([ordered]@{
      clsid = $clsid
      title = $title
      dllPath = $dllPath
      hive = $base
    })
  }
}

$result.ToArray() | ConvertTo-Json -Depth 4 -Compress
