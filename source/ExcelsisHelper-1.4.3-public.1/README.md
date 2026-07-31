# Excelsis Helper 1.4.3

Windows Electron tray app that automates SOLIDWORKS / SolidCAM workflows
(recent documents, macro runner, document search, Work Logger, CAM tools, and
local MPF analysis). This public source is licensed under GPL-3.0-only; bundled
third-party notices are recorded in `THIRD_PARTY_NOTICES.md`.

Version 1.4.3 keeps Electron processes at Normal priority with EcoQoS, gives
the newest SOLIDWORKS thumbnails priority without increasing worker count,
limits the default Recent view to 50 entries while retaining full-history
search/Show all, and fixes Work Logger sampling with large open-document sets.
The unsaved-document Save As carryover still requires at least one minute.

Application defaults are generic. A shop can place
`ExcelsisHelper-settings.json` beside the installer; it uses the same JSON
format as Settings > Import/Export and is not embedded in the setup EXE. The
installer stages that optional file for first startup, where it fills missing
settings only. An existing `Documents\Excelsis Helper\settings.json` always
wins.

## Quick start

Requires **Node.js 22.12+** (24.x in use for the audited build). The committed
`.npmrc` intentionally omits electron-builder's optional Squirrel.Windows peer;
this project builds only the configured NSIS target.

```powershell
npm ci
npm test
npm run dist       # build the NSIS installer into dist\
```

See `docs/BUILDING.md` for the complete non-launching inspection flow.

## Install and local data

Interactive installs launch the de-elevated app once so an optional external
`ExcelsisHelper-settings.json` beside the setup EXE can fill missing values.
Silent installs stage the sidecar but do not launch the app. Existing settings
always take precedence, and uninstall preserves both Electron user data and
`Documents\Excelsis Helper` for repair installs and upgrades.

Bundled `.swb` source macros are copied by the logged-in app, not the elevated
installer. On the first startup for each app version, a differing existing
macro is backed up under `Documents\Excelsis Helper\macrobackup\bundle-deploy`
before replacement.

The preserved Documents folder can include settings, work logs, caches, macro
backups, and incident diagnostics. Diagnostics are written only after sustained
Explorer CPU incidents, retain at most 20 files, and can contain local paths and
process metadata. Remove that folder manually only when its retained data is no
longer needed.

`CrawlScrews_v1` is an opt-in local diagnostic capture. Before it runs, the app
warns that the resulting bundle includes screenshots, absolute CAD paths,
configurations, and feature names. The app does not upload the bundle.
