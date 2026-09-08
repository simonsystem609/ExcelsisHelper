# Source And Asset Provenance

This inventory accompanies the preset-free 1.4.13-public.1 distribution.
Project-owned application code, scripts, macro sources and assets remain
GPL-3.0-only. Third-party components retain their original licenses and notices.

## Project Work

The original Helper application, PowerShell/VBS scripts, macros and application
icon are project-owned work. Project changes are distributed under
GPL-3.0-only. New settings synchronization, viewport capture, AutoRadius
integration and DXF predicate tests are project-authored code.

The distribution includes no customer CAD documents, fixtures copied from real
projects, screenshots, custom fonts, user branding images, vendor SDKs,
vendor program files or proprietary CAD binaries.

## Macros

| Macro source | Recorded origin |
| --- | --- |
| BackupAssembly_v1.swb | Project-created assembly backup macro using API interoperability |
| BOM_v19.swb | Project-owned original |
| BOM_v19_ROfriendy.swb | Project-generated read-only variant |
| CNCDXF_v1.swb | Project-created macro, with alignment logic from the project's DXF macro |
| CrawlScrews_v1.swb | Project-created opt-in local diagnostic macro |
| DXF_v16.swb | Project-owned original |
| DXF_v16_ROfriendy.swb | Project-generated read-only variant |
| PDF_v1.swb | Project-created drawing exporter using API interoperability |
| Radius_v9.swb | Project-owned original with selected-face targeting changes |

The nine SWPs contain source corresponding to the supplied SWBs. Independent
source recovery verified every executable statement; the two read-only
variants differ only in comments and formatting. Editable SWBs and exact
build-ready SWPs are provided. Application packaging requires no macro build
step; modified sources can be compiled with the SOLIDWORKS VBA editor.

The received SWPs already contained neutral host-metadata paths. Independent
Latin-1 and both-alignment UTF-16 inspection found no saved developer-machine
paths. The release audit did not modify any SWP bytes. This is a statement
about the current distribution, not historical immutable releases or Git history.

Macro settings come from generic defaults and the runtime sidecar. No real
deployment preset is included. CrawlScrews requires a privacy confirmation
before collecting its local diagnostic bundle; no such bundle is supplied.

## Machining Data

The engine is project-authored. Material names, aliases, formulas and
normalized numerical ranges are factual interoperability data assembled from
the manufacturer and material-producer references recorded alongside them.
Source URLs, retrieval dates, document hashes where available, applicability
limits and conservative transfer warnings remain in `machining-engine/`.
No source catalog/PDF, manufacturer code, logo, product image or interactive
calculator output is redistributed.

Generic recommendations are explicitly provisional. Drilling, tapping and
face-milling providers retain their source identity and limits. The receiving
reviewer must independently check data provenance and recommendation scope.

## Preview Interoperability

`scripts/extract-embedded-preview.cjs` is independently authored, read-only
preview extraction for user-owned CAD files. It extracts image data without
modifying the source document or decoding model geometry.

`scripts/extract-sw-thumbnails.ps1` contains the translated DWG preview-table
algorithm from DwgThumbnailReader. Its exact upstream revision, copyright and
MIT attribution are in `THIRD_PARTY_NOTICES.md` and
`licenses/DwgThumbnailReader-MIT.txt`.

The current-viewport scripts call the installed application's viewport API;
they do not redistribute its runtime, SDK or a screenshot utility.

## Dependencies And Assets

Electron supplies Chromium and generated notices. electron-builder supplies
its checked NSIS/elevation tools. ResEdit changes project-owned icon resources.
`THIRD_PARTY_NOTICES.md`, `licenses/`, `docs/DEPENDENCY_LICENSES.md` and the
lockfile retain dependency attribution for review. Electron is pinned to
42.11.3; electron-builder remains 27.0.0-alpha.6. Pinned xmldom 0.8.15, fast-uri
3.1.7 and js-yaml 4.3.2 retain their MIT/BSD-3-Clause/MIT declared licenses.
The complete 193-entry inventory was regenerated from the exact lockfile, and
full/production advisory checks passed on 2026-09-09. No npm dependency is
shipped as an application runtime module.

Only the application icon in PNG/ICO formats is supplied as image artwork.
Trademark references identify interoperability or data sources, not
endorsement. No trademark rights are granted by the software license.
