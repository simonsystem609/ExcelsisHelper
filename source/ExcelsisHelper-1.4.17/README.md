# Excelsis Helper 1.4.17

SOLIDWORKS workflow helper for recent documents, document search, macro running,
work logging, CAM tools, local G-code analysis and embedded thumbnail previews.
Project-owned source and macros are GPL-3.0-only. See LICENSE,
THIRD_PARTY_NOTICES.md and docs/PROVENANCE.md for attribution and provenance.

## Release Contents

Complete, preset-free source and build-ready macro artifacts.
Do not reapply earlier separate macro patches to this version.
The installer includes all nine current compiled macros and the app changes.

Settings now supports adding/removing macro shortcuts. Defaults are
Radius_v9.swp on Alt+R and regular DXF_v16.swp on Alt+D. Saved bindings appear
in Macro Runner. Legacy custom Radius bindings migrate; duplicates are rejected.
Shortcuts retain SOLIDWORKS foreground gating and do not raise Helper. They
reuse the existing helper and macro run gate, with no new polling or process.

Both DXF variants freeze selections before export, preserve configuration and
visibility scope, clean up owned document windows per candidate, and support
cooperative Alt+S cancellation. Import scope is explicitly prompted on every
route. Early Toolbox and obvious non-sheet checks avoid opening parts when
loaded data is sufficient. Missing-only export defaults to Yes; immediate-parent
assembly/configuration subfolders are opt-in. Existing DXFs are not rewritten
in missing-only mode. Unknown geometry defers to the existing detailed checks.

DXF opens its actual output folder on successful export; BOM opens the starting
assembly root. Macro settings are reread each run. Existing thumbnail capture,
work logging, machining tools, Normal priority and EcoQoS remain included.

## Build and Settings

On Windows with Node.js 22.12 or later:

```powershell
npm.cmd ci --legacy-peer-deps
npm.cmd test
npm.cmd run dist
```

Electron remains 42.11.3 with the existing security fuses and sandbox/IPC
restrictions. Exactly 16 runtime scripts are packaged. All nine SWPs have
readable SWB sources here; the supplied build-ready SWPs are used directly
when packaging the installer.

The installer upgrades the existing Helper identity and preserves app data.
Existing settings stay authoritative. Optional external
ExcelsisHelper-settings.json uses Settings > Import/Export format. It is not
included in this source or installer. Differing installed macros are backed up.
Interactive setup starts the de-elevated app with --after-install. Locked macro
updates request save-work/close-SOLIDWORKS with Retry or Later; nothing is
force-closed. Silent installations remain non-interactive.

See docs/BUILDING.md and docs/RELEASE_AUDIT.md. The producer's candidate notes
are retained separately. Offline tests do not establish live CAD behavior;
operator acceptance remains necessary.
