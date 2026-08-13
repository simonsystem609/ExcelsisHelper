# Excelsis Helper 1.4.9-public.1 release audit

Audit date: 2026-08-14

Decision: **GO for public release, with the unsigned/no-Defender/manual-test
caveats below**

This is an engineering and open-source-license assessment, not legal advice,
indemnity, or a promise that no third party can ever make a claim.

## Intake and safe repairs

- The six-asset private candidate was downloaded through the authenticated
  immutable release, not taken from an untrusted local copy. GitHub release
  attestations verified all six server-reported SHA-256 digests. The candidate
  source ZIP was `1,176,606` bytes with SHA-256
  `B4A25B1733E5F25966B9B3AC4E49BC590B1D85D16E20ECE23534478BE39AD6A6`.
- All 111 source paths were checked for traversal, absolute paths, duplicate
  normalized names, alternate data streams, Git metadata, dependency trees,
  settings sidecars, and focused secret patterns before extraction.
- The public build was made from a separate 111-file staging tree. Package
  identity was restored to `excelsis-helper`; Electron was updated within
  major 42 from 42.6.1 to 42.9.0; notices, tests, and dependency inventory were
  aligned with the final build.
- A stale broad scripts glob was replaced by an explicit 14-file runtime
  allow-list. No build-only or private tooling is present in the source ZIP,
  ASAR, installer, or independently extracted payload.

## Licensing and provenance

- Excelsis Helper is `GPL-3.0-only`. The root source, packaged identity,
  bundled project license, and NSIS installer license page use that same
  license. Exact corresponding source is published with the installer.
- Application code, scripts, macros, tests, and icon artwork are project-owned.
  Eight SWBs provide readable corresponding source for the eight distributed
  SWPs. Independent VBA recovery found the same executable statements in every
  pair; two read-only variants differ only by leading provenance comments.
