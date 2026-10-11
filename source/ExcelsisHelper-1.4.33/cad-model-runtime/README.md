# CAD Model Export Runtime

The installed Helper copies these starter files to
`Documents\Excelsis Helper\CAD Model Export`. This folder is separate from
`Macros`. Helper loads its JavaScript workflow from there for each CAD export,
then runs `export-active-glb.vbs` and `capture-sw-assembly-geometry.exe` from
the same folder. Existing files are never replaced automatically.

Edit only while no CAD export is running. Helper checks that runtime files stay
unchanged during an export and withholds delivery if they change. A bad or
missing file fails the export; it never falls back silently to a different
version. Restarting Helper is not required for JavaScript edits.

These files execute with your Windows account's permissions. Only put trusted
code in this folder. Keep a backup before replacing any file. The C# source
for the capture executable is included in the corresponding source under
`scripts`; compile and replace the executable here when changing that component.

Build the capture executable as a console-subsystem program. Helper launches it
with hidden, piped standard handles; `/target:winexe` breaks that protocol.

~~~powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/build-cad-utilities.ps1 `
  -InteropDirectory 'C:\path\to\SOLIDWORKS\api\redist' `
  -OutputDirectory 'C:\new-empty-build-folder' `
  -CscPath 'C:\path\to\Roslyn\csc.exe'
node tools\test-cad-model-session.cjs
~~~

Use the signed, pinned external inputs and deterministic build procedure in
`docs/BUILDING.md`. Review and scan the output before replacing runtime files.

Assembly capture pins the exported document's path, configuration, and update
stamp before it reports that switching models is safe. Keep that assembly and
its components open and unchanged until capture ends. Work Logger pauses during
the capture rather than assigning time to a stale document snapshot.

The capture session keeps a bounded, per-occurrence geometry cache (64 MiB
including conservative metadata estimates). Repeated bounds, exact metrics and
tessellations reuse successful results; shape/support upgrades request only
missing metrics. Every command still verifies the pinned document and every
component pose before cache lookup. Nothing is reused between exports. The
Helper timing report includes cache hits/misses after a successful session.
