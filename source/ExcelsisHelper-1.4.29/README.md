# Excelsis Helper 1.4.29 Source

This is the corresponding source for the public Excelsis Helper 1.4.29
installer. The Windows installer is built with `npm.cmd run dist` and the
version-pinned Electron 42.11.3 runtime. The packaged authored files are
checked against this source tree.

This release includes the inactive-assembly CAD capture session and the
Radius macro's outline-tangency fit check. The radius check has offline
geometry coverage; live SOLIDWORKS fillet and end-to-end CAD-capture
acceptance remain pending.

The standalone assembly-date command is supplied as
`scripts/date-assembly-files.exe`; its source is `tools/date-assembly-files.cs`.
The CAD capture command is supplied as
`cad-model-runtime/capture-sw-assembly-geometry.exe`; its source is in
`scripts/capture-sw-assembly-geometry.cs` and
`scripts/capture-sw-assembly-session.cs`. Compiled SOLIDWORKS macros have
matching `.swb` sources in `macros`.

An optional `ExcelsisHelper-settings.json` is external to the installer and
is deliberately absent from this archive. Build and test commands are defined
in `package.json`; packaging rules are in `electron-builder.yml`. See
`docs/BUILDING.md` for the .NET utility build inputs and
`docs/PROVENANCE.md` for the source and asset inventory.
