# Excelsis Helper 1.4.13

Windows Electron helper for SOLIDWORKS and SolidCAM: recent documents,
document search, thumbnails, macro running, Work Logger, CAM tools and local
MPF analysis. Project license: GPL-3.0-only. See `THIRD_PARTY_NOTICES.md`.

The distribution label `1.4.13-public.1` identifies the preset-free
distribution; the actual application and installer version is `1.4.13`.

## Changes

- Configurable AutoRadius shortcut, default Alt+R, with focus-preserving
  launch, selected-face targeting in parts/assemblies and a largest-face
  fallback in a part with no face selected.
- BOM, DXF and CNCDXF reread the macro settings sidecar on each invocation.
  Settings saves do not require recompiling macros. Sidecar write/read-back
  and macro deployment failures are reported, including locked files.
- ERP username is optional, with Windows-user fallback. Work logging and
  all exports can be disabled together without removing existing logs.
- Manual single-document thumbnail retry captures the active CAD viewport
  exactly as the user framed it. It does not zoom, rotate, recenter or activate
  another document. A successful manual preview persists; failed capture keeps
  the previous preview. Bulk missing-thumbnail retry remains in the background.
- DXF excludes hidden components and hidden ancestors, including the original
  visibility scope when opening a selected subassembly. Native Toolbox
  exclusion is separate from imported-geometry filtering. Body-extrema
  thickness handles rotated and circular geometry.
- Compiled macro host metadata contains neutral paths instead of build-machine
  paths. VBA source, references and all unrelated compound streams are unchanged.
  Electron and build dependencies are pinned to independently audited versions.

Existing Recent SW top-50 maintenance, Show all/collapse, document context
menus, Work Logger overtime/rounding, optimized MPF copies, macro run markers,
bounded COM traffic, Normal priority and EcoQoS remain in the source.

## Build

Windows, Node.js 22.12 or newer, and npm are required. This release used
Node.js 24.18.0, Electron 42.11.3 and electron-builder 27.0.0-alpha.6.

```powershell
npm.cmd ci --legacy-peer-deps
npm.cmd test
npm.cmd run dist -- --win nsis --x64 --publish never
```

See `docs/BUILDING.md` and `docs/RELEASE_AUDIT.md` for inspection steps,
verified results and remaining acceptance checks. Do not run a transferred
installer merely to inspect its contents.

## Macros

Nine build-ready SWPs and their corresponding SWB sources are included:

- BackupAssembly_v1
- BOM_v19 and BOM_v19_ROfriendy
- CNCDXF_final_v1 (source: CNCDXF_v1.swb)
- CrawlScrews_v1
- DXF_v16 and DXF_v16_ROfriendy
- PDF_v1
- Radius_v9

Modified macro source can be compiled with the SOLIDWORKS VBA editor.
The source ZIP includes editable source and exact
build-ready SWPs, not a proprietary CAD runtime or SDK.

The application deploys macros to the logged-in user's macro folder once per
version, preserving differing previous files in its macro backups. Obsolete
bundled macros are retired into a backup folder rather than deleted.
Settings-dependent macros read `macro-settings.json` beside their SWP.

`CrawlScrews_v1` is an opt-in local diagnostic capture. Its confirmation warns
about screenshots, absolute CAD paths, configurations and feature names. Its
output is not uploaded automatically and is not part of this distribution.

## Settings And Installation

Required shop paths and optional prefixes are configured in Settings. The
application has generic defaults. An optional `ExcelsisHelper-settings.json`
beside a private installer uses the same format as Settings Import/Export.
It is not embedded in the installer and is absent from this distribution.
Existing settings take precedence during an upgrade.

Interactive installs launch the de-elevated application once after setup;
silent installs do not launch it. Uninstall preserves application data and
the user's Helper documents, including settings, logs, caches and macro backups.
This installer is unsigned. Installed UI, upgrade/uninstall and live SOLIDWORKS
workflow acceptance are user-controlled and were not exercised by the release
audit. See `docs/RELEASE_AUDIT.md` for the scope of verified checks.
