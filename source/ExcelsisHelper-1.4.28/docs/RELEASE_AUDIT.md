# Helper 1.4.28 release assessment

This public source tree was prepared from the immutable 1.4.28 producer
candidate in an isolated staging directory. The optional installer-adjacent
settings sidecar was not transferred. Public packaging removed development-only
probe/corpus material and added corresponding-source, dependency, provenance,
and build documentation.

The app and its nine SWP/SWB macro pairs passed the source/package
correspondence checks. The staged application passed its test suite, the
packaged-runtime hardening check, and an npm audit with zero reported
vulnerabilities. The installer was rebuilt non-interactively from this staged
source. These checks do not constitute installed-app or live SOLIDWORKS
acceptance; the installer and macros are unsigned.

Two packaged, project-authored .NET utilities have C# source here:
`tools/date-assembly-files.cs` and
`scripts/capture-sw-assembly-{geometry,session}.cs`. A parameterized build
recipe is in `scripts/build-cad-utilities.ps1`. The release host compiled
both from their included sources using Microsoft-signed Roslyn and
Dassault-signed redistributable API interop assemblies. Two separate
deterministic builds produced identical bytes, and the resulting EXEs were
used in the final installer. Exact external build-input/output hashes and
the third-party NuGet package provenance caveat are in `docs/BUILDING.md`.
The final EXEs were inspected for fixed private paths and identifying
metadata; no bundled company-specific path was identified. Document
locations derive from the active session or user-selected settings. No
live SOLIDWORKS/CAD acceptance was exercised on this host.

This assessment is limited to the 1.4.28 release. Historical immutable
releases and their metadata have not been changed.
