# Helper 1.4.29 macro revision 20261001.1 audit

Audit date: 2026-10-01. This is an optional macro-only release for already
installed Helper 1.4.29, not a replacement installer or live SOLIDWORKS
acceptance test. The immutable 1.4.29 app release and exact app source tree
remain unchanged.

## Change and corresponding source

Both DXF macro variants now use quantity-first short filenames even when
the full part name fits. Fitting dates and non-default configurations remain
visible; overlong names shorten within a 20-character stem budget. The
`DXF-names.tsv` folder map preserves ownership across reruns and treats
untracked DXFs as occupied. Existing exports are not renamed or deleted.
The map contains source paths and configurations and should be kept in a
trusted environment. Geometry, quantities, filters, export routes and
document cleanup were not changed by this naming update.

The immutable private transfer's 11 declared patch files matched their
hashes against the exact 1.4.29 source base; its reconstructed 161-file
inventory matched the signed digest. Eight reviewed macro/test files were
integrated into the sanitized public source, with public-facing naming
documentation. The separate corresponding source under
`source/ExcelsisHelper-1.4.29-macros-20261001.1` contains 156 files /
4,851,787 bytes. Both compiled SWPs were independently recovered and match
their readable SWB sources, apart from the read-only variant's already-known
historical repeated comment prefix.

## Verification and limits

- Both DXF variants passed actual offline naming procedures, prefix and
  20-character bounds, collision separation, old-map reuse, persistent
  reruns, Unicode, long paths and failure-case tests. The other offline
  project test groups passed. The final hardening test passed separately
  with an already-audited local `js-yaml` 4.3.2 dependency.
- The frozen 1.4.29 development lockfile is retained, with its known
  medium `brace-expansion` advisory. On this host's npm 11, a new `npm ci`
  fails due to missing optional builder entries in that frozen lockfile;
  this macro-only release does not rebuild or alter the app installer.
  A lockfile-only repair was evaluated in isolated evidence but not shipped.
- Gitleaks found no secrets in the public revision source or final assets.
  Focused path and compiled-macro privacy checks passed. A byte-verified
  copy of source and assets received a Kaspersky 21.26 scan: 300 processed /
  300 OK, with zero detections, suspicions, skips, corruptions or errors.
  The host ignored requested report-only mode, but all 163 copied files
  and originals remained byte-identical afterward. No Defender scan is
  claimed.
- The six-asset manifest, source paths, hashes and synthetic release
  metadata passed Viewer's actual macro-update validator. Publication still
  requires an immutable prerelease and fresh remote-byte verification.
- SWPs are unsigned. Live SOLIDWORKS export, macro-lock handling on an
  installed machine and target laser-software acceptance remain untested.

## Macro assets

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| `DXF_v16.swb` | 283,589 | `00C099282AFB1A2A89E79E645DC01251488DCA915EA0F5D5C40BBB6D3F832BA2` |
| `DXF_v16.swp` | 345,088 | `F8F98ED13A857154E0EFF579F063F5CBDE8359B7BF371F75C29567B0DB225348` |
| `DXF_v16_ROfriendy.swb` | 282,042 | `2B4F1B760547FEF47D43F691D516B21AE047EEFF0C08D1D920F7F7D463584BBE` |
| `DXF_v16_ROfriendy.swp` | 339,968 | `B3352BAC0DD5327A18B08C2298394BF243D8031DC04DB5C5AABF01161CC4E9CC` |

`MACRO-REVISION.json` and `SHA256SUMS.txt` bind these assets to the
compatible app version and exact public source tag.
