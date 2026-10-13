# DXF Tight-Budget Numbering

The 2026-10-12 fix stopped rejecting otherwise valid sheets when the material
and thickness prefix left insufficient room for readable configuration text
or the former collision suffix. It is included in the cumulative
`2026-10-13-selection-metadata-1` revision; no intermediate patch is required.

- Tight budgets allocate `01`, `02`, etc., considering all existing DXF names
  and this run's reservations across the destination folder.
- Part/configuration text remains where it fits. A prefix too long to coexist
  with the serial is shortened with an explicit diagnostic.
- Fitting, non-conflicting names remain intact and are not unnecessarily numbered.
- Every generated stem remains at most 20 characters before `.dxf`.
- New or missing owned outputs stage locally and publish without replacement,
  including a competing writer at final publication. Native write/copy/move
  errors preserve the local recovery stage and report the failed step.

The later 2026-10-13 revision replaced the TSV ownership map with embedded
metadata while retaining these budget/serial rules. Existing TSVs and untagged
DXFs are preserved, not silently claimed or overwritten. Complete filenames
and configurations are in the leading DXF comments.

Native offline regressions cover very long material prefixes, non-default
configurations, 120-item numeric growth, empty/unclaimed files, Unicode/long
paths, enumeration failures and copy/final-publication races. Full offline
suites pass; these are not live SOLIDWORKS or controller acceptance tests.

See `DXF_SHORT_NAMES_20260930.md` for the current rules and
`DXF_EMBEDDED_METADATA_20261013.md` for the standalone reader contract.
