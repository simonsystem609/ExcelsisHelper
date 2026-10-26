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
for the capture executable is in the private Helper source tree under `scripts`;
compile and replace the executable here when changing that component.

Build the capture executable as a console-subsystem program. Helper launches it
with hidden, piped standard handles; `/target:winexe` breaks that protocol.

~~~powershell
$csc = 'C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe'
$api = 'C:\Program Files\SOLIDWORKS Corp\SOLIDWORKS\api\redist'
& $csc /nologo /target:exe /optimize+ `
  '/out:cad-model-runtime\capture-sw-assembly-geometry.exe' `
  /r:System.Web.Extensions.dll `
  "/link:$api\SolidWorks.Interop.sldworks.dll" `
  "/link:$api\SolidWorks.Interop.swconst.dll" `
  scripts\capture-sw-assembly-geometry.cs scripts\capture-sw-assembly-session.cs `
  scripts\capture-sw-assembly-cache.cs
node tools\test-cad-model-session.cjs
~~~

Assembly capture pins the exported document's path, configuration, and update
stamp before it reports that switching models is safe. Keep that assembly and
its components open and unchanged until capture ends. Work Logger pauses during
the capture rather than assigning time to a stale document snapshot.

Part exports also identify the source by path, configuration and update stamp.
Every multibody part is captured body by body, including all visible solid and
surface bodies, without activating, rebuilding, saving or closing the CAD
document. A valid native single-body export is retained; an invalid one uses the
same body-capture fallback. During body capture the log reports when switching
models is safe; keep the target part open and unchanged until capture ends.

Each captured body becomes a separate named mesh in the GLB. Its native-meter
positions and normals are checked against the body's exact XYZ and diagonal
support extents. Body colors are used where available, otherwise neutral gray;
face-specific appearances and textures are not captured by this fallback.
Hidden bodies are excluded. Wire/graphics-only bodies, incomplete tessellation,
changed source identities or captures above the bounded geometry limits fail
without delivery; missing bodies are never silently dropped.

Delivery checks the actual binary buffer, accessor ranges, indices and usable
triangles in the active scene, not just the GLB header. Draco-compressed geometry
has structural checks only, not a full decoder. Invalid native part staging
files are preserved beside the repaired local stage as `.native.glb`. Existing
ERP exports are not repaired, replaced or deleted automatically.

The capture session keeps a bounded, per-occurrence geometry cache (64 MiB
including conservative metadata estimates). Repeated bounds, exact metrics and
tessellations reuse successful results; shape/support upgrades request only
missing metrics. Every command still verifies the pinned document and every
component pose before cache lookup. Nothing is reused between exports. The
Helper timing report includes cache hits/misses after a successful session.
