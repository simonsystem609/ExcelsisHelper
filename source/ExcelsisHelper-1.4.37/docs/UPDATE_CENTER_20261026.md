# Helper Update Center 1.4.37

A header Update button appears only for updates to installed Viewer/Helper or
compatible standalone macros. Settings always provides an Update Center entry.
The isolated popup lists all three products, current/latest versions, progress,
Refresh and explicit Install/Update actions. Metadata checks run quietly after
startup and every six hours. Missing optional Viewer, older public versions or
lookup failures do not create a false update notification.

The public protocol uses immutable releases owned by `simonsystem609` in
`ExcelsisViewer` and `ExcelsisHelper`. It does not fetch private candidates or
update external CAD capture/date runtimes. No local document paths, settings,
worklogs or credentials are sent. Downloads require user confirmation, exact
asset identity, HTTPS allowlists, size/digest checks and content verification.
Installers are opened normally by Windows, never silently or automatically.

Compatible macro tags bind to the exact Helper version. Existing bundled setup
must be complete. Only allowlisted SWPs are deployed; original bytes are backed
up and read back after every affected target is held with exclusive handles.
Failed writes roll back under the same handles. The revision receipt commits
last, atomically. SOLIDWORKS file locks offer Retry/Later; active macros/capture
and an already-opened Helper installer prevent overlapping macro updates.
Settings, worklogs, history and unrelated files are not replaced.

Reference behavior/protocol: https://github.com/simonsystem609/ExcelsisViewer,
commit `3abc6190c5755aea5367e7614136403979064f5a`.
Helper's implementation and popup are independently authored; no AGPL Viewer
modules, renderer engines or reference files are vendored. Helper remains
GPL-3.0-only and adds no package dependency.

Build verification includes the complete offline suite, mocked host/frame IPC,
synthetic native transaction locks/rollback/concurrent edits, eight browser
layouts and busy/progress/cancel/deferred/error states, package correspondence,
runtime integrity and Defender scans. Public metadata accepted Viewer 1.1.50
and Helper 1.4.33; no compatible public 1.4.37 macro revision existed at the
check. No live app/macro update or installation was performed during testing.
