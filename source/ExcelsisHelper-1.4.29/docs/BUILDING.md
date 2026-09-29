# Building Excelsis Helper 1.4.29

On Windows with Node.js 24 and npm, run `npm.cmd ci --legacy-peer-deps --no-audit`,
`npm.cmd test`, `npm.cmd audit --audit-level=low`, and `npm.cmd run dist` from the source
root. The pinned application build uses Electron 42.11.3 and electron-builder
27.0.0-alpha.6. The NSIS installer is under `dist/`. It is unsigned.

The installer includes two project-authored .NET Framework utilities:
`scripts/date-assembly-files.exe` and
`cad-model-runtime/capture-sw-assembly-geometry.exe`. Their full C# source is
at `tools/date-assembly-files.cs` and
`scripts/capture-sw-assembly-{geometry,session}.cs`. To build these utilities,
use SOLIDWORKS redistributable API interop assemblies (preferably from a
licensed installation's `api/redist` directory) and a C# compiler supporting
`/deterministic+`, such as Microsoft Roslyn 4.14.0:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/build-cad-utilities.ps1 `
  -InteropDirectory 'C:\path\to\SOLIDWORKS\api\redist' `
  -OutputDirectory 'C:\new-empty-build-folder' `
  -CscPath 'C:\path\to\Roslyn\csc.exe'
```

The build helper refuses to overwrite any output. Review the outputs before
placing them at the two runtime paths and rebuilding the installer. The API
interops and compiler are external build prerequisites, not included in this
repository or installer.

For this release the host used Microsoft-signed Roslyn 4.14.0 (`csc.exe`
SHA-256 `2DC1461B1A6E95BE9C1BECEB4B263141B7BB90E704029344A0C2D1A5693D9007`)
from the Microsoft-owned `Microsoft.Net.Compilers.Toolset` NuGet package
4.14.0 (package SHA-256
`941A9CF3EA618D88D01A3DD6B1A45A06BCF07716A9F81CE4031CAA3EDD24A845`).
The build-only interop DLLs were version 32.1.0.123 and had valid Windows
Authenticode signatures from Dassault Systemes SolidWorks Corp. They were
extracted from the public `SolidWorks.Interop.sldworks` and
`SolidWorks.Interop.swconst` NuGet packages version 32.1.0, maintained by a
third party; the DLL signatures, not that package owner, establish their
vendor provenance. The DLL SHA-256 values were respectively
`8F535BCD3310CFD878781D1581425A07A278C7D7FAD0B73F96F57920C88B9DF0`
and `C3F66A359C70CAF1E43794EBF0809F168C72BFA8F7D93A543DF5FE080359BE31`.
No NuGet package or vendor DLL is redistributed.

Two independent build runs with those same source/compiler/interop inputs
produced byte-identical EXEs: `date-assembly-files.exe` SHA-256
`F0FA07BF3F5906C27DBF190C811090F67034619598AAB3EBC03CBA3AB8878552`
and `capture-sw-assembly-geometry.exe` SHA-256
`546358FF155FEACBD15E12624AC5F8E77772C72AC0B38B8D1940E3BD7995DD0B`.
Those are the binaries packaged in this release. Compilation and offline
tests are not live SOLIDWORKS acceptance.

`node tools/audit-build-correspondence.cjs` verifies the expanded application's
authored files against the source, including both utilities. Run
`node tools/audit-packaged-runtime.cjs "dist/win-unpacked/Excelsis Helper.exe"`
to check Electron fuses and ASAR integrity. The nine SWP macros have readable
SWB counterparts in `macros/`. No external settings sidecar belongs in the
installer or source package.
