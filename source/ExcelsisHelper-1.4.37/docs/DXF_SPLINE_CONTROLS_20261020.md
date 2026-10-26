# DXF Rational Spline Controls

Macro-only revision: `2026-10-20-native-spline-validation-1`.
Both regular and RO-friendly SWB/SWP pairs are included in the full 1.4.35
installer and source. No separate macro patch is required.

## Diagnosis and Fix

Some trimmed native chamfer outline splines report open curves but expose
Cartesian XYZ plus rational weights. The previous open-curve assumption divided
those coordinates by their weights again, producing pointed extensions.
The SOLIDWORKS control convention documentation alone did not identify this
observed native-outline case reliably.

The writer now evaluates both Cartesian and homogeneous interpretations with
De Boor's algorithm and compares positions with the native curve using
`GetClosestPointOn`. Nine uniform samples plus at most 64 knot-span midpoints
bound the work. Wrong interpretations stop early; cancellation remains active.
Positions are checked in full 3D before XY projection because chamfer
transitions may legitimately vary through the thickness.

The matching interpretation must stay within 0.001 mm. Invalid, nonfinite,
missing or nonmatching data fails before output creation/publication. Exact
rational SPLINE curves and weights are preserved, with diagnostic mode and
error reporting. There is no tessellated approximation or added cutting line.

Analytic LINE/CIRCLE/ARC routes, native sheet-metal flattening, hidden bodies,
through-openings, geometry filters, quantity/configuration scope, names and
embedded metadata, geometry caching and window cleanup remain unchanged.

## Verification and Limits

- Both variants pass offline controls for Cartesian and homogeneous data with
  either closure flag, nonrational data, translated 3D chamfer transitions,
  cancellation, malformed/missing data, no overwrite and no output on failure.
- A user-approved in-process read-only probe verified the two affected native
  curves within 1.6e-14 mm. It did not save, rebuild or export a CAD document;
  save flags and the active document remained unchanged.
- Independent DXF evaluation gives the expected 220 x 70 mm outline, with
  18 entities and the other 16 unchanged. The 5 mm transition-radius check
  differs by less than 1.4e-13 mm. This audit substituted spline definitions
  in memory only; no production DXF was rewritten.
- Both compiled SWPs recover their readable source exactly, with unchanged
  module identities and references. Complete offline regression, including
  naming, metadata, filters, configurations, lifecycle and macro path checks,
  is required for the combined source.

This is bounded source-geometry validation, not a proof for every spline.
The native probe is not a complete assembly-batch export or universal
laser-reader acceptance test. Native test data, logs, models and screenshots
are not distributed. No app rebuild, live CAD test or dependency change is
performed during transfer.

## Regenerating Existing DXFs

Answer No to Export only missing DXFs? to regenerate a previous output, or move
the affected old DXF aside before a missing-only run. The default missing-only
mode intentionally preserves existing nonempty files. Back up external macros
and close SOLIDWORKS if it locks them before deploying the updated SWPs.
