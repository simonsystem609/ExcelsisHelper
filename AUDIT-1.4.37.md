# Excelsis Helper 1.4.37 release audit

Assessment date: 2026-10-27. Protected publication and exact remote asset
verification are required in addition to the local checks below.

## Changes and source

The cumulative release adds a manually operated Update Center for Helper,
Viewer and compatible macros, full-path recent search, configurable project
folders, part/assembly capture improvements and laser DXF refinements. Macro
updates acquire every affected SWP exclusively before writing, verify backups
and read-back, roll back failures and publish their receipt last. Locked files
offer Retry/Later with SOLIDWORKS close/restart guidance. No process is killed
and installers are never run silently. Metadata checks do not send local paths,
documents, settings or worklogs.

Public packaging patches Electron to 42.11.18, undici to 6.29.1/7.30.1 and
fast-uri to 3.1.9. Exact dependency assertions include patched brace-expansion
5.0.12 and the safe legacy 1.1.21 required by newly resolved build-only paths.
The generated inventory covers 222 locked build packages. The independent,
unlocked developer renderer fixture is not covered by that lockfile audit;
its Electron pin is also updated to 42.11.18.

Helper's Update Center is independently authored and implements the public
release protocol; no AGPL Viewer modules or engines are included. Helper
remains GPL-3.0-only. The packaged ISC notice covers the Lucide copy,
folder-open and project-adapted folder-plus glyphs. Full corresponding source
contains 197 files / 5,499,370 bytes. Personal deployment data, private probes,
compiler and vendor DLLs are excluded. The SOLIDWORKS thumbnail/preview
extraction remains read-only; CAD capture uses the documented application API.

## Verification and limitations

- Trusted immutable transfer, source selection, full offline feature tests,
  separate final hardening verification, locked dependency audit and all nine
  source/compiled macro pairs passed. A missing scratch parent was supplied;
  dependency assertions were updated to the exact patched graph. Neither is a
  product feature change. Locked dependency findings are zero.
- Both project-authored native utilities were built twice identically using
  validated Microsoft/Dassault-signed inputs. Producer executables were not
  extracted, restored or executed. The unchanged date utility matches its
  previously audited public hash; the changed capture utility was rebuilt.
- All 81 extracted installer files, 39 authored ASAR files, 46 external source
  files, nine fuses and embedded ASAR integrity match the public build/source.
  The package contains no settings sidecar or deployment seed. Privacy scanning
  covered 328 files / 398,010,621 bytes in Latin-1 and both UTF-16 alignments;
  the sole locale exception is exact-hash matched to upstream Electron.
  The complete final source secret scan has zero findings.
- Kaspersky 21.26: 469 processed / 469 OK across exact installer/source/macro
  copies, all adverse counters zero. Original and copy hashes are unchanged;
  no protection settings changed. No public-build Defender result is claimed.
- Binaries and macros are unsigned. No installed public-build or live
  SOLIDWORKS/CAM/laser acceptance is claimed; synthetic tests do not prove every
  model, network environment or reader.

## Assets

Installer: 94,990,416 bytes, SHA256
`45FBA25F8136851A0F359D27FB3EE4FCA7A8DF4E415A02928FDB6547747C3008`.
Source ZIP: 1,746,020 bytes, SHA256
`3D91201912ABF7B07B729BE5CD140CCA46F4972ECDF486F7502DED9810504078`.
SHA256SUMS covers the installer, blockmap and source archive.

The separate immutable macro revision `20261026.1` contains the CNC/DXF three
pairs and is compatible only with Helper 1.4.37. Fresh installs already include
those bytes; future compatible revisions do not need an app-version bump.
Older 1.4.33/1.4.29 revisions and immutable installers remain unchanged.
