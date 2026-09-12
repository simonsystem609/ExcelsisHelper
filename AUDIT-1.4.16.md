# Excelsis Helper 1.4.16 release audit

Audit date: 2026-09-12.

Decision: technical GO after the independent local release gates below.
Publication requires protected checks and remote verification. This engineering
and open-source-license assessment is not legal advice or a guarantee against
every defect, vulnerability or third-party claim. Binaries are unsigned and
installed SOLIDWORKS workflows still require user acceptance.

## Intake and bounded release preparation

The immutable candidate passed repository-control, asset-size/hash, safe ZIP
structure and signed GitHub release/asset attestation checks. No settings
sidecar was transferred. Its 128 source files were extracted into a fresh
isolated build tree after another complete checksum check.

The supplied 1.4.16 source already integrates the Radius changes; no separate
patch was reapplied. It retains the reviewed package identity, install appId,
explicit 16-script runtime allow-list, Electron 42.11.3 and dependency pins.
Release preparation changed six files, solely comments and documentation:
neutral wording, current nine-macro provenance, retained-runtime build guidance
and a current release-audit reference. No application behavior or macro bytes
were changed. The installer was rebuilt from that exact cleaned source.

Product changes relative to 1.4.13 include Radius outline-corner handling,
angle/size prompts and unsaved-document guards; correct Radius/backup module
routing; opening successful DXF/BOM export folders; and a de-elevated
interactive setup warning with Retry/Later for failed macro/settings updates.
Silent setup does not launch the app. The update flow does not force-close
SOLIDWORKS or its editor. Existing preview, Work Logger, machining, PDF export
and backup functionality is retained.

Only current expanded source is kept on main. Prior 1.4.13 source remains in
its immutable release and Git history; its audit links point to the original
release commit. ExcelsisView is unchanged.

## Corresponding source, licensing and provenance

Helper is GPL-3.0-only. Root/source/packaged license text, package metadata
and the NSIS license selection agree. The exact source is at
[source/ExcelsisHelper-1.4.16/](source/ExcelsisHelper-1.4.16/): 128 files,
4,128,402 bytes. Every ZIP entry's path, size and SHA-256 independently matches
the frozen source and build input. The archive includes editable app/scripts,
tests, build configuration, icons, notices, nine SWBs and nine build-ready SWPs.

All 193 locked npm packages are build-only, with registry archive URLs,
SHA-512 pins and declared license expressions. There are no npm application
runtime dependencies. The deterministic inventory was regenerated and checked.
Twenty-nine existing artwork, license, preview and machining provenance files
remain byte-identical to the reviewed public baseline. Twenty native/runtime
files, including NSIS plugins and Elevate, match the reviewed baseline too.

DwgThumbnailReader retains its pinned MIT attribution. Electron/Chromium,
NSIS 3.12 and Elevate retain their complete applicable notices. The NSIS
bundle SHA-256 remains pinned to
56997fdefe25e7928a1a68b4583d08b240b66cf660234053b20131a74cc082f4.
The project owns the original macros and artwork; new macro changes are
project-authored API interoperability, not redistributed vendor code.

See [PROVENANCE.md](source/ExcelsisHelper-1.4.16/docs/PROVENANCE.md),
[THIRD_PARTY_NOTICES.md](source/ExcelsisHelper-1.4.16/THIRD_PARTY_NOTICES.md)
and [DEPENDENCY_LICENSES.md](source/ExcelsisHelper-1.4.16/docs/DEPENDENCY_LICENSES.md).
Read-only embedded thumbnail/preview extraction is preserved. No vendor SDK,
proprietary CAD runtime/model decoder, customer document, preset, credential,
diagnostic bundle, operational control or private build tooling is included.

## Macro, privacy and security evidence

All nine SWPs recover to their paired SWBs' executable statements. The two
read-only variants differ only in comments/formatting. All 18 module cache
prefixes match reviewed public 1.4.13 bytes. Macro inputs already have neutral
saved paths; no SWB/SWP bytes changed during release preparation.

Independent Latin-1 and both-alignment UTF-16 checks pass. A bounded scan of
241 files and 491,742,418 bytes across frozen source/assets, extracted installer,
payload and ASAR found zero boundary violations. Six chunk-boundary self-tests
verify split-marker detection. Gitleaks 8.30.1 found no leaks in final source,
extracted ASAR or existing public Git history; committed content is checked
again before push. History authors/committers use GitHub noreply identities.

Historical immutable 1.4.8/1.4.9 assets and Git objects retain original saved-
machine metadata. They are not claimed path-free and were not rewritten.
Structural macro correspondence is not live macro-loading or geometry acceptance.

