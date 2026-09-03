# Excelsis Helper 1.4.12

Windows Electron tray app for SOLIDWORKS and SolidCAM workflows, including
recent documents, macro running, document search, Work Logger, CAM tools, and
local MPF analysis. Public source is licensed under GPL-3.0-only; bundled
third-party notices are recorded in `THIRD_PARTY_NOTICES.md`.

Version 1.4.12 promotes the finalized regular and read-only DXF macros. Their
geometry-first candidate checks apply imported-part rejection to washer-like
parts by default, with an explicit general imported-filter choice for broader
assembly cleanup. Selected assembly-context faces retain their direct export
path, multibody output quantities count solid bodies, and current-view exports
hide sketches and annotations temporarily before restoring the display state.
Detailed reject tracing and robust output-folder handling remain available.

Every bundled macro publishes the shared PID-scoped run marker, including when
launched directly in SOLIDWORKS. During a marked run, Helper blocks unseen
Recent entries and gates background watcher/thumbnail COM probes while known
documents can continue to refresh. Dead-process and stale markers fail open.

Version 1.4.11 limits Recent SW background maintenance strictly to the newest
50 entries. A 90-second pass reuses the existing Doc Search index and at most
one bounded targeted scan, pauses missing-file evidence when storage is
unavailable, and confirms a missing entry before removal. Relocated documents
can be repaired by file identity or conservative indexed matching without a
new worker or helper process.

Recent SW can now collapse from Show all back to the first 50 entries. Its
single Delete + retry thumbnail action also works from Doc Search and forces
the existing live SOLIDWORKS rendering route after discarding a broken cached
preview. Normal process priority and EcoQoS remain the policy for all
Helper-owned processes.

Version 1.4.10 consolidated steady-state SOLIDWORKS communication into one
self-paced two-second COM watcher. A separate Win32 activity watcher decides
whether SOLIDWORKS or SolidCAM has focus without using COM. Cached status reads,
macro gating, bounded thumbnail fallbacks, and operational connection states
reduce redundant API traffic while preserving Work Logger, Recent SW, Document
Search, macro, thumbnail, and recovery behavior.

The current Work Logger regular/overtime export model, configurable hotkeys and
shop paths, local machining analysis, optimized MPF-copy generation, document
type badges, drawing PDF export, and all eight compiled macros remain present.

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

The installer deploys these compiled macros from the logged-in app:

- `BOM_v19.swp`
- `BOM_v19_ROfriendy.swp`
- `CNCDXF_final_v1.swp`
- `CrawlScrews_v1.swp`
- `DXF_v16.swp`
- `DXF_v16_ROfriendy.swp`
- `PDF_v1.swp`
- `Radius_v9.swp`

Corresponding reviewed SWB sources and build-ready SWPs are included in public
source. The application build packages those SWPs directly. To modify a macro,
edit its corresponding VBA source with a compatible SOLIDWORKS macro editor and
save the matching SWP, retaining its module and entry-point identifiers used by
the application. No vendor SDK or development program is bundled.

`PDF_v1` accepts a saved active part or selected part components/faces in an
assembly. It asks SOLIDWORKS to open each component's associated drawing,
exports all of that drawing's sheets into the root document's `pdf` folder,
and restores the original document and selections. Drawings that were already
open are preserved; drawings opened by the macro are closed without saving.

For the two DXF variants, a single planar face selected in an active part is an
explicit export request even when the part is thicker than the normal plate
filter. Thin-solid detection now prefers measured body thickness over a
coordinate-dependent bounding-box dimension. Imported rejection runs after
geometry classification and is washer-only by default; the optional general
filter is available from the export-choice dialog. Multibody filenames count
solid bodies in addition to assembly occurrences.

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
