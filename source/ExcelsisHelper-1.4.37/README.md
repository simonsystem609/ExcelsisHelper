# Excelsis Helper 1.4.37 Source

Exact corresponding source for the unsigned public 1.4.37 installer.
The public build updates Electron to 42.11.18 and compatible patched build
dependencies, corrects icon attribution and rebuilds both project-authored
native utilities from validated inputs. Personal settings, history, customer
documents and the compiler are excluded.

## Included Changes

- Conditional header Update button plus a permanent Settings entry open one
  Update Center for Viewer, Helper and compatible standalone Helper macros.
- Uses official public immutable releases, manual download/install approval,
  SHA-256 and size checks, numeric version/downgrade guards, and exact-version
  macro compatibility. Private candidate builds are not automatic update feeds.
- Macro transactions acquire all affected SWPs exclusively before writing,
  verify backups/read-back, restore originals on failure and offer Retry/Later
  when SOLIDWORKS locks a target. Settings and unrelated files stay intact.
- Both DXF variants include the nonuniform-stock allowance through 20 mm total
  native face-normal depth plus 0.02 mm tolerance. Other filters and genuine
  sheet-metal flattening remain; sparse-flat exceptions still need flat proof.
- Recent full-path search, native rational curves, outline/through-opening
  cleanup, unique 20-character names, quantity/configuration handling, window
  cleanup, multibody GLB and earlier CNC DXF/date-tool changes are cumulative.
- All nine readable SWB/compiled SWP pairs match the installer. No earlier macro
  patch should be applied over this full candidate. Dependencies are unchanged.

## Build And Source

See `docs/BUILDING.md`. On Windows use `npm.cmd ci --legacy-peer-deps`,
`npm.cmd test`, `npm.cmd run audit:licenses` and
`npm.cmd run dist -- --publish never`. The lockfile pins dependencies.
Browser harnesses use separately supplied Playwright and Chrome, with synthetic
data only. `SOURCE-INVENTORY.json` records all exported files and hashes.

Native capture sources and date-tool source are included. Rebuilding native
helpers requires separately installed SOLIDWORKS interop assemblies; vendor
SDKs/interop DLLs are not transferred. SOLIDWORKS can convert readable SWBs in
its macro editor. The private iteration compiler is excluded.

The optional catalogue-seed importer and its synthetic tests are source only;
this installer contains no seed or personal data and does not replace existing
per-user settings/history. Edited external CAD/date runtimes remain preserved.

## Verification And Limits

The same-byte build passed the full offline test suite, dependency inventory,
eight browser layouts/states, native synthetic macro-lock/rollback tests,
source/package correspondence for all 81 installer files, ASAR integrity and
nine runtime fuses. Non-remediating Defender scans found no threats.
Read-only public metadata integration passed. No live updater installation was
performed. Transfer reuses those results; no new test run, rebuild, dependency
installation or online dependency audit was requested during upload.

The installer is unsigned. Bounded geometry checks and synthetic tests do not
prove every model/laser reader works. The packaged third-party icon notice
predates one folder-plus variant; the shared ISC license remains included.
Independent licensing, provenance, privacy, security, clean-build, package and
installer review remain required before public release. This source export
does not authorize publication or installer execution.
