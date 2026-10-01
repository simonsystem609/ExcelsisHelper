# Source and Asset Provenance

This inventory covers the Excelsis Helper 1.4.29 application baseline. This
separate macro revision changes only the two DXF SWP/SWB pairs and associated
source tests; the immutable 1.4.29 installer is not rebuilt here.

## Project-owned work

The Excelsis project author owns the original Helper application source,
PowerShell/VBS scripts, SWB macros, and icon artwork supplied in this tree.
Public variants and agent-assisted changes were created for the same project
and are released under GPL-3.0-only.

`thumbnail-scheduler.cjs`, `recent-doc-maintenance.cjs`, the bounded
SOLIDWORKS watcher, the inactive-assembly capture handshake, and the Radius
outline-tangency fit check are project-authored and add no third-party runtime
material.

The source package includes no custom fonts, website screenshots, stock photos,
texture packs, user branding images, vendor program files, SDK DLLs, or
redistributable SOLIDWORKS/SolidCAM binaries.

## Macro audit

| Macro | Origin | Borrowed material |
|---|---|---|
| BackupAssembly_v1.swb | Project-created assembly backup macro | SOLIDWORKS API interoperability only |
| BOM_v19.swb | Project-owned original | None identified |
| BOM_v19_ROfriendy.swb | Project-generated read-only variant | Internal source only |
| CNCDXF_v1.swb | Project-created macro | Alignment vector reused from project-owned DXF_v16.swb |
| CrawlScrews_v1.swb | Project-created local diagnostic macro | None identified |
| DXF_v16.swb | Project-owned original | None identified |
| DXF_v16_ROfriendy.swb | Project-generated read-only variant | Internal source only |
| PDF_v1.swb | Project-created drawing PDF exporter | SOLIDWORKS API interoperability only |
| Radius_v9.swb | Project-owned original | None identified |

The original 1.4.29 installer contains compiled `.swp` forms of these nine
project-owned macros. Matching readable SWB source and build-ready SWP
artifacts are included here; only the separately published DXF SWPs are
deployed by the opt-in macro updater.
`CNCDXF_v1.swb` corresponds to the renamed `CNCDXF_final_v1.swp`.

Configurable macro shortcuts and the DXF selection, cleanup, preflight and
incremental-export changes are project-authored. They add no runtime library,
third-party binary or vendor fixture. Offline tests use synthetic CAD doubles.

CrawlScrews_v1 remains in the public build as an opt-in feature. Its wording is
vendor-neutral, its output stays local, and both the app and the macro provide
an explicit privacy warning. The in-macro confirmation occurs before document
access, so direct or renamed runs still disclose screenshots, absolute paths,
configurations, and feature names.

Public macro defaults use English and generic identifiers. Company paths and
project prefixes come from editable settings or a deployment preset. Project
prefixes can be empty where root-based detection is possible.

## Machining taxonomy and recommendation data

The machining engine is project-authored code. Its material names, aliases,
unit formulas, and normalized numerical ranges are factual interoperability
data assembled from the public manufacturer and material-producer references
named in `machining-engine/*.cjs`. Source URLs, retrieval dates, reviewed-
document SHA-256 values where available, table scope, and conservative transfer
warnings are retained beside the data. No source PDF, catalog page,
manufacturer code, logo, product image, or interactive-calculator output is
redistributed.

Generic milling seeds are independently assembled conservative fallbacks and
state in the UI when exact manufacturer data were not used. Drilling, tapping,
and indexable face-milling providers retain their source identity and withhold
or derate recommendations when their reviewed envelope is not a safe match.

## Interoperability code

scripts/extract-embedded-preview.cjs is independently authored, read-only code
for validated preview data in user-owned SOLIDWORKS files. It contains no
copied vendor source, binary material, samples, or private research notes.

scripts/extract-sw-thumbnails.ps1 contains a translation of the embedded DWG
preview-table algorithm from DwgThumbnailReader. The exact upstream file,
commit, copyright, and MIT notice are recorded in THIRD_PARTY_NOTICES.md and
licenses/DwgThumbnailReader-MIT.txt.

The assembly-date and CAD model capture utilities are project-authored C#
source at `tools/date-assembly-files.cs` and
`scripts/capture-sw-assembly-{geometry,session}.cs`. They call documented
SOLIDWORKS COM APIs and use the current user's Documents folder and explicit
settings/arguments, not a fixed company path. Their EXEs contain embedded
interop type metadata but no separate vendor DLL. The public source has a
parameterized build helper. The release host compiled both utilities twice
with Microsoft-signed Roslyn and Dassault-signed redistributable API interop
build inputs; paired outputs were byte-identical. The interop DLLs were not
packaged. Exact hashes and the NuGet package-owner caveat are in
`docs/BUILDING.md`.

## Build-generated material

Electron supplies Chromium and its generated notices. electron-builder supplies
the checksum-verified NSIS 3.12 bundle and its source-built elevate.exe; their
origin, checksums, and licenses are recorded in THIRD_PARTY_NOTICES.md and
docs/RELEASE_AUDIT.md. ResEdit changes only the project-owned executable icon
resources.

The only image assets in public source are the project-owned application icon
in PNG and ICO formats. The root PNG is used by the renderer and the build copy
is used by installed native UI.

Trademark and trade-name references are descriptive interoperability and source
identifiers only. This project is independent and is not endorsed by any named
tool manufacturer, material producer, Dassault Systemes, SOLIDWORKS, or
SolidCAM. No trademark rights are granted by the software license.
