using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;

internal static partial class CaptureSwAssemblyGeometry
{
    private sealed class ExactGeometry
    {
        public double[] Box;
        public int BodyCount;
        public double? Shape3, Shape4;
        public double[][] Supports;
    }

    // One pinned session only. Occurrences, poses and configurations are never
    // merged by filename; target and transform validation happen before lookup.
    private sealed class CaptureGeometryCache
    {
        private sealed class Entry
        {
            public int Index;
            public string Name, SourcePath, Configuration;
            public double[] Pose, Approx, Box;
            public int BodyCount;
            public double? Shape3, Shape4;
            public readonly Dictionary<string, double[]> Supports = new Dictionary<string, double[]>();
            public byte[] Tessellation;
            public LinkedListNode<int> Node;
            public long Bytes;
        }

        private readonly Dictionary<int, Entry> entries = new Dictionary<int, Entry>();
        private readonly LinkedList<int> recent = new LinkedList<int>();
        private readonly long budget;
        private long bytes, peakBytes;
        private int approxHits, approxMisses, exactHits, exactMisses, tessellationHits, tessellationMisses;
        private int invalidations, evictions;

        public CaptureGeometryCache(long budgetBytes = 64 * 1024 * 1024)
        {
            if (budgetBytes < 0) throw new ArgumentOutOfRangeException("budgetBytes");
            budget = budgetBytes;
        }

        private static bool Finite(double value)
        {
            return !double.IsNaN(value) && !double.IsInfinity(value);
        }

        private static bool ValidBox(double[] value)
        {
            return value != null && value.Length == 6 && Array.TrueForAll(value, Finite)
                && value[0] <= value[3] && value[1] <= value[4] && value[2] <= value[5];
        }

        private Entry Find(ExactRequest request)
        {
            if (request.validatedTransform == null || request.validatedTransform.Length != 16)
                throw new InvalidDataException("Geometry cache requires a validated component pose.");
            Entry entry;
            if (entries.TryGetValue(request.sourceIndex, out entry))
            {
                bool same = entry.Name == request.name && entry.Configuration == request.configuration
                    && string.Equals(entry.SourcePath, request.sourcePath, StringComparison.OrdinalIgnoreCase);
                for (int axis = 0; same && axis < 16; axis++)
                    same = entry.Pose[axis] == request.validatedTransform[axis];
                if (same)
                {
                    recent.Remove(entry.Node);
                    recent.AddLast(entry.Node);
                    return entry;
                }
                Remove(entry);
                invalidations++;
            }
            return new Entry { Index = request.sourceIndex, Name = request.name,
                SourcePath = request.sourcePath, Configuration = request.configuration,
                Pose = (double[])request.validatedTransform.Clone() };
        }

        private void Remove(Entry entry)
        {
            entries.Remove(entry.Index);
            recent.Remove(entry.Node);
            bytes -= entry.Bytes;
        }

        private void Remember(Entry entry)
        {
            // Conservative metadata estimate as well as the actual binary buffers.
            long size = 2048 + 2L * ((entry.Name ?? "").Length + (entry.SourcePath ?? "").Length
                + (entry.Configuration ?? "").Length) + (entry.Tessellation == null ? 0 : entry.Tessellation.Length);
            foreach (string key in entry.Supports.Keys) size += 256 + key.Length * 2L;
            if (entry.Node != null) { bytes -= entry.Bytes; recent.Remove(entry.Node); entries.Remove(entry.Index); }
            entry.Node = null;
            if (size > budget) { entry.Bytes = 0; return; }
            while (bytes + size > budget && recent.Count > 0)
            {
                Remove(entries[recent.First.Value]);
                evictions++;
            }
            entry.Bytes = size;
            entry.Node = recent.AddLast(entry.Index);
            entries[entry.Index] = entry;
            bytes += size;
            peakBytes = Math.Max(peakBytes, bytes);
        }

        public double[] Approximate(ExactRequest request, Func<double[]> measure)
        {
            Entry entry = Find(request);
            if (entry.Approx != null) { approxHits++; return entry.Approx; }
            approxMisses++;
            double[] value = measure();
            if (ValidBox(value)) { entry.Approx = (double[])value.Clone(); Remember(entry); }
            return value;
        }

