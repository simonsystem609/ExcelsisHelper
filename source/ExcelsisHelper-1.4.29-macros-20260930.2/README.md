# Excelsis Helper 1.4.29 Macro Revision Source

This is the corresponding source for macro revision `20260930.2` for
installed Excelsis Helper 1.4.29. It is derived from the public 1.4.29
installer source, but the existing installer and its exact source snapshot
remain unchanged. This revision is delivered separately through Viewer's
manual **Update macros** action.

The two DXF macro variants now assign at most 20 characters before `.dxf`,
persisting collision-safe filename ownership in each export folder. See
`docs/DXF_SHORT_NAMES_20260930.md` for behavior and limitations. The source
changes include both compiled macros, readable matching sources, and offline
tests. The Windows installer is still built with `npm.cmd run dist` and the
version-pinned Electron 42.11.3 runtime; this revision does not rebuild it.

The application baseline includes the inactive-assembly CAD capture session and the
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
