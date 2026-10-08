# DXF macro revision 20261008.1

GPL-3.0-only macro-only corresponding source for public Helper 1.4.29.
This is not a new Helper application or installer. The unchanged application
source remains at the immutable `excelsis-helper-v1.4.29` tag.

The two DXF macros accept sparse/cutout sheet configurations only when existing
exact body-extents and opposing-face slab checks prove that they are flat.
Unreadable extents, bent bodies, insufficient planar area and missing opposing
planes remain rejected. Quantity-first short filenames and collision-safe
output ownership are unchanged.

`macros/*.swb` is readable VBA; matching `*.swp` files are compiled macro
containers. Launcher/module/procedure names are unchanged from public 1.4.29.
This package contains the supplied macro delta and its corresponding tests;
no native executable or application dependency is included here.

From this folder, using Node.js and Windows .NET Framework:

```powershell
node tools/test-dxf-macro-filters.cjs
node tools/test-dxf-macro-lifecycle.cjs
node tools/test-dxf-macro-paths.cjs
node tools/test-dxf-macro-names.cjs
node tools/test-macro-privacy.cjs
```

Tests use synthetic objects and temporary files, not live SOLIDWORKS sessions.
Reported-document regression examples are excluded from this public test copy;
the generic positive/negative flat-slab checks are retained. Macro bytes are
unchanged from the supplied delta. No installed or live-export acceptance is
claimed, and macros remain unsigned.

Install Helper 1.4.29 and launch it once, then use Viewer's opt-in **Update
macros** button. Save work and close/restart SOLIDWORKS if it locks a macro;
Retry/Later remains available. No background installation or forced shutdown.
