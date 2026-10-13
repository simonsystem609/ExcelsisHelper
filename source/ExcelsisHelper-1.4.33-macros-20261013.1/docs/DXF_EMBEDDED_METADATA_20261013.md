# Embedded DXF Names and Ownership

Implemented in both laser DXF variants. This public source package supplies
matching compiled and readable macros, the bounded reader and offline tests.
Live SOLIDWORKS and laser-reader acceptance remain required. Helper stays at
1.4.33; the existing installer is not rebuilt or replaced by this revision.
Verification details: `DXF_SELECTION_METADATA_20261013.md`.

## Reader Contract

The ASCII DXF begins with group-code `999` comments, before the first `SECTION`.
An existing UTF-8 BOM remains the first three bytes. Each comment has a `999`
code line followed by one value line. No TEXT, MTEXT, layers or cutting entities
are added.

1. The first comment is `EXCELSIS-DXF-META-V1-BEGIN`.
2. Collect comment values starting with `EXCELSIS-DXF-JSON `. Remove that prefix
   and concatenate their payloads in order, without inserting whitespace.
   Each payload is at most 200 ASCII characters.
3. Parse the concatenated JSON. Version 1 has exactly these fields:

```json
{
  "schemaVersion": 1,
  "fullFilename": "2xLV10_S235_original_full_part_name(M10).dxf",
  "configuration": "M10",
  "sourceId": "<64 uppercase hexadecimal characters>",
  "ownerId": "<64 uppercase hexadecimal characters>"
}
```

4. The final comment is `EXCELSIS-DXF-META-V1-END`.
5. If there is no begin marker at the start, use the actual filename as a
   fallback. Never infer a full name or ownership from a truncated name.

`fullFilename` is the complete requested DXF filename before the 20-character
shortening, including quantity, thickness, material, full part name/date,
non-default configuration and precut suffix. `configuration` always contains
the full raw configuration name, including `Default`.

The block is bounded to 65,536 ASCII bytes. JSON quotes, backslashes, controls
and non-ASCII UTF-16 code units are escaped. Use a JSON parser for the payload.

## Integrity and Ownership

The block also contains `EXCELSIS-DXF-OWNER ` chunks and exactly one
`EXCELSIS-DXF-CHECKSUM ` value. OWNER chunks concatenate to an uppercase hex
encoding of UTF-16 code units, four hex characters per code unit. The decoded
eight-field, tab-separated record is internal to the macro's name allocator.
The checksum is SHA-256 of UTF-8:

```text
decodedOwnerRecord + "\n" + concatenatedJsonText
```

`sourceId` identifies the normalized source path, configuration and export
suffix. `ownerId` also identifies the naming request. The source path itself
is not included in this metadata. Digests are identifiers and integrity checks, not
authentication, a geometry checksum or a digital signature.

The supplied reader validates the complete block:

```js
const { readDxfMetadata } = require("./tools/read-dxf-metadata.cjs");
const info = readDxfMetadata(dxfBytes);
const label = info?.fullFilename ?? actualFilename;
```

CLI reads only the bounded header and does not need SOLIDWORKS:

```powershell
node tools/read-dxf-metadata.cjs "C:\path\short-name.dxf"
```

Treat labels as untrusted display data; render text rather than HTML.

## No TSV Requirement

New exports use embedded identities for persistent repeat-export lookup. One
bounded identity index is cached per output folder per macro run. The macro
does not create, read, append or delete `DXF-names.tsv`.

Older untagged DXFs, editor-stripped identities and renamed files exceeding
20 stem characters are occupied, unclaimed files. They are preserved; a new
uniquely named export is allocated. Existing TSVs are untouched but unused.
The first run against an old folder can therefore create another DXF beside
an old untagged export. Afterwards, tagged files are reusable without a TSV,
including when processing candidates in a different order.

Fresh outputs stage locally and publish without replacing an occupied name.
Corrupt/incomplete identities and I/O failures are explicit errors, not
permission to overwrite. Only a verified matching identity qualifies an
existing DXF for the user's explicit regenerate-all choice.

## Compatibility

Group `999` is the standard ASCII DXF comment mechanism. AutoCAD ignores it
on opening, but SAVEAS can strip comments. Other editors may strip them too.
The geometry remains valid, but the macro then preserves the file as unclaimed.
Binary DXF cannot carry these comments: its native local recovery stage is
preserved and delivery is refused. Use ASCII DXF for this protocol.

Primary references:
[Autodesk group codes](https://help.autodesk.com/cloudhelp/2023/ENU/AutoCAD-DXF/files/GUID-3F0380A5-1C15-464D-BC66-2C5F094BCFB9.htm),
[Autodesk binary DXF](https://help.autodesk.com/cloudhelp/2025/ENU/AutoCAD-DXF/files/GUID-FC1C3C69-DBC2-49E4-893A-000D6538C0FE.htm),
[Microsoft BCryptHash](https://learn.microsoft.com/en-us/windows/win32/api/bcrypt/nf-bcrypt-bcrypthash),
[Microsoft SHA-256 pseudo-handle](https://learn.microsoft.com/en-us/windows/win32/seccng/cng-algorithm-pseudo-handles).

