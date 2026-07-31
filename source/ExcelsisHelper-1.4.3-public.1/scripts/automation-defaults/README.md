# Excelsis Helper User Scripts

The app installs these editable scripts into
`Documents\Excelsis Helper\Scripts`. It invokes each script as a local child
process and reads the last output line as compact JSON.

## Files

| File | Purpose |
| --- | --- |
| `create-cam-folder.ps1` | Creates the configured CAM destination for the active part or component. |
| `convert-swb-macros.ps1` | Drives the SOLIDWORKS VBA editor to convert `.swb` macros to `.swp`. |

## Upgrades

Each PowerShell file starts with an `Excelsis-Default-Version` header. At
startup, the app compares that value with the bundled script:

* A missing script is copied into the user Scripts folder.
* An older script is renamed with a timestamped `.bak` suffix and replaced.
* An equal or newer script is left unchanged.

To maintain a permanently customized copy, give its version header a value
higher than the bundled version. Review backups before removing them.
