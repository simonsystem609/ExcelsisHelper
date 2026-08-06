# Excelsis Helper 1.4.8

Windows Electron tray app for SOLIDWORKS and SolidCAM workflows, including
recent documents, macro running, document search, Work Logger, CAM tools, and
local MPF analysis. Public source is licensed under GPL-3.0-only; bundled
third-party notices are recorded in `THIRD_PARTY_NOTICES.md`.

Version 1.4.8 includes the current Work Logger regular/overtime export model,
bounded Recent SW repair and thumbnail scheduling, configurable hotkeys and
shop paths, local machining analysis, optimized MPF-copy generation, document
type badges, and the finalized seven-macro release.

Application defaults are generic. Required deployment paths are configured in
Settings. Project and filename prefixes may remain empty where root-based
detection is available. A shop can optionally place
`ExcelsisHelper-settings.json` beside the installer; it uses the same JSON
format as Settings Import/Export and is not embedded in the setup EXE.
Existing settings always take precedence during an upgrade.

## Quick Start

Requires Node.js 22.12 or newer; Node.js 24.18.0 was used for this release.

```powershell
npm ci
npm test
npm run dist
```

See `docs/BUILDING.md` for the complete non-launching inspection flow.

## Macros

The installer deploys these compiled macros from the logged-in app:

- `BOM_v19.swp`
- `BOM_v19_ROfriendy.swp`
- `CNCDXF_final_v1.swp`
- `CrawlScrews_v1.swp`
- `DXF_v16.swp`
- `DXF_v16_ROfriendy.swp`
- `Radius_v9.swp`

Corresponding reviewed SWB sources and build-ready SWPs are included in public
source. The development compiler is not distributed and is not needed for a
normal application build.

On first startup for each version, differing production SWPs are backed up
under `Documents\Excelsis Helper\macrobackup\bundle-deploy` before replacement.
Known obsolete SWB and Test1 files are moved into a timestamped `retired`
backup folder. Macro deployment never deletes those files.

## Install And Local Data

Interactive installs launch the de-elevated app once so an optional external
settings sidecar can fill missing values. Silent installs do not launch the
app. Uninstall preserves Electron user data and
`Documents\Excelsis Helper`, including settings, activity logs, caches, and
macro backups.

`CrawlScrews_v1` is an opt-in local diagnostic capture. Before it runs, the app
warns that its bundle contains screenshots, absolute CAD paths,
configurations, and feature names. The app does not upload that bundle.

The Windows installer is unsigned unless the distributor supplies a trusted
code-signing certificate. Windows may display an unknown-publisher warning.
