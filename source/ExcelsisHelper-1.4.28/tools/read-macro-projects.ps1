param([string]$MacroRoot = (Join-Path $PSScriptRoot '..\macros'))

$ErrorActionPreference = 'Stop'

# Test-only OLE storage inspection. No SOLIDWORKS automation, compiler or writes.
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
using System.Text;

[ComImport, Guid("0000000B-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IReadStorage
{
    // Retain the native vtable positions before the two read-only methods.
    void ReservedCreateStream();
    [PreserveSig] int OpenStream([MarshalAs(UnmanagedType.LPWStr)] string name, IntPtr reserved,
        uint mode, uint reserved2, out IStream stream);
    void ReservedCreateStorage();
    [PreserveSig] int OpenStorage([MarshalAs(UnmanagedType.LPWStr)] string name, IReadStorage priority,
        uint mode, IntPtr exclude, uint reserved, out IReadStorage storage);
}

public static class MacroProjectReader
{
    [DllImport("ole32.dll", CharSet = CharSet.Unicode)]
    private static extern int StgOpenStorage(string name, IReadStorage priority, uint mode,
        IntPtr exclude, uint reserved, out IReadStorage storage);

    public static string Read(string filename)
    {
        var opened = new List<IReadStorage>();
        IStream stream = null;
        IntPtr count = IntPtr.Zero;
        try
        {
            IReadStorage storage;
            Marshal.ThrowExceptionForHR(StgOpenStorage(filename, null, 0x20, IntPtr.Zero, 0, out storage));
            opened.Add(storage);
            foreach (string name in new[] { "apc", "The VBA Project", "_VBA_Project" })
            {
                IReadStorage child;
                Marshal.ThrowExceptionForHR(storage.OpenStorage(name, null, 0x10, IntPtr.Zero, 0, out child));
                opened.Add(child);
                storage = child;
            }
            Marshal.ThrowExceptionForHR(storage.OpenStream("PROJECT", IntPtr.Zero, 0x10, 0, out stream));
            System.Runtime.InteropServices.ComTypes.STATSTG stat;
            stream.Stat(out stat, 1);
            if (stat.cbSize <= 0 || stat.cbSize > 65536) throw new InvalidDataException("Unexpected PROJECT size.");
            var bytes = new byte[(int)stat.cbSize];
            count = Marshal.AllocHGlobal(4);
            stream.Read(bytes, bytes.Length, count);
            if (Marshal.ReadInt32(count) != bytes.Length) throw new EndOfStreamException("Truncated PROJECT stream.");
            return Encoding.ASCII.GetString(bytes);
        }
        finally
        {
            if (count != IntPtr.Zero) Marshal.FreeHGlobal(count);
            if (stream != null) Marshal.FinalReleaseComObject(stream);
            for (int i = opened.Count - 1; i >= 0; i--) Marshal.FinalReleaseComObject(opened[i]);
        }
    }
}
'@

$results = @(foreach ($file in Get-ChildItem -LiteralPath $MacroRoot -File -Filter '*.swp') {
    $project = [MacroProjectReader]::Read($file.FullName)
    $modules = @([regex]::Matches($project, '(?m)^Module=([A-Za-z][A-Za-z0-9_]*)\r?$') |
        ForEach-Object { $_.Groups[1].Value })
    if ($modules.Count -eq 0) { throw "No standard module in $($file.Name)" }
    [pscustomobject]@{ fileName = $file.Name; modules = $modules }
})
ConvertTo-Json -InputObject $results -Depth 4 -Compress
