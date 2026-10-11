# Source and Asset Provenance

This inventory covers the complete Excelsis Helper 1.4.33 release source.

## Project-owned Work

The project provenance record declares the original application, PowerShell/VBS
scripts, authored native interoperability helpers, SWB macros and icon artwork
to be project-owned work under GPL-3.0-only. Agent-assisted changes are made for
the same project. No custom fonts, customer CAD files, user branding images,
vendor programs, SDK DLLs or SOLIDWORKS/SolidCAM binaries are included.

## Macro Sources

| Readable source | Compiled artifact | Recorded origin |
|---|---|---|
| BackupAssembly_v1.swb | BackupAssembly_v1.swp | Project-created backup macro |
| BOM_v19.swb | BOM_v19.swp | Project-owned original |
| BOM_v19_ROfriendy.swb | BOM_v19_ROfriendy.swp | Internal read-only variant |
| CNCDXF_v1.swb | CNCDXF_final_v1.swp | Project-created; internal DXF alignment vector |
| CrawlScrews_v1.swb | CrawlScrews_v1.swp | Project-created opt-in diagnostic |
| DXF_v16.swb | DXF_v16.swp | Project-owned original |
| DXF_v16_ROfriendy.swb | DXF_v16_ROfriendy.swp | Internal read-only variant |
| PDF_v1.swb | PDF_v1.swp | Project-created drawing exporter |
| Radius_v9.swb | Radius_v9.swp | Project-owned original |

SWPs correspond to the included readable SWBs. SOLIDWORKS can convert these
sources through its macro editor when rebuilding macros.
Generic identifiers are used; deployment paths and project prefixes come from
editable settings or an external preset.

CrawlScrews remains an opt-in local diagnostic with privacy confirmation before
document access. Its reports can include screenshots, paths, configurations
and feature names; no live reports or vendor/customer fixtures are transferred.

## Third-party Material

The embedded copy and folder-open glyphs are Lucide ISC-licensed SVGs. Their
upstream files and preserved notice are recorded in THIRD_PARTY_NOTICES.md and
licenses/Lucide-ISC.txt. No icon JavaScript dependency is added.

The DWG preview-table parser in scripts/extract-sw-thumbnails.ps1 translates
the MIT-licensed DwgThumbnailReader algorithm. Its exact upstream file, commit
and notice are recorded in THIRD_PARTY_NOTICES.md and licenses/.

The machining engine contains project-authored formulas and factual normalized
data with source URLs, dates and scope beside the data. No manufacturer PDF,
catalog, logo, code or calculator output is bundled.

Electron/Chromium and the checksum-pinned NSIS/Elevate build inputs retain their
licenses. THIRD_PARTY_NOTICES.md and docs/DEPENDENCY_LICENSES.md record their
versions, declared license metadata and source archives. Independent provenance
and redistribution review remains required before public publication.

Trademark references describe interoperability or factual sources only. No
vendor endorsement or trademark rights are implied or granted.
