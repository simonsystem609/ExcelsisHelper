# Excelsis Helper 1.4.12-public.1 release audit

Audit date: 2026-09-03.

Decision: GO for public release with the unsigned-binary, historical-metadata,
and installed-workflow testing limitations below. This is an engineering and
open-source-license assessment, not legal advice, indemnity, or a guarantee
against every defect, vulnerability, or third-party claim.

## Intake and release selection

The live release inventory was checked first: Helper 1.4.9-public.1 was the
latest public release; neither 1.4.11 nor 1.4.12 had been published. Both newer
six-asset candidates were independently verified using their immutable private
release metadata, signed GitHub release attestations, file sizes, and SHA-256
digests. No external settings sidecar was transferred.

Version 1.4.12 is the cumulative successor, so 1.4.11 was used for comparison
and is not being released separately. The 1.4.12 input source archive was
1,204,177 bytes with SHA-256
`2E3F8595E2DB4E3302DA7E0B561A0F880A5995AAE6A615D5D6387534793B372D`.
Its 113 paths were checked for traversal, duplicate normalized names, absolute
paths, alternate streams, unsafe links, private settings, and generated or
control material before isolated extraction. The supplied installer was not
reused; the public installer was rebuilt from the independently reviewed source.

ExcelsisView 1.1.27 was already public and was not rebuilt or republished.

## Changes and safe release repairs

The cumulative product changes include finalized regular/read-only DXF
filtering, selected-face handling and body quantities; PID-scoped macro markers
that quiet background SOLIDWORKS probes; one self-paced watcher; bounded Recent
maintenance; reversible Show all; and thumbnail rebuilding. Existing local
PDF export, read-only previews, Work Logger, CAM tools, and machining analysis
remain available.

The release audit made these bounded corrections:

- Restored the public package name `excelsis-helper` while retaining the
  installation application ID and product name for upgrade compatibility.
- Replaced a broad scripts resource glob with the reviewed 14-file runtime
  allow-list and an exact-list regression test.
