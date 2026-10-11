$ErrorActionPreference = "Stop"

$scriptPath = Join-Path $PSScriptRoot "..\scripts\automation-defaults\create-cam-folder.ps1"
$tokens = $null
$errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile(
  (Resolve-Path $scriptPath),
  [ref]$tokens,
  [ref]$errors
)
if ($errors.Count) { throw ($errors | Out-String) }

$functionAst = $ast.Find({
  param($node)
  $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and
    $node.Name -eq "Get-ProjectNameFromPath"
}, $true)
if ($null -eq $functionAst) { throw "Get-ProjectNameFromPath was not found." }

Invoke-Expression $functionAst.Extent.Text

$script:ProjectPrefixes = @("PRJ", "JOB")
$script:ProjectRootNames = @("CompanyProjects")
$prefixed = Get-ProjectNameFromPath -SourcePath "M:\CompanyProjects\PRJ-26-01 Example\Models\part.SLDPRT"
if ($prefixed -ne "PRJ-26-01 Example") { throw "Prefix detection failed: $prefixed" }

$script:ProjectPrefixes = @()
$rootBased = Get-ProjectNameFromPath -SourcePath "M:\CompanyProjects\Alpha Project\Models\part.SLDPRT"
if ($rootBased -ne "Alpha Project") { throw "Project-root fallback failed: $rootBased" }

$unmatched = Get-ProjectNameFromPath -SourcePath "M:\Unconfigured\Alpha Project\Models\part.SLDPRT"
if ($unmatched -ne "") { throw "Unexpected project match: $unmatched" }

Write-Output "CAM project detection tests passed."
