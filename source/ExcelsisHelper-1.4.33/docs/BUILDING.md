# Reproducible Build and Inspection

## Pinned environment

- Windows 11
- Node.js 24.18.0
- npm 11.16.0
- Electron 42.11.3
- electron-builder 27.0.0-alpha.6, pinned exactly by package-lock.json
- EJS 6.0.1, pinned as a build-only override
- brace-expansion 5.0.12, fast-uri 3.1.8, xmldom 0.8.15, js-yaml 4.3.2

Current 1.4.33 source adds configurable Recent Documents folder actions and
automatic CAM-folder output with non-overwriting numbering for CNC DXF.
The document-card, laser DXF, assembly-date and performance fixes from 1.4.32
remain included. Dependencies, Electron and deployment
policies remain unchanged from 1.4.32. Repeat packaged-runtime, macro deployment
and installer checks for this combined release; source tests alone are
insufficient.
Interactive setup starts the de-elevated app with `--after-install`. Failed
macro or runtime-settings deployment shows a native warning with Retry and
Later, including instructions to save work and close SOLIDWORKS. A successful
update shows no warning. Silent installation neither launches the app nor
shows this dialog. No process is force-closed to unlock macros.

The versions above are a reviewed baseline, not a claim of latest availability.

Electron was updated only within major version 42. The public candidate does
not take an Electron 43 migration. electron-builder 27 requires Node.js
22.12 or newer. Its v27 ASAR configuration schema is used by this source.

## Build

From a clean source checkout:

~~~powershell
npm.cmd ci --legacy-peer-deps
npm.cmd audit --audit-level=low
npm.cmd audit --omit=dev --audit-level=low
npm.cmd test
npm.cmd run audit:licenses
node --check main.cjs
node --check preload.cjs
node --check automation.js
node --check scripts\doc-search-worker.cjs
node --check scripts\extract-embedded-preview.cjs
npm.cmd run dist
~~~

### Rebuilding the native utilities

`scripts/date-assembly-files.exe` is the bundled starter for a standalone C#
command used by Macro Runner. It is not an SWP or part of the CAD GLB runtime.
Helper runs the user-replaceable copy under `Documents\Excelsis Helper\Assembly
Date`. Rebuild the starter before packaging when `tools/date-assembly-files.cs`
changes. Also rebuild CAD capture when any of its three C# files changes.
Use Microsoft Roslyn 4.14.0, a compiler supporting deterministic builds:

