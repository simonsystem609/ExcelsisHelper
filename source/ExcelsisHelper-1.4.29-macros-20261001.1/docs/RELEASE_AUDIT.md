# Helper 1.4.29 app release assessment and macro revision

The app-release assessment below describes the immutable 1.4.29 installer
and its original exact source at `source/ExcelsisHelper-1.4.29`. This separate
macro-revision tree changes two DXF SWP/SWB pairs and related tests only; it
was not used to rebuild or replace that installer. The macro revision passed
offline tests, compiled/readable source checks, privacy and malware scans.
Live SOLIDWORKS export and target laser-software acceptance remain pending.

The original app source tree was prepared from the immutable 1.4.29 producer
candidate in an isolated staging directory. The optional installer-adjacent
settings sidecar was not transferred. Public packaging removed development-only
probe/corpus material and added corresponding-source, dependency, provenance,
and build documentation.

The app and its original nine SWP/SWB macro pairs passed the source/package
correspondence checks. That staged application passed its test suite, the
packaged-runtime hardening check, and an npm audit with zero reported
vulnerabilities. The installer was rebuilt non-interactively from that staged
source. These checks do not constitute installed-app or live SOLIDWORKS
acceptance; the installer and macros are unsigned.

In the original app release, the Radius SWP's VBA source matched its included readable SWB. The other
eight macro pairs are byte-identical to the audited 1.4.28 public baseline.
The changed Radius macro and CAD capture/session code have focused tests;
their live SOLIDWORKS workflows were not exercised for this release.

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

The app-release assessment is limited to 1.4.29. Historical immutable
releases and their metadata have not been changed.
