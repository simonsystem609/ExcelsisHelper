# DXF macro revision 20261008.1

Assessment date: 2026-10-08. Macro-only update for installed public Helper
1.4.29; the app installer, exact app source and latest-app channel are unchanged.

The supplied change adds an exact-flat-slab fallback for sparse/cutout sheet
configurations. It retains opposing-face/body-extents, thickness, planar-area,
unknown-geometry and bent-body rejection checks. Quantity-first short names,
collision-safe ownership and the existing launcher/module/procedure contract
are unchanged. Both macro variants receive the same reviewed change.

The separate source folder contains the two SWP/SWB pairs, GPL license,
macro-only README and five offline tests. It is not a complete application
snapshot and contains no application dependency, deployment preset, native
executable, private document, research or build log. The unchanged app source
remains available at its immutable 1.4.29 release/tag. Reported-document test
examples were excluded; generic synthetic positive/negative cases remain.

## Checks and limitations

- Both variants passed synthetic filter/geometry, lifecycle, prompt/stop,
  long-path/Unicode/output-failure and collision-safe filename regression tests.
- Compiled OLE VBA independently recovered to the corresponding readable SWB;
  the read-only variant's prefix contains only reviewed historical comments.
- Latin-1 and both UTF-16 alignment checks found no saved developer path.
  Gitleaks reported no source secrets.
- The six assets, SHA-256 manifest and fixed source paths passed public Viewer
  1.1.43's actual macro-release validator using synthetic release metadata.
  Actual published metadata must also verify before completion.
- Kaspersky 21.26 scanned byte-verified copies of all source and six assets:
  93 processed / 93 OK; all adverse counters zero. The host ignored the
  requested report-only action flag, but all 17 copies remained unchanged.
- Macros are unsigned. No live SOLIDWORKS export, installed lock/retry behavior,
  or downstream laser-software acceptance is claimed. Checks cannot establish
  the absence of unknown private identifiers or undiscovered defects.

Use Viewer's manual **Update macros** action after installing and launching
Helper 1.4.29 once. Save work and close/restart SOLIDWORKS if it locks a file;
Retry/Later, backups and rollback are retained. No automatic background update
or forced process termination is introduced.
