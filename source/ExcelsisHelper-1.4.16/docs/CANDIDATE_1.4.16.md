# Helper 1.4.16 Transfer Evidence

UNAUDITED_TRANSFER_ONLY. Built on 2026-09-10; independent public-release review
is required. This is a complete installer/source candidate, not a patch.

Includes the current Radius outline-corner and unsaved-part fix, both DXF/BOM
folder-opening changes, builder-handoff packaging repairs, and the new
post-install macro-update warning. Earlier 1.4.15 drafts are superseded and
retained unchanged. Do not reapply prior macro patches to this source.

## Build and Checks

- Build: npm.cmd run dist, Electron 42.11.3, electron-builder 27.0.0-alpha.6.
  Package/lock identity excelsis-helper; fixed appId/productName and explicit
  user-data location preserve upgrade identity.
- fast-uri 3.1.7, xmldom 0.8.15 and js-yaml 4.3.2 retained. Fresh full npm
  advisory audit reported zero known vulnerabilities on 2026-09-10. License
  inventory: 193 dependencies. No runtime dependency or fuse change from 1.4.15.
- Complete source tests passed, covering macro launch modules, settings,
  Radius, DXF filters, folder opening, work logging/exports, G-code/machining,
  preview extraction, thumbnail scheduling, EcoQoS and release hardening.
- The real setup-warning and deployment functions pass inert filesystem/dialog
  tests: successful install has no popup, lock preserves prior SWP and version
  marker, Later keeps warnings, released-lock Retry succeeds, persistent lock
  re-prompts, repeated invocation has one dialog, and sidecar errors are shown.
  Installer flag wiring, silent-install gate and second-instance forwarding
  are checked. No SOLIDWORKS process is killed or queried for this flow.
- 28 authored ASAR files and 35 external source resources match source. All
  nine packaged SWPs match source. Runtime scripts use the exact 16-file
  allowlist; no settings, SWB source or build/test tool is packaged.
- All 70 extracted installer payload files match win-unpacked exactly.
  The packaged MPF worker passed its compaction/rewrite/transfer/hash tests.
- All nine Electron fuse slots and embedded ASAR header integrity verified.
  The file-protocol privilege required by loadFile remains enabled.
- Microsoft Defender scanned the exact installer with remediation disabled
  and reported no threats. The installer remains Authenticode NotSigned.
- The resource auditor recognizes the generated NSIS elevate.exe, correcting
  the false failure in the earlier packaging patch without widening the script
  allowlist. Unused runtime files are retained without deletion by afterPack.

## Limits and Deployment

No installer or installed application was launched for this build/transfer.
The native installer-to-app dialog and live SOLIDWORKS/Explorer acceptance
remain for operator testing. Offline tests use inert geometry/Shell/dialog
doubles. The receiver must independently verify runtime startup, upgrade and
macro deployment, corresponding source, security, licensing and privacy.

Interactive setup starts the app as the logged-in user, not the installer
elevation identity. Failed macro/settings deployment displays instructions
to save work and close SOLIDWORKS, with Retry and Later. Later does not record
a failed bundle as current. A refresh or later startup can complete pending
macro deployment. Silent installation stages the optional external settings
file without launching the app or opening the interactive warning.

No private settings file, customer CAD file, build tooling or vendor SDK is
included. Source is an isolated allowlisted export, not a Git-clean claim.
The external source inventory and SHA256SUMS identify its exact bytes.
