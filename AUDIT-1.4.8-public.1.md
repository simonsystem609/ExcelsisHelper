# Excelsis Helper 1.4.8-public.1 release audit

Audit date: 2026-08-07

Decision: **GO for public release, with the unsigned/no-Defender caveats
below**

This is an engineering and open-source-license assessment, not legal advice,
indemnity, or a promise that no third party can ever make a claim.

## Intake and safe repairs

- The transferred ZIP SHA-256 matched its detached checksum:
  `504BF89AC829B2E45E2B072FC02199B41186F30B2ADF3005BEA209FCBE1BCFA3`.
  Its 128 paths and the nested source ZIP were checked for traversal,
  absolute-path, and alternate-stream names before extraction.
- The supplied expanded source and supplied source ZIP contained the same 110
  files byte-for-byte. The transferred installer was treated only as intake;
  the published candidate was rebuilt from audited source.
- The package identity was corrected from the retired combined-project name to
  `excelsis-helper`, stale 1.4.6/retired-repository documentation was corrected,
  and the dependency-license inventory was regenerated.
- Electron was updated within supported major 42 from 42.6.1 to 42.8.1 before
  the clean build. Complete and production npm audits both report zero known
  vulnerabilities.
- Independent VBA recovery found that five compiled SWPs matched their SWB
  sources exactly after container attributes and blank lines were removed.
  Two read-only variants additionally contained repeated leading provenance
  comments. Their SWB files were aligned with those comments; executable VBA
  statements were unchanged. All seven compiled macros now have exact
  corresponding SWB source under that normalization.

## Licensing and provenance

- Excelsis Helper is `GPL-3.0-only`. The root source, packaged identity, bundled
  project license, and NSIS installer license page use that same license.
- Application code, scripts, macros, and icon artwork are project-owned and
  released under GPL-3.0-only. The seven SWPs are build inputs compiled from
  the included project-owned SWB sources; no compiler or vendor SDK is
  distributed.
- Read-only SOLIDWORKS preview extraction is independently authored. The DWG
  preview-table translation retains the pinned DwgThumbnailReader MIT notice,
  upstream file/commit attribution, and exact MIT license text.
- Electron/Chromium, electron-builder, NSIS, Elevate, ResEdit, and every npm
  package are covered by the included notices and generated dependency-license
  inventory. Machining reference data retain source URLs, review dates, and
  conservative-use notes without redistributing source catalogs.
- No nanoPRC, PRC, 3D-PDF decoder, proprietary Adobe implementation, vendor
  SDK/binary, customer file, private research, or settings preset is present.
  The public package preserves the allowed read-only thumbnail functionality.

## Build, tests, and packaged bytes

- A clean install and rebuild used Windows `10.0.26100`, Node.js `24.18.0`, npm
  `11.16.0`, Electron `42.8.1`, and electron-builder `27.0.0-alpha.6`.
- The complete settings, Recent SW, Work Logger, export, G-code privacy,
  machining, preview, thumbnail, EcoQoS, renderer/IPC/process, installer, and
  release-hardening suites passed. JavaScript syntax passed for 50 files and
  PowerShell parsing passed for 10 scripts.
- Installer extraction produced 66 files. All 66 match the clean
  `win-unpacked` tree byte-for-byte.
- The ASAR contains 28 files. All 27 non-package files match source
  byte-for-byte; electron-builder's generated package identity preserves
  `excelsis-helper`, version `1.4.8`, `main.cjs`, `GPL-3.0-only`, and
  `private: true`.
- Production fuses disable RunAsNode, NODE_OPTIONS, and command-line
  inspection; ASAR integrity and ASAR-only application loading are enabled.
  The executable's embedded ASAR header SHA-256 is
  `9dfd18a3f3b99e64a2a28ef7afc4166c894e0a95c7894e6225fa1f43326dfd16`.
- Public source, extracted ASAR, packaged resources, and compiled macros were
  scanned for private identity/path markers, the observed public IP address,
  credentials, private keys, token patterns, forbidden decoder material, and
  settings sidecars. Only generic documentation examples such as
  `C:\Users\you` and `C:\Users\foo` matched.
