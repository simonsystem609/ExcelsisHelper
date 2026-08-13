# Release Audit: 1.4.9-public.1

Status: independently rebuilt and audited public-release candidate. Public
publication still requires the protected-branch, release, and remote
verification gates. The installer and unpacked application were not launched
during staging or audit.

## Release Model

- Application version: `1.4.9`; artifact label: `1.4.9-public.1`.
- One preset-free installer serves private and public delivery. A private copy
  may have an external `ExcelsisHelper-settings.json` beside it; this source
  tree and candidate do not contain that file.
- The installer, ASAR, and unpacked resources contain no settings preset.
  Existing settings win on upgrade, silent installation does not launch the
  app, and uninstall preserves both Electron user data and
  `Documents\Excelsis Helper`.
- The isolated source carries the reviewed current product files plus neutral
  release documentation and public-safe test fixtures. No private preset was
  copied into the source or package.

## Included Changes

- Eight finalized SWP macro projects are the only runtime macro payload: both
  BOM variants, `CNCDXF_final_v1`, `CrawlScrews_v1`, both DXF variants,
  `PDF_v1`, and `Radius_v9`.
- The PDF exporter accepts selected parts or faces, an unselected active part,
  and multiple selected assembly components. It resolves each associated
  drawing, exports the correct drawing sheet as PDF, and restores the user's
  SOLIDWORKS window state. Parts without drawings are skipped.
- The DXF variants preserve the established assembly and sheet-metal export
  paths. In an active part, one selected planar face is an explicit export
  request even for a thicker body; measured body thickness is preferred over
  an orientation-dependent bounding-box estimate.
- The app deploys only SWPs. Differing live SWPs are backed up before
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
  auto-skip behavior, and active-document sampling during bounded scans.
- Local milling, face milling, drilling, tapping, MPF geometry analysis,
  editable proposals, time estimates, and verified optimized-copy writing are
  present. AI prompt paths remain basename-only by default and untrusted
  comments require warning and normalization.
- Helper-owned processes retain Normal priority with EcoQoS. Optional incident
  diagnostics remain disabled by default.

## Source And Privacy

- Public source contains 111 files: application and build source, lockfile,
  tests, licenses, eight reviewed SWB sources, and eight build-ready SWPs.
- It excludes `node_modules`, `dist`, Git metadata, settings and presets,
  private audit/recovery/roadmap documents, private build tooling, corpus tools,
  backups, logs, customer files, private paths, and branding beyond the
  project-owned app icon.
- Static and secret scans found no personal, company, customer, credential, or
  private machine-path marker. No PDF document/sample, PRC or 3D-PDF decoder,
  sample MPF, certificate, archive, or unexpected executable is present. The
  only image assets are the project icon PNG and ICO copies.
- `CrawlScrews_v1` remains an opt-in local diagnostic. Both app and macro warn
  before capture that output includes screenshots, absolute CAD paths,
  configurations, and feature names. Nothing is uploaded automatically.
- Corresponding SWB source is included for every distributed SWP. The
  project-authored VBA and SWP projects are maintained as project source; the
  checked-in SWPs are the exact build inputs used by electron-builder.

## Verification

- Fresh lockfile install: 193 dependency packages plus the root project.
- Full regression suite passed: settings, Recent SW suppression, Work Logger,
  export, G-code privacy, machining, MPF rewrite, thumbnails, EcoQoS, IPC,
  process, installer, privacy, and macro-retirement coverage.
- JavaScript syntax: 50/50 files passed. PowerShell parsing: 10/10 scripts
  passed.
- All eight SWBs passed the bounded source validator. Each SWP independently
  recovered complete VBA source whose executable statements match its paired
  SWB; two read-only variants differ only by leading provenance comments.
- The SWP version-dependent performance caches contain older, reviewed
  project-owned macro bytecode. The PDF SWP cache duplicates the reviewed DXF
  cache, while its current source stream contains the PDF exporter that passed
  the uploader's live test. Independent disassembly found no network, download,
  credential, private-tool, Adobe, PRC, or hidden third-party behavior. The
  authoritative source/correspondence gate is therefore favorable.
- The PDF macro was live-verified before staging with three selected assembly
  components; each component's associated drawing exported successfully.
- Complete and production-only npm audits both report zero vulnerabilities.
  The 193-entry dependency-license inventory regenerates deterministically.
- The documented `--legacy-peer-deps` install mode intentionally omits the
  unused Squirrel target peer from electron-builder 27 alpha. This project
  builds only NSIS; the installed direct-dependency tree is otherwise complete.
- Installer extraction: 67/67 files matched `win-unpacked` byte-for-byte.
- ASAR extraction: 27/27 non-package authored files matched source. The
  packaged `package.json` differs only by expected build-time removal of
  scripts and development dependencies. External scripts matched 14/14,
  unpacked machining-engine files 18/18, macros 8/8, build resources 2/2,
  dependency licenses 6/6, plus project license and notices.
- Packaging now uses an explicit 14-file runtime-script allow-list. No
  build-only or private tooling is present in the source archive, ASAR,
  installer, or extracted payload.
- All nine Electron fuses match the production configuration. Embedded ASAR
  integrity hash:
  `02faf5f6e9eff55535ac2bb1fdfc7f37554a58373fa04e9b0c21e256018d5b45`.
- Runtime locale packs are exactly `en-US.pak` and `hu.pak`.
- Gitleaks 8.30.1 found no secrets in either source or extracted package bytes.
- Kaspersky `21.26.4.406`, with full bases dated `2026-08-13 19:24`, scanned
  the final installer, blockmap, checksum manifest, source ZIP, expanded
  source, unpacked payload, and SWP containers in report-only mode with
  iChecker and iSwift disabled. It processed 767 objects with zero detections,
  suspicions, skipped objects, password-protected objects, corrupt objects, or
  errors.
- Microsoft Defender is disabled on the independent public-build host, so no
  Defender result is claimed. The transfer uploader's Defender report is not
  treated as an independent release gate.

## Binary Artifacts

- Installer release filename: `ExcelsisHelper-1.4.9-public.1-Setup.exe`
  - Bytes: 88,927,912
  - SHA-256:
    `39812D3DF5C7CC75C6BDE8C4DFAFC5593F1C176C7173C0300FB3ABDAB0106C46`
  - Authenticode: `NotSigned`
- Blockmap:
  - Bytes: 94,701
  - SHA-256:
    `5CEC905A1D10F1FF47305D26D1D6D52D2C20BAF6447FFC28427E1DF46C8E6762`
- Packaged executable:
  - Bytes: 222,257,664
  - SHA-256:
    `18CECD82FA1B74EB777737B34A2E00662BD9CF227509AFD2FC3E595021E1A976`
  - Authenticode: `NotSigned`
- Packaged `app.asar`:
  - Bytes: 746,342
  - SHA-256:
    `5FD1BF14DC82C0684A569DEEC28D0BBF88D8B77ABD01CBF843569EAF0B085168`
- Packaged `elevate.exe`:
  - Bytes: 33,280
  - SHA-256:
    `BB01CF9F5E651AB16804D37A7269DB932664989C34D26CCD204038995AA8FAD3`
  - Authenticode: `NotSigned`

The release copies the independently rebuilt installer and blockmap under the
`1.4.9-public.1` public filenames without modifying their bytes. Source-ZIP
hashes are recorded outside this source tree so an archive does not attempt to
contain its own hash.

Build environment: Windows `10.0.26100.0`, Node.js `24.18.0`, npm `11.16.0`,
Electron `42.9.0`, electron-builder `27.0.0-alpha.6`.
