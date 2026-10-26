param(
    [Parameter(Mandatory=$true)][string]$RequestPath,
    [Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$RequestSha256,
    [Parameter(Mandatory=$true)][string]$DocumentsPath
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2
[Console]::OutputEncoding = New-Object Text.UTF8Encoding($false)
$allowedNames = @('BackupAssembly_v1.swp','BOM_v19.swp','BOM_v19_ROfriendy.swp','CNCDXF_final_v1.swp','CrawlScrews_v1.swp','DXF_v16.swp','DXF_v16_ROfriendy.swp','PDF_v1.swp','Radius_v9.swp')
$records = @()
$backupFolder = ''
function Hash-Bytes([byte[]]$Bytes) {
    $hash = [Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($hash.ComputeHash($Bytes)).Replace('-','').ToLowerInvariant() } finally { $hash.Dispose() }
}
function Safe-Path([string]$Path, [bool]$Directory) {
    $entry = Get-Item -LiteralPath $Path -Force
    if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $entry.PSIsContainer -ne $Directory) { throw 'An update path is redirected or has an unexpected type.' }
}
function Read-Held($Stream, [long]$Maximum) {
    if ($Stream.Length -lt 32 -or $Stream.Length -gt $Maximum) { throw 'An update file has an unsafe size.' }
    $Stream.Position = 0
    $bytes = New-Object byte[] ([int]$Stream.Length)
    $offset = 0
    while ($offset -lt $bytes.Length) {
        $count = $Stream.Read($bytes, $offset, $bytes.Length - $offset)
        if ($count -le 0) { throw 'Incomplete update file read.' }
        $offset += $count
    }
    return ,$bytes
}
function Write-Held($Stream, [byte[]]$Bytes) {
    $Stream.Position = 0
    $Stream.Write($Bytes, 0, $Bytes.Length)
    $Stream.SetLength($Bytes.Length)
    $Stream.Flush($true)
}
function Read-SafeBytes([string]$Path, [long]$Maximum) {
    Safe-Path $Path $false
    $handle = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
    try { return ,(Read-Held $handle $Maximum) } finally { $handle.Dispose() }
}
try {
    $requestBytes = Read-SafeBytes $RequestPath 65536
    if ((Hash-Bytes $requestBytes) -ne $RequestSha256.ToLowerInvariant()) { throw 'The macro update request changed before verification.' }
    $request = [Text.Encoding]::UTF8.GetString($requestBytes) | ConvertFrom-Json
    if ($request.schema -ne 'excelsis-helper-macro-request-v1' -or $request.helperVersion -notmatch '^\d+\.\d+\.\d+$' -or
        $request.revision -notmatch '^20\d{6}\.[1-9]\d{0,3}$' -or
        $request.tag -ne ('excelsis-helper-macros-' + $request.helperVersion + '-' + $request.revision)) { throw 'Invalid macro update identity.' }
    $files = @($request.files)
    if ($files.Count -lt 1 -or $files.Count -gt $allowedNames.Count) { throw 'Invalid macro update file count.' }
    $documents = [IO.Path]::GetFullPath($DocumentsPath)
    $helper = Join-Path $documents 'Excelsis Helper'
    $macros = Join-Path $helper 'Macros'
    foreach ($folder in @($documents,$helper,$macros)) { Safe-Path $folder $true }
    $stage = [IO.Path]::GetFullPath([string]$request.stagingRoot)
    Safe-Path $stage $true
    if ([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($RequestPath)) -ne $stage) { throw 'The request is outside its staging directory.' }
    $markerPath = Join-Path $macros '.bundled-macros.json'
    $marker = [Text.Encoding]::UTF8.GetString((Read-SafeBytes $markerPath 65536)).TrimStart([char]0xFEFF) | ConvertFrom-Json
    if ($marker.schema -ne 'excelsis-bundled-macros-v2' -or $marker.appVersion -ne $request.helperVersion) { throw 'Helper macro setup/version changed; no update was applied.' }
    $names = @{}
    $total = 0
    foreach ($file in $files) {
        $name = [string]$file.name
        if ($allowedNames -cnotcontains $name -or $names.ContainsKey($name) -or @($marker.files) -cnotcontains $name -or
            $file.sha256 -notmatch '^[a-f0-9]{64}$' -or $file.previousSha256 -notmatch '^[a-f0-9]{64}$') { throw 'Unexpected, duplicate or unverified macro file.' }
        $names.Add($name,$true)
        $bytes = Read-SafeBytes (Join-Path $stage $name) 16777216
        $total += $bytes.Length
        if ($total -gt 67108864 -or $bytes.Length -ne $file.size -or $bytes.Length -lt 512 -or
            [BitConverter]::ToString($bytes,0,8) -ne 'D0-CF-11-E0-A1-B1-1A-E1' -or
            (Hash-Bytes $bytes) -ne $file.sha256) { throw 'The downloaded SWP failed independent verification.' }
        $target = Join-Path $macros $name
        Safe-Path $target $false
        $stream = [IO.File]::Open($target, [IO.FileMode]::Open, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
        $record = [pscustomobject]@{name=$name;stream=$stream;before=$null;after=$bytes;oldHash=[string]$file.previousSha256;newHash=[string]$file.sha256;written=$false}
        $records += $record
        $record.before = Read-Held $stream 16777216
        if ((Hash-Bytes $record.before) -ne $record.oldHash) { throw 'An installed macro changed since the update was approved.' }
    }
    # All target SWPs are held exclusively before any target is modified.
    $backupRoot = Join-Path $helper 'macrobackup'
    if (-not (Test-Path -LiteralPath $backupRoot)) { New-Item -ItemType Directory -Path $backupRoot | Out-Null }
    Safe-Path $backupRoot $true
    $history = Join-Path $backupRoot 'update-center'
    if (-not (Test-Path -LiteralPath $history)) { New-Item -ItemType Directory -Path $history | Out-Null }
    Safe-Path $history $true
    $backupFolder = Join-Path $history ($request.revision + '-' + [Guid]::NewGuid().ToString('D'))
    New-Item -ItemType Directory -Path $backupFolder | Out-Null
    foreach ($record in $records) {
        $backup = Join-Path $backupFolder $record.name
        [IO.File]::WriteAllBytes($backup,$record.before)
        if ((Hash-Bytes ([IO.File]::ReadAllBytes($backup))) -ne $record.oldHash) { throw 'A macro backup failed read-back verification.' }
    }
    $receipt = [ordered]@{schema='excelsis-helper-macro-update-v1';helperVersion=$request.helperVersion;revision=$request.revision;tag=$request.tag;
        installedAt=[DateTime]::UtcNow.ToString('o');files=@($records | Select-Object name,newHash)}
    $receiptPath = Join-Path $macros '.verified-macro-update.json'
    $hadReceipt = Test-Path -LiteralPath $receiptPath
    if ($hadReceipt) { Safe-Path $receiptPath $false }
    $stagedReceipt = Join-Path $backupFolder 'new-receipt.json'
    $receiptBytes = (New-Object Text.UTF8Encoding($false)).GetBytes(($receipt | ConvertTo-Json -Depth 5))
    [IO.File]::WriteAllBytes($stagedReceipt,$receiptBytes)
    if ((Hash-Bytes ([IO.File]::ReadAllBytes($stagedReceipt))) -ne (Hash-Bytes $receiptBytes)) { throw 'Macro receipt staging failed.' }
    foreach ($record in $records) {
        $record.written = $true
        Write-Held $record.stream $record.after
        if ((Hash-Bytes (Read-Held $record.stream 16777216)) -ne $record.newHash) { throw 'An installed macro failed read-back verification.' }
    }
    # Publish the receipt last and atomically. A failed publish leaves the old
    # receipt intact and triggers rollback while all macro handles remain held.
    if ($hadReceipt) { [IO.File]::Replace($stagedReceipt,$receiptPath,(Join-Path $backupFolder 'previous-receipt.json')) }
    else { [IO.File]::Move($stagedReceipt,$receiptPath) }
    $result = @{ok=$true;updated=@($records | ForEach-Object name);backupFolder=$backupFolder}
} catch {
    $failure = $_.Exception
    $rollbackErrors = @()
    foreach ($record in $records) {
        if ($record.written) {
            try {
                Write-Held $record.stream $record.before
                if ((Hash-Bytes (Read-Held $record.stream 16777216)) -ne $record.oldHash) { throw 'Original macro read-back failed.' }
            } catch { $rollbackErrors += $record.name }
        }
    }
    while ($failure.InnerException) { $failure = $failure.InnerException }
    $code = if ($rollbackErrors.Count) { 'rollback-failed' } elseif (($failure.HResult -band 65535) -in @(32,33)) { 'locked' } else { 'failed' }
    $message = if ($rollbackErrors.Count) { 'Macro recovery needs attention. Originals: ' + $backupFolder + '. Files: ' + ($rollbackErrors -join ', ') } else { $failure.Message }
    $result = @{ok=$false;code=$code;error=$message;backupFolder=$backupFolder}
} finally {
    foreach ($record in $records) { $record.stream.Dispose() }
}
$result | ConvertTo-Json -Depth 5 -Compress
