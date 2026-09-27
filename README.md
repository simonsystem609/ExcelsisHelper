# Excelsis Helper

Excelsis Helper 1.4.28 is an open-source Windows workflow companion
for SOLIDWORKS. It provides recent-document access, document search,
read-only embedded/thumbnail preview extraction, SWP macro launching,
AutoRadius, assembly backup, PDF drawing export, Work Logger, local machining
guidance, MPF analysis, assembly-date maintenance, and local CAD-model
capture through the documented SOLIDWORKS API.

## Download

- [Windows installer](https://github.com/simonsystem609/ExcelsisHelper/releases/download/excelsis-helper-v1.4.28/ExcelsisHelper-1.4.28-Setup.exe)
- [Release notes and all assets](https://github.com/simonsystem609/ExcelsisHelper/releases/tag/excelsis-helper-v1.4.28)
- [Exact corresponding-source archive](https://github.com/simonsystem609/ExcelsisHelper/releases/download/excelsis-helper-v1.4.28/ExcelsisHelper-1.4.28-source.zip)
- [SHA-256 checksums](SHA256SUMS.txt)
- [Licensing and security audit](AUDIT-1.4.28.md)

The installer and application binaries are currently unsigned, so Windows may
show a SmartScreen warning. Kaspersky 21.26 scanned byte-identical copies of
the final installer and source ZIP with zero detections or suspicions. Verify
the installer SHA-256 before running it.

This update adds assembly-date maintenance, local CAD-model capture, and
machining guidance improvements while retaining the nine unchanged SWP macros,
configurable shortcuts, Work Logger, viewport thumbnails and read-only
previews. Two project-authored .NET utilities were rebuilt deterministically
from included C# source with vendor-signed API interop build inputs; no vendor
DLL is bundled. File locations use the active SOLIDWORKS session or editable
settings. No installed or live SOLIDWORKS workflow acceptance is claimed.

## Source and build

The exact expanded corresponding source is committed under
[`source/ExcelsisHelper-1.4.28/`](source/ExcelsisHelper-1.4.28/).

On Windows with Node.js 24:

```powershell
npm.cmd ci
npm test
npm.cmd run dist
```

See
[`docs/BUILDING.md`](source/ExcelsisHelper-1.4.28/docs/BUILDING.md)
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