- SWP performance caches retain older reviewed project-owned macro bytecode;
  the PDF container's cache duplicates the reviewed DXF cache while its source
  stream contains the current PDF exporter. Independent disassembly found no
  network, download, credential, Adobe, PRC, private-tool, or hidden
  third-party behavior. Microsoft's VBA container specification describes the
  performance cache as version-dependent and says it must be ignored on read:
  [MS-OVBA Module Stream](https://learn.microsoft.com/en-us/openspecs/office_file_formats/ms-ovba/c66b58a6-f8ba-4141-9382-0612abce9926).
- Read-only SOLIDWORKS preview extraction is independently authored. The DWG
  preview-table translation retains pinned DwgThumbnailReader file/commit
  attribution, the upstream MIT notice, and exact MIT license text.
- Electron/Chromium, electron-builder, NSIS, Elevate, ResEdit, and all npm
  packages are covered by bundled notices and the generated 193-entry
  dependency-license inventory.
- No nanoPRC, PRC or 3D-PDF decoder, proprietary Adobe implementation, vendor
  SDK/binary, customer file, private research, settings preset, credential, or
  private path is present. The allowed read-only thumbnail functionality is
  preserved.

## Build, tests, and packaged bytes

- The clean build used Windows `10.0.26100`, Node.js `24.18.0`, npm `11.16.0`,
  Electron `42.9.0`, and electron-builder `27.0.0-alpha.6`.
- A fresh `npm ci --legacy-peer-deps` installed 193 dependency packages plus
  the root project. Complete and production-only npm audits both report zero
  known vulnerabilities. The legacy-peer mode omits only the unused Squirrel
  target peer; this project builds NSIS only.
- The complete settings, Recent SW, Work Logger, export, G-code privacy,
  machining, preview, thumbnail, EcoQoS, renderer/IPC/process, installer, and
  release-hardening suites passed. JavaScript syntax passed for 50 files and
  PowerShell parsing passed for 10 scripts.
- The PDF macro was live-tested by the candidate uploader with three selected
  assembly components. The independent public audit did not launch the
  installer or unpacked application.
- Independent installer extraction produced 67 files. All 67 match the clean
  `win-unpacked` tree byte-for-byte.
- The ASAR contains 28 files. All 27 non-package authored files match source
  byte-for-byte; the generated package identity preserves `excelsis-helper`,
  version `1.4.9`, `main.cjs`, `GPL-3.0-only`, and `private: true`.
- All 32 external authored resource pairs match source: 14 runtime scripts,
  eight SWPs, two build resources, six dependency-license texts, the project
  license, and third-party notices. No SWB or settings JSON is in the payload.
- Production fuses disable RunAsNode, NODE_OPTIONS, and command-line
  inspection; ASAR integrity and ASAR-only loading are enabled. The executable
  embeds ASAR-header SHA-256
  `02faf5f6e9eff55535ac2bb1fdfc7f37554a58373fa04e9b0c21e256018d5b45`.
- Source and extracted package scans found no personal/customer identity,
  credential, key/token pattern, private path, settings preset, or forbidden
  decoder material. Gitleaks 8.30.1 found no secrets.
- Kaspersky `21.26.4.406`, with full bases dated `2026-08-13 19:24`, scanned
  the exact final installer, blockmap, checksum manifest, source ZIP, expanded
  source, unpacked payload, and SWP containers in report-only mode with
  iChecker and iSwift disabled. It processed 767 objects: zero detections,
  suspicions, skipped objects, password-protected objects, corrupt objects, or
  errors.

## Corresponding source

- The final expanded public source contains 111 files and excludes
  `node_modules`, `dist`, Git metadata, settings/presets, customer files,
  backups, logs, caches, private audit/research, and build-only tooling.
- Independent extraction of the final source ZIP produced the same 111 paths,
  sizes, and SHA-256 hashes with zero differences.
- The installer deploys SWPs only. Paired SWBs remain in corresponding source
  so recipients can inspect and modify the VBA under GPL-3.0-only.

## Release SHA-256

```text
39812D3DF5C7CC75C6BDE8C4DFAFC5593F1C176C7173C0300FB3ABDAB0106C46  ExcelsisHelper-1.4.9-public.1-Setup.exe
5CEC905A1D10F1FF47305D26D1D6D52D2C20BAF6447FFC28427E1DF46C8E6762  ExcelsisHelper-1.4.9-public.1-Setup.exe.blockmap
E890E84AA2381F8F0806A9709A28DA7A7241A170A1DA60C3F3C9E0F152022E73  ExcelsisHelper-1.4.9-public.1-source.zip
```

The installer is `88,927,912` bytes. The packaged application executable is
`222,257,664` bytes with SHA-256
`18CECD82FA1B74EB777737B34A2E00662BD9CF227509AFD2FC3E595021E1A976`.
The packaged ASAR is `746,342` bytes with SHA-256
`5FD1BF14DC82C0684A569DEEC28D0BBF88D8B77ABD01CBF843569EAF0B085168`.

## Known caveats and follow-up

- The installer, application executable, and Elevate helper are not
  Authenticode-signed. SmartScreen warnings and weaker publisher identity are
  expected. Signing remains recommended when practical.
- Microsoft Defender is disabled on the independent build host. The uploader's
  Defender result is not treated as independent evidence; the Kaspersky result
  above is the release malware-scan gate.
- The installer was audited non-interactively and the unpacked app was not
  launched. Installation, upgrade/config preservation, real SOLIDWORKS macro
  workflows, and uninstall should still be exercised by the user.
- Replace electron-builder with a stable 27.x release when one is available;
  do not downgrade to an audit-regressing 26.x tree solely to remove the
  prerelease label.

## Post-publication verification

- Protected release PR
  [#3](https://github.com/simonsystem609/ExcelsisHelper/pull/3) merged normally
  after CodeQL run `31751315786` passed. The release merge commit is
  `60fbb3e5ca237d54a5ee666b670642d78ba9c915`.
- Annotated tag `excelsis-helper-v1.4.9-public.1` is object
  `96dfac90a36e40df8c493f36bb4846e2f04343db` and dereferences to that exact
  merge commit. Immutable Release ID `370254012` is public, latest,
  non-draft, and non-prerelease.
- GitHub's signed immutable-release attestation validates Release ID
  `370254012`, the exact tag object, and the exact names and SHA-256 digests of
  all four assets. Every independently downloaded asset also passed
  `gh release verify-asset`.
- Fresh unauthenticated downloads of all four public assets matched the
  audited staging files byte-for-byte. The downloaded checksum manifest's
  three entries also passed. The manifest itself is `328` bytes with SHA-256
  `F2F6FF5348D99A35344172E3E907C27B03EFDD2DD5B769C85DAC0EC8D1ACCC46`.
- Release-main CodeQL run `31751434825` and Pages run `31751434275` passed.
  The live HTTPS Pages site returned HTTP 200, exposes the exact 1.4.9
  installer and release/source links, links to ExcelsisView, retains the
  separate Excelsis3D plans/development-help section, and publishes the
  project contact address. The repository description itself contains no
  Excelsis3D wording.
- The repository remains public with `main` as default. Protected `main`
  requires a pull request and a strict successful
  `Analyze (javascript-typescript)` check, enforces protection for admins, and
  rejects force pushes and deletion. Actions SHA pinning is required; default
  workflow permissions are read-only and workflows cannot approve pull
  requests.
- Immutable releases, private vulnerability reporting, vulnerability alerts,
  automated security fixes, Dependabot security updates, secret scanning, and
  push protection are enabled. Open CodeQL, Dependabot, and secret-scanning
  alert counts were all zero after publication. The repository has no
  webhooks, deploy keys, Actions/Dependabot/Codespaces secrets, or Actions
  variables; the owner is the only direct collaborator.
