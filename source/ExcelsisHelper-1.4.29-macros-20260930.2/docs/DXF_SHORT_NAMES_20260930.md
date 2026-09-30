# DXF Short Filenames

Macro-only change for regular `DXF_v16` and `DXF_v16_ROfriendy`.
The Helper app version remains unchanged.

## Naming

1. Build the original name from the configured prefix, thickness, material,
   quantity, part name, configuration and any precut suffix.
2. Keep at most 20 characters before `.dxf`.
3. If that name is occupied by another export or an untracked existing file,
   shorten the base and append `_<configuration>`. Shorten the configuration
   itself if necessary.
4. If still occupied, append `_2`, `_3`, etc., shortening the earlier
   pieces again so the entire stem stays at most 20 characters.

For example, colliding requested names beginning with
`LV3_S235_4db_some_long_part_name` and configuration `Default` become:

```text
LV3_S235_4db_some_lo.dxf
LV3_S235_4db_Default.dxf
LV3_S235_4_Default_2.dxf
```

Invalid Windows filename characters, controls, trailing spaces/dots and
reserved device names are guarded. This change does not transliterate
non-ASCII part names or claim compatibility with every controller.

## Repeat Exports

Each actual output folder has a UTF-8 `DXF-names.tsv` ownership map.
It associates the short name with the source path, raw configuration, and
complete original generated name. Changed material, quantity or precut
parameters therefore cannot silently reuse another export's short name.

Keep this map with the folder. The macro reuses its assignments regardless
of selection order. Existing nonempty owned DXFs keep the usual
missing-only behavior; missing or empty owned DXFs can be regenerated.
Regenerate-all uses the same owned filenames.

Without a map entry, any existing DXF is treated as occupied, including an
empty file. This deliberately does not guess ownership from a truncated
name. Existing exports from earlier macros are not renamed or deleted;
they may coexist with newly allocated short-name exports.

Name allocation is serialized with an exclusive native file handle.
Malformed maps, lock/read/write/flush failures, and maps exceeding 16 MiB
stop allocation with a trace message instead of risking ambiguous output.
An interrupted append is rejected on the next run if the map is incomplete.
Long local and UNC output paths use the existing native long-path support.
The DXF entities, filtering, quantities, geometry routes and document cleanup
are unchanged.

## Verification

- `tools/test-dxf-macro-names.cjs` executes the actual naming procedures
  in an offline Windows VB harness with local native file I/O, not
  SOLIDWORKS. Both variants must have identical allocator code.
- Coverage includes plain truncation, multiple/raw/long configurations,
  numeric suffix growth, regular/precut separation, changed metadata,
  reordered reruns, removed/empty files, regenerate-all, existing unrelated
  files, Unicode field roundtrips, Windows name constraints, per-folder
  scope, long paths, exclusive locks, injected read/write/flush failures,
  malformed maps, read/append size bounds and file-handle cleanup.
- The naming test is included in `npm.cmd run test:settings` alongside the
  existing DXF filter, lifecycle, path, settings and launcher tests.
- Both SWPs have matching readable SWB source and preserve their existing
  macro module identities.
- The offline tests do not touch SOLIDWORKS models or existing export folders.

Live SOLIDWORKS export and the actual laser software still need acceptance.
No installer is rebuilt by this macro-only revision. The 20-character stem
limit is a requested naming convention, not a universal DXF or controller
limit; actual target software and hardware must be tested separately.
