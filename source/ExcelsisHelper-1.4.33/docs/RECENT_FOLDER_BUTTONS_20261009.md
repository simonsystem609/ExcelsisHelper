# Recent Documents Folder Buttons

UI update, 2026-10-09, included in the 1.4.33 release source. The installed
app and earlier installers remain unchanged until a user installs the
new build; this is not a macro-only deployment.

## Configuration

Settings > Recent Documents Folder controls one folder and two independent
button names. The `recentDocsFolder` group is included in the existing Settings
save, import, export and reset routes:

```json
{
  "recentDocsFolder": {
    "path": "C:\\Drawings",
    "copyLabel": "Copy drawing path",
    "openLabel": "Open drawings"
  }
}
```

Generic defaults have an empty path and the labels `Copy Folder Path` and
`Open Folder`. The universal installer contains no deployment preset. Existing
user values override an optional external preset. Clearing the path persists and disables both
buttons; blank names use the generic defaults. Names accept up to 80 characters
on one line and remain literal text during language changes.

## Actions and Limits

Both buttons sit beneath the Recent Documents heading and wrap with available
space. Copy writes the saved path without accessing the drive. Open checks that
the saved path is a directory and asks Windows to open it. Missing/unavailable
folders or shell failures appear in the existing Helper Log. No directory is
created, no contents are scanned and no CAD API is called. While an action is
pending, both buttons are disabled to prevent repeated requests.

Trusted IPC accepts only `copy` or `open`, reads the setting in the host and
rejects relative, URL, device and alternate-stream paths. It does not accept a
target path from the renderer. The copy/folder glyphs are embedded Lucide SVGs;
the ISC notice is preserved in `licenses/Lucide-ISC.txt` and packaged through
the existing licenses resource rule.

## Verification

- `node tools/test-recent-folder-shortcut.cjs` exercises actual settings merge,
  preset precedence, old-settings compatibility, JSON round trips, path/name
  rejection, trusted actions, unavailable-folder errors and click coalescing.
- `npm.cmd test` passes the complete existing suite plus the new regression.
- Mock-only Playwright checks pass save/reload, copy/open dispatch, literal
  labels, language changes, group reset, import/export and 14 layouts across
  840, 920, 1180, 1366, 1600, 1920 and 2560 px. The existing 84 document-card
  checks also pass. No production Electron host or live folder was accessed.

Optional UI check, using a separately provided Playwright runtime:

```powershell
node tools/renderer-harness/check-recent-folder-buttons.cjs
```