- Updated Electron within major 42 from 42.6.1 to 42.11.1, including
  [upstream security fixes](https://releases.electronjs.org/release/v42.11.1).
- Updated locked `@xmldom/xmldom` to 0.8.15 and `fast-uri` to 3.1.7, clearing
  the current build-dependency advisories. The build-tool version remains
  electron-builder 27.0.0-alpha.6; no application npm runtime dependency was added.
- Corrected version-specific notices and build/source documentation, and
  regenerated the 193-entry dependency-license inventory.
- Neutralized saved-machine paths in all eight SWP containers as described
  below. No application behavior code was changed by these release repairs.

Superseded 1.4.8 and 1.4.9 expanded source trees were removed from the current
branch to avoid presenting old dependency manifests as active source. Their
historical commits, tags, source archives, and immutable releases remain.

## Macro correspondence and metadata correction

Runtime deployment remains SWP-only. All eight editable SWBs are included in
corresponding source. Independent recovery of each SWP's VBA source found the
same executable statements as its paired SWB; the two read-only variants differ
only in comments and formatting. All 16 module performance-cache prefixes are
byte-identical to the previously reviewed 1.4.9 containers. Before metadata
sanitization, six of the eight whole input SWPs were also byte-identical to
1.4.9; the other two contain the updated DXF source.

A deeper Latin-1 and UTF-16 byte scan found saved-machine paths in a metadata
stream of all eight SWPs. The same overlooked class of metadata is present in
all eight 1.4.9 SWPs and all seven 1.4.8 SWPs. This corrects the previous audit's
privacy conclusion: text-only and secret scans did not cover those records.
The finding is local-path metadata, not a discovered credential.

For this release only, each saved path was replaced with equal-length neutral
text while preserving the original macro basename and every field length.
The complete stream set, stream sizes, VBA source, cached-code bytes, module
identifiers, references, and all bytes outside the single metadata record were
verified unchanged. A binary-encoding regression test detects the old records
and passes on the sanitized files.

Older immutable assets and historical Git revisions were not rewritten and
still retain their original metadata. This release does not claim to erase
copies of older files. This metadata-only repair has not been exercised inside
an installed SOLIDWORKS host; that remains an explicit acceptance-test limit.

## Licensing and provenance

- Helper is `GPL-3.0-only`, not the Viewer's AGPL license. Root and packaged
  license files, package metadata, and generated NSIS license-page instructions
  agree. The bundled license is the same GPLv3 text as the corresponding source.
- The archive includes the editable application, scripts, eight SWBs and eight
  build-ready SWPs, build configuration, tests, license inventory, and notices.
  It contains 113 files totaling 3,927,925 uncompressed bytes. The expanded
  repository source and independently re-extracted ZIP match path-for-path and
  byte-for-byte.
- Reviewed provenance and component notices remain in
  [PROVENANCE.md](https://github.com/simonsystem609/ExcelsisHelper/blob/71e18b192563f43e3b81d7fd579c703c2e0bcdf9/source/ExcelsisHelper-1.4.12-public.1/docs/PROVENANCE.md),
  [THIRD_PARTY_NOTICES.md](https://github.com/simonsystem609/ExcelsisHelper/blob/71e18b192563f43e3b81d7fd579c703c2e0bcdf9/source/ExcelsisHelper-1.4.12-public.1/THIRD_PARTY_NOTICES.md),
  and [DEPENDENCY_LICENSES.md](https://github.com/simonsystem609/ExcelsisHelper/blob/71e18b192563f43e3b81d7fd579c703c2e0bcdf9/source/ExcelsisHelper-1.4.12-public.1/docs/DEPENDENCY_LICENSES.md).
  No proprietary vendor SDK, decoder, binary, customer CAD sample, or private
  build-only tooling was found in the reviewed release tree or payload.
- Read-only embedded preview/thumbnail extraction is retained. It does not
  authorize modifying vendor documents or imply vendor affiliation.
- User presets, credentials, settings sidecars, diagnostic logs, private
  research notes, and release-control documents are not distributed.

## Independent build and security evidence

- A fresh `npm ci --legacy-peer-deps`, the complete `npm test` suite, and
  `npm run dist` succeeded. The final full tests and build were repeated after
  macro metadata sanitization. Build host: Node.js 24.18.0, npm 11.16.0.
- Full and production-only npm audits report zero known vulnerabilities at
  the audit time. All 52 JavaScript syntax and ten PowerShell parser checks pass.
- All 67 independently extracted installer files match the clean build.
  The ASAR contains 29 files; all 28 non-metadata files and all 32 authored
  external resources match the audited source. Packaged metadata also matches.
  No SWBs, private settings, or application npm dependency tree is deployed.
- All nine Electron fuse slots match the hardened policy, including disabled
  RunAsNode, Node options and inspect flags, and enabled ASAR integrity and
  OnlyLoadAppFromAsar. Embedded ASAR-header integrity matches the packaged ASAR.
- The packaged MPF worker passes direct compaction, rewrite, transfer, and
  source-hash checks. Application runtime boundaries, macro launch handling,
  read-only preview extraction, watcher changes, Recent cleanup bounds, and
  settings preservation were reviewed with the corresponding regression tests.
- Gitleaks 8.30.1 found zero leaks in the final source, extracted ASAR, and
  recovered VBA source. The deeper final binary/text boundary scan examined
  209 files totaling 300,165,436 bytes with zero flagged findings.
- Kaspersky 21.26.4.406 completed a scan of the exact final installer,
  source ZIP, expanded source, macros, and extracted payload on 2026-09-03,
  13:41:01-13:41:16 local time: 671 processed, 671 OK, zero detections, zero
  suspicions, zero skipped/password-protected/corrupted objects, and zero errors.
  Correction recorded 2026-09-09: report-only was requested, but the preserved
  console output says the scan-action option was ignored in non-interactive
  mode. An enforced report-only scan is therefore not claimed. The reported
  zero-findings result is unchanged. An antivirus scan is evidence, not a
  guarantee of safety. No historical release asset or Git history was rewritten.
- Microsoft Defender is stopped on the build host; no independent Defender
  scan is claimed.

## Exact release assets

Release: [Excelsis Helper 1.4.12-public.1](https://github.com/simonsystem609/ExcelsisHelper/releases/tag/excelsis-helper-v1.4.12-public.1).
The installer is a fresh public build, not the input candidate installer.

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| ExcelsisHelper-1.4.12-public.1-Setup.exe | 94,771,523 | `0E2EC548BA70876FF91F9DABEEB7444BB672CCAF2733C4592B0F10149A17BBC1` |
| ExcelsisHelper-1.4.12-public.1-Setup.exe.blockmap | 101,763 | `10AFC8EA04FC82BE1068067B2AFD3D794978D5F8CDF40D74AA0A8103B8BAD4F3` |
| ExcelsisHelper-1.4.12-public.1-source.zip | 1,204,943 | `D90639A8289A205B5A0403C0BE833D7EA78B746D02E8E548C43A891E5B827914` |
| SHA256SUMS.txt | 331 | `509BBC298E6FFE2C2D3EEEC633639A9F33BD1FFBEF27F924FD9CA85790BBF03C` |

The manifest covers the three payload assets. Application executable SHA-256:
`3A5DC7D7D86FE982C8CDC31C11A694E217E6F85AEA95B4F274F2A35ED5CD60A7`.
Packaged `app.asar` SHA-256:
`3A291DCE688F6B7AC14DA4E339427FAF31F48837C04AE8EC85E038212BC1788E`.

## Publication and verification

Publication uses the protected pull-request path and required CodeQL check,
with no force-push, history rewrite, or protection bypass. Release immutability
is enabled. The publication checklist requires verifying the exact merge/tag
commit, all four uploaded asset names/sizes/digests, fresh public downloads,
the three manifest entries, signed GitHub release/asset attestations, and the
deployed GitHub Pages download links. These checks do not confer Authenticode
signatures on the Windows binaries.

### Completed public verification

The release was published on 2026-09-03 at 12:02:55 UTC as immutable release
ID `381984185`, through [protected PR #5](https://github.com/simonsystem609/ExcelsisHelper/pull/5).
The release merge commit is `71e18b192563f43e3b81d7fd579c703c2e0bcdf9`;
annotated tag object `b9d2dc5f220430e4a65ea53b750bfe66fc60c251` resolves to that
commit. The tag, release, and source/package bytes are not changed by later
audit-documentation commits.

All four draft uploads matched their expected names, sizes, and GitHub digests.
All four fresh unauthenticated public downloads then matched the exact hashes
above, and all three checksum-manifest entries passed. The signed GitHub release
attestation and each of the four individual `verify-asset` checks succeeded.

Release PR CodeQL run `33752424827`, release-main CodeQL run `33752765339`, and
release-main Pages run `33752764089` succeeded. The release-main analysis has
zero CodeQL findings. After the new dependency graph was processed, open
CodeQL, Dependabot, and secret-scanning alert counts were all zero. No alerts
were dismissed to obtain that result.

The live HTTPS Page and public README match the release checkout byte-for-byte.
Page SHA-256: `7305497B57DF085F153606F1CFF99CEAB9F257F93F69AC96392183CD87F82953`.
README SHA-256: `1622D4806992F07C01A697BD72E56C6FF86181AECA196916A0F4ABFD03855A54`.
Exact installer/source/audit links, the Viewer cross-link, contact, support,
and separate Excelsis3D plans/development-help section remain present.

After downloading the named assets, independent verification is available with:

```powershell
Get-FileHash .\ExcelsisHelper-1.4.12-public.1-Setup.exe -Algorithm SHA256
gh release verify excelsis-helper-v1.4.12-public.1 --repo simonsystem609/ExcelsisHelper
gh release verify-asset excelsis-helper-v1.4.12-public.1 .\ExcelsisHelper-1.4.12-public.1-Setup.exe --repo simonsystem609/ExcelsisHelper
```

## Remaining limits and follow-up

The installer, application executable, and elevation helper are unsigned:
Windows may show Unknown Publisher or SmartScreen warnings. No installer or
unpacked application was launched for this audit. Real installation, upgrade
and configuration preservation, SOLIDWORKS macro behavior, Recent relocation
timing, thumbnail replacement, and uninstall remain installed-user acceptance
tests. Diagnostics may contain local CAD paths and must be reviewed before
sharing. Follow up on stable electron-builder 27.x in a future audited candidate;
do not replace it with a dependency tree that reintroduces known advisories.
