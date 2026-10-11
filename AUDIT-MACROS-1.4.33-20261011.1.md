# Helper 1.4.33 macro revision 20261011.1

This optional immutable prerelease contains three matching CNC/DXF SWP/SWB
pairs, `MACRO-REVISION.json`, and checksums. It is compatible only with Helper
1.4.33 and is separate from the latest-app release endpoint. Fresh 1.4.33
installations already include these exact bytes. Existing Helper 1.4.29
installations retain their separate compatible DXF revision.

The CNC macro adds configured CAM-folder output with non-overwriting numbering.
Its recovered VBA matches the readable source. Both laser DXF pairs are
byte-identical to reviewed revision 20261008.1. Corresponding readable source
and offline tests are included in the complete
[1.4.33 source](source/ExcelsisHelper-1.4.33/); this revision's tag points to
the same source commit as the application release.

Macro privacy checks, offline tests and exact-file checks passed. These assets
were included in the unchanged 554/554-object zero-finding Kaspersky scan
recorded in [the application audit](AUDIT-1.4.33.md). The actual Viewer 1.1.44
updater accepts all three pairs and does not select them for Helper 1.4.29.
Macros remain unsigned. No installed/live SOLIDWORKS or target CAM acceptance
is claimed. Updates remain manual and offer save/close or restart instructions
when a macro is locked; no process is force-closed.
