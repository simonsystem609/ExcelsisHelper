# DXF Selection Scope and Embedded Metadata

Revision: `2026-10-13-selection-metadata-1`.
Applies to regular `DXF_v16` and `DXF_v16_ROfriendy`, not CNC DXF.
Originally a macro-only delta over `helper-v1.4.33-candidate.1`.
The full 1.4.34 candidate now includes this behavior and the later native
solid-profile updates; its installer needs no separate macro patch.
No private compiler, operational settings, customer fixtures or local logs are
included. Public release requires independent review.

## Selection Scope

The first prompt for an assembly selection offers:

- YES: all visible, unsuppressed instances of selected source files in the
  active assembly. Every configuration used there exports/counts separately.
- NO: selected instances only, retaining the current behavior and default.
- CANCEL: abort before material/export prompts or outputs.

Selected subassemblies expand to matching subassembly occurrences and each
occurrence's own visible descendants, not unrelated occurrences of every
child file. Explicit parent/child overlaps and repeated faces count once per
occurrence. Hidden/suppressed ancestor trees remain excluded; eligible
lightweight occurrences remain eligible. Original face overrides remain with
the originally selected occurrences. Unknown configurations, missing original
occurrences, incomplete subtrees and conflicting identities fail before export.

Inventory expansion does not open, activate, rebuild, resolve or suppress
models. Existing geometry filters, body/occurrence quantity aggregation,
configuration restoration and real-document-window cleanup remain intact.

## Prompt Order

1. Selection scope, only for an assembly with a selection.
2. Material; a custom-material input follows if chosen.
3. Regular DXF/precut, skipped for an assembly without selection.
4. Imported-part filter: all imported or washer-like imported only.
5. Existing outputs: missing-only or explicit regeneration.
6. Parent-assembly subfolders/flat layout, for assemblies only.
7. Referenced-part/assembly-context geometry for regular assembly export;
   precut instead asks for offset and original outline/holes.

## Persistent Names

Leading `999` comments carry versioned JSON, an internal owner record and a
SHA-256 integrity checksum. The full requested filename and raw configuration
are available through `tools/read-dxf-metadata.cjs`. See
`DXF_EMBEDDED_METADATA_20261013.md` for the complete protocol.

The macro no longer creates, reads, changes or deletes `DXF-names.tsv`.
It builds one bounded identity index per output folder per run. Tagged outputs
keep repeat assignments in a different candidate order. Untagged/stripped
outputs and overlong renamed DXFs remain occupied and preserved; the first run
in an older output folder can add another DXF. Corrupt tagged identities and
I/O failures are explicit errors, not permission to overwrite.

Native geometry bytes and any UTF-8 BOM are preserved. No text entities, layers
or cutting geometry are added. Binary DXF cannot carry this comment protocol
and is refused, with the native local recovery stage retained. Editors can
strip comments; readers must fall back to the actual filename when metadata
is absent. Treat names as untrusted text, not HTML or executable paths.

Fresh outputs publish without replacement. Explicit regeneration requires a
verified matching identity. No shared allocation-lock file is used; concurrent
exports can conflict/fail at publication rather than overwrite each other.
Deleted outputs remove their persistent reservations, so serials can be reused
and are not lasting or globally unique IDs.

## Verification and Limits

The complete offline suite passes in development and in the isolated
base-plus-delta tree. Regression coverage includes scope/configuration/quantity,
prompt ordering/default/cancel paths, geometry filters, lifecycle/cleanup,
native Windows hashing and metadata I/O, reversed disk-only reruns, legacy
files, Unicode/long paths, binary/corrupt/partial identities, failures/handle
cleanup, exact body/BOM preservation and numbering beyond 99.

Independent source recovery from both unsigned compiled SWPs matches the SWBs
exactly, with module identities and stdole 2.0 references preserved. Existing
application, dependency, CAD/date-runtime and other macro bytes match the base.
The separate transfer manifest records every changed file's before/after hash
and the reconstructed source inventory. Focused scans and byte verification
do not establish public-release safety or licensing/provenance completeness.

Live SOLIDWORKS and target laser-software acceptance remain pending. No live
CAD export or installer was run during preparation. The existing installer
does not contain these changes; a future installer must be rebuilt after merge.