~~~powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/build-cad-utilities.ps1 `
  -InteropDirectory 'C:\path\to\SOLIDWORKS\api\redist' `
  -OutputDirectory 'C:\new-empty-build-folder' `
  -CscPath 'C:\path\to\Roslyn\csc.exe'
node tools\test-date-assembly-files.cjs
~~~

The script refuses to overwrite outputs and includes all three CAD capture
source files. It uses `/link` for the two API interop assemblies, so the
commands require no adjacent vendor DLLs. `/deterministic+` and a neutral
source path map permit independent identical native builds. Review and scan
the outputs before copying them to their two runtime paths and packaging.
Startup and synthetic-file tests are not live SOLIDWORKS acceptance.

The release build uses Microsoft-signed Roslyn 4.14.0 (`csc.exe` SHA-256
`2DC1461B1A6E95BE9C1BECEB4B263141B7BB90E704029344A0C2D1A5693D9007`),
from Microsoft.Net.Compilers.Toolset 4.14.0 (NuGet package SHA-256
`941A9CF3EA618D88D01A3DD6B1A45A06BCF07716A9F81CE4031CAA3EDD24A845`).
External build-only API interops are version 32.1.0.123, Authenticode-signed
by Dassault Systemes SolidWorks Corp. The sldworks DLL SHA-256 is
`8F535BCD3310CFD878781D1581425A07A278C7D7FAD0B73F96F57920C88B9DF0`;
the swconst DLL SHA-256 is
`C3F66A359C70CAF1E43794EBF0809F168C72BFA8F7D93A543DF5FE080359BE31`.
The signed DLLs were extracted from third-party-maintained public NuGet
packages SolidWorks.Interop.sldworks/swconst 32.1.0; the DLL signatures,
not the package owner, establish vendor provenance. Prefer interops from
a licensed installation. No compiler, NuGet package or vendor DLL is shipped.

Two independent native builds produced byte-identical output. The packaged
assembly-date command SHA-256 is
`04C1199134501DF991B80B9CC5FE301B73C0947FC99DDD7724795B776B264A2D`;
CAD capture SHA-256 is
`6778A61898FDC81E5BD519E2E764D5CDFDF572261D27A0E8C53A01E3D0DD9353`.
These binaries, not the original transfer binaries, are used in the release.

For a later command-only fix, build the EXE and replace the external Documents
copy between runs; Helper preserves that file on startup and no app version
bump is needed. Keep the CLI preview/apply JSON contract compatible with the
installed host. Host UI, IPC, or seeding changes still require an installer.

npm ci and electron-builder fetch exact archives from the npm registry,
Electron releases, and electron-builder binary releases. The lockfile and
upstream checksums verify those inputs. Electron 42.11.3 has no npm lifecycle
install script; no locked npm package declares an install script.
electron-builder fetches its checked runtime and toolset archives during
packaging.

The clean-install command sets `legacy-peer-deps` solely to omit
electron-builder's optional Squirrel.Windows target plugin from the resolved
lockfile. This project configures only NSIS. The omitted plugin is not needed
to install dependencies, test, package, or inspect this release.

electron-builder 27's NSIS template rendering still requests EJS 3, whose
declared Jake/Filelist build tree is flagged by the July 2026
`brace-expansion` advisory. EJS 6 retains the renderer API exercised by the
NSIS build while removing that unused dependency chain, so `package.json`
pins it as an override. A clean install, current full and production audits,
the complete test suite, and an NSIS build must pass for each combined release.

The build-only `js-yaml` dependency is pinned to 4.3.2 by the reviewed security
patch lockfile. It is reached through electron-builder and is not shipped in
the application runtime.

Runtime scripts use an exact 17-file resource allowlist, checked by
`tools/test-release-hardening.cjs` and consumed by
`tools/audit-build-correspondence.cjs`. Development-only tools are not runtime
resources. The package name is `excelsis-helper`; the installer appId,
productName, explicit user-data directory, and external settings import remain
unchanged. SWPs are scanned as Latin-1 and at both UTF-16 byte alignments.

Do not launch the application merely to inspect a package. The build creates
one universal, preset-free installer:

- dist\Excelsis Helper-Setup-1.4.33.exe
- dist\Excelsis Helper-Setup-1.4.33.exe.blockmap
- dist\win-unpacked\

An optional `ExcelsisHelper-settings.json` beside the setup EXE uses the same
schema as Settings > Import/Export. The installer stages it for first startup;
without that sidecar, generic application defaults remain in effect. The
sidecar is never embedded in the setup EXE.

## Non-launching verification

~~~powershell
Get-FileHash -Algorithm SHA256 '.\dist\Excelsis Helper-Setup-1.4.33.exe'
Get-AuthenticodeSignature '.\dist\Excelsis Helper-Setup-1.4.33.exe'
node -e "import('@electron/asar').then(a => console.log(JSON.parse(a.extractFile('dist/win-unpacked/resources/app.asar','package.json')).version))"
node tools\audit-packaged-runtime.cjs "dist\win-unpacked\Excelsis Helper.exe"
~~~

The packaged-runtime audit verifies all nine Electron fuse slots and recomputes
the embedded SHA-256 hash of the app.asar header. WasmTrapHandlers remains
enabled for its lower compile-time, code-size, and runtime overhead. The
file-protocol privilege fuse is enabled because `BrowserWindow.loadFile()`
loads the packaged renderer from `app.asar`; an isolated packaged smoke test
confirmed that disabling it fails with `ERR_FILE_NOT_FOUND`. CSP, sandboxing,
context isolation, navigation denial, and trusted IPC remain enforced.

The unpacked runtime should contain only en-US.pak and hu.pak under locales.
Hardware acceleration is disabled, and the after-pack hook removes the five
unused GPU runtime files listed in scripts/after-pack.cjs.

The package must retain LICENSE.electron.txt, LICENSES.chromium.html,
resources\LICENSE.txt, resources\THIRD_PARTY_NOTICES.md, and
resources\licenses\.

The NSIS installer is per-machine. It preserves app data on uninstall, launches
only after an interactive install, and does not launch during silent installs.
It presents the project `LICENSE` as its license page. The de-elevated app
performs logged-in-user macro deployment with backups.

Candidates are unsigned unless the distributor supplies a
trusted code-signing certificate. Installer bytes can differ across rebuilds
because PE resources and NSIS output contain build metadata. Reproducibility
means exact source, lockfile, tool versions, upstream checksums, packaged-file
inventory, and recorded artifact hashes, not guaranteed byte-for-byte NSIS
output.
