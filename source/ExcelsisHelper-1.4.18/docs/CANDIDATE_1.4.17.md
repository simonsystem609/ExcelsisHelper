# Helper 1.4.17 Transfer Evidence

UNAUDITED_TRANSFER_ONLY. Prepared on 2026-09-19. Independent public-release
review is required. This is complete corresponding source and installer, not a
delta. Earlier patches are already integrated and must not be reapplied.

## Included Changes

- Universal Settings macro-shortcut list, defaults Alt+R Radius and Alt+D DXF.
  Add/remove, reset, import/export, language and saved Macro Runner notes.
  Existing custom Radius bindings migrate. Empty lists remain empty; duplicate
  combinations, unsafe paths and non-SWP targets fail validation.
- Existing Win32 foreground-gated hotkey helper and shared macro launch guard
  are reused. No Helper focus steal, extra process, polling, or SW API probe.
  Delayed/unknown events, overlapping launches and escaped targets are rejected.
- Both DXF variants contain revision 2026-09-18-preflight-incremental-4:
  selected-object queue snapshot, configuration-aware processing, hidden-tree
  exclusions, Toolbox rejection, revised shape/import checks, and diagnostic
  rejection reasons. Imported-part scope is prompted on every export route.
- Owned-document cleanup occurs per candidate, including virtual/path-alias
  documents. Original windows and pre-existing dirty documents are protected.
  Unsafe cleanup stops the batch. Alt+S is cooperative, not a native API abort.
- Conservative loaded-data preflight skips obvious non-sheet/Toolbox parts
  before opening when possible. Unknown geometry/configuration defers; existing
  sheet-metal, selected-face and precut exceptions remain.
- Missing-DXF-only mode defaults on. Nonempty exact matches are retained;
  empty files retry. Optional immediate-parent assembly/configuration subfolders
  retain scoped quantities and deterministic collision suffixes. Some eligible
  parts still require inspection to determine their exact output names.
- Previous Radius selected-outline/unsaved-part behavior, BOM/DXF folder
  opening, runtime settings reread, post-install Retry/Later warnings, thumbnail
  capture, work logging and all machining modules remain included.

## Verification

Build command: npm.cmd run dist. Electron 42.11.3 and electron-builder
27.0.0-alpha.6 are unchanged. No dependency, app identity, user-data identity,
priority or fuse policy change. New installer version is 1.4.17.

- Clean offline install of all 193 pinned dependencies and the complete test
  suite pass in this exact isolated source export. Source functional tests and
  release hardening also pass in development. Coverage includes macro
  modules, settings/migration/deployment locks, foreground hotkey dispatch,
  Radius geometry, DXF filters/selection/cleanup/incremental routes, Recent,
  Work Logger/exports, G-code/machining, previews, EcoQoS and IPC restrictions.
- Isolated Chrome UI checks pass add/save/remove/reset, translated labels,
  disabled shortcuts, import/export and Macro Runner note layout. Fixtures
  are synthetic; native CAD/global hotkeys are not exercised by the UI test.
- 28 authored ASAR files and 35 external source resources match source.
  All nine compiled macros match packaged bytes. All 70 extracted installer
  payload files match the unpacked build. The packaged MPF worker tests pass.
  Correspondence was independently repeated against this exported source.
- All nine Electron fuse slots and embedded ASAR header integrity verified.
  File-protocol privilege needed by loadFile remains enabled.
- Fresh full npm advisory audit reported zero known vulnerabilities. License
  inventory includes 193 dependency entries. No runtime dependency was added.
- Microsoft Defender scanned the exact installer with remediation disabled
  and reported no threats. Authenticode status is NotSigned.

## Limits and Handoff

Offline tests do not establish real geometry acceptance or prevent native
SOLIDWORKS/SolidCAM crashes. The latest combined macros, shortcut focus handling
and installer-to-app workflow still require operator acceptance on real CAD
documents. Cancellation waits for a safe checkpoint and cannot interrupt a
blocked native call. Unknown imported/Toolbox metadata cannot be invented.

The source archive is an allowlisted export, not a clean-Git claim. Its inventory
identifies exact files. No settings sidecar, customer document, build-only tooling,
vendor SDK, private image, build log or reverse-engineering research is included.
The same preset-free installer is used locally with an optional external
settings sidecar. Local operator installation is separate from transfer checks.

The receiving agent must independently review source/package correspondence,
security, privacy, licensing, startup, upgrade and deployment before publishing.
