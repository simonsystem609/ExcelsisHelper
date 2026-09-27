# Excelsis Helper 1.4.28 Source

This is the corresponding source for Excelsis Helper 1.4.28. The application
installer is built with `npm.cmd run dist` and the version-pinned Electron
42.11.3 runtime. See `docs/BUILDING.md` for the build inputs and checks.

The standalone assembly-date command is supplied as
`scripts/date-assembly-files.exe`; its source is `tools/date-assembly-files.cs`.
The CAD capture command is supplied as
`cad-model-runtime/capture-sw-assembly-geometry.exe`; its source is in
`scripts/capture-sw-assembly-geometry.cs` and
`scripts/capture-sw-assembly-session.cs`. Compiled SOLIDWORKS macros have
matching `.swb` sources in `macros`.

The two C# utilities use documented SOLIDWORKS COM APIs through interop type
metadata; no separate SOLIDWORKS SDK DLL is packaged. A deterministic build
helper is at `scripts/build-cad-utilities.ps1`. The release host independently
compiled both utilities from this source using vendor-signed redistributable
interop assemblies as isolated build inputs, then packaged the resulting
EXEs. Build input provenance, hashes and limitations are in `docs/BUILDING.md`.

An optional `ExcelsisHelper-settings.json` is external to the installer and
is deliberately absent from this archive. Build and test commands are defined
in `package.json`; packaging rules are in `electron-builder.yml`.
