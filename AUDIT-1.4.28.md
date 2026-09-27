# Excelsis Helper 1.4.28 release audit

Audit date: 2026-09-27. This assessment covers the isolated public 1.4.28
package, not installed-app or live SOLIDWORKS acceptance. The installer,
utilities, and macros are unsigned.

## Source and provenance

The immutable private producer candidate passed transfer integrity checks.
Public staging omitted development-only probes/corpus tools and the optional
settings sidecar. The exact corresponding source is
[`source/ExcelsisHelper-1.4.28/`](source/ExcelsisHelper-1.4.28/): 152 files /
4,757,241 bytes, matching the source ZIP. Project-authored code and the nine
unchanged SWP/SWB macro pairs are GPL-3.0-only; see the source
[provenance](source/ExcelsisHelper-1.4.28/docs/PROVENANCE.md),
[notices](source/ExcelsisHelper-1.4.28/THIRD_PARTY_NOTICES.md), and
[dependency licenses](source/ExcelsisHelper-1.4.28/docs/DEPENDENCY_LICENSES.md).

Two new .NET utilities were compiled from the included C# source with
Microsoft-signed Roslyn 4.14.0 and Dassault-signed redistributable SOLIDWORKS
interop assemblies used only as external build inputs. Separate deterministic
builds produced identical EXEs; those exact files are in the installer. The
interop DLLs came from third-party NuGet packages, so their valid vendor
Authenticode signatures—not the package owner—were the provenance evidence.
Neither vendor DLL nor compiler is bundled. Input and output hashes are in
[build instructions](source/ExcelsisHelper-1.4.28/docs/BUILDING.md).
The CAD capture utility reads the active application through documented COM
APIs; it is not a proprietary document-file decoder.

## Checks and limits

- Clean locked npm install and full tests passed. A source-to-package audit
  matched 30 authored ASAR files, 44 external authored files and all nine
  macros. Electron fuses and ASAR integrity passed; `npm audit` reported zero
  vulnerabilities.
- The final installer and source ZIP were scanned as exact isolated copies by
  Kaspersky 21.26: 463/463 objects OK, with zero detections, suspicions,
  skips, password-protected objects, corruption, or errors. Both scan copies
  retained their hashes. No Defender scan is claimed.
- Focused text/binary checks found no bundled company path, private user path
  or settings sidecar. Assembly-date backups default to the current user's
  Documents and accept an explicit folder; CAD capture uses the active
  SOLIDWORKS session. This does not prove absence of unknown identifiers.
- The source ZIP expands to the exact 152-file public tree. Installed upgrade,
  macro lock handling and live CAD/SolidCAM workflows were not exercised here.
  Prior immutable releases and history were not rewritten.

## Immutable release payloads

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| `ExcelsisHelper-1.4.28-Setup.exe` | 94,892,360 | `A4057B20063C3AFFC1EC2E0A0E8A17132A7C8F8B203A72B1F26F61ADECC2A6C3` |
| `ExcelsisHelper-1.4.28-Setup.exe.blockmap` | 101,419 | `EC36856EFAB592FBD0ED1E41A0864C8EE27ABA8108132F61CF83D425D3D0D271` |
| `ExcelsisHelper-1.4.28-source.zip` | 1,487,173 | `6BF9274C26920B7CBEEBC3697283BB66E4B0E4ACFECC866DAB175B14B5D9EB8F` |
| `SHA256SUMS.txt` | 304 | `7EC640896F27634C34C87FDCB3A4A2606DB82B9490C658AEB776B93D4C4E280B` |
