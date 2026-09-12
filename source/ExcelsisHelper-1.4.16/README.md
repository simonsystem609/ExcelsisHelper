# Excelsis Helper 1.4.16

SOLIDWORKS workflow helper for recent documents, document search, macro running,
work logging, CAM tools, local G-code analysis and embedded thumbnail previews.
Project-owned source and macros are GPL-3.0-only. See LICENSE,
THIRD_PARTY_NOTICES.md and docs/PROVENANCE.md for attribution and provenance.

## Release Contents

Complete, preset-free application source. The corresponding installer includes
the current Radius outline-corner
and unsaved-part fixes, DXF/BOM export-folder changes, and packaging repairs.
Do not apply earlier separate macro patches on top of this version.

Interactive setup launches the de-elevated app with `--after-install`. If macro
or runtime-settings deployment fails, a native warning asks the user to save
work, close SOLIDWORKS and Retry. Later keeps the update pending; it does not
force-close a process. Successful updates show no warning. Silent installs
remain non-interactive. The user's real Documents folder is resolved by the
app, not the elevated installer.

DXF opens its actual output root after a successful export and report dismissal
(dxf_precut for precut exports). BOM opens the starting assembly root after a
successful BOM or cutlist workbook export. Folder-opening failures do not fail
completed exports. Existing export filters and geometry are unchanged.

The runtime uses Electron 42.11.3 with existing security fuses and sandbox/IPC
restrictions. Exactly 16 runtime scripts are packaged. All nine compiled SWPs
have their corresponding readable SWBs here; no source conversion is needed
on the deployment machine. Macro settings are reread on every run.

## Build and Settings

On Windows with Node.js 22.12 or later:

```powershell
npm.cmd ci --legacy-peer-deps
npm.cmd test
npm.cmd run dist
```

The installer upgrades the existing Excelsis Helper identity and preserves app
data. Existing settings remain authoritative. An optional external
ExcelsisHelper-settings.json beside the installer uses Settings > Import/Export
format; no settings sidecar or deployment preset is included in this source or
installer. Differing existing SWPs are backed up before replacement.

See docs/BUILDING.md and docs/RELEASE_AUDIT.md for verification requirements and
remaining live acceptance work. Source tests do not establish live CAD behavior.
