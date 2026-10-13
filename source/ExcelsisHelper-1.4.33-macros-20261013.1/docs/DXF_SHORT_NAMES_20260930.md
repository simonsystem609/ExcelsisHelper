# DXF Short Filename Rules

Current laser macro revision: `2026-10-13-selection-metadata-1`.
The rules apply to regular and RO-friendly laser DXF, not CNC DXF.
Filename stems are at most 20 characters; `.dxf` is excluded from that limit.

1. Always start with the quantity-first prefix, such as `1xLV10_S235_` or
   `2xLV16_S235_`. Thickness labels and material remain settings-driven.
2. Preserve part/configuration text and dates that fit. Do not pad or number
   a genuinely short, non-conflicting name. `Default` is implicit in the short
   name, while the metadata always carries the full raw configuration.
3. Only when overlong, remove the trailing date/time and company tag first,
   then abbreviate words while budgeting for part and non-default configuration.
   Use the available budget instead of discarding useful text unnecessarily.
4. When necessary, add a folder-unique numeric suffix such as `01` or `02`.
   Keep readable part/configuration text wherever it fits. If the metadata
   prefix itself leaves no room for a serial, shorten it with an explicit trace
   rather than refusing a valid sheet. Every final stem remains within 20.
5. Check all existing DXF names, including empty/unclaimed outputs, plus
   this run's reservations. Distinct sources cannot be distinguished solely
   by thickness/material/quantity. Existing unrelated files are never replaced.

Windows-invalid characters, controls, trailing spaces/dots and reserved device
names are guarded. No controller-specific encoding compatibility is claimed.
The 20-character limit is the user's laser-import requirement, not a general
DXF format limit.

Persistent ownership and the complete pre-shortening filename are inside each
DXF. `DXF-names.tsv` is unused and untouched. See
`DXF_EMBEDDED_METADATA_20261013.md` for the reader protocol and migration caveats.
No model/filter/quantity changes arise from shortening a filename.