        private static string DirectionKey(double[] direction)
        {
            string key = "";
            foreach (double value in direction)
                key += BitConverter.DoubleToInt64Bits(value == 0 ? 0 : value).ToString("X16", CultureInfo.InvariantCulture);
            return key;
        }

        private static ExactGeometry Result(Entry entry, ExactRequest request)
        {
            double[][] supports = null;
            if (request.supportDirections != null)
            {
                supports = new double[request.supportDirections.Length][];
                for (int index = 0; index < supports.Length; index++)
                {
                    double[] value;
                    if (!entry.Supports.TryGetValue(DirectionKey(request.supportDirections[index]), out value))
                    { supports = null; break; }
                    supports[index] = value;
                }
            }
            return new ExactGeometry { Box = entry.Box, BodyCount = entry.BodyCount,
                Shape3 = request.includeShape ? entry.Shape3 : null,
                Shape4 = request.includeShape ? entry.Shape4 : null, Supports = supports };
        }

        public ExactGeometry Exact(ExactRequest request, Func<bool, double[][], ExactGeometry> measure)
        {
            Entry entry = Find(request);
            bool shapeNeeded = request.includeShape && (!entry.Shape3.HasValue || !entry.Shape4.HasValue);
            var missing = new List<double[]>();
            if (request.supportDirections != null)
                foreach (double[] direction in request.supportDirections)
                    if (!entry.Supports.ContainsKey(DirectionKey(direction))) missing.Add(direction);
            if (entry.Box != null && !shapeNeeded && missing.Count == 0)
            { exactHits++; return Result(entry, request); }
            exactMisses++;
            ExactGeometry value = measure(shapeNeeded, missing.Count == 0 ? null : missing.ToArray());
            if (value == null || !ValidBox(value.Box) || value.BodyCount <= 0)
                return value ?? new ExactGeometry();
            if (entry.Box != null)
            {
                if (entry.BodyCount != value.BodyCount)
                    throw new InvalidDataException("Component body count changed during cached geometry capture.");
                for (int axis = 0; axis < 6; axis++)
                    if (Math.Abs(entry.Box[axis] - value.Box[axis]) > 1e-9)
                        throw new InvalidDataException("Component bounds changed during cached geometry capture.");
            }
            entry.Box = (double[])value.Box.Clone();
            entry.BodyCount = value.BodyCount;
            if (shapeNeeded && value.Shape3.HasValue && value.Shape4.HasValue
                && Finite(value.Shape3.Value) && Finite(value.Shape4.Value))
            { entry.Shape3 = value.Shape3; entry.Shape4 = value.Shape4; }
            if (value.Supports != null && value.Supports.Length == missing.Count)
            {
                for (int index = 0; index < missing.Count; index++)
                {
                    double[] pair = value.Supports[index];
                    if (pair != null && pair.Length == 2 && Array.TrueForAll(pair, Finite) && pair[0] <= pair[1])
                        entry.Supports[DirectionKey(missing[index])] = (double[])pair.Clone();
                }
            }
            Remember(entry);
            return Result(entry, request);
        }

        public byte[] Tessellate(ExactRequest request, Func<byte[]> measure)
        {
            Entry entry = Find(request);
            if (entry.Tessellation != null) { tessellationHits++; return entry.Tessellation; }
            tessellationMisses++;
            byte[] value = measure();
            if (value == null || value.Length < 12 || value[0] != 83 || value[1] != 87
                || value[2] != 84 || value[3] != 82 || value[4] != 73 || value[5] != 49
                || value[6] != 0 || value[7] != 0 || BitConverter.ToUInt32(value, 8) == 0
                || 12L + BitConverter.ToUInt32(value, 8) * 24L != value.Length)
                throw new InvalidDataException("Invalid component tessellation cache payload.");
            entry.Tessellation = value;
            Remember(entry);
            return value;
        }

        public Dictionary<string, object> Profile()
        {
            return new Dictionary<string, object> {
                { "approxHits", approxHits }, { "approxMisses", approxMisses },
                { "exactHits", exactHits }, { "exactMisses", exactMisses },
                { "tessellationHits", tessellationHits }, { "tessellationMisses", tessellationMisses },
                { "invalidations", invalidations }, { "evictions", evictions },
                { "retainedBytes", bytes }, { "peakBytes", peakBytes }
            };
        }
    }
}
