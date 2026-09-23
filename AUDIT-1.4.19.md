# Excelsis Helper 1.4.19 release audit

Audit date: 2026-09-23. This record applies to the immutable 1.4.19 release
artifacts named below. Engineering/public-boundary decision: GO for a protected
public release after required GitHub checks and remote-byte verification. This
is not legal indemnity or installed SOLIDWORKS acceptance.

## Scope and corresponding source

The reviewed, cumulative selected-quantities macro/source/test delta was
allow-list-integrated with the exact public 1.4.18 application source in isolated
staging. No producer installer, settings sidecar, private product workspace,
customer document or operational preset was transferred. Both DXF variants now
count selected component occurrences and deduplicate overlapping selections;
uncertain identity or failed child/configuration reads stop incomplete selected
exports. Full-assembly behavior and earlier DXF corrections remain.

The nine SWP executable statement sets match their readable SWB sources. Only
the two DXF source streams changed from the 1.4.18 macro baseline; reviewed
cached-code prefixes and neutral container metadata remained unchanged. The
prior 1.4.18 licensing/provenance assessment applies to unchanged dependencies,
thumbnail extraction, artwork, machining data and application modules.

Exact corresponding source: [source/ExcelsisHelper-1.4.19/](source/ExcelsisHelper-1.4.19/),
132 files / 4,435,787 bytes, matching the source archive. Project-owned code
and macros are GPL-3.0-only. All 193 locked build dependencies and 29
provenance-sensitive files were checked against the public baseline. See the
source [provenance](source/ExcelsisHelper-1.4.19/docs/PROVENANCE.md),
[notices](source/ExcelsisHelper-1.4.19/THIRD_PARTY_NOTICES.md),
[dependency licenses](source/ExcelsisHelper-1.4.19/docs/DEPENDENCY_LICENSES.md)
and [build instructions](source/ExcelsisHelper-1.4.19/docs/BUILDING.md).

## Verification and limits

- Clean locked dependency install; full tests and full/production dependency
  audits pass with zero known vulnerabilities. The installer was independently
  built from the frozen source. Extracted runtime: 70 files / 295,346,026 bytes,
  matching the clean build. All 29 ASAR files, 35 authored external resources,
  nine bundled SWPs, runtime allow-list, fuses and ASAR integrity pass.
- Source ZIP, expanded source, installer, blockmap and manifest correspond
  exactly. Privacy scan: 245 files / 492,318,357 bytes, zero findings.
  Kaspersky 21.26: 1,110 objects OK, zero detections, suspicions, skips,
  password-protected objects, corruption or errors; copied inputs and
  originals stayed unchanged. Report-only was requested but not assumed.
- Macro-focused tests and full suite passed in isolated staging; no live
  SOLIDWORKS selected-quantity, install/upgrade or locked-file acceptance is
  claimed. First-party binaries and macros remain unsigned. Defender was not
  running on the audit host and is not claimed.

## Immutable release payloads

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| `ExcelsisHelper-1.4.19-Setup.exe` | 94,840,169 | `9416F26B08C9F085A0968593625FF5A0E1E12A26E93AA49B94475D6BBAC1B4F6` |
| `ExcelsisHelper-1.4.19-Setup.exe.blockmap` | 101,342 | `2BF4C211BC837F43E80B239EF71D21AE44AA1BBA4E10A15E8D07333D8D676516` |
| `ExcelsisHelper-1.4.19-source.zip` | 1,384,698 | `FD26373C4B370512D5D12195BC806AE898082F8212EA0244CCC13CB3810ED832` |
| `SHA256SUMS.txt` | 304 | `1A3DF2FC7EB1BFE4A8F513A5A0A5FC60A0C5AB2B48334C7B492171FAD7B1B8E4` |

Future macro-only revisions will use a separate immutable prerelease channel,
with an explicit compatible Helper version and corresponding SWB source.
They do not alter this installer or its source tree.