- Kaspersky `21.26.4.406`, with full bases dated `2026-08-06 20:00`, scanned
  the exact final installer, blockmap, source ZIP, expanded source, unpacked
  payload, and compiled macros in report-only mode. It processed 653 objects:
  zero detections, suspicions, skipped objects, corrupted objects, or errors.

## Corresponding source

- The final expanded public source contains 110 files and excludes
  `node_modules`, `dist`, Git metadata, settings/presets, customer files,
  backups, logs, caches, and private audit/research material.
- Independent extraction of the final source ZIP produced the same 110 paths,
  sizes, and SHA-256 hashes with zero differences.

## Release SHA-256

```text
B0666A71D6D067749A1EEFF143A71EDBABED210CF999A824092CF7482F0C6875  ExcelsisHelper-1.4.8-public.1-Setup.exe
D8CE45A46197B00D656174F565D092481D5DBDEBDF10D73613C3DAAD3EF9EE0C  ExcelsisHelper-1.4.8-public.1-Setup.exe.blockmap
5E522155F1B6956C81170CC18AAC2C35366FAADCAB2D0E26562B9286615D4C70  ExcelsisHelper-1.4.8-public.1-source.zip
```

The installer is `88,810,901` bytes. The packaged application executable is
`222,015,488` bytes with SHA-256
`6FC40ECE8F7B2458DC79E486EFC3F7DB38884E963515A92BC4F2E65FEF3CA1D2`.
The packaged ASAR is `746,145` bytes with SHA-256
`159BBD14C2A181D839E4CACAB3AC9BE0D1CBF69D19324DD9D16F95B875C09C81`.

## Known caveats and follow-up

- The installer, application executable, and Elevate helper are not
  Authenticode-signed. SmartScreen warnings and weaker publisher identity are
  expected. Signing remains recommended when practical.
- Microsoft Defender was disabled on the build machine. No Defender scan is
  claimed; the Kaspersky result above is the malware-scan evidence.
- The installer was audited non-interactively and the unpacked app was not
  launched. Installation, upgrade/config preservation, real SOLIDWORKS macro
  workflows, and uninstall should still be exercised on a disposable Windows
  machine.
- Replace electron-builder with a stable 27.x release when one is available;
  do not downgrade to an audit-regressing 26.x tree solely to remove the
  prerelease label.

## Post-publication verification

- Pull request [#1](https://github.com/simonsystem609/ExcelsisHelper/pull/1)
  passed CodeQL and was merged normally. Release commit
  `5998fc9c8d1a3e82aedf18c44abf2a9ed57956a1` is the exact target of annotated
  tag `excelsis-helper-v1.4.8-public.1` (tag object
  `5dd6c1cb8306e2585733dd559d65185969caa42c`).
- GitHub release `366440207` is published and immutable. Its four uploaded
  assets have the expected names, sizes, and GitHub-reported SHA-256 digests.
  A fresh independent download matched all four staged files byte-for-byte,
  and the downloaded checksum manifest verified all three listed artifacts.
- GitHub's signed release attestation verifies the tag and all four asset
  digests. `gh release verify-asset` also verified each downloaded file
  individually against that release attestation.
- Default-branch CodeQL run
  [31133171764](https://github.com/simonsystem609/ExcelsisHelper/actions/runs/31133171764)
  passed. After publication, open CodeQL, Dependabot, and secret-scanning alert
  counts were all zero.
- Pages deployment
  [31133170743](https://github.com/simonsystem609/ExcelsisHelper/actions/runs/31133170743)
  succeeded at the release commit. The live
  [project page](https://simonsystem609.github.io/ExcelsisHelper/) returned
  HTTP 200 and exposed the 1.4.8-public.1 release, exact installer link, audit,
  support/development-help content, separate Excelsis3D section, and Viewer
  cross-link. The installer URL returned HTTP 200 with content length
  `88,810,901`.
