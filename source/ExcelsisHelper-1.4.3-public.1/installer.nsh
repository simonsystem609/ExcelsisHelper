; NSIS hooks for Excelsis Helper.
;
; User Documents paths are intentionally handled by the de-elevated app, not
; this per-machine installer. On first startup for each app version, main.cjs
; copies bundled source macros into the logged-in user's Documents folder and
; backs up differing existing macros before replacement.
;
; ExcelsisHelper-settings.json uses the same format as Settings > Export. When
; it sits beside the setup EXE, the installer stages it for first startup. The
; setup EXE itself therefore remains identical for private and public use.

!macro customInstall
  ; Remove either historical preset name before staging the optional sidecar.
  ; This does not touch Documents or Electron userData, so upgrade settings and
  ; work logs remain intact.
  Delete "$INSTDIR\resources\install-settings-preset.json"
  Delete "$INSTDIR\resources\ExcelsisHelper-settings.json"
  IfFileExists "$EXEDIR\ExcelsisHelper-settings.json" 0 +2
    CopyFiles /SILENT "$EXEDIR\ExcelsisHelper-settings.json" "$INSTDIR\resources"

  ; Interactive installs launch once so staged values can fill only missing
  ; settings. Existing settings always win. Silent installs never launch the
  ; app, which keeps managed deployment non-interactive.
  ${IfNot} ${Silent}
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" ""
  ${EndIf}
!macroend

!macro customUnInstall
  ; Preserve Documents\Excelsis Helper and Electron userData on uninstall so
  ; settings, work logs, caches, diagnostics, and macro backups survive repair
  ; installs and upgrades.
!macroend
