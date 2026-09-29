param(
    [Parameter(Mandatory = $true)][string]$InteropDirectory,
    [Parameter(Mandatory = $true)][string]$OutputDirectory,
    [Parameter(Mandatory = $true)][string]$CscPath
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$root = Split-Path -Parent $PSScriptRoot
$interop = (Resolve-Path -LiteralPath $InteropDirectory -ErrorAction Stop).Path
$output = (Resolve-Path -LiteralPath $OutputDirectory -ErrorAction Stop).Path
$sldworks = Join-Path $interop 'SolidWorks.Interop.sldworks.dll'
$swconst = Join-Path $interop 'SolidWorks.Interop.swconst.dll'
foreach ($required in @($CscPath, $sldworks, $swconst)) {
    if (-not (Test-Path -LiteralPath $required -PathType Leaf)) {
        throw "Required compiler or interop file is missing: $required"
    }
}

$dateExe = Join-Path $output 'date-assembly-files.exe'
$captureExe = Join-Path $output 'capture-sw-assembly-geometry.exe'
foreach ($target in @($dateExe, $captureExe)) {
    if (Test-Path -LiteralPath $target) { throw "Refusing to overwrite: $target" }
}

$common = @('/nologo', '/target:exe', '/platform:anycpu', '/deterministic+',
    ('/link:' + $sldworks), ('/link:' + $swconst),
    '/reference:System.Web.Extensions.dll')

& $CscPath @common '/reference:System.IO.Compression.dll' '/reference:System.IO.Compression.FileSystem.dll' ('/out:' + $dateExe) (Join-Path $root 'tools\date-assembly-files.cs')
if ($LASTEXITCODE -ne 0) { throw "Assembly-date compilation failed: $LASTEXITCODE" }

& $CscPath @common ('/out:' + $captureExe) (Join-Path $root 'scripts\capture-sw-assembly-geometry.cs') (Join-Path $root 'scripts\capture-sw-assembly-session.cs')
if ($LASTEXITCODE -ne 0) { throw "CAD capture compilation failed: $LASTEXITCODE" }

Write-Host "Built $dateExe"
Write-Host "Built $captureExe"
