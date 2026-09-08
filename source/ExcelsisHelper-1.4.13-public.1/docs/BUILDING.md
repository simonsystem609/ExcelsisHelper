# Build And Inspection

## Recorded Environment

- Windows 11 x64
- Node.js 24.18.0 and npm 11.16.0
- Electron 42.11.3
- electron-builder 27.0.0-alpha.6
- Exact dependency resolution in `package-lock.json`

Electron 42.11.3 includes the current reviewed Electron 42 maintenance fixes.
electron-builder remains at 27.0.0-alpha.6. Pinned transitive build dependencies
include xmldom 0.8.15, fast-uri 3.1.7 and js-yaml 4.3.2. The source requires
Node.js 22.12 or newer.
Run commands from the extracted source root.

```powershell
npm.cmd ci --legacy-peer-deps
npm.cmd test
npm.cmd audit --audit-level=low
npm.cmd run audit:licenses
npm.cmd run dist -- --win nsis --x64 --publish never
```

The source intentionally excludes `.npmrc`. `--legacy-peer-deps` preserves
the project's NSIS-only dependency resolution without an optional Squirrel
target plugin. The build fetches locked dependencies and checksum-verified
Electron/electron-builder tool archives. Do not bypass failed integrity checks.

The dependency inventory and online advisory checks should be refreshed by
the receiving reviewer. Historical inventory is not proof that no new
vulnerability has been disclosed.

The 2026-09-09 independent full and production npm audits returned zero reported
vulnerabilities. Electron maintenance notes are at
[Electron 42.11.3](https://github.com/electron/electron/releases/tag/v42.11.3).
Upstream patch references: [xmldom](https://github.com/advisories/GHSA-8344-3jmq-59r6),
[fast-uri](https://github.com/advisories/GHSA-f65p-4m7j-42xc), and
[js-yaml](https://github.com/advisories/GHSA-2883-xcg3-v3hh).

The macro predicate tests use Windows' .NET Framework VB compiler with
synthetic geometry doubles. Viewport tests use mock VBScript objects. Neither
test is a live SOLIDWORKS geometry or rendering acceptance test.

## Outputs

- `dist/Excelsis Helper-Setup-1.4.13.exe`
- `dist/Excelsis Helper-Setup-1.4.13.exe.blockmap`
- `dist/win-unpacked/`

One preset-free installer serves either deployment. Optional private settings
are an external file beside setup, never a build input. No private settings
file is supplied in this distribution.

The after-pack hook retains excluded GPU runtime files under
`build-retained-runtime`, or under `EXCELSIS_BUILD_RETAIN_REMOVED_DIR` when
configured. Keep retained files and other generated outputs out of releases.

All nine compiled SWPs are build inputs and their corresponding SWB sources
are supplied. Application packaging does not compile macros. To change a macro,
use the SOLIDWORKS VBA editor with its corresponding SWB source and save a new
SWP. Verify the macro
entrypoint and test in a disposable CAD document before distribution.

## Non-Launching Inspection

```powershell
Get-FileHash -Algorithm SHA256 '.\dist\Excelsis Helper-Setup-1.4.13.exe'
Get-AuthenticodeSignature '.\dist\Excelsis Helper-Setup-1.4.13.exe'
node tools\audit-packaged-runtime.cjs "dist\win-unpacked\Excelsis Helper.exe"
node tools\audit-build-correspondence.cjs "dist\win-unpacked"
```

The correspondence audit optionally accepts a second argument naming an
independently extracted installer payload folder. It verifies the complete
bounded payload inventory against `win-unpacked` without launching setup.

Verify all nine Electron fuse slots and the embedded ASAR-header SHA-256.
File-protocol privileges remain enabled because the packaged renderer uses
`BrowserWindow.loadFile()`. Sandbox, context isolation, CSP, trusted IPC and
navigation restrictions remain enforced. Locales must be only en-US and hu.

Retain Electron/Chromium notices, `resources/LICENSE.txt`,
`resources/THIRD_PARTY_NOTICES.md` and `resources/licenses/`.
The NSIS installer is per-machine and preserves app data. It launches the
de-elevated app after interactive setup, but not during silent installation.

Only the 16 explicitly listed runtime scripts and nine SWPs are deployed;
editable SWBs, tests and build tooling stay in corresponding source.

Installer, application and elevation helper are unsigned. Rebuilds can have
different NSIS/PE bytes due to build metadata. Verify exact source, lockfile,
tool versions, packaged resources and recorded hashes rather than assuming
byte-for-byte reproducibility of the installer.
