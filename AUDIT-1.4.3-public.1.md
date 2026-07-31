# Release Audit: 1.4.3-public.1

Status: published on 2026-07-31 from release commit
`6f12b27fe738367b511cadff42451e34768aa57a` under tag
`excelsis-helper-v1.4.3-public.1`. The application and installer were not
launched during the build or audit. User installation and behavioral testing
remain pending.

## Release model

- Application version: `1.4.3`; public artifact label: `1.4.3-public.1`.
- The installer was built from this isolated, sanitized public staging tree.
  It is not a relabeled private-workspace artifact.
- No settings preset is embedded in the source tree, installer, `app.asar`, or
  unpacked resources. A private deployment can place
  `ExcelsisHelper-settings.json` beside the installer. The NSIS hook copies that
  optional file into the installed resources; an install without the sidecar
  remains public and generic.
- The sidecar uses the application's existing Settings export document format:
  `excelsis-helper-settings`, format version 1, with a `settings` object. On
  upgrade, existing AppData settings take precedence. Fresh private installs
  receive sidecar defaults. Existing settings are backed up before a changed
  preset is written.
- Installer upgrade and uninstall behavior preserves settings, activity logs,
  diagnostics, and other application data. Silent installation does not launch
  the app. Interactive post-install launch remains de-elevated.

## Included repairs

- Every Electron role retains Normal process priority with EcoQoS. A bounded
  reconciler repairs newly spawned helpers without raising process priority.
- The newest 20 Recent SW documents receive thumbnail priority while the
  worker count and queue caps stay unchanged. Missing/moved entries are repaired
  in bounded front-to-back batches.
- Recent SW renders 50 entries by default. Search and Show all retain access to
  the complete history without loading all thumbnails at startup.
- Background diagnostics remain available but are disabled by default.
- Work Logger no longer blocks its active-document heartbeat behind a complete
  SOLIDWORKS open-document traversal. It samples the active document every
  tick, advances the full inventory two documents per tick, and has a
  60-second helper startup/restart guard.
- Unsaved Save As carryover still requires at least 60,000 ms and preserves
  stable document identity plus wrong-document fail-closed checks.

- The AI-prompt generator includes only the MPF basename by default, never the
  full source path. Header comments are excluded by default. Including them
  requires an explicit warning-dialog confirmation because comments may carry
  customer or project data.
- Every untrusted prompt field is Markdown-escaped. Header comments are
  normalized and rendered as untrusted indented text; backtick and tilde fence
  sequences are neutralized. Regression tests cover existing backslashes,
  table delimiters, newlines, and attempted code-fence closure.
- The localhost renderer harness returns only generic 404 or 500 responses,
  with detailed exceptions confined to the local terminal. Responses are
  marked `no-store`.
- Recent SW and Doc Search thumbnail tiles share compact top-right `PRT`, `ASS`,
  and `DRW` document-type badges without changing thumbnail extraction.
- Unsaved SOLIDWORKS work remains tracked in memory by watcher session and
  document identity. Save/Save As promotion requires an eligible real path;
  ambiguous identity transitions fail closed.
- Work Logger export adjustments, the local milling/face-milling/drilling/
  tapping engine, automatic MPF geometry extraction, editable proposals,
  time estimates, and verified `_optimized` copy writing remain present.
- Electron remains at `42.6.1`. Helper-owned processes continue to request
  EcoQoS while retaining normal priority. Thumbnail extraction remains present.

## Security and packaging

- Both BrowserWindows use sandboxing, context isolation, restrictive CSPs,
  navigation/window-open denial, denied permission requests, and trusted
  renderer/main-frame IPC wrappers.
- Production fuses disable RunAsNode, NODE_OPTIONS, and command-line inspection.
  Embedded ASAR integrity and only-load-from-ASAR are enabled. The recomputed
  ASAR header hash matches the executable's embedded SHA-256 value
  `2c4a46a3cdb5781893d65ad291a9004192d36475c38a42ab9a6558c3a4768d41`.
- The installer contains 67 files, exactly matching `dist/win-unpacked` with no
  missing, extra, or hash-mismatched file. `app.asar` contains 28 files: all 27
  non-package source files match source byte-for-byte, and the generated
  `package.json` preserves name, version, main, license, and private status
  while omitting scripts and development dependencies.
- All 50 external project resources match source byte-for-byte. The packaged
  machining worker independently passed compaction, rewrite, transfer, and
  source-hash tests. The packaged bounded watcher independently passed its
  status-write test. Source tests cover the 60-second Work Logger promotion,
  59,999 ms rejection, relink, and wrong-document cases.
