# Helper 1.4.33 source maintenance

The exact immutable release source remains at tag `excelsis-helper-v1.4.33`
and in `ExcelsisHelper-1.4.33-source.zip` on that release. The macro revision
tag also preserves the same source snapshot. Release assets were not replaced.

After publication, a developer-only renderer smoke-test pin on the default
branch was updated from Electron 42.6.1 to 42.11.3, matching the already
patched application build dependency. This resolves four Electron advisories
reported against the test harness. Its source inventory was updated too.
The harness is not included in the installer and is not part of the normal
application build or test chain. Application code, macros, runtime dependencies
and installer bytes are unchanged; this is not a new application release.

The full and production zero-finding npm audits in `AUDIT-1.4.33.md` cover
the locked application dependency tree. They did not audit this separate
unlocked developer fixture; do not interpret them as covering every nested
development package in the original immutable source archive. Developers
using that fixture should use the corrected default-branch source or the
application's already-patched Electron version, not its historical pin.
