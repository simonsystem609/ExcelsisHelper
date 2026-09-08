# Release Audit Scope: 1.4.13-public.1

Actual application version: `1.4.13`. Distribution label:
`1.4.13-public.1`. Project license: `GPL-3.0-only`.

## Source And Build

The preset-free source contains the application, runtime scripts, machining
engine, tests, build configuration, icons, license notices, nine readable SWBs
and nine exact build-ready SWPs. It excludes deployment settings, customer
documents, logs, caches, generated build output and proprietary CAD software.

The independent release preparation restores package identity
`excelsis-helper`, the explicit runtime-script allow-list and corresponding
regression checks. Electron is pinned to 42.11.3, electron-builder to
27.0.0-alpha.6, xmldom to 0.8.15, fast-uri to 3.1.7 and js-yaml to 4.3.2.
Install identity and product name are unchanged.

A clean dependency installation and non-launching Windows x64 NSIS build
passed on 2026-09-09. Full and production npm advisory checks reported zero
vulnerabilities. The exact 193-package license inventory was regenerated from
the lockfile. All npm packages are build dependencies, not shipped runtime
modules. Build commands and dependency provenance are in `BUILDING.md`.

## Macro Correspondence And Privacy

Independent compound-container inspection recovered the executable source
of all nine SWPs and matched it to the corresponding SWBs. The two read-only
variants differ only in comments and formatting. All 18 module
performance-cache prefixes match previously reviewed project-owned cache
bytes. Source recovery is not a live VBA execution or geometry test.

The received macros already contain neutral host-metadata paths. Independent
Latin-1 and both-alignment UTF-16 byte scans passed. This release preparation
changed no SWP or SWB bytes. The regression suite repeats binary path checks.

These findings apply to this release. Older immutable 1.4.8/1.4.9 release assets
and historical Git objects retain original saved-machine metadata; they were
not rewritten and must not be described as fully path-free.

## Tests Actually Run

The full npm suite passed, including settings/default validation, runtime
macro-sidecar synchronization, lock/read-back failure handling, Work Logger
enable/disable and export behavior, recent-document maintenance, machining
formulas/materials/solvers, MPF writing/workers, preview resource limits,
thumbnail scheduling, and release hardening.

DXF predicates were extracted and executed against synthetic Windows VB
geometry doubles. Viewport tests use substituted VBScript objects, not a live
SOLIDWORKS session. They cover active-document mismatch/switching, unavailable
COM, failed capture, mapped-drive aliases, single-flight capture, persisted
manual-cache preference, background exclusion, aspect ratio and framing.

All ten supplied PowerShell scripts parsed without errors. EcoQoS and Normal
priority were checked on a disposable test process.

## Packaged Bytes

The installer was extracted without launching it. All 70 extracted payload
files match the clean build. The ASAR contains 29 files: package metadata and
28 authored files matching source. All 35 external authored resources match,
including the 16 approved runtime scripts and nine SWPs. SWBs and build/test
tools are not deployed. No settings preset is embedded.

All nine Electron fuse slots and the embedded ASAR-header SHA-256 passed
independent verification. File-protocol privileges remain enabled for the
packaged `BrowserWindow.loadFile()` renderer. Sandbox, context isolation,
content policy, trusted IPC and navigation restrictions remain enforced.
Electron/Chromium and other redistributed component notices are included.
Locales are limited to en-US and hu.

Exact final asset checksums, malware-scan results and post-publication remote
verification are recorded in the versioned root audit of the public repository.
The installed application, installer and elevation helper are unsigned.

## User-Controlled Acceptance Still Required

The release audit did not install or launch Helper, run a live macro, modify a
CAD document, or exercise upgrade/uninstall. After a user-controlled upgrade,
verify preserved settings and logs, AutoRadius selections, changed macro
material/BOM language between runs, assembly backup, hidden/Toolbox DXF
candidates, manually framed viewport retry and real SOLIDWORKS macro loading.
Mocked tests and structural source checks do not replace these acceptance steps.