- Runtime footprint is restricted to `en-US` and `hu` locale packs. Unused
  GPU/Vulkan files are stripped, application files use ASAR, and there are no
  runtime npm modules.
- Public source, extracted ASAR, and packaged resource scans found no private
  settings, user/company path, customer identifier, operational prefix,
  credential pattern, downloaded machining corpus, research sample, PDF, PRC,
  sample MPF, or vendor binary. No external settings sidecar is present in
  public source, beside the installer, in `app.asar`, or in resources.
- License and provenance files cover the application, Electron/Chromium, NSIS,
  Elevate, electron-builder, ResEdit, DwgThumbnailReader, and cited machining
  references. The lockfile contains 193 package entries, and every entry has a
  declared SPDX license.
- The installer explicitly presents the project's `GPL-3.0-only` license page.
  The generated NSIS script contains `MUI_PAGE_LICENSE` for the exact project
  `LICENSE` file. The bundled NSIS `3.12` license text is byte-for-byte from the
  verified official `nsis@1.2.1` archive.
- A clean `npm ci` succeeded. Both the complete development-tree and
  production-only `npm audit --audit-level=low` checks report zero known
  vulnerabilities. Node syntax checks passed for 49 source files, PowerShell
  parsing passed for 11 scripts, and six JSON documents parsed successfully.
- The clean dependency tree uses Electron `42.6.1` and the official immutable
  electron-builder `27.0.0-alpha.6` prerelease. The `ejs` build-only dependency
  is overridden to `6.0.1` to remove the obsolete Jake/Filelist branch. The
  optional Squirrel.Windows peer is deliberately omitted because this project
  builds NSIS only; the release build and generated NSIS script exercise the
  resulting configuration.
- The complete test suite passed in this isolated public staging tree. Coverage
  includes settings, Work Logger and its bounded watcher,
  G-code prompt privacy, all machining modules, optimized-copy writing,
  embedded previews, thumbnail scheduling, renderer/IPC/process constraints,
  installer behavior, EcoQoS, and thumbnail badges.
- Kaspersky `21.25`, using full bases dated `2026-07-31 07:20`, scanned the
  exact final installer and recursively scanned the unpacked payload in
  report-only mode. It processed 177 objects with zero detections, suspicions,
  skipped objects, corrupted objects, or errors. Microsoft Defender was not
  active on this build host and is not claimed as release evidence.

## Corresponding source

- The public source tree contains 103 files before archiving and excludes
  `node_modules`, `dist`, Git metadata, private presets, backups, logs, caches,
  downloaded machining material, and private branding.
- The exact source ZIP must extract to those same files byte-for-byte. Its hash
  is recorded in the external checksum file because an archive cannot contain
  its own final checksum.

## Final artifacts

- Installer: `ExcelsisHelper-1.4.3-public.1-Setup.exe`
- Installer size: `93529021` bytes
- Installer SHA-256:
  `51DF46943C85EA41B196DDDAD3F30C2114C8993E5AE43E5680237682F8E538EC`
- Blockmap: `ExcelsisHelper-1.4.3-public.1-Setup.exe.blockmap`
- Blockmap size: `99194` bytes
- Blockmap SHA-256:
  `92698174F265170FF184C5533963B8D4F6FFD165582ECEBA89DD84D00B480BE2`
- Packaged app executable: `232785408` bytes
- Packaged app SHA-256:
  `421B276B25700CABF9D868B63E85BB21A6CE50C9FE5BA7EC88753EAED3D58B77`
- Packaged `app.asar`: `723087` bytes
- Packaged `app.asar` SHA-256:
  `4D4DE808A511418BF09D5AADF13568989508A81E2DCCC11028E0358FB60A7F12`
- Packaged `elevate.exe`: `33280` bytes
- Packaged `elevate.exe` SHA-256:
  `BB01CF9F5E651AB16804D37A7269DB932664989C34D26CCD204038995AA8FAD3`
- Installer, packaged app, and `elevate.exe` Authenticode: `NotSigned`.
- Build environment: Windows `10.0.26100.0`, Node.js `24.18.0`, npm
  `11.16.0`, Electron `42.6.1`, electron-builder `27.0.0-alpha.6`.

Unsigned status is explicit and is not treated as signing success. Authenticode
signing remains recommended before broad public distribution.

## Post-publication verification

- The annotated release tag dereferences to the exact audited release commit.
- All four release assets were downloaded back from GitHub. Their sizes and
  SHA-256 hashes match the local release files byte-for-byte.
- GitHub Pages built the release commit successfully, and the live page returns
  HTTP 200 with the expected installer, ExcelsisView, Excelsis3D, support, and
  development links.
- GitHub CodeQL completed successfully against the release commit.
