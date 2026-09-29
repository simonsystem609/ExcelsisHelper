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
  scripts\capture-sw-assembly-geometry.cs scripts\capture-sw-assembly-session.cs
node tools\test-cad-model-session.cjs
~~~

Assembly capture pins the exported document's path, configuration, and update
stamp before it reports that switching models is safe. Keep that assembly and
its components open and unchanged until capture ends. Work Logger pauses during
the capture rather than assigning time to a stale document snapshot.
