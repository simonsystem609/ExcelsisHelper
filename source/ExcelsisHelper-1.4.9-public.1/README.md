# Excelsis Helper 1.4.9

Windows Electron tray app for SOLIDWORKS and SolidCAM workflows, including
recent documents, macro running, document search, Work Logger, CAM tools, and
local MPF analysis. Public source is licensed under GPL-3.0-only; bundled
third-party notices are recorded in `THIRD_PARTY_NOTICES.md`.

Version 1.4.9 retains the current Work Logger regular/overtime export model,
bounded Recent SW repair and thumbnail scheduling, configurable hotkeys and
shop paths, local machining analysis, optimized MPF-copy generation, and
document type badges. The eight-macro release adds drawing PDF export and
updates both DXF variants without removing their existing assembly, sheet-metal,
or thin-solid workflows.

Application defaults are generic. Required deployment paths are configured in
Settings. Project and filename prefixes may remain empty where root-based
detection is available. A shop can optionally place
`ExcelsisHelper-settings.json` beside the installer; it uses the same JSON
format as Settings Import/Export and is not embedded in the setup EXE.
Existing settings always take precedence during an upgrade.

## Quick Start

Requires Node.js 22.12 or newer; Node.js 24.18.0 was used for this release.

```powershell
npm ci --legacy-peer-deps
npm test
npm run dist
```

See `docs/BUILDING.md` for the complete non-launching inspection flow.

## Macros

The installer deploys these SWP macro projects from the logged-in app:

- `BOM_v19.swp`
- `BOM_v19_ROfriendy.swp`
- `CNCDXF_final_v1.swp`
- `CrawlScrews_v1.swp`
- `DXF_v16.swp`
- `DXF_v16_ROfriendy.swp`
- `PDF_v1.swp`
- `Radius_v9.swp`

Corresponding reviewed SWB sources and build-ready SWPs are included in public
source. The project-authored VBA is created or converted and saved through the
SOLIDWORKS macro editor; a normal application build uses the checked-in SWPs.

`PDF_v1` accepts a saved active part or selected part components/faces in an
assembly. It asks SOLIDWORKS to open each component's associated drawing,
exports all of that drawing's sheets into the root document's `pdf` folder,
and restores the original document and selections. Drawings that were already
open are preserved; drawings opened by the macro are closed without saving.

For the two DXF variants, a single planar face selected in an active part is an
explicit export request even when the part is thicker than the normal plate
filter. Thin-solid detection now prefers measured body thickness over a
coordinate-dependent bounding-box dimension.

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
