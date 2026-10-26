# Excelsis Helper

Excelsis Helper 1.4.37 is an open-source Windows workflow companion
for SOLIDWORKS. It provides recent-document access, document search,
read-only embedded/thumbnail preview extraction, SWP macro launching,
AutoRadius, assembly backup, PDF drawing export, Work Logger, local machining
guidance, MPF analysis, assembly-date maintenance, and local CAD-model
capture through the documented SOLIDWORKS API.

## Download

- [Windows installer](https://github.com/simonsystem609/ExcelsisHelper/releases/download/excelsis-helper-v1.4.37/ExcelsisHelper-1.4.37-Setup.exe)
- [Release notes and all assets](https://github.com/simonsystem609/ExcelsisHelper/releases/tag/excelsis-helper-v1.4.37)
- [Exact corresponding-source archive](https://github.com/simonsystem609/ExcelsisHelper/releases/download/excelsis-helper-v1.4.37/ExcelsisHelper-1.4.37-source.zip)
- [Current CNC and laser macros for Helper 1.4.37](https://github.com/simonsystem609/ExcelsisHelper/releases/tag/excelsis-helper-macros-1.4.37-20261026.1)
- [SHA-256 checksums](SHA256SUMS.txt)
- [Licensing and security audit](AUDIT-1.4.37.md)

The installer and application binaries are currently unsigned, so Windows may
show a SmartScreen warning. Kaspersky 21.26 scanned byte-identical copies of
the final installer and source ZIP with zero detections or suspicions. Verify
the installer SHA-256 before running it.

This release adds an Update Center for Helper, Viewer and compatible macros,
recent-document full-path search and configurable project-folder creation.
Cumulative laser DXF changes cover native rational curves, outline/through-opening
cleanup and nonuniform stock depth through 20 mm with 0.02 mm tolerance.
All nine macros, configurable shortcuts, Work Logger, previews and documented
SOLIDWORKS API capture remain. Electron is patched to 42.11.18. Both
project-authored native utilities were rebuilt twice with identical outputs;
no vendor DLL or personal deployment data is bundled.

Fresh 1.4.37 installations contain the CNC/DXF pairs in revision 20261026.1.
Use Helper's Settings or Update button, or the compatible Viewer's **Update
macros** button, for later verified revisions. Updates require approval, back
up current macros and offer Retry/Later when SOLIDWORKS locks a file.
Save work and close or restart SOLIDWORKS when prompted. No background macro
replacement or forced process termination occurs. This revision is only for
Helper 1.4.37; older compatible streams remain unchanged.

Earlier laser DXF revision **20261013.1** adds selection-only/all-visible
instance scope, embedded full filenames/configurations and safe tight-budget
numbering. It is compatible only with Helper 1.4.33 and does not replace or
bump the app installer. The manual Update macros button supplies the newer
files; CNC DXF remains unchanged. New laser exports no longer use the TSV map.
Old TSVs and untagged outputs are preserved, so the first rerun can create
additional DXFs. Editors may strip comments; concurrent exports can conflict
at no-replace publication. Metadata labels are untrusted display text.
[Corresponding source and offline tests](source/ExcelsisHelper-1.4.33-macros-20261013.1/)
and the [macro audit](AUDIT-MACROS-1.4.33-20261013.1.md) accompany this revision.

The separate [DXF revision for existing Helper 1.4.29 installations](https://github.com/simonsystem609/ExcelsisHelper/releases/tag/excelsis-helper-macros-1.4.29-20261008.1)
remains available and unchanged. The 1.4.33 CNC macro needs the newer host
configuration and is not offered to Helper 1.4.29. That older DXF revision uses
quantity-first prefixes on short and long DXF names, keeps filename stems
to at most 20 characters, and preserves collision-safe assignments in a
per-folder `DXF-names.tsv` map. The map contains source paths and should
stay within a trusted environment. Revision 20261008.1 also accepts sparse/cutout
sheet configurations only when exact opposing-face/body-extents checks prove a
flat slab; bent bodies and unreadable geometry remain rejected.
[Macro-only corresponding source and offline tests](source/ExcelsisHelper-1.4.29-macros-20261008.1/)
and its [separate audit](AUDIT-MACROS-1.4.29-20261008.1.md) remain available.
Live SOLIDWORKS export and
target laser-software acceptance have not been performed.

## Source and build

The exact expanded corresponding source is committed under
[`source/ExcelsisHelper-1.4.37/`](source/ExcelsisHelper-1.4.37/).
Older complete source snapshots are preserved at their immutable release
tags and source archives rather than duplicated on the current branch.

On Windows with Node.js 24:

```powershell
npm.cmd ci
node node_modules/electron/install.js
npm.cmd test
npm.cmd run dist
```

See
[`docs/BUILDING.md`](source/ExcelsisHelper-1.4.37/docs/BUILDING.md)
for the complete non-launching build and inspection flow.

## Project links

- Project site: https://simonsystem609.github.io/ExcelsisHelper/
- ExcelsisView: https://simonsystem609.github.io/ExcelsisViewer/
- Support and issue reports: https://github.com/simonsystem609/ExcelsisHelper/issues
- Excelsis3D plans and development help: https://discord.gg/uJrSBQm68
- Support development: https://buymeacoffee.com/lakatos

Please do not upload confidential customer or CAD files to public issues.

## Contact

For collaboration, development, or general inquiries, email
[simonsystem609@gmail.com](mailto:simonsystem609@gmail.com).

For bug reports, please use
[GitHub Issues](https://github.com/simonsystem609/ExcelsisHelper/issues); it is
the preferred channel for reproducible problems. Do not email credentials or
confidential files.

## License

Excelsis Helper is `GPL-3.0-only`; see [LICENSE](LICENSE). Bundled third-party
components retain their own compatible licenses and notices.


