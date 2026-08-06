# Release Audit: 1.4.8-public.1

Status: rebuilt public-release candidate; not committed, pushed, tagged, or
published at audit time. The unpacked application was not launched during
staging or audit.

## Release Model

- Application version: `1.4.8`; public artifact label: `1.4.8-public.1`.
- One preset-free installer serves private and public delivery. The private
  copy may have an external `ExcelsisHelper-settings.json` beside it; this
  public source and transfer bundle do not contain that file.
- The installer, ASAR, and unpacked resources contain no settings preset.
  Existing settings win on upgrade, silent installation does not launch the
  app, and uninstall preserves both Electron user data and
  `Documents\Excelsis Helper`.
- The installer was built from common 1.4.8 product source. Every packaged
  authored file matches that source. Isolated public staging differs only in
  public documentation and a test assertion that requires the deployment
  sidecar to be absent.

## Included Changes

- Seven finalized compiled macros replace the prior runtime SWB conversion
  flow: both BOM variants, `CNCDXF_final_v1`, `CrawlScrews_v1`, both DXF
  variants, and `Radius_v9`.
- The app deploys only compiled SWPs. Differing live SWPs are backed up before
  replacement. A fixed obsolete SWB/Test1 filename set is moved into a
  timestamped external backup and retried on failure; it is never deleted.
- Macro execution publishes the shared run marker so temporary SOLIDWORKS
  documents do not enter Recent SW. The Recent SW burst cutoff remains
  configurable.
- Recent SW and Document Search retain bounded thumbnail scheduling, newest-20
  priority, 50-entry initial rendering, full search/Show all access, document
  type badges, and `Copy path` plus `Copy document name` context actions.
- Work Logger retains unsaved Save As carryover after at least one minute,
  regular/overtime separation at the configurable default 17:00 boundary,
  shared cutoff/rounding rules, the 0.5-hour ERP entry floor, manual-export
  auto-skip behavior, and active-document sampling during bounded full-document
  scans.
- Local milling, face-milling, drilling, tapping, MPF geometry analysis,
  editable proposals, time estimates, and verified optimized-copy writing are
  present. AI prompt paths remain basename-only by default and untrusted
  comments require warning/normalization.
- Helper-owned processes retain Normal priority with EcoQoS. Optional incident
  diagnostics remain disabled by default.

## Source And Privacy

- Public source contains 110 files: common application/build source, lockfile,
  tests, licenses, seven reviewed SWB sources, and seven build-ready SWPs.
- It excludes `node_modules`, `dist`, Git metadata, settings/presets, private
  audit/recovery/roadmap documents, compiler research, corpus tools, backups,
  logs, customer files, private paths, and branding beyond the project-owned
  app icon.
- Static scans found no personal/company/customer marker, credential pattern,
  private machine path, compiler/research identifier, PDF/PRC material, vendor
  binary, or unexpected image. The only image assets are the project-owned PNG
  and ICO app icon copies.
- `CrawlScrews_v1` remains an opt-in local diagnostic. Both app and macro warn
  before capture that output includes screenshots, absolute CAD paths,
  configurations, and feature names. Nothing is uploaded automatically.
- Corresponding SWB source is included for every distributed SWP. The
  development compiler is not distributed; the checked-in SWPs are the build
  inputs used by electron-builder.

## Verification

- Fresh `npm ci`: 193 dependency packages plus the root project. Electron was
  updated within major 42 from 42.6.1 to security-patched 42.8.1 before the
  clean rebuild.
- Full private and isolated-public test suites: passed.
- Settings, Recent SW suppression, Work Logger, export, G-code privacy,
  machining, MPF rewrite, thumbnails, EcoQoS, IPC/process/installer hardening,
  and macro retirement coverage: passed.
- JavaScript syntax: 50/50 files passed. PowerShell parsing: 10/10 scripts
  passed.
- All seven SWBs passed the bounded source validator. Each SWP independently
  recovered complete VBA source matching its corresponding SWB after removal
  of VBA container attributes and insignificant blank lines. Two source files
  were aligned with duplicated leading provenance comments found in their
  compiled projects; executable VBA statements were unchanged.
- Fresh npm audit initially identified the new high-severity `js-yaml` 4.x
  `!!omap` advisory in electron-builder's build-only tree. The lock now pins
  patched `js-yaml` 4.3.1; complete and production audits both report zero
  vulnerabilities.
- Installer extraction: 66/66 files matched `win-unpacked` byte-for-byte.
- ASAR extraction produced 28 files; 27/27 non-package authored files matched
  source. Generated
  package identity fields match source. External scripts matched 14/14,
  unpacked machining-engine files 18/18, macros 7/7, build resources 2/2,
  dependency licenses 6/6, plus project license and notices.
- All nine Electron fuses match the production configuration. Embedded ASAR
  integrity hash:
  `9dfd18a3f3b99e64a2a28ef7afc4166c894e0a95c7894e6225fa1f43326dfd16`.
- Runtime locale packs are exactly `en-US.pak` and `hu.pak`.
- Microsoft Defender was disabled on the public build host and is not claimed
  as release evidence. The exact antivirus result is recorded in the public
  release audit beside the final artifact hashes.

## Binary Artifacts

- Installer release filename:
  `ExcelsisHelper-1.4.8-public.1-Setup.exe`
  - Bytes: 88,810,901
  - SHA-256:
    `B0666A71D6D067749A1EEFF143A71EDBABED210CF999A824092CF7482F0C6875`
  - Authenticode: `NotSigned`
- Blockmap:
  - Bytes: 92,256
  - SHA-256:
    `D8CE45A46197B00D656174F565D092481D5DBDEBDF10D73613C3DAAD3EF9EE0C`
- Packaged executable:
  - Bytes: 222,015,488
  - SHA-256:
    `6FC40ECE8F7B2458DC79E486EFC3F7DB38884E963515A92BC4F2E65FEF3CA1D2`
  - Authenticode: `NotSigned`
- Packaged `app.asar`:
  - Bytes: 746,145
  - SHA-256:
    `159BBD14C2A181D839E4CACAB3AC9BE0D1CBF69D19324DD9D16F95B875C09C81`
- Packaged `elevate.exe`:
  - Bytes: 33,280
  - SHA-256:
    `BB01CF9F5E651AB16804D37A7269DB932664989C34D26CCD204038995AA8FAD3`
  - Authenticode: `NotSigned`

The transfer bundle renames the byte-identical installer and blockmap with the
`1.4.8-public.1` label. Source-ZIP and checksum hashes are recorded externally
in the transfer folder so the source archive does not attempt to contain its
own hash.

Build environment: Windows `10.0.26100`, Node.js `24.18.0`, npm `11.16.0`,
Electron `42.8.1`, electron-builder `27.0.0-alpha.6`.
