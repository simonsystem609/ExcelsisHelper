# Excelsis Helper 1.4.16 release verification

This document describes the verification scope for this exact corresponding
source. Completed independent release results and artifact hashes are recorded
in the public repository's
[AUDIT-1.4.16.md](https://github.com/simonsystem609/ExcelsisHelper/blob/main/AUDIT-1.4.16.md).
Producer build evidence is retained separately in CANDIDATE_1.4.16.md and is not
a substitute for independent release checks.

## Source and runtime

Helper is GPL-3.0-only. Project-owned application code, scripts, artwork,
machining data and nine paired readable SWB/build-ready SWP macros are supplied.
Only SWPs are deployed at runtime. Licensing and provenance are described in
PROVENANCE.md, DEPENDENCY_LICENSES.md and the root THIRD_PARTY_NOTICES.md.

The runtime includes the corrected Radius outline-corner and unsaved-part
behavior, Test11 launcher fallback, DXF/BOM export-folder changes and the
interactive post-install macro/settings update warning. Earlier separate
macro patches are already integrated and must not be reapplied.

The installer preserves the established application identity and user data.
It contains no settings preset. An optional external settings sidecar is not
part of this source or release; existing settings remain authoritative.

## Required independent checks

- Validate corresponding-source paths, sizes and hashes against the frozen
  archive and expanded repository source.
- Install the exact locked dependency graph in isolated staging, check current
  full and production advisories, and run the complete non-launching test suite.
- Rebuild the Windows x64 NSIS installer without publishing or launching it.
- Compare every extracted installer payload file, authored ASAR file and
  external resource with the reviewed source/build. Verify package identity,
  exact 16-entry script allow-list, nine SWPs, component notices and locales.
- Verify all nine Electron fuse slots and the embedded ASAR-header digest,
  plus the packaged MPF worker. Preserve the file-protocol privilege required
  by loadFile, sandboxing, context isolation and trusted IPC.
- Recover executable VBA from every SWP and compare it with its paired SWB;
  assess performance-cache provenance. Check macro metadata and other release
  bytes in Latin-1 and both UTF-16 alignments, together with secret scanning.
- Scan exact release/package bytes with the available malware scanner and
  report its actual mode, findings and limitations without changing security
  settings. Preserve all original evidence.
- Verify the protected merge/tag, immutable release, uploaded and downloaded
  asset sizes/hashes, checksum manifest, signed GitHub attestations and live
  publication links before claiming a completed release.

## Limits

Installer, application and elevation helper remain unsigned unless a separately
verified Authenticode signature is supplied. GitHub release attestations are
not Windows code-signing certificates. Synthetic geometry, filesystem and dialog
tests do not establish native installer or live SOLIDWORKS acceptance.

User-controlled acceptance includes installation/upgrade, de-elevated startup,
settings/log preservation, macro lock handling, Retry/Later and silent-install
behavior, real Radius geometry and export-folder behavior, and uninstall.
No audit conclusion is a guarantee against every defect or third-party claim.

Historical immutable 1.4.8/1.4.9 artifacts and Git objects retain original
saved-machine macro metadata. They were not rewritten and are not claimed
path-free. Current-source checks do not retroactively certify those artifacts.
