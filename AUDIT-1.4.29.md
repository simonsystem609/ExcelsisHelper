# Excelsis Helper 1.4.29 release audit

Audit date: 2026-09-30. This assessment covers the isolated public 1.4.29
package, not installed-app or live SOLIDWORKS acceptance. The installer,
project-authored utilities, and macros are unsigned.

## Source and provenance

The immutable private producer candidate passed transfer integrity checks.
Public staging omitted ten development-only probes and the optional settings
sidecar, restored the public build/provenance documentation, and aligned a
development-only renderer-smoke dependency pin with the audited app versions.
The exact corresponding source is
[`source/ExcelsisHelper-1.4.29/`](source/ExcelsisHelper-1.4.29/): 153 files /
4,771,984 bytes, matching the source ZIP. Project-authored code and nine
SWP/SWB macro pairs are GPL-3.0-only; see the source
[provenance](source/ExcelsisHelper-1.4.29/docs/PROVENANCE.md),
[notices](source/ExcelsisHelper-1.4.29/THIRD_PARTY_NOTICES.md), and
[dependency licenses](source/ExcelsisHelper-1.4.29/docs/DEPENDENCY_LICENSES.md).

The Radius SWP's VBA source exactly matches its included readable SWB; only
that macro pair changed from the audited 1.4.28 baseline. The separate
immutable Radius macro revision has the same bytes as the 1.4.29 installer and
corresponding source, and is for compatible Helper 1.4.29 installations.
Fresh 1.4.29 installations already include it.

Two project-authored .NET utilities were compiled twice from included C#
source with Microsoft-signed Roslyn and Dassault-signed redistributable API
interop assemblies as external build inputs. Both builds produced identical
EXEs; those exact files are in the installer. The interop DLLs were obtained
from third-party NuGet packages, so valid vendor Authenticode signatures—not
the package owner—were the provenance evidence. Neither vendor DLL nor compiler
is bundled. Input/output hashes and caveats are in
[build instructions](source/ExcelsisHelper-1.4.29/docs/BUILDING.md).

## Checks and limits

- A locked npm install, full tests, focused Radius/CAD capture tests, and both
  full and production dependency audits passed with zero reported
  vulnerabilities. The source-to-package audit matched 30 authored ASAR files,
  44 external authored files and all nine macros. Electron fuses and ASAR
  integrity passed; the extracted installer matched all 79 unpacked files.
- The final installer and source ZIP were scanned as exact isolated copies by
  Kaspersky 21.26: 484/484 objects OK, with zero detections, suspicions,
  skips, password-protected objects, corruption, or errors. Both scan copies
  retained their hashes. No Defender scan is claimed.
- Focused text/binary checks found no bundled private user path or settings
  sidecar. CAD capture uses the active SOLIDWORKS session and checks source
  identity. This does not prove absence of unknown identifiers.
- The source ZIP expands to the exact 153-file public tree. Installed upgrade,
  macro lock handling, Radius tangency behavior and live CAD workflows were
  not exercised here. Prior immutable releases and history were not rewritten.

## Immutable app release payloads

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| `ExcelsisHelper-1.4.29-Setup.exe` | 94,897,593 | `A9206A9566EBEE2B67BF98BB383AED9F522ADB95B8A295BCD10F393C49FE691C` |
| `ExcelsisHelper-1.4.29-Setup.exe.blockmap` | 101,443 | `318D3ABFCF00AC90668184D39B1E8C804B07F6322D6346104B0D8C8B6C7DF834` |
| `ExcelsisHelper-1.4.29-source.zip` | 1,444,899 | `5CCBA3CDD43587A473F637FEECEAD947FCC465F7E8C8933864D0DFAE37F4959E` |
