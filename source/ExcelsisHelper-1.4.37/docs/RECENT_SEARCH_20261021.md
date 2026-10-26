# Recent Full-Path Search

Included in Helper 1.4.35. Both the recent-documents backend and renderer used
to search full paths only when no filename matched. A name containing a query
could therefore hide documents with that query only in their parent folders.

Both filters now search title, actual full path and mapped/display path together.
Each whitespace-separated query token must match somewhere in that combined
case-insensitive string. The original recent order is retained, with no duplicate
rows. Existing type filters and non-search default/show-all limits remain.
This is in-memory filtering, not a new network or file-content scan; recent
record persistence, thumbnails and CAD behavior are unchanged.

The new `tools/test-recent-doc-search.cjs` first reproduced the original failure
and now passes 19 backend/UI parity cases as part of the complete offline suite.
Cases cover mixed filename/folder matches, title aliases, mapped paths, fallback
titles, case/whitespace, literal characters, Unicode case, cross-field token AND,
all type filters, order, limits, no duplicates and immutable input records.

`tools/renderer-harness/check-recent-search.cjs` connects the real backend search
predicate to an isolated mock UI. Seven typed-input searches cover mixed hits,
type filters, cross-field tokens, no results and query reset. Synthetic layout
screenshots were checked at 840, 1180 and 1920 px. No customer record, screenshot
or cache is included. The extracted installer's main/renderer files also pass
the same 19 search cases. These tests do not launch installed Helper or CAD.
