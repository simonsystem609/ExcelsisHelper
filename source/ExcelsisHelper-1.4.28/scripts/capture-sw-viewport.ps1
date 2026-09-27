param(
  [Parameter(Mandatory = $true)][string]$DocumentPath,
  [Parameter(Mandatory = $true)][string]$OutputPng,
  [string]$MacroRunMarkerPath = "",
  [ValidateRange(32, 1024)][int]$Size = 256
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

try {
  if ($DocumentPath -match '["\x00-\x1f]' -or $OutputPng -match '["\x00-\x1f]' -or
      $DocumentPath -notmatch '\.(sldprt|sldasm|slddrw)$' -or
      -not [System.IO.Path]::IsPathRooted($DocumentPath) -or
      -not [System.IO.Path]::IsPathRooted($OutputPng)) {
    throw 'Invalid viewport capture path.'
  }
  if ($MacroRunMarkerPath -and (Test-Path -LiteralPath $MacroRunMarkerPath -PathType Leaf)) {
    $marker = Get-Content -LiteralPath $MacroRunMarkerPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $owner = Get-Process -Id ([int]$marker.pid) -ErrorAction SilentlyContinue
    $age = [DateTimeOffset]::UtcNow - [DateTimeOffset]::Parse([string]$marker.startedAt)
    if ($marker.schema -eq 'excelsis-helper-macro-run-v1' -and $owner -and
        $age.TotalMinutes -ge -5 -and $age.TotalHours -le 12) {
      throw 'A SOLIDWORKS macro is running. Retry after it finishes.'
    }
  }

  # One bounded scratch bitmap is reused; the published cache is never touched
  # unless capture and decoding both succeed.
  $bitmapPath = Join-Path ([System.IO.Path]::GetDirectoryName($OutputPng)) 'viewport-capture.bmp'
  [System.IO.File]::WriteAllBytes($bitmapPath, [byte[]]@())
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = Join-Path $env:WINDIR 'System32\cscript.exe'
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $captureScript = Join-Path $PSScriptRoot 'capture-sw-viewport.vbs'
  $psi.Arguments = '//NoLogo "' + $captureScript + '" "' + $DocumentPath + '" "' + $bitmapPath + '"'
  $capture = [System.Diagnostics.Process]::Start($psi)
  try {
    try { $capture.PriorityClass = [System.Diagnostics.ProcessPriorityClass]::Normal } catch {}
    & (Join-Path $PSScriptRoot 'set-ecoqos.ps1') -TargetPid $capture.Id | Out-Null
    if (-not $capture.WaitForExit(10000)) {
      try { $capture.Kill() } catch {}
      throw 'SOLIDWORKS did not answer the viewport capture in time. Existing thumbnail kept.'
    }
    $stderr = $capture.StandardError.ReadToEnd().Trim()
    if ($capture.ExitCode -ne 0) { throw $stderr }
  } finally {
    $capture.Dispose()
  }

  $info = Get-Item -LiteralPath $bitmapPath
  if ($info.Length -lt 54 -or $info.Length -gt 64MB) { throw 'Viewport bitmap exceeds the safe size limit.' }
  Add-Type -AssemblyName System.Drawing
  $bitmap = [System.Drawing.Bitmap]::FromFile($bitmapPath)
  try {
    if ($bitmap.Width -gt 8192 -or $bitmap.Height -gt 8192 -or
        [long]$bitmap.Width * $bitmap.Height -gt 16 * 1024 * 1024) {
      throw 'Viewport dimensions exceed the safe decode limit.'
    }
    $scale = [Math]::Min($Size / [double]$bitmap.Width, $Size / [double]$bitmap.Height)
    $width = [Math]::Max(1, [int][Math]::Round($bitmap.Width * $scale))
    $height = [Math]::Max(1, [int][Math]::Round($bitmap.Height * $scale))
    $thumbnail = New-Object System.Drawing.Bitmap -ArgumentList $width, $height
    $graphics = [System.Drawing.Graphics]::FromImage($thumbnail)
    try {
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.DrawImage($bitmap, 0, 0, $width, $height)
      $thumbnail.Save($OutputPng, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $graphics.Dispose()
      $thumbnail.Dispose()
    }
  } finally {
    $bitmap.Dispose()
  }
  [ordered]@{ ok = $true; method = 'sw-viewport'; output = $OutputPng } | ConvertTo-Json -Compress
} catch {
  [ordered]@{ ok = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress
}
