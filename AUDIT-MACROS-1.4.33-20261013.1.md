# Helper 1.4.33 macro revision 20261013.1

This separate immutable prerelease contains two matching laser DXF SWP/SWB
pairs, revision metadata and checksums. Helper **1.4.33 only** is compatible.
The app installer, app source snapshot, CNC DXF and older revisions are unchanged.

Selection-only remains the default; an optional first prompt expands visible,
unsuppressed instances of selected source files/configurations. Full requested
filenames/configurations and bounded checksummed ownership metadata are embedded
as DXF comments. Geometry/BOM bytes are preserved. Tight-budget names retain
collision-safe numbering. Old TSVs and untagged outputs are untouched; first
reruns can add files. Editors can strip comments. Binary DXF is refused.
No shared allocation lock or globally permanent serial is claimed.

The corresponding source at `source/ExcelsisHelper-1.4.33-macros-20261013.1`
contains 16 files / 1,559,417 bytes: readable and compiled macros, the standalone
bounded reader, four offline test groups, protocol documents and GPL-3.0-only
license. It is not a full app snapshot and contains no executable/dependency.

Checks completed independently on 2026-10-13:

- Exact immutable transfer/control identity, all five assets, server/download
  digests, checksums and signed release/asset attestations passed.
- The 15-file delta matched the exact base; all 181 reconstructed file hashes
  and the canonical combined revision matched. No native executable was extracted.
- Both compiled VBA modules exactly match their readable SWBs. Four offline
  regression groups cover scope, filters, lifecycle, metadata, no-replace I/O,
  Unicode/long paths, corruption, binary refusal and numbering beyond 99.
- Source/final privacy and secret scans passed. Latin-1 and both-alignment
  UTF-16 scans covered 22 files / 2,892,287 bytes with zero findings.
- Kaspersky 21.26 scanned exact source/final copies: 98/98 objects OK; every
  adverse counter zero. All copied/original hashes stayed unchanged. No protection
  setting or exclusion changed.
- The actual Viewer 1.1.44 updater validates the two-pair release contract.

Updates remain manual through Update macros after Helper is launched once.
On lock, save work and close/restart SOLIDWORKS, then retry; no process is
force-closed. Macros are unsigned. No installed/live CAD or target laser-software
acceptance is claimed. Full labels are display data, not trusted paths/HTML.
