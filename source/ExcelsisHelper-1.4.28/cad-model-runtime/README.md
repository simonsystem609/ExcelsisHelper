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
for the capture executable is included in the Helper source package at `scripts/capture-sw-assembly-geometry.cs`;
compile and replace the executable here when changing that component.
