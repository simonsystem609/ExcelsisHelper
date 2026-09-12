# Excelsis Helper 1.4.13-public.1 release audit

Audit date: 2026-09-09.

Decision: Published after passing the release gates, with the unsigned-binary,
historical-metadata and installed-workflow limits below. This engineering and
open-source-license assessment is not legal advice or a guarantee against every defect,
vulnerability or third-party claim.

## Intake and release preparation

The public baseline was verified first: 1.4.12-public.1 was already released,
with no 1.4.13 release or open PR. The new immutable private candidate passed
independent repository-control, ZIP-structure, asset-size/hash and signed
GitHub attestation checks. No settings sidecar was transferred. Its 123 source
files passed path, duplicate, link and generated-content checks before extraction.

The input installer was not reused. The public installer was rebuilt with
these bounded release corrections:

- Restored package name excelsis-helper while retaining install application ID
  and product name for upgrade compatibility.
- Restored an explicit 16-script resource allow-list, including two new viewport
  scripts, plus the exact-list regression test.
- Updated Electron 42.6.1 to
  [42.11.3](https://github.com/electron/electron/releases/tag/v42.11.3), restoring
  current reviewed Electron 42 maintenance fixes.
- Restored fast-uri 3.1.7; retained xmldom 0.8.15, js-yaml 4.3.2 and the audited
  electron-builder 27.0.0-alpha.6 build tool.
- Corrected notices/documentation, regenerated the 193-package license inventory,
  strengthened the binary-path test and neutralized a development-only comment.

No application behavior, SWB source or SWP container bytes were changed by
release preparation. Product changes include configurable AutoRadius (Alt+R),
assembly backup, fresh runtime macro settings and lock/read-back warnings,
optional Work Logger/export with Windows-user fallback, manual current-viewport
thumbnails and DXF visibility/Toolbox/thickness improvements. Existing read-only
previews, PDF export, Recent maintenance and machining/MPF features remain.

The previous expanded 1.4.12 source remains in its immutable release and Git
history; only current expanded source is kept on main. Historical audit source
links point to its exact release commit. ExcelsisView was not changed or republished.

## Corresponding source, licensing and provenance

Helper is GPL-3.0-only. Root/source/packaged license text and package metadata
agree. The exact expanded source is at
[source/ExcelsisHelper-1.4.13-public.1/](https://github.com/simonsystem609/ExcelsisHelper/tree/8f48d7faae2c03a03e28daa9a56148d799ceb072/source/ExcelsisHelper-1.4.13-public.1/).
Its 123 files total 4,070,485 bytes; an independently re-extracted ZIP matches
every path, size and SHA-256.

Editable app/scripts/machining code, tests, build configuration, icons, notices,
nine readable SWBs and nine build-ready SWPs are supplied. All 193 npm entries
are build-only, with registry source URLs, SHA-512 integrity pins and license
metadata. No npm dependency is deployed as an application runtime module.

Unchanged artwork, machining data and existing third-party integrations retain
their reviewed provenance. New scripts and the assembly backup macro are
project-authored API interoperability. DwgThumbnailReader retains its documented
MIT upstream pin. Electron/Chromium, NSIS and Elevate notices are preserved. See
[PROVENANCE.md](https://github.com/simonsystem609/ExcelsisHelper/tree/8f48d7faae2c03a03e28daa9a56148d799ceb072/source/ExcelsisHelper-1.4.13-public.1/docs/PROVENANCE.md),
[THIRD_PARTY_NOTICES.md](https://github.com/simonsystem609/ExcelsisHelper/tree/8f48d7faae2c03a03e28daa9a56148d799ceb072/source/ExcelsisHelper-1.4.13-public.1/THIRD_PARTY_NOTICES.md)
and [DEPENDENCY_LICENSES.md](https://github.com/simonsystem609/ExcelsisHelper/tree/8f48d7faae2c03a03e28daa9a56148d799ceb072/source/ExcelsisHelper-1.4.13-public.1/docs/DEPENDENCY_LICENSES.md).

Read-only preview extraction is retained. No vendor SDK, proprietary CAD runtime
or model decoder, customer document, deployment preset, credential, diagnostic
bundle, operational control document or private build tooling is distributed.

## Macro and privacy evidence

All nine SWPs recover to the executable statements in their paired SWBs. The
two read-only variants differ only in comments and formatting. All 18 module
performance-cache prefixes match previously reviewed project-owned bytes.

The received macros already contain neutral host paths. Independent Latin-1
and both-alignment UTF-16 checks pass; no macro bytes were changed during release
preparation. Structural correspondence is not live macro-loading or geometry
acceptance. Older immutable 1.4.8/1.4.9 releases and historical Git objects
retain original saved-machine metadata and are not claimed path-free.

Gitleaks 8.30.1 found zero leaks in final source and extracted ASAR. A bounded
independent byte scan covered 236 files and 491,657,290 bytes across frozen
assets/source, installer extraction, payload and ASAR extraction: zero findings
in Latin-1 and both UTF-16 alignments. Six chunk-boundary tests verified
split-marker detection. Private release-control files and build logs are excluded.

## Independent build, tests and packaged bytes

- Clean npm ci with legacy-peer-deps, ignore-scripts and no-audit, then the
  non-launching Windows x64 NSIS build passed with Node.js 24.18.0/npm 11.16.0.
  electron-builder fetched checksum-verified Electron bytes during packaging.
- Full and production npm audits reported zero vulnerabilities at audit time.
  The complete npm suite, 58 JavaScript syntax checks and ten PowerShell parser
  checks passed. The license inventory was regenerated from the exact lockfile.
- Tests cover settings synchronization, deployment locks/read-back failures,
  Work Logger enable/disable/export, Recent maintenance, machining/MPF behavior,
  preview limits, thumbnail scheduling and release hardening. EcoQoS/Normal
  priority checks used a disposable process.
- DXF predicates ran against synthetic Windows VB geometry doubles. Viewport
  tests substitute VBScript objects and do not attach to live SOLIDWORKS.
  Framing, aspect ratio, failed capture, document mismatch/switching, aliases,
  persistence and single-flight behavior passed offline checks.
- All 70 extracted installer payload files match the clean build. ASAR has
  package metadata plus 28 source-matching authored files. All 35 external
  authored resources match, including 16 approved scripts and nine SWPs.
  SWBs, build/test tools, presets and npm runtime dependencies are not deployed.
- All nine Electron fuse values and embedded ASAR-header SHA-256 pass. Sandbox,
  context isolation, content policy, trusted IPC and navigation limits remain.
  File-protocol privileges stay enabled for BrowserWindow.loadFile().
  Locales are only en-US/hu, and all required component notices are present.
- The extracted packaged MPF worker passes compaction, rewriting, transfer and
  source-hash tests.

Application executable SHA-256: 0D61D48659766C58D21AB88437EBA42F2A53289F4CF342E8104536A148358C73.

Packaged ASAR SHA-256: D76C8DEBEDE743AF9A2A329A36551752E7B12F2C574BDA230E6DCF2C0BF61F8F.

## Malware scan

Kaspersky 21.26 completed a cache-bypassed all-file scan of byte-identical
isolated copies of the exact release/source and extracted artifacts.
Bases: 2026-09-08 20:34; scan: 2026-09-09 01:27:07-01:27:26 local time.
Result: 1,087 processed, 1,087 OK, zero detections, suspicions, skipped,
password-protected or corrupted objects, and zero errors.

Report-only was requested, but Kaspersky warned that automatic-action mode
ignored that option. This is not claimed as an enforced report-only scan.
Frozen release files were not scan targets; all 236 scan-copy files were
hash-verified unchanged afterwards. No antivirus setting changed.
Microsoft Defender is not running and is not claimed as independent evidence.
Antivirus results are evidence, not a guarantee of safety.

## Exact release assets

Release: [Excelsis Helper 1.4.13-public.1](https://github.com/simonsystem609/ExcelsisHelper/releases/tag/excelsis-helper-v1.4.13-public.1).

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| ExcelsisHelper-1.4.13-public.1-Setup.exe | 94,793,750 | 82147CE2C70FF68ACEAE8CB65FF7E48F77CF1A1787D9DAF2C7205C781955F69B |
| ExcelsisHelper-1.4.13-public.1-Setup.exe.blockmap | 101,443 | 147418108526539F8B17596225AE494EC7EDA470A6B09B0A96D8DE01C0553772 |
| ExcelsisHelper-1.4.13-public.1-source.zip | 1,257,887 | 98794BD4F163735BCC0ABED4C0B8EBFBD08985F7B844C48C11BC60CADC7C3837 |
| SHA256SUMS.txt | 331 | 4AEC1372FC5ED1B06F50F1977B05D04E79F994F624C335BB02A69FB5795A0A5A |

The manifest covers the three payload assets. The rebuilt installer and source
archive correspond to the same frozen source, not the unaudited input binary.

## Publication and remote verification

Publication uses a protected PR, the required up-to-date CodeQL check, an
annotated release tag and immutable release. No force-push, history rewrite or
protection bypass is used. Required checks cover exact merge/tag/source-tree,
four uploaded asset sizes/digests, draft downloads, fresh unauthenticated public
downloads, checksum entries, release/asset attestations, deployed Pages links
and current security alerts.

Completed verification on 2026-09-09:

- Protected [PR #7](https://github.com/simonsystem609/ExcelsisHelper/pull/7)
  merged as `8f48d7faae2c03a03e28daa9a56148d799ceb072` after its required
  CodeQL checks passed. No protection bypass or history rewrite was used.
- Annotated tag `excelsis-helper-v1.4.13-public.1`, object
  `b554d953296fa300d9fca88c2a14bc7c867681be`, resolves to that merge commit.
  The exact `source` tree is `15fa9123bf202e03d1a232fa482b1e39ef3c20fe`.
- Release ID `385129981` was published at `2026-09-08T23:48:39Z` and is the
  latest immutable, non-prerelease release.
- All four server-side asset sizes/SHA-256 digests and independent draft
  downloads matched the frozen files before publication. Fresh unauthenticated
  public downloads then matched all four sizes/hashes and all three checksum
  manifest entries.
- GitHub CLI verified the signed release attestation and each of its four
  downloaded assets. The attestation binds the annotated tag object and exact
  asset digests. These are not Windows Authenticode signatures.
- Release-main
  [CodeQL run 34291939646](https://github.com/simonsystem609/ExcelsisHelper/actions/runs/34291939646)
  and [Pages run 34291939070](https://github.com/simonsystem609/ExcelsisHelper/actions/runs/34291939070)
  succeeded. Main analysis `1744686029` has zero results and no error.
  Open CodeQL, Dependabot and secret-scanning alert counts are each zero.
- The live HTTPS page, remote README, audit and checksum manifest matched
  repository bytes. The page retains the installer/release/source/audit links,
  Viewer link, public contact, support and separate Excelsis3D section.
  Page SHA-256: C923795740A887AEC89A3B88E620622DB0091942D45AE7132EE5E75509CE7A93.
  README SHA-256: 1A6499819C35F3A9AAA18362177C84CEBAC13755F4B2669047FD2827D1D9B2BB.
- Strict up-to-date PR checks, administrator enforcement, conversation
  resolution, no force-push/deletion, read-only Actions defaults, full-SHA
  action pinning and HTTPS Pages from main remain in effect.

This verification-record update changes documentation only; the release tag,
assets and corresponding source are unchanged.

## User-controlled acceptance

Installer, application and elevation helper are unsigned. No installation,
unpacked app launch, live macro execution or CAD-document modification was
performed by this audit. User acceptance still covers upgrade/settings/log
preservation, AutoRadius selections, assembly backup, changed material/BOM
language between macro runs, hidden/Toolbox DXF output, manually framed viewport
retry, real macro loading and uninstall.

Review locally generated diagnostics before sharing. Stable electron-builder
27.x remains future maintenance; do not downgrade to an audit-failing graph.
