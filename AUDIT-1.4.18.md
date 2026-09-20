# Excelsis Helper 1.4.18 release audit

Audit date: 2026-09-20. This record applies to the exact files below.
Engineering/public-boundary decision: GO, subject to protected GitHub checks
and the remote verification described below. This is not legal indemnity.

## Scope, source and provenance

This release integrates a supplied eight-file DXF macro/source/test delta with
the preserved 1.4.17 application baseline. Transfer integrity was independently
checked: exact base and before-file hashes, immutable tag/commit, asset allow-list,
sizes, server/download hashes, manifest, signed release/asset attestations and
safe archive entries. The combined producer inventory was independently rebuilt.
An installer was not required from the producer; this combined installer was
clean-built independently with a new version so version-gated macro deployment
delivers the update. Existing immutable installers were not altered.

Both DXF variants add confirmed bent non-sheet-metal thickness-band filtering,
protected unsaved-window closure, fractional sub-millimeter thickness filenames,
referenced-configuration and post-resolution preflight, and checked Unicode/
long-path DXF delivery and folder opening. Referenced-part export and parent
assembly folders are the defaults. Unknown geometry does not invent a new
rejection. Sheet-metal handling, scopes, configurable shortcuts, missing-only
export, cooperative cancellation and the other seven macros remain included.

The release agent did not redesign macro or application behavior. Supplied
macro/test bytes were preserved. Release integration updates only the version,
matching version assertion, release/build documentation and generated license
inventory. Prior public comment/documentation cleanup is retained.

Exact expanded source: [source/ExcelsisHelper-1.4.18/](source/ExcelsisHelper-1.4.18/),
132 files / 4,422,858 bytes, identical to the source archive. It contains the
build configuration, lockfile, tests, readable macro sources and build-ready
SWPs. Project-owned code/macros remain GPL-3.0-only. Dependency resolution,
artwork, licenses, machining data, read-only thumbnail extraction and application
implementation are unchanged from the reviewed baseline. All 193 locked build
packages retain their exact versions, integrity values and license expressions;
29 provenance-sensitive source files were independently hash-compared.

No vendor SDK, proprietary decoder, geometry decoder, private research,
customer CAD, operational presets, credentials, settings sidecar or internal
logs are included. Thumbnail/preview extraction remains read-only and included.
See [PROVENANCE.md](source/ExcelsisHelper-1.4.18/docs/PROVENANCE.md),
[THIRD_PARTY_NOTICES.md](source/ExcelsisHelper-1.4.18/THIRD_PARTY_NOTICES.md),
[DEPENDENCY_LICENSES.md](source/ExcelsisHelper-1.4.18/docs/DEPENDENCY_LICENSES.md)
and [BUILDING.md](source/ExcelsisHelper-1.4.18/docs/BUILDING.md).

## Independent checks

- Clean locked installation and full/production dependency audits: zero
  vulnerabilities. No dependency change or new install hook was introduced.
- Complete npm test suite, 65 JavaScript syntax checks and 12 PowerShell parses
  pass. The initial run reached the hardening test and rejected the old exact
  version assertion; updating it to 1.4.18 preserves that check, and the complete
  suite subsequently passed. No security or behavioral assertion was removed.
- Both DXF variants pass isolated geometry, referenced/lightweight preflight,
  route, ownership, dirty-document, failure and cancellation tests. Separate
  Windows long-path tests pass Unicode delivery, existing-file preservation,
  explicit replacement and access/copy/commit-failure cases. These use disposable
  files and test doubles, not live SOLIDWORKS or customer documents.
- All nine SWP/SWB executable statement sets match. All 18 reviewed cached-code
  prefixes are unchanged. Only the two DXF module streams changed; container
  metadata stays unchanged and no private saved-machine paths were detected.
  Both variants have identical added/removed source statements.
- Clean NSIS packaging passes. Extracted installer: 70 runtime files /
  295,344,490 bytes, identical to the tested build. All 29 ASAR files have exact
  corresponding source or verified generated package metadata. The 35 authored
  external resources match source, including exactly 16 runtime scripts and
  nine SWPs. No settings sidecar, test tool or SWB is shipped as a runtime file.
- All nine Electron fuse slots, embedded ASAR-header integrity, packaged worker,
  installer/source/resource correspondence, runtime notices and locale checks
  pass. The application was not launched to inspect it.
- Byte-level privacy scanning covered 245 files / 492,299,090 bytes, including
  ASCII and both UTF-16 alignments, with no findings. Full public Git history,
  frozen source and extracted ASAR secret scans are clear. Historical 1.4.8/1.4.9
  saved-machine metadata remains in immutable assets/history and was not rewritten.
- Kaspersky 21.26, full bases 2026-09-19 23:14, scanned isolated byte-identical
  copies on 2026-09-20 04:39:02-04:39:19 local: 1,110 processed / 1,110 OK;
  detections, suspicions, skipped, protected, corrupt and error counters all zero.
  Host automatic mode ignored requested report-only. All 245 copies and originals
  stayed hash-identical; no antivirus settings changed. Defender was stopped and
  no Defender scan is claimed.

## Frozen assets

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| ExcelsisHelper-1.4.18-Setup.exe | 94,839,546 | `2AF88DB1C8027DE8DE78F05489DFA6343C503BA831BD771FFCBEA406A564CBB3` |
| ExcelsisHelper-1.4.18-Setup.exe.blockmap | 101,271 | `70435CDE1623C37CB3B254608D8E6302CF4EB7F87E26BAE82075A62E1B2651BC` |
| ExcelsisHelper-1.4.18-source.zip | 1,381,198 | `873F829622A0036A5D56CF67E9FAD259B6DDACA64B2B9A12B45B26B925592CB5` |
| SHA256SUMS.txt | 304 | `F6A3478D256EE02F86281A3EEDF74B5BF14D321DED9A29678F817DB7031BE999` |

Extracted application SHA-256:
`6896BE67EB419760F5EC2A83F7D8032258A42892EA9C92D837AB539946DC1A63`.
ASAR SHA-256:
`C238EA301CCA9EAD3A125B5A1B831A1F08554F4FD51B943E645DB7B4A49087D5`.

## Publication and acceptance limits

Publication uses the protected PR and a new immutable release. Exact-commit
CodeQL, main/Pages workflows, zero open security alerts, draft and fresh public
downloads, signed GitHub release/asset attestations, live page bytes and source
tree are checked before recording final verification on the release PR.
Those remote receipts are pending at this audit commit; no frozen source is
changed to add the final receipt.

Release: [Excelsis Helper 1.4.18](https://github.com/simonsystem609/ExcelsisHelper/releases/tag/excelsis-helper-v1.4.18).
Installer, application, Elevate and macros are unsigned. GitHub attestations
are not Authenticode. Installed upgrades, locked-macro Retry/Later, real
shortcuts, live CAD geometry/unsaved-document behavior, sustained large assembly
stress and uninstall require operator acceptance. Producer-reported live
fixtures are not relabeled as independent tests performed by this reviewer.
