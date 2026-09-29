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
    public sealed class ExactRequest
    {
        public int sourceIndex { get; set; }
        public string name { get; set; }
        public string sourcePath { get; set; }
        public string configuration { get; set; }
        public double[] transform { get; set; }
        public bool includeShape { get; set; }
        public double[][] supportDirections { get; set; }
    }

    public sealed class ExactInput
    {
        public string sourcePath { get; set; }
        public ExactRequest[] requests { get; set; }
    }

    [STAThread]
    private static int Main(string[] args)
    {
        try
        {
            Console.OutputEncoding = new UTF8Encoding(false);
            if (args.Length == 1 && args[0] == "--exact") return CaptureExact(false);
            if (args.Length == 1 && args[0] == "--boxes") return CaptureExact(true);
            if (args.Length == 1 && args[0] == "--tess") return CaptureTessellation(false);
            if (args.Length == 1 && args[0] == "--tess-batch") return CaptureTessellation(true);
            if (args.Length == 4 && args[0] == "--probe")
            {
                int expectedStamp;
                if (!int.TryParse(args[3], NumberStyles.Integer, CultureInfo.InvariantCulture, out expectedStamp))
                    throw new ArgumentException("Invalid source update stamp.");
                return ProbeCaptureTarget(args[1], args[2], expectedStamp);
            }
            if (args.Length == 4 && args[0] == "--session")
            {
                int expectedStamp;
                if (!int.TryParse(args[3], NumberStyles.Integer, CultureInfo.InvariantCulture, out expectedStamp))
                    throw new ArgumentException("Invalid source update stamp.");
                return CaptureSession(args[1], args[2], expectedStamp);
            }
            if (args.Length != 0) throw new ArgumentException("Unsupported capture mode.");
            ISldWorks sw = (ISldWorks)Marshal.GetActiveObject("SldWorks.Application");
            IModelDoc2 doc = (IModelDoc2)sw.ActiveDoc;
            if (doc == null || doc.GetType() != 2 ||
                !doc.GetPathName().EndsWith(".sldasm", StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("A saved assembly must be active.");
            IAssemblyDoc assembly = (IAssemblyDoc)doc;
            int expectedCount = assembly.GetComponentCount(false);
            if (expectedCount < 0 || expectedCount > 20000)
                throw new InvalidOperationException("Unsupported assembly component count.");
            Array raw = (Array)assembly.GetComponents(false);
            if (raw == null || raw.Length != expectedCount)
                throw new InvalidOperationException("SOLIDWORKS component count changed during capture.");

            List<IComponent2> modelComponents;
            var report = BuildInventory(doc, raw, true, out modelComponents);
            var serializer = new JavaScriptSerializer { MaxJsonLength = 64 * 1024 * 1024 };
            Console.Write(serializer.Serialize(report));
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("SOLIDWORKS assembly geometry capture failed: " + ex.GetType().Name + ": " + ex.Message);
            return 1;
        }
    }

    private static Dictionary<string, object> BuildInventory(IModelDoc2 doc, Array raw,
        bool includeLegacyBoxes, out List<IComponent2> modelComponents)
    {
            var timer = Stopwatch.StartNew();
            long namesTicks = 0, pathsTicks = 0, configurationsTicks = 0;
            long mirrorTicks = 0, transformTicks = 0, boxTicks = 0;
            var components = new List<Dictionary<string, object>>(raw.Length);
            modelComponents = new List<IComponent2>(raw.Length);
            var boxStems = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (object item in raw)
            {
                IComponent2 component = (IComponent2)item;
                var record = new Dictionary<string, object>();
                long sample = Stopwatch.GetTimestamp();
                record["name"] = component.Name2;
                namesTicks += Stopwatch.GetTimestamp() - sample;
                sample = Stopwatch.GetTimestamp();
                string sourcePath = component.GetPathName();
                pathsTicks += Stopwatch.GetTimestamp() - sample;
                record["sourcePath"] = sourcePath;
                sample = Stopwatch.GetTimestamp();
                record["configuration"] = component.ReferencedConfiguration;
                configurationsTicks += Stopwatch.GetTimestamp() - sample;
                sample = Stopwatch.GetTimestamp();
                bool isMirrored = component.IsMirrored();
                mirrorTicks += Stopwatch.GetTimestamp() - sample;
                record["isMirrored"] = isMirrored;
                record["transform"] = null;
                record["box"] = null;
                string stem = Path.GetFileNameWithoutExtension(sourcePath);
                if (isMirrored && stem != null && stem.StartsWith("Mirror", StringComparison.OrdinalIgnoreCase) && stem.Length > 6)
                {
                    boxStems.Add(stem);
                    string ordinaryStem = stem.Substring(6);
                    boxStems.Add(ordinaryStem);
                    for (int length = 1; length <= 3 && length < ordinaryStem.Length; length++)
                    {
                        string suffix = ordinaryStem.Substring(ordinaryStem.Length - length);
                        if (suffix[0] == '0') continue;
                        bool decimalSuffix = true;
                        foreach (char digit in suffix)
                            if (digit < '0' || digit > '9') decimalSuffix = false;
                        if (decimalSuffix) boxStems.Add(ordinaryStem.Substring(0, ordinaryStem.Length - length));
                    }
                }
                components.Add(record);
                modelComponents.Add(component);
            }

            long inventoryMs = timer.ElapsedMilliseconds;
            int boxReads = 0;
            for (int i = 0; i < components.Count; i++)
            {
                long sample = Stopwatch.GetTimestamp();
                MathTransform transform = modelComponents[i].GetTotalTransform(false);
                components[i]["transform"] = NumericArray(transform == null ? null : transform.ArrayData, 16);
                transformTicks += Stopwatch.GetTimestamp() - sample;
                string stem = Path.GetFileNameWithoutExtension((string)components[i]["sourcePath"]);
                if (!includeLegacyBoxes || stem == null || !boxStems.Contains(stem)) continue;
                sample = Stopwatch.GetTimestamp();
                components[i]["box"] = NumericArray(modelComponents[i].GetBox(false, false), 6);
                boxTicks += Stopwatch.GetTimestamp() - sample;
                boxReads++;
            }

            var report = new Dictionary<string, object>();
            report["format"] = "excelsis-sw-assembly-geometry";
            report["formatVersion"] = 1;
            report["sourcePath"] = doc.GetPathName();
            report["capturedUtc"] = DateTime.UtcNow.ToString("o", CultureInfo.InvariantCulture);
            report["componentCount"] = components.Count;
            report["boxReads"] = boxReads;
            report["inventoryMs"] = inventoryMs;
            long planesStart = Stopwatch.GetTimestamp();
            report["mirrorPlanes"] = CaptureMirrorPlanes(doc);
            long planesTicks = Stopwatch.GetTimestamp() - planesStart;
            report["elapsedMs"] = timer.ElapsedMilliseconds;
            double msPerTick = 1000.0 / Stopwatch.Frequency;
            report["timingMs"] = new Dictionary<string, object> {
                { "names", namesTicks * msPerTick }, { "paths", pathsTicks * msPerTick },
                { "configurations", configurationsTicks * msPerTick },
                { "isMirrored", mirrorTicks * msPerTick },
                { "transforms", transformTicks * msPerTick },
                { "boxes", boxTicks * msPerTick }, { "mirrorPlanes", planesTicks * msPerTick }
            };
            report["components"] = components;
            return report;
    }

    private static List<Dictionary<string, object>> CaptureMirrorPlanes(IModelDoc2 doc)
    {
        var planes = new List<Dictionary<string, object>>();
        Array rawFeatures = doc.FeatureManager.GetFeatures(true) as Array;
        if (rawFeatures == null) return planes;
        foreach (object rawFeature in rawFeatures)
        {
            IFeature feature = (IFeature)rawFeature;
            if (feature.GetTypeName2() != "MirrorCompFeat") continue;
            try
            {
                IMirrorComponentFeatureData data = feature.GetDefinition() as IMirrorComponentFeatureData;
                if (data == null) continue;
                object reference = data.MirrorPlane;
                IFeature planeFeature = reference as IFeature;
                if (planeFeature != null) reference = planeFeature.GetSpecificFeature2();
                double[] point = null;
                double[] normal = null;
                IRefPlane refPlane = reference as IRefPlane;
                IFace2 face = reference as IFace2;
                if (refPlane != null)
                {
                    double[] values = NumericArray(refPlane.Transform.ArrayData, 16);
                    point = new[] { values[9], values[10], values[11] };
                    normal = new[] { values[6], values[7], values[8] };
                }
                else if (face != null)
                {
                    ISurface surface = face.GetSurface() as ISurface;
                    if (surface == null || !surface.IsPlane()) continue;
                    double[] values = NumericArray(surface.PlaneParams, 6);
                    normal = new[] { values[0], values[1], values[2] };
                    point = new[] { values[3], values[4], values[5] };
                }
                if (point == null || normal == null) continue;
                double length = Math.Sqrt(normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2]);
                if (length < 0.999 || length > 1.001) continue;
                for (int i = 0; i < 3; i++) normal[i] /= length;
                planes.Add(new Dictionary<string, object> {
                    { "featureName", feature.Name }, { "point", point }, { "normal", normal }
                });
            }
            catch (Exception) { }
        }
        return planes;
    }

    private static int CaptureExact(bool approxOnly)
    {
        Console.InputEncoding = new UTF8Encoding(false);
        var serializer = new JavaScriptSerializer { MaxJsonLength = 64 * 1024 * 1024 };
        ExactInput input = serializer.Deserialize<ExactInput>(Console.In.ReadToEnd());
        if (input == null || input.requests == null || input.requests.Length > 2000 ||
            string.IsNullOrWhiteSpace(input.sourcePath))
            throw new InvalidDataException("Invalid exact-geometry request.");
        ISldWorks sw = (ISldWorks)Marshal.GetActiveObject("SldWorks.Application");
        IModelDoc2 doc = (IModelDoc2)sw.ActiveDoc;
        if (doc == null || doc.GetType() != 2 ||
            !string.Equals(doc.GetPathName(), input.sourcePath, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("The active assembly changed before exact-geometry capture.");
        IAssemblyDoc assembly = (IAssemblyDoc)doc;
        Array raw = (Array)assembly.GetComponents(false);
        var names = new HashSet<string>(StringComparer.Ordinal);
        var found = new List<IComponent2>[input.requests.Length];
        for (int i = 0; i < found.Length; i++)
        {
            ExactRequest request = input.requests[i];
            if (request == null || string.IsNullOrEmpty(request.name) ||
                string.IsNullOrEmpty(request.sourcePath) || request.transform == null ||
                request.transform.Length != 16 || request.sourceIndex < 0)
                throw new InvalidDataException("Invalid component identity request.");
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
            names.Add(request.name);
            found[i] = new List<IComponent2>();
        }
        foreach (object item in raw)
        {
            IComponent2 component = (IComponent2)item;
            string name = component.Name2;
            if (!names.Contains(name)) continue;
            string sourcePath = component.GetPathName();
            string configuration = component.ReferencedConfiguration;
            MathTransform transform = component.GetTotalTransform(false);
            double[] values = NumericArray(transform == null ? null : transform.ArrayData, 16);
            for (int i = 0; i < input.requests.Length; i++)
            {
                ExactRequest request = input.requests[i];
                if (request.name != name ||
                    !string.Equals(request.sourcePath, sourcePath, StringComparison.OrdinalIgnoreCase) ||
                    request.configuration != configuration || values == null) continue;
                bool samePose = true;
                for (int k = 0; k < 12; k++)
                    if (Math.Abs(request.transform[k] - values[k]) >= 0.0001) samePose = false;
                if (samePose) found[i].Add(component);
            }
        }
        var items = new List<Dictionary<string, object>>(found.Length);
        for (int i = 0; i < found.Length; i++)
        {
            var item = new Dictionary<string, object>();
            item["sourceIndex"] = input.requests[i].sourceIndex;
            item["matchedCount"] = found[i].Count;
            item["box"] = null;
            item["bodyCount"] = 0;
            item["shapeInvariant3"] = null;
            item["shapeInvariant4"] = null;
            item["supports"] = null;
            if (found[i].Count == 1)
            {
                try
                {
                    if (approxOnly) item["box"] = NumericArray(found[i][0].GetBox(false, false), 6);
                    else
                    {
                        int bodyCount;
                        double? shape3, shape4;
                        double[][] supports;
                        item["box"] = ExactWorldBox(found[i][0], out bodyCount,
                            input.requests[i].includeShape, input.requests[i].supportDirections,
                            out shape3, out shape4, out supports);
                        item["bodyCount"] = bodyCount;
                        item["shapeInvariant3"] = shape3;
                        item["shapeInvariant4"] = shape4;
                        item["supports"] = supports;
                    }
                }
                catch (Exception) { item["box"] = null; }
            }
            items.Add(item);
        }
        var output = new Dictionary<string, object>();
        output["format"] = approxOnly ? "excelsis-sw-approx-component-bounds"
            : "excelsis-sw-exact-component-bounds";
        output["formatVersion"] = 1;
        output["sourcePath"] = doc.GetPathName();
        output["items"] = items;
        Console.Write(serializer.Serialize(output));
        return 0;
    }

    private static double[] ExactWorldBox(IComponent2 component, out int bodyCount, bool includeShape,
        double[][] supportDirections, out double? shape3, out double? shape4,
        out double[][] supportValues)
    {
        shape3 = null;
        shape4 = null;
        supportValues = supportDirections == null ? null : new double[supportDirections.Length][];
        if (supportValues != null) for (int i = 0; i < supportValues.Length; i++)
            supportValues[i] = new[] { double.PositiveInfinity, double.NegativeInfinity };
        MathTransform transform = component.GetTotalTransform(false);
        double[] values = NumericArray(transform == null ? null : transform.ArrayData, 16);
        if (values == null || values[12] <= 0) throw new InvalidDataException("Missing body transform.");
        object bodyInfo;
        Array bodies = component.GetBodies3(-1, out bodyInfo) as Array;
        bodyCount = bodies == null ? 0 : bodies.Length;
        if (bodyCount == 0) return null;
        double[] low = { double.PositiveInfinity, double.PositiveInfinity, double.PositiveInfinity };
        double[] high = { double.NegativeInfinity, double.NegativeInfinity, double.NegativeInfinity };
        double total3 = 0, total4 = 0;
        bool hasShape = true;
        foreach (object rawBody in bodies)
        {
            IBody2 body = (IBody2)rawBody;
            if (includeShape) try
            {
                Array properties = body.GetMassProperties(1.0) as Array;
                if (properties == null || properties.Length < 5) hasShape = false;
                else
                {
                    total3 += Convert.ToDouble(properties.GetValue(3), CultureInfo.InvariantCulture);
                    total4 += Convert.ToDouble(properties.GetValue(4), CultureInfo.InvariantCulture);
                }
            }
            catch (Exception) { hasShape = false; }
            for (int axis = 0; axis < 3; axis++)
            {
                for (int sign = -1; sign <= 1; sign += 2)
                {
                    double x, y, z;
                    bool ok = body.GetExtremePoint(sign * values[axis], sign * values[3 + axis],
                        sign * values[6 + axis], out x, out y, out z);
                    if (!ok) return null;
                    double world = values[9 + axis] + values[12] *
                        (values[axis] * x + values[3 + axis] * y + values[6 + axis] * z);
                    if (sign < 0) low[axis] = Math.Min(low[axis], world);
                    else high[axis] = Math.Max(high[axis], world);
                }
            }
            if (supportValues != null)
            {
                for (int i = 0; i < supportDirections.Length; i++)
                {
                    double[] direction = supportDirections[i];
                    for (int sign = -1; sign <= 1; sign += 2)
                    {
                        double vx = values[0] * direction[0] + values[1] * direction[1] + values[2] * direction[2];
                        double vy = values[3] * direction[0] + values[4] * direction[1] + values[5] * direction[2];
                        double vz = values[6] * direction[0] + values[7] * direction[1] + values[8] * direction[2];
                        double x, y, z;
                        bool ok = body.GetExtremePoint(sign * vx, sign * vy, sign * vz, out x, out y, out z);
                        if (!ok) { supportValues = null; break; }
                        double wx = values[9] + values[12] * (values[0] * x + values[3] * y + values[6] * z);
                        double wy = values[10] + values[12] * (values[1] * x + values[4] * y + values[7] * z);
                        double wz = values[11] + values[12] * (values[2] * x + values[5] * y + values[8] * z);
                        double projected = direction[0] * wx + direction[1] * wy + direction[2] * wz;
                        if (sign < 0) supportValues[i][0] = Math.Min(supportValues[i][0], projected);
                        else supportValues[i][1] = Math.Max(supportValues[i][1], projected);
                    }
                    if (supportValues == null) break;
                }
            }
        }
        double[] box = { low[0], low[1], low[2], high[0], high[1], high[2] };
        if (Array.Exists(box, value => double.IsNaN(value) || double.IsInfinity(value)))
            throw new InvalidDataException("Non-finite body extrema.");
        if (includeShape && hasShape && !double.IsNaN(total3) && !double.IsInfinity(total3) &&
            !double.IsNaN(total4) && !double.IsInfinity(total4))
        {
            shape3 = total3;
            shape4 = total4;
        }
        return box;
    }

    private static int CaptureTessellation(bool batch)
    {
        Console.InputEncoding = new UTF8Encoding(false);
        var serializer = new JavaScriptSerializer { MaxJsonLength = 64 * 1024 * 1024 };
        ExactInput input = serializer.Deserialize<ExactInput>(Console.In.ReadToEnd());
        if (input == null || input.requests == null || input.requests.Length < 1 ||
            input.requests.Length > (batch ? 100 : 1) ||
            string.IsNullOrWhiteSpace(input.sourcePath))
            throw new InvalidDataException("Invalid tessellation request count.");
        var names = new HashSet<string>(StringComparer.Ordinal);
        var indices = new HashSet<int>();
        foreach (ExactRequest request in input.requests)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.name) ||
                string.IsNullOrWhiteSpace(request.sourcePath) || request.transform == null ||
                request.transform.Length != 16 || request.sourceIndex < 0 ||
                !indices.Add(request.sourceIndex))
                throw new InvalidDataException("Invalid tessellation component identity.");
            names.Add(request.name);
        }
        ISldWorks sw = (ISldWorks)Marshal.GetActiveObject("SldWorks.Application");
        IModelDoc2 doc = (IModelDoc2)sw.ActiveDoc;
        if (doc == null || doc.GetType() != 2 ||
            !string.Equals(doc.GetPathName(), input.sourcePath, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("The active assembly changed before tessellation capture.");
        Array raw = (Array)((IAssemblyDoc)doc).GetComponents(false);
        var chosen = new IComponent2[input.requests.Length];
        var matches = new int[input.requests.Length];
        foreach (object entry in raw)
        {
            IComponent2 component = (IComponent2)entry;
            string name = component.Name2;
            if (!names.Contains(name)) continue;
            string sourcePath = component.GetPathName();
            string configuration = component.ReferencedConfiguration;
            MathTransform transform = component.GetTotalTransform(false);
            double[] pose = NumericArray(transform == null ? null : transform.ArrayData, 16);
            if (pose == null) continue;
            for (int requestIndex = 0; requestIndex < input.requests.Length; requestIndex++)
            {
                ExactRequest request = input.requests[requestIndex];
                if (request.name != name ||
                    !string.Equals(request.sourcePath, sourcePath, StringComparison.OrdinalIgnoreCase) ||
                    request.configuration != configuration) continue;
                bool same = true;
                for (int k = 0; k < 12; k++)
                    if (Math.Abs(request.transform[k] - pose[k]) >= 0.0001) same = false;
                if (same) { chosen[requestIndex] = component; matches[requestIndex]++; }
            }
        }
        for (int i = 0; i < matches.Length; i++)
            if (matches[i] != 1)
                throw new InvalidOperationException("Tessellation component identity is ambiguous.");
        using (var output = new MemoryStream())
        using (var writer = new BinaryWriter(output))
        {
            if (batch)
            {
                writer.Write(new byte[] { 83, 87, 66, 84, 67, 72, 49, 0 });
                writer.Write((uint)input.requests.Length);
            }
            for (int i = 0; i < input.requests.Length; i++)
            {
                byte[] triangles = TessellateComponent(chosen[i]);
                if (batch)
                {
                    writer.Write(input.requests[i].sourceIndex);
                    writer.Write((uint)triangles.Length);
                }
                writer.Write(triangles);
                if (output.Length > 64 * 1024 * 1024)
                    throw new InvalidDataException("Batch tessellation exceeds memory limit.");
            }
            writer.Flush();
            byte[] result = output.ToArray();
            using (Stream stdout = Console.OpenStandardOutput()) stdout.Write(result, 0, result.Length);
        }
        return 0;
    }

    private static byte[] TessellateComponent(IComponent2 chosen)
    {
        object bodyInfo;
        Array bodies = chosen.GetBodies3(-1, out bodyInfo) as Array;
        if (bodies == null || bodies.Length == 0)
            throw new InvalidOperationException("Tessellation component has no bodies.");
        byte[] cached = TryCachedPartTessellation(chosen, bodies, bodyInfo as Array);
        if (cached != null) return cached;
        using (var output = new MemoryStream())
        using (var writer = new BinaryWriter(output))
        {
            writer.Write(new byte[] { 83, 87, 84, 82, 73, 49, 0, 0 });
            writer.Write((uint)0);
            int vertices = 0;
            foreach (object rawBody in bodies)
            {
                IBody2 body = (IBody2)rawBody;
                if (!body.Visible) continue;
                Array faces = body.GetFaces() as Array;
                if (faces == null || faces.Length == 0)
                    throw new InvalidDataException("A visible body has no tessellatable faces.");
                foreach (object rawFace in faces)
                {
                    IFace2 face = (IFace2)rawFace;
                    Array points = face.GetTessTriangles(true) as Array;
                    Array normals = face.GetTessNorms() as Array;
                    vertices = AppendTessellation(writer, points, normals, vertices);
                }
            }
            if (vertices == 0) throw new InvalidDataException("Component tessellation is empty.");
            output.Position = 8;
            writer.Write((uint)vertices);
            writer.Flush();
            return output.ToArray();
        }
    }

    private static byte[] TryCachedPartTessellation(IComponent2 component, Array bodies,
        Array bodyInfo)
    {
        if (bodyInfo == null || bodyInfo.Length != bodies.Length) return null;
        for (int i = 0; i < bodies.Length; i++)
        {
            IBody2 body = (IBody2)bodies.GetValue(i);
            if (!body.Visible || Convert.ToInt32(bodyInfo.GetValue(i), CultureInfo.InvariantCulture) != 1)
                return null;
        }
        try
        {
            IModelDoc2 model = component.GetModelDoc2() as IModelDoc2;
            if (model == null || model.GetType() != 1 ||
                !string.Equals(model.ConfigurationManager.ActiveConfiguration.Name,
                    component.ReferencedConfiguration, StringComparison.Ordinal)) return null;
            IPartDoc part = (IPartDoc)model;
            Array points = part.GetTessTriangles(true) as Array;
            Array normals = part.GetTessNorms() as Array;
            if (points == null || points.Length == 0 || points.Length % 9 != 0 ||
                normals == null || normals.Length != points.Length || points.Length / 3 > 2000000)
                return null;
            using (var output = new MemoryStream())
            using (var writer = new BinaryWriter(output))
            {
                writer.Write(new byte[] { 83, 87, 84, 82, 73, 49, 0, 0 });
                writer.Write((uint)0);
                int vertices = AppendTessellation(writer, points, normals, 0);
                output.Position = 8;
                writer.Write((uint)vertices);
                writer.Flush();
                return output.ToArray();
            }
        }
        catch (COMException) { return null; }
        catch (InvalidCastException) { return null; }
        catch (InvalidDataException) { return null; }
    }

    private static int AppendTessellation(BinaryWriter writer, Array points, Array normals,
        int vertices)
    {
        if (points == null || points.Length == 0 || points.Length % 9 != 0 ||
            normals == null || normals.Length != points.Length)
            throw new InvalidDataException("A visible face has incomplete tessellation.");
        if (vertices + points.Length / 3 > 2000000)
            throw new InvalidDataException("Component tessellation exceeds vertex limit.");
        for (int i = 0; i < points.Length; i += 3)
        {
            for (int axis = 0; axis < 3; axis++)
            {
                float value = Convert.ToSingle(points.GetValue(i + axis), CultureInfo.InvariantCulture);
                if (float.IsNaN(value) || float.IsInfinity(value))
                    throw new InvalidDataException("Non-finite tessellation coordinate.");
                writer.Write(value);
            }
            for (int axis = 0; axis < 3; axis++)
            {
                float value = Convert.ToSingle(normals.GetValue(i + axis), CultureInfo.InvariantCulture);
                if (float.IsNaN(value) || float.IsInfinity(value))
                    throw new InvalidDataException("Non-finite tessellation normal.");
                writer.Write(value);
            }
            vertices++;
        }
        return vertices;
    }

    private static double[] NumericArray(object raw, int expectedLength)
    {
        if (raw == null || raw == DBNull.Value) return null;
        Array values = (Array)raw;
        if (values.Length != expectedLength)
            throw new InvalidDataException("Unexpected geometry array length.");
        var result = new double[expectedLength];
        for (int i = 0; i < result.Length; i++)
        {
            result[i] = Convert.ToDouble(values.GetValue(i), CultureInfo.InvariantCulture);
            if (double.IsNaN(result[i]) || double.IsInfinity(result[i]))
                throw new InvalidDataException("Non-finite geometry value.");
        }
        return result;
    }
}
