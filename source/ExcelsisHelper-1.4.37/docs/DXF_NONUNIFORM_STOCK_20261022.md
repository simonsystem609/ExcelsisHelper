# DXF Nonuniform Stock Depth

Both laser DXF variants allow stepped/nonuniform stock up to 20 mm total native
depth along the largest planar face normal, with 0.02 mm geometry tolerance.
The earlier local face-pair gap could wrongly reject an otherwise acceptable
stepped part. Distinct acceptance status 2 preserves the genuine-flat proof
required for the sparse-face exception; flat slabs retain status 1.

Other ratio, hardware/import, visibility, quantity/configuration, native-profile
and cleanup rules are unchanged. Genuine sheet-metal flattening is unchanged.
Small non-sheet-metal bends within the allowed total depth may intentionally
pass. Focused geometry/routes, compiled source recovery and the complete offline
suite passed. This is not proof of acceptance for every CAD model/laser reader.
The candidate includes both complete current SWB/SWP pairs cumulatively.