## Independent build, tests and packaged bytes

- Fresh npm ci with legacy-peer-deps, ignore-scripts and no-audit, followed by
  a non-launching Windows x64 NSIS build, passed with Node.js 24.18.0/npm 11.16.0.
  Exact dependency and upstream build/runtime checksums are retained.
- Full and production npm audits each report zero vulnerabilities. All tests,
  61 JavaScript syntax checks and 12 PowerShell parser checks pass.
- Tests cover settings layering, macro locks/backups/read-back failures,
  installer Retry/Later/single-flight behavior, actual module names and fallback
  routing, Radius geometry/selection/guards, DXF filtering and export folders.
  New geometry and shell checks use synthetic doubles, not live SOLIDWORKS or
  Explorer. EcoQoS tests use a disposable process.
- Existing Work Logger, recent-document, preview limits, viewport, machining,
  MPF rewrite and release-hardening suites pass.
- All 70 extracted installer payload files (295,283,599 bytes) match the build.
  ASAR contains 28 exact authored files plus package metadata. All 35 external
  authored resources match, including exactly 16 runtime scripts and nine SWPs.
  SWBs, build/test tools, presets and npm modules are not deployed at runtime.
- All nine Electron fuse slots and the embedded ASAR-header SHA-256 verify.
  Sandbox, context isolation, content policy, trusted IPC and navigation limits
  remain. File-protocol privileges stay enabled for BrowserWindow.loadFile().
  Only en-US/hu locales are included; component notices are present.
- The extracted packaged MPF worker passes compaction, rewrite, transfer and
  source-hash tests. Five unused GPU files are retained outside the package;
  that retained directory is excluded from corresponding source.

Application executable SHA-256:
8C3E74AC94BE23A43370F8FF10BCE5E2098C7041C733AB71261F4354F0ECC870.

ASAR SHA-256:
424C9525E6460177640B54C0225387BCA287179E8D2517FE2B6B4384A846166C.

## Malware scan

Kaspersky 21.26, bases 2026-09-12 08:33, completed an all-file, cache-bypassed
scan at 13:17:00-13:17:22 local time. Result: 1,102 processed/OK; zero
detections, suspicions, skipped, protected, corrupted objects or errors.

Report-only was requested but the host's automatic-action mode ignored it.
Only byte-identical isolated copies were scan targets. All 241 copies and
original files were hash-verified unchanged afterwards. No antivirus setting
was changed. WinDefend was stopped; no Defender scan is claimed. Antivirus
results are supporting evidence, not a safety guarantee.

## Exact release assets

Release: [Excelsis Helper 1.4.16](https://github.com/simonsystem609/ExcelsisHelper/releases/tag/excelsis-helper-v1.4.16).

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| ExcelsisHelper-1.4.16-Setup.exe | 94,794,834 | F0B594BBDB760C01E36F988EE75C825BA867415144960F460984ACF44FECA16B |
| ExcelsisHelper-1.4.16-Setup.exe.blockmap | 101,303 | 17B8E19FE0278B7666942AE9DB39B8CAA50B52FD8C82EFA5EAC82763BC3A3819 |
| ExcelsisHelper-1.4.16-source.zip | 1,276,856 | B6A7E0FBF248758749876C9BB5E36AD32EBB7370796E9921A2F33F7654B3495E |
| SHA256SUMS.txt | 304 | 77EBBB829B210999FEDDED10ECB75955BAE5D0D386372C6AEEC734FBCADCA98C |

The manifest covers the three payload assets. The rebuilt installer and source
archive correspond to the same frozen input, not the original candidate binary.
Large binaries are release assets, not newly committed Git/LFS objects.

## Publication controls and acceptance limits

Publication uses a protected PR with an up-to-date required CodeQL check,
an annotated release tag and immutable release. Uploaded names, sizes and
server digests and independent draft downloads must match before publication.
Fresh unauthenticated public downloads, all three checksum entries, signed
release/asset attestations, the final commit/source tree, CodeQL, Pages and
current security alerts must verify afterwards. No force-push, history rewrite
or protection bypass is permitted. GitHub attestations are not Authenticode.

Installer, application and Elevate are unsigned. This audit did not install
or launch the app, execute a live macro or modify a CAD document. User acceptance
still covers upgrade/settings/log preservation, Retry/Later with locked macros,
Radius selections and prompts, real module loading, DXF/BOM folder opening,
assembly backup, viewport capture and uninstall. Review local diagnostics before
sharing. Stable electron-builder 27.x remains separate maintenance; these pins
are an audited baseline, not a claim of latest availability.
