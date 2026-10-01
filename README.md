# Excelsis Helper

Excelsis Helper 1.4.29 is an open-source Windows workflow companion
for SOLIDWORKS. It provides recent-document access, document search,
read-only embedded/thumbnail preview extraction, SWP macro launching,
AutoRadius, assembly backup, PDF drawing export, Work Logger, local machining
guidance, MPF analysis, assembly-date maintenance, and local CAD-model
capture through the documented SOLIDWORKS API.

## Download

- [Windows installer](https://github.com/simonsystem609/ExcelsisHelper/releases/download/excelsis-helper-v1.4.29/ExcelsisHelper-1.4.29-Setup.exe)
- [Release notes and all assets](https://github.com/simonsystem609/ExcelsisHelper/releases/tag/excelsis-helper-v1.4.29)
- [Exact corresponding-source archive](https://github.com/simonsystem609/ExcelsisHelper/releases/download/excelsis-helper-v1.4.29/ExcelsisHelper-1.4.29-source.zip)
- [Latest optional DXF macro revision for Helper 1.4.29](https://github.com/simonsystem609/ExcelsisHelper/releases/tag/excelsis-helper-macros-1.4.29-20261001.1)
- [SHA-256 checksums](SHA256SUMS.txt)
- [Licensing and security audit](AUDIT-1.4.29.md)

The installer and application binaries are currently unsigned, so Windows may
show a SmartScreen warning. Kaspersky 21.26 scanned byte-identical copies of
the final installer and source ZIP with zero detections or suspicions. Verify
the installer SHA-256 before running it.

This update improves Radius outline/tangency fitting and CAD-model capture
session safety while retaining all nine SWP macros, configurable shortcuts,
Work Logger, viewport thumbnails and read-only previews. The changed Radius
macro is also published as an immutable macro-only revision for Helper 1.4.29;
ExcelsisView's **Update macros** button is opt-in. Fresh 1.4.29 installations
already contain those exact macro bytes. Two project-authored .NET utilities
were rebuilt deterministically from included C# source with vendor-signed API
interop build inputs; no vendor DLL is bundled. No installed or live
SOLIDWORKS workflow acceptance is claimed.

The newer DXF macro revision is **not** bundled in that installer. It is an
optional, manual update through ExcelsisView 1.1.36 or later. It uses
quantity-first prefixes on short and long DXF names, keeps filename stems
to at most 20 characters, and preserves collision-safe assignments in a
per-folder `DXF-names.tsv` map. The map contains source paths and should
stay within a trusted environment. [Revision source and offline tests](source/ExcelsisHelper-1.4.29-macros-20261001.1/)
and its [separate audit](AUDIT-MACROS-1.4.29-20261001.1.md) are distinct
from the unchanged 1.4.29 installer source. Live SOLIDWORKS export and
target laser-software acceptance have not been performed.

## Source and build

The exact expanded corresponding source is committed under
[`source/ExcelsisHelper-1.4.29/`](source/ExcelsisHelper-1.4.29/).

On Windows with Node.js 24:

```powershell
npm.cmd ci --legacy-peer-deps
npm.cmd test
npm.cmd run dist
```

See
[`docs/BUILDING.md`](source/ExcelsisHelper-1.4.29/docs/BUILDING.md)
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
