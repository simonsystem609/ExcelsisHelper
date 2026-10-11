# Excelsis Helper 1.4.33 Source

This is the complete corresponding source for Excelsis Helper 1.4.33,
licensed under GPL-3.0-only. It includes the application, runtime resources,
native utility sources and all nine matching SWB/SWP macro pairs.
Operational settings, customer files and vendor binaries are not included.

## Included Changes

- Recent Documents has two folder-action buttons. Settings controls the path
  and both labels, including save/import/export/reset. Generic defaults have
  no folder configured. Copy performs no storage access; Open checks only the
  requested directory. Neither action scans files or calls the CAD API.
- CNC DXF uses the same configured CAM-folder destination as Create CAM Folder.
  Different outputs receive numeric suffixes without overwriting earlier DXFs;
  only conservatively verified identical output is reused.
- The document-card wrapping, laser DXF sparse-flat/configuration fixes,
  assembly-date stale/missing-reference handling and approved performance
  changes from 1.4.32 remain included. Build dependencies are unchanged.
- Copy/folder-open glyphs are embedded from Lucide with their ISC notice.

## Build and Source

See `docs/BUILDING.md` for pinned tools and commands. On Windows, use
`npm.cmd ci --legacy-peer-deps`, `npm.cmd test`, `npm.cmd run audit:licenses`
and `npm.cmd run dist -- --publish never`. The lockfile pins all dependencies;
`.npmrc`, operational presets, private logs and user data are excluded.

The assembly-date starter is `scripts/date-assembly-files.exe`, with source in
`tools/date-assembly-files.cs`. Native CAD capture source is in
`scripts/capture-sw-assembly-geometry.cs`, `scripts/capture-sw-assembly-session.cs`
and `scripts/capture-sw-assembly-cache.cs`. Rebuilding these requires the
documented external C# compiler and SOLIDWORKS API interop assemblies;
no compiler or vendor DLL is redistributed.
`SOURCE-INVENTORY.json` records the exported files and their SHA-256 hashes.

Optional mock-only browser checks use separately supplied Playwright and Chrome:

```powershell
node tools/renderer-harness/check-recent-folder-buttons.cjs
node tools/renderer-harness/check-document-card-layout.cjs
```

## Verification and Limits

The release assessment is recorded in `docs/RELEASE_AUDIT.md`.
Offline regression tests and non-launching package checks do not establish
live SOLIDWORKS acceptance. Binaries and macros are unsigned.

Source fixtures and mock-only browser checks are not live SOLIDWORKS acceptance.
The latest CNC DXF change has not been exercised by a live export in this run.

Build from the pinned lockfile using the commands in `docs/BUILDING.md`.
Both native utilities are independently built from the included C# source;
their binary hashes and pinned external build inputs are documented there.

No private settings sidecar is included or embedded. Existing user settings
are preserved. Edited CAD/assembly-date runtime files in Documents are not
automatically replaced by bundled starters; explicit idle-runtime deployment
is required to update those external files. No installer was launched or
SOLIDWORKS model changed while preparing this candidate.
