# Helper macro revision 20261013.1

GPL-3.0-only corresponding source and offline tests for the regular and
read-only-friendly laser DXF macros. Requires Helper **1.4.33** and its existing
launcher contract. CNC DXF and other macros are unchanged.

This standalone macro revision adds selection-only/all-visible instance scope,
embedded full filename/configuration comments, bounded ownership metadata and
collision-safe tight-budget numbering. Geometry and BOM bytes are preserved.
Old TSVs and untagged DXFs are untouched; a first rerun can create extra DXFs.
Editors may strip comments. Binary DXF is refused. Concurrent exports can
conflict/fail at no-replace publication; serials are not globally unique IDs.

Use ExcelsisView's **Update macros** button after installing and launching
Helper 1.4.33 once. Save work and close/restart SOLIDWORKS if a macro is locked,
then retry. Updates are manual; no process is forcibly closed. The immutable
Helper installer remains unchanged and contains its earlier bundled macros.

The matching readable SWBs, compiled SWPs, standalone metadata reader and
four offline regression groups are included. No app executable, dependency
tree, settings sidecar or native tool is distributed in this source package.
Run each `tools/test-dxf-macro-*.cjs` with Node.js on Windows. See `docs/` for
the protocol, selection scope and compatibility limitations.

Macros are unsigned. Source, package and offline checks do not establish
installed/live SOLIDWORKS or target laser-controller acceptance.
