# DXF Short Filenames: 20261001.1

This macro-only revision changes the regular and read-only-friendly DXF
macros for installed Helper 1.4.29. It does not replace the app installer.

Both variants always start new output names with the quantity, for example
`1xLV10_S235_alja.dxf`. A complete part name, date and non-default
configuration are retained when they fit. When a name is too long, its
date/time suffix is removed first, then words and configurations are
abbreviated within the available space. The filename stem remains at most
20 characters before `.dxf`. Distinct sources, configurations, materials,
thicknesses or quantities never claim the same output name; actual
collisions receive a numbered suffix within that limit.

Each output folder has a UTF-8 `DXF-names.tsv` ownership map. Keep that map
with the exports: it preserves names across reruns, selection order changes,
missing or empty outputs, and regenerate-all. An existing DXF without a
matching ownership record is treated as occupied, not overwritten or
renamed. The new policy reuses older quantity-first assignments where
compatible; older clipped or database-style assignments remain reserved.
Removing only the map while keeping DXFs can produce extra numbering.

Map records include source paths and configurations, so keep the map in a
trusted environment when sharing export folders. Native exclusive file
locking, length limits and strict validation make allocation fail closed on
corrupt, incomplete or unreadable maps and on I/O errors. The macro does not
rename or delete previous DXF exports.

The included offline tests exercise actual naming procedures, legacy-map
reuse, collisions, Unicode, long paths and failure cases. Both compiled SWP
files have corresponding readable SWB source. Geometry, quantities, filters,
export routes and document cleanup were not changed by this naming update.
The SWPs are unsigned. Live SOLIDWORKS and target laser-software acceptance
remain pending; the 20-character limit is a selected naming convention, not
a universal DXF compatibility guarantee.
