using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Web.Script.Serialization;
using SolidWorks.Interop.sldworks;

internal static partial class CaptureSwAssemblyGeometry
{
    private sealed class SessionCommand
    {
        public string op { get; set; }
        public string sourcePath { get; set; }
        public ExactRequest[] requests { get; set; }
    }

    private static int ProbeCaptureTarget(string expectedPath, string expectedConfiguration,
        int expectedStamp)
    {
        ISldWorks sw = (ISldWorks)Marshal.GetActiveObject("SldWorks.Application");
        IModelDoc2 doc = sw.GetOpenDocumentByName(expectedPath) as IModelDoc2;
        if (doc == null || doc.GetType() != 2 ||
            !string.Equals(doc.GetPathName(), expectedPath, StringComparison.OrdinalIgnoreCase) ||
            !string.Equals(doc.ConfigurationManager.ActiveConfiguration.Name,
                expectedConfiguration, StringComparison.Ordinal) ||
            doc.GetUpdateStamp() != expectedStamp)
            throw new InvalidOperationException("The inactive capture target does not match its saved identity.");
        Console.WriteLine("INACTIVE_TARGET_OK");
        return 0;
    }

    private static int CaptureSession(string expectedPath, string expectedConfiguration, int expectedStamp)
    {
        Console.InputEncoding = new UTF8Encoding(false);
        if (string.IsNullOrWhiteSpace(expectedPath) || string.IsNullOrWhiteSpace(expectedConfiguration) ||
            !expectedPath.EndsWith(".sldasm", StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("Invalid capture target.");
        ISldWorks sw = (ISldWorks)Marshal.GetActiveObject("SldWorks.Application");
        IModelDoc2 doc = sw.GetOpenDocumentByName(expectedPath) as IModelDoc2;
        if (doc == null || doc.GetType() != 2 ||
            !string.Equals(doc.GetPathName(), expectedPath, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("The exported assembly must remain open in its own window.");
        IAssemblyDoc assembly = (IAssemblyDoc)doc;
        string sourcePath = doc.GetPathName();
        string configuration = doc.ConfigurationManager.ActiveConfiguration.Name;
        if (!string.Equals(configuration, expectedConfiguration, StringComparison.Ordinal) ||
            doc.GetUpdateStamp() != expectedStamp)
            throw new InvalidOperationException("The exported assembly changed after GLB capture.");
        int count = assembly.GetComponentCount(false);
        if (count < 0 || count > 20000)
            throw new InvalidOperationException("Unsupported assembly component count.");
        var serializer = new JavaScriptSerializer { MaxJsonLength = 64 * 1024 * 1024 };
        using (var writer = new BinaryWriter(Console.OpenStandardOutput()))
        {
            WriteJsonFrame(writer, serializer, new Dictionary<string, object> {
                { "format", "excelsis-sw-capture-pinned" }, { "formatVersion", 1 },
                { "sourcePath", sourcePath }, { "configuration", configuration },
                { "updateStamp", expectedStamp }
            });
            var listTimer = Stopwatch.StartNew();
            Array raw = assembly.GetComponents(false) as Array;
            long componentListMs = listTimer.ElapsedMilliseconds;
            if (raw == null || raw.Length != count)
                throw new InvalidOperationException("SOLIDWORKS component count changed during capture.");
            List<IComponent2> modelComponents;
            Dictionary<string, object> inventory = BuildInventory(doc, raw, false, out modelComponents);
            inventory["componentListMs"] = componentListMs;
            inventory["configuration"] = configuration;
            inventory["updateStamp"] = expectedStamp;
            var records = (List<Dictionary<string, object>>)inventory["components"];
            VerifyCaptureTarget(sw, doc, assembly, sourcePath, configuration, expectedStamp, count);
            WriteJsonFrame(writer, serializer, inventory);
            for (int commandNumber = 0; commandNumber < 64; commandNumber++)
            {
                string line = Console.ReadLine();
                if (line == null) throw new EndOfStreamException("Capture session ended without closing.");
                SessionCommand command = serializer.Deserialize<SessionCommand>(line);
                if (command == null || command.op == null)
                    throw new InvalidDataException("Invalid capture session command.");
                VerifyCaptureTarget(sw, doc, assembly, sourcePath, configuration, expectedStamp, count);
                if (command.op == "end") return 0;
                if (!string.Equals(command.sourcePath, sourcePath,
                    StringComparison.OrdinalIgnoreCase))
                    throw new InvalidOperationException("The capture request targets a different assembly.");
                if (command.op == "boxes")
                {
                    ExactRequest[] requests = ValidateSessionRequests(command.requests,
                        modelComponents, records, 2000);
                    var items = new List<Dictionary<string, object>>();
                    foreach (ExactRequest request in requests)
                    {
                        items.Add(new Dictionary<string, object> {
                            { "sourceIndex", request.sourceIndex },
                            { "matchedCount", 1 },
                            { "box", NumericArray(modelComponents[request.sourceIndex].GetBox(false, false), 6) }
                        });
                    }
                    WriteJsonFrame(writer, serializer, new Dictionary<string, object> {
                        { "format", "excelsis-sw-approx-component-bounds" },
                        { "formatVersion", 1 }, { "sourcePath", sourcePath }, { "items", items }
                    });
                }
                else if (command.op == "exact")
                {
                    ExactRequest[] requests = ValidateSessionRequests(command.requests,
                        modelComponents, records, 2000);
                    var items = new List<Dictionary<string, object>>(requests.Length);
                    foreach (ExactRequest request in requests)
                    {
                        var item = new Dictionary<string, object> {
                            { "sourceIndex", request.sourceIndex }, { "matchedCount", 1 },
                            { "box", null }, { "bodyCount", 0 },
                            { "shapeInvariant3", null }, { "shapeInvariant4", null },
                            { "supports", null }
                        };
                        try
                        {
                            int bodyCount;
                            double? shape3, shape4;
                            double[][] supports;
                            item["box"] = ExactWorldBox(modelComponents[request.sourceIndex],
                                out bodyCount, request.includeShape, request.supportDirections,
                                out shape3, out shape4, out supports);
                            item["bodyCount"] = bodyCount;
                            item["shapeInvariant3"] = shape3;
                            item["shapeInvariant4"] = shape4;
                            item["supports"] = supports;
                        }
                        catch (Exception) { item["box"] = null; }
                        items.Add(item);
                    }
                    WriteJsonFrame(writer, serializer, new Dictionary<string, object> {
                        { "format", "excelsis-sw-exact-component-bounds" },
                        { "formatVersion", 1 }, { "sourcePath", sourcePath }, { "items", items }
                    });
                }
                else if (command.op == "tess")
                {
                    ExactRequest[] requests = ValidateSessionRequests(command.requests,
                        modelComponents, records, 100);
                    if (requests.Length == 0)
                        throw new InvalidDataException("Empty tessellation request.");
                    using (var output = new MemoryStream())
                    using (var batch = new BinaryWriter(output))
                    {
                        batch.Write(new byte[] { 83, 87, 66, 84, 67, 72, 49, 0 });
                        batch.Write((uint)requests.Length);
                        foreach (ExactRequest request in requests)
                        {
                            byte[] triangles = TessellateComponent(modelComponents[request.sourceIndex]);
                            batch.Write(request.sourceIndex);
                            batch.Write((uint)triangles.Length);
                            batch.Write(triangles);
                            if (output.Length > 64 * 1024 * 1024)
                                throw new InvalidDataException("Batch tessellation exceeds memory limit.");
                        }
                        batch.Flush();
                        WriteFrame(writer, output.ToArray());
                    }
                }
                else throw new InvalidDataException("Unsupported capture session command.");
            }
            throw new InvalidDataException("Too many capture session commands.");
        }
    }

    private static void VerifyCaptureTarget(ISldWorks sw, IModelDoc2 doc, IAssemblyDoc assembly,
        string sourcePath, string configuration, int updateStamp, int componentCount)
    {
        IModelDoc2 open = sw.GetOpenDocumentByName(sourcePath) as IModelDoc2;
        if (open == null || !string.Equals(open.GetPathName(), sourcePath,
            StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("The exported assembly was closed during capture.");
        IntPtr originalIdentity = Marshal.GetIUnknownForObject(doc);
        IntPtr openIdentity = Marshal.GetIUnknownForObject(open);
        try
        {
            if (originalIdentity != openIdentity)
                throw new InvalidOperationException("The exported assembly was replaced during capture.");
        }
        finally
        {
            Marshal.Release(originalIdentity);
            Marshal.Release(openIdentity);
        }
        if (!string.Equals(doc.ConfigurationManager.ActiveConfiguration.Name, configuration,
            StringComparison.Ordinal) || doc.GetUpdateStamp() != updateStamp ||
            assembly.GetComponentCount(false) != componentCount)
            throw new InvalidOperationException("The exported assembly changed during capture.");
    }

    private static ExactRequest[] ValidateSessionRequests(ExactRequest[] requests,
        List<IComponent2> components, List<Dictionary<string, object>> records, int limit)
    {
        if (requests == null || requests.Length > limit)
            throw new InvalidDataException("Invalid capture request count.");
        var seen = new HashSet<int>();
        foreach (ExactRequest request in requests)
        {
            if (request == null || request.sourceIndex < 0 ||
                request.sourceIndex >= components.Count || !seen.Add(request.sourceIndex) ||
                request.transform == null || request.transform.Length != 16 ||
                request.name != (string)records[request.sourceIndex]["name"] ||
                !string.Equals(request.sourcePath,
                    (string)records[request.sourceIndex]["sourcePath"],
                    StringComparison.OrdinalIgnoreCase) ||
                request.configuration != (string)records[request.sourceIndex]["configuration"])
                throw new InvalidDataException("Capture component identity changed.");
            MathTransform transform = components[request.sourceIndex].GetTotalTransform(false);
            double[] current = NumericArray(transform == null ? null : transform.ArrayData, 16);
            if (current == null) throw new InvalidDataException("Capture component transform is missing.");
            for (int axis = 0; axis < 12; axis++)
                if (Math.Abs(current[axis] - request.transform[axis]) >= 0.0001)
                    throw new InvalidDataException("Capture component pose changed.");
            if (request.supportDirections != null)
            {
                if (request.supportDirections.Length > 12)
                    throw new InvalidDataException("Too many support directions.");
                foreach (double[] direction in request.supportDirections)
                {
                    if (direction == null || direction.Length != 3 ||
                        Array.Exists(direction, value => double.IsNaN(value) || double.IsInfinity(value)) ||
                        Math.Abs(direction[0] * direction[0] + direction[1] * direction[1] +
                            direction[2] * direction[2] - 1.0) > 0.00001)
                        throw new InvalidDataException("Invalid support direction.");
                }
            }
        }
        return requests;
    }

    private static void WriteJsonFrame(BinaryWriter writer, JavaScriptSerializer serializer,
        object value)
    {
        WriteFrame(writer, Encoding.UTF8.GetBytes(serializer.Serialize(value)));
    }

    private static void WriteFrame(BinaryWriter writer, byte[] payload)
    {
        if (payload.Length > 68 * 1024 * 1024)
            throw new InvalidDataException("Capture response exceeds size limit.");
        writer.Write((uint)payload.Length);
        writer.Write(payload);
        writer.Flush();
    }
}
