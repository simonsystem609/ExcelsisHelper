# Excelsis Helper 1.4.33 release audit

Audit date: 2026-10-11. This assessment covers the isolated source and release
package, not installed-app or live SOLIDWORKS acceptance. The installer,
project-authored utilities and macros are unsigned.

## Source and provenance

The immutable producer transfer passed exact asset, source-inventory and
signed-attestation checks. Public staging excludes settings sidecars,
development-only probes, compiler inputs, unused runtime build remnants and
build logs. Corresponding source is committed at
[`source/ExcelsisHelper-1.4.33/`](source/ExcelsisHelper-1.4.33/): 168 files /
5,075,542 bytes, independently matched to the complete source ZIP.

Both project-authored C# utilities were rebuilt twice from included source
using Microsoft-signed Roslyn 4.14.0 and signed SOLIDWORKS API interop inputs.
The independent outputs are byte-identical and match the installer; no compiler
or vendor DLL is distributed. Hashes and instructions are in
[BUILDING.md](source/ExcelsisHelper-1.4.33/docs/BUILDING.md).
Project-authored source and macros are GPL-3.0-only. The updated license
inventory, provenance and third-party notices accompany the complete source.

The changed CNC SWP was independently recovered and matched to its readable
SWB. The other eight macro pairs match previously audited app or macro-only
releases exactly. The three CNC/DXF pairs are also published as optional
immutable revision 20261011.1 for Helper 1.4.33; they are already bundled in
fresh 1.4.33 installations. The older 1.4.29 DXF revision remains unchanged.

## Checks and limitations

- Fresh locked npm install, full tests and release build passed. Full and
  production dependency audits each reported zero vulnerabilities.
- Exact source correspondence matched 30 authored ASAR files, 45 external
  authored files, all nine macros and all 80 extracted installer files.
  All nine Electron fuses and embedded ASAR integrity passed.
- Gitleaks source, ASAR and packaged-resource scans found no secrets. A bounded
  Latin-1 and both-alignment UTF-16 privacy scan covered 279 files /
  301,744,760 bytes with no findings. The Hungarian word for cat is allowed
  only in the exact official checksum-verified Electron locale.
- Kaspersky 21.26, with 2026-10-11 bases, scanned exact installer, source ZIP
  and macro copies: 554/554 objects OK, zero detections, suspicions, skips,
  password-protected objects, corruption or errors. All copies and originals
  retained their hashes. No protection setting or exclusion was changed.
- Source tests do not establish installed upgrade behavior, macro-file locking,
  machining suitability, live CAD/export results or absence of unknown
  identifiers. No installed/live workflow acceptance is claimed.
- Older source snapshots remain available through their immutable tags and
  release archives. Existing releases and Git history were not rewritten.

## Release assets

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| `ExcelsisHelper-1.4.33-Setup.exe` | 94,927,285 | `4856594C19406D4549E01A6C0C0AE4B8C129BEBC14F2D3F0555958E7B68BD3D6` |
| `ExcelsisHelper-1.4.33-Setup.exe.blockmap` | 101,471 | `9D351FD1D7A3A26D7EF41B36292877FC18579C57EC65DACF8FEE1DBB9ED5D8A1` |
| `ExcelsisHelper-1.4.33-source.zip` | 1,594,307 | `6BC15B379F8A770A643DA362677561342073DF3DA44D154B8E6530AF56A22298` |
