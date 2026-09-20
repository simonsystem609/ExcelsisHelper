# Excelsis Helper 1.4.17 release audit

Audit date: 2026-09-19. This record applies to the exact artifacts below, not to
all historical releases or arbitrary rebuilds. Local checks passed before the
protected release PR. Remote publication checks are described separately below.

## Release scope and provenance

The supplied update adds configurable macro shortcuts (Alt+R Radius and Alt+D
DXF defaults), legacy binding migration, validation and foreground/overlap
guards. DXF changes cover captured selection/configuration scope, conservative
preflight, missing-only export by default, optional output subfolders and
per-candidate owned-document cleanup. Alt+S stops at cooperative checkpoints;
it cannot interrupt a blocked native CAD call.

Release preparation changed seven comment/documentation files to refresh
stale release information and remove build-only implementation references.
No application behavior or macro bytes were changed. No prior patch was
reapplied. Installer identity, user-data identity, preset-free behavior and
the explicit 16-runtime-script allow-list are preserved.

The exact expanded source is
[source/ExcelsisHelper-1.4.17/](https://github.com/simonsystem609/ExcelsisHelper/tree/3fd90f4b9cb9f8a5df4efba2a8bd096941b0ada7/source/ExcelsisHelper-1.4.17/): **131 files,
4,305,158 bytes**, byte-identical to the source ZIP contents and the frozen
build inputs. It includes source, build configuration, lockfile, tests, notices,
nine compiled SWPs and their readable SWBs. Build dependencies and generated
outputs are not included in that source archive.

Helper remains GPL-3.0-only. Reviewed license/artwork/machining/preview files
(29 files) match the preceding audited release. Read-only embedded thumbnail
extraction remains independently authored; this does not introduce model,
geometry or proprietary decoder functionality. No vendor SDK, vendor sample,
customer document, real-world preset or settings sidecar is included.

See [PROVENANCE.md](https://github.com/simonsystem609/ExcelsisHelper/blob/3fd90f4b9cb9f8a5df4efba2a8bd096941b0ada7/source/ExcelsisHelper-1.4.17/docs/PROVENANCE.md),
[THIRD_PARTY_NOTICES.md](https://github.com/simonsystem609/ExcelsisHelper/blob/3fd90f4b9cb9f8a5df4efba2a8bd096941b0ada7/source/ExcelsisHelper-1.4.17/THIRD_PARTY_NOTICES.md),
[DEPENDENCY_LICENSES.md](https://github.com/simonsystem609/ExcelsisHelper/blob/3fd90f4b9cb9f8a5df4efba2a8bd096941b0ada7/source/ExcelsisHelper-1.4.17/docs/DEPENDENCY_LICENSES.md)
and [BUILDING.md](https://github.com/simonsystem609/ExcelsisHelper/blob/3fd90f4b9cb9f8a5df4efba2a8bd096941b0ada7/source/ExcelsisHelper-1.4.17/docs/BUILDING.md).

## Independent build and regression checks

- Clean dependency installation and non-launching Windows NSIS build passed
  with Node 24.18.0 and npm 11.16.0. Dependency pins are unchanged, including
  Electron 42.11.3 and electron-builder 27.0.0-alpha.6. The existing prerelease
  builder is retained as a documented maintenance limitation, not silently
  replaced with an audit-failing version.
- Full tests, **64 JavaScript syntax checks** and **12 PowerShell parses** pass.
  Full and production dependency audits each report **zero vulnerabilities**.
- All 193 locked build packages reconcile with the generated license inventory,
  registry/integrity metadata and reviewed license expressions. No unexpected
  install hooks were introduced. These build packages are not shipped as an
  application node_modules tree.
- Isolated headless Chrome shortcut UI tests pass defaults, add/save/remove,
  reset, notes, language, disable and import/export cases, including responsive
  layout assertions at widths 1180, 920, 640 and 390. No browser page errors.
- Synthetic native-dispatch and DXF geometry/lifecycle tests pass. These use
  test boundaries, not live keyboard hooks, CAD documents or SOLIDWORKS.
- All **nine SWP/SWB executable statement sets** match. All **18 cached-code
  prefixes** match the previously reviewed baseline. Compiled macro metadata
  contains no detected private saved-machine paths. Macro bytes are exactly
  those supplied for this release.

## Packaged-byte and hardening checks

The installer was extracted without running it. All **70 application payload
files / 295,325,034 bytes** match the clean build. The ASAR has 29 files (28
exact authored files plus package metadata); all 35 external authored resources
match source, including the 16 allowed scripts and nine SWPs. SWBs, build/test
tooling, personal settings and logs are absent from the application payload.

All nine Electron fuse assertions, embedded ASAR integrity and the packaged
MPF worker test pass. Twenty existing native/runtime files match the previous
audited package. Unused optional GPU components were excluded under the
existing packaging policy. No installer or unpacked application was launched.

## Privacy, secrets and malware

Gitleaks reports no findings in the public Git history, frozen source or
extracted ASAR. Final public-checkout/staged-history checks are required before
push. Git author identities use the existing public noreply identity.

The final boundary scan covered **244 files / 492,091,834 bytes** across frozen
source/assets, extracted application/ASAR and installer contents. It found no
configured private-path, credential, customer-data or prohibited-content
markers in Latin-1 or either byte alignment of UTF-16LE. Six cross-chunk scanner
self-tests pass. This is scoped evidence, not a claim that pattern matching
can prove the absence of every possible secret.

Kaspersky 21.26 scanned byte-identical isolated copies of that same set on
2026-09-19, 20:08:32-20:10:23 local time, using bases dated 2026-09-19 15:27:00.
It reported **1,106 processed / 1,106 OK**; detections, suspicions, skipped,
password-protected, corrupted and errors were all **zero**. Exit code was zero.
Report-only mode was requested but ignored by the host's automatic mode. All
244 scan copies and all originals were rehashed afterward and were unchanged.
Microsoft Defender was not running on this host; no independent Defender scan
is claimed. Antivirus results do not guarantee future detection outcomes.

Historical 1.4.8/1.4.9 immutable artifacts and Git revisions retain their
original saved-machine metadata. They were not rewritten. Neutral paths and
privacy findings in this audit apply to this release, not all history.

## Frozen public assets

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| ExcelsisHelper-1.4.17-Setup.exe | 94,823,584 | `14B6740577F17798588D42AF0282B913837EA7C0BF1D4F521F056F29D9477513` |
| ExcelsisHelper-1.4.17-Setup.exe.blockmap | 101,438 | `4DB002A7D6690973B4527B5CE44C831C54034C5B9C8E2A111F91A7B027905D10` |
| ExcelsisHelper-1.4.17-source.zip | 1,342,857 | `8F24BE4B200814C9ACB85C7F4E4C1ADC735AB57A053D2FE66A5583EEEEE985ED` |
| SHA256SUMS.txt | 304 | `A2F3AE3D3926855362967CF344DA980B84AF0C9382AC14B69F854C11E33E72EB` |

The manifest covers the three payload assets. Extracted application SHA-256:
`C3DB7A4316E1F285E587E7C63934ADD966AD39E37D5FFE997B5C1844F02CE025`.
ASAR SHA-256:
`75D3D2AEAFAD12F43ACF54D8F493C5474779EA6D1B27F22B419754D6E6320066`.

## Publication checks and acceptance limits

Publication requires the protected PR's CodeQL check, exact merge/tag/source
identity, four verified draft assets and a successful main CodeQL analysis.
After publication, fresh unauthenticated downloads must match all asset sizes,
SHA-256 values and manifest entries. The immutable release and each asset must
pass signed GitHub attestation verification. The live Pages deployment and
download links must match the release commit; open CodeQL, Dependabot and
secret-scanning counts must be zero. Final remote verification is recorded
on the release PR after these checks, without changing the frozen source.

Release: [Excelsis Helper 1.4.17](https://github.com/simonsystem609/ExcelsisHelper/releases/tag/excelsis-helper-v1.4.17).

Installer, application and Elevate are **unsigned**. GitHub attestations do not
replace Authenticode; Windows SmartScreen may warn. Installed upgrade/settings,
real shortcuts, actual DXF geometry and document cleanup, long-running native
calls, and uninstall require user acceptance. Offline/static tests do not
establish those live workflows. No such acceptance is claimed here.
