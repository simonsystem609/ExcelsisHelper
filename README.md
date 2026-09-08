# Excelsis Helper

Excelsis Helper 1.4.13-public.1 is an open-source Windows workflow companion
for SOLIDWORKS. It provides recent-document access, document search,
read-only embedded/thumbnail preview extraction, SWP macro launching,
AutoRadius, assembly backup, PDF drawing export, Work Logger, local machining
guidance, and MPF analysis.

## Download

- [Windows installer](https://github.com/simonsystem609/ExcelsisHelper/releases/download/excelsis-helper-v1.4.13-public.1/ExcelsisHelper-1.4.13-public.1-Setup.exe)
- [Release notes and all assets](https://github.com/simonsystem609/ExcelsisHelper/releases/tag/excelsis-helper-v1.4.13-public.1)
- [Exact corresponding-source archive](https://github.com/simonsystem609/ExcelsisHelper/releases/download/excelsis-helper-v1.4.13-public.1/ExcelsisHelper-1.4.13-public.1-source.zip)
- [SHA-256 checksums](SHA256SUMS.txt)
- [Licensing and security audit](AUDIT-1.4.13-public.1.md)

The installer and application binaries are currently unsigned, so Windows may
show a SmartScreen warning. Kaspersky 21.26 scanned byte-identical copies of
the exact installer, unpacked application, compiled macros, expanded source,
and source ZIP with
zero detections or suspicions. Microsoft Defender was disabled on the build
host and is not claimed as release evidence. Verify the installer SHA-256
before running it.

This update adds configurable AutoRadius, assembly backup, fresh runtime macro
settings, optional work logging, current-viewport thumbnail capture, and
hidden/Toolbox-aware DXF filtering. It contains nine SWP macro projects with
matching editable sources, an updated Electron runtime, and neutral macro
host metadata. Older immutable releases and historical Git revisions retain
their original metadata; see the audit for the correction and testing limits.

## Source and build

The exact expanded corresponding source is committed under
[`source/ExcelsisHelper-1.4.13-public.1/`](source/ExcelsisHelper-1.4.13-public.1/).

On Windows with Node.js 22.12 or later:

```powershell
npm ci --legacy-peer-deps
npm test
npm run dist
```

See
[`docs/BUILDING.md`](source/ExcelsisHelper-1.4.13-public.1/docs/BUILDING.md)
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
