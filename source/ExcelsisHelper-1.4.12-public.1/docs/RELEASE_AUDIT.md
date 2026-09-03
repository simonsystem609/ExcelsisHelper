# Public Build Assessment: 1.4.12-public.1

Independent build assessment: 2026-09-03. Final publication and download
verification are recorded in the public repository's `AUDIT-1.4.12-public.1.md`.
This is an engineering and open-source-license assessment, not legal advice or
a guarantee against every defect, vulnerability, or third-party claim.

## Release model and changes

- Application version: `1.4.12`; public release label: `1.4.12-public.1`.
- One preset-free installer serves all deployments. The optional external
  settings sidecar is not embedded or included in corresponding source.
- Existing settings take precedence during upgrades. Uninstall preserves
  user data, work logs, and the user's Helper documents and macro backups.
- Finalized regular and read-only DXF macros use geometry-first classification,
  washer-only imported rejection by default, an optional general filter,
  selected-face handling, solid-body quantities, and restored display state.
- Shared PID-scoped macro markers pause background COM probes and prevent new
  Recent entries during marked runs. Stale/dead-process markers fail open.
- The cumulative 1.4.10/1.4.11 changes retain one self-paced COM watcher,
  bounded Recent maintenance, reversible Show all, and thumbnail rebuilding.
- The app remains GPL-3.0-only. Read-only preview extraction, eight SWPs,
  editable SWBs, Work Logger, CAM tools, and local machining analysis remain.

## Public packaging corrections

- Restored the existing public package identity `excelsis-helper`, retaining
  the installation application ID and product name for upgrade compatibility.
- Replaced the broad scripts resource glob with the reviewed 14-file runtime
  allow-list and an exact-list regression test.
- Updated Electron within major 42 from 42.6.1 to 42.11.1, which includes
  [upstream security fixes](https://releases.electronjs.org/release/v42.11.1).
- Updated locked `@xmldom/xmldom` to 0.8.15 and `fast-uri` to 3.1.7 to clear
  current build-dependency advisories. No application npm runtime dependency
  was added. electron-builder remains the audited 27.0.0-alpha.6.
- Corrected version-specific notices and retained neutral, complete source and
  macro modification instructions. No private development material is shipped.
- Replaced saved-machine paths in all eight SWP metadata records with
  equal-length neutral paths. No VBA source, performance-cache byte, module
  identifier, reference, allocation record, or field length changed. Added a
  binary-encoding regression check so this is not missed by text-only scans.

## Independent verification

- Fresh `npm ci --legacy-peer-deps`, the complete `npm test` suite, generated
  193-entry dependency-license inventory, and `npm run dist` passed.
- Complete and production-only npm audits reported zero known vulnerabilities.
- All 52 JavaScript syntax checks and ten PowerShell parser checks passed.
- All eight SWPs contain executable VBA statements matching their paired SWBs.
  The two read-only variants differ only in comments/formatting. Before the
  metadata correction, six input SWPs were byte-identical to public 1.4.9.
  Every final container retains its exact previously reviewed performance-cache
  bytes. No new hidden executable cache or additional module was introduced.
- All 67 independently extracted installer payload files match the clean
  build. The ASAR contains 29 files; its 28 non-metadata files match source.
  Packaged metadata and all 32 authored external resources also match.
- The runtime deploys only SWPs, not SWBs or a settings sidecar. Editable SWBs
  remain in the corresponding-source archive.
- All nine Electron fuse slots and embedded ASAR-header integrity passed.
- Generated NSIS instructions select the same GPLv3 `LICENSE` that is bundled
  in application resources. Electron/Chromium and third-party notices remain.
- The packaged MPF worker passed direct compaction, rewrite, transfer, and
  source-hash checks.
- Final malware and remote-verification results are recorded in the public
  repository audit, not inferred from the uploader's test report.

## Caveats and follow-up

- The installer, application executable, and elevation helper are unsigned.
  Unknown-publisher/SmartScreen warnings are expected.
- No installer or unpacked application was launched during this audit. Real
  installation, upgrade/config preservation, SOLIDWORKS macro behavior, Recent
  relocation timing, malformed-thumbnail replacement, and uninstall remain
  installed-user acceptance tests.
- Defender is stopped on the independent build host. No independent Defender
  scan is claimed; use the scanner result recorded in the public audit.
- Macro diagnostics stay local and may contain CAD paths or feature names.
  Review them before sharing. No diagnostic output is included in this source.
- Older immutable releases and historical Git revisions were not rewritten.
  Their saved-machine macro metadata is not covered by this release's cleanup.
- Reconsider a stable electron-builder 27.x only in a future audited candidate;
  do not downgrade to an audit-regressing dependency tree.
