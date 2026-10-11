using System;
using System.Collections;
using System.Collections.Generic;
using System.ComponentModel;
using System.Globalization;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;
using SolidWorks.Interop.sldworks;
using SolidWorks.Interop.swconst;

internal static class DateAssemblyFiles
{
    private const int MaxModels = 5000;
    private const int MaxScannedFiles = 25000;
    private const int MaxDrawings = 1000;
    private const uint MbYesNo = 0x00000004;
    private const uint MbIconWarning = 0x00000030;
    private const uint MbIconError = 0x00000010;
    private const uint MbIconInformation = 0x00000040;
    private const uint MbDefaultButton2 = 0x00000100;
    private const uint MbSetForeground = 0x00010000;
    private static readonly StringComparer Paths = StringComparer.OrdinalIgnoreCase;
    private static readonly Regex ExistingDate = new Regex(@"__SZT_\d{4}\.\d{2}\.\d{2}$",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    private sealed class DrawingPlan
    {
        public string Source;
        public string Target;
        public Dictionary<string, string> References = new Dictionary<string, string>(Paths);
        public HashSet<string> MissingReferences = new HashSet<string>(Paths);
    }

    private sealed class ModelReferencePlan
    {
        public string Source;
        public Dictionary<string, string> References = new Dictionary<string, string>(Paths);
        public HashSet<string> MissingReferences = new HashSet<string>(Paths);
    }

    private sealed class Plan
    {
        public string Root;
        public string ScopeFolder;
        public string TargetRoot;
        public string Date;
        public string Fingerprint;
        public string ToolboxRoot;
        public Dictionary<string, string> Models = new Dictionary<string, string>(Paths);
        public List<DrawingPlan> Drawings = new List<DrawingPlan>();
        public List<ModelReferencePlan> ModelReferences = new List<ModelReferencePlan>();
        public HashSet<string> DrawingInventory = new HashSet<string>(Paths);
        public HashSet<string> Toolbox = new HashSet<string>(Paths);
        public HashSet<string> MissingReferences = new HashSet<string>(Paths);
        public Dictionary<string, string> SourceStamps = new Dictionary<string, string>(Paths);
    }

    private sealed class ScopeHints
    {
        public string[] Prefixes = new string[0];
        public string[] RootNames = new string[0];
    }

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int MessageBoxW(IntPtr owner, string message, string title, uint flags);

    [DllImport("mpr.dll", CharSet = CharSet.Unicode, ExactSpelling = true)]
    private static extern int WNetGetUniversalNameW(string path, int level, IntPtr buffer, ref int bytes);

    [STAThread]
    private static int Main(string[] args)
    {
        bool interactive = args.Length == 0 ||
            (args.Length == 1 && args[0].Equals("interactive", StringComparison.OrdinalIgnoreCase));
        try
        {
            if (!interactive && (args.Length < 1 ||
                (args[0] != "preview" && args[0] != "apply" && args[0] != "scope")))
                throw new ArgumentException("Usage: DateAssemblyFiles.exe [interactive] | preview [assembly] [scope-hints-json] | apply assembly date fingerprint [backup-folder] [scope-hints-json] | scope assembly scope-hints-json [candidate]");

            if (!interactive && args[0] == "scope")
            {
                if (args.Length < 3 || args.Length > 4) throw new ArgumentException("Scope requires assembly and scope hints.");
                string scope = SelectScopeFolder(Path.GetFullPath(args[1]), ParseScopeHints(args[2]));
                Print(new { ok = true, scope, candidateInside = args.Length == 4 ?
                    (bool?)IsInsideScope(scope, Path.GetFullPath(args[3])) : null });
                return 0;
            }

            ISldWorks sw = (ISldWorks)Marshal.GetActiveObject("SldWorks.Application");
            string root = !interactive && args.Length >= 2 && !string.IsNullOrWhiteSpace(args[1])
                ? FullReferencePath(args[1]) : ActiveAssemblyPath(sw);
            string date = DateTime.Now.ToString("yyyy.MM.dd", CultureInfo.InvariantCulture);
            if (interactive)
            {
                ScopeHints hints = LoadDefaultScopeHints();
                Plan plan = BuildPlan(sw, root, date, hints);
                string message = plan.Root + "\n\nNew assembly: " + Path.GetFileName(plan.TargetRoot) +
                    "\n\nRename " + plan.Models.Count + " model file(s) and " + plan.Drawings.Count +
                    " drawing(s). " + plan.Toolbox.Count + " Toolbox reference(s) stay unchanged." +
                    "\n\nProject scope: " + plan.ScopeFolder +
                    MissingReferenceWarning(plan) +
                    "\n\nThe saved assembly will close. A verified ZIP backup is made before any rename." +
                    "\nBackup folder: " + DefaultBackupFolder() + "\n\nContinue?";
                if (MessageBoxW(IntPtr.Zero, message, "Date assembly files",
                    MbYesNo | MbIconWarning | MbDefaultButton2 | MbSetForeground) != 6)
                {
                    Print(new { ok = true, canceled = true });
                    return 0;
                }
                return ApplyPlan(sw, root, date, plan.Fingerprint, DefaultBackupFolder(), hints, true);
            }
            if (args[0] == "preview")
            {
                if (args.Length > 3) throw new ArgumentException("Unexpected preview arguments.");
                ScopeHints hints = args.Length == 3 ? ParseScopeHints(args[2]) : LoadDefaultScopeHints();
                Plan plan = BuildPlan(sw, root, date, hints);
                Print(new {
                    ok = true, root = plan.Root, target = plan.TargetRoot, scope = plan.ScopeFolder, date = plan.Date,
                    fingerprint = plan.Fingerprint, models = plan.Models.Count,
                    drawings = plan.Drawings.Count, toolbox = plan.Toolbox.Count,
                    missingReferences = plan.MissingReferences.OrderBy(x => x, Paths).ToArray(),
                    relinkedReferences = ReferenceRepairCount(plan),
                    drawingNames = plan.Drawings.Select(d => Path.GetFileName(d.Source)).ToArray(),
                    targetNames = plan.Models.Values.Concat(plan.Drawings.Select(d => d.Target))
                        .Select(Path.GetFileName).ToArray()
                });
                return 0;
            }

            if (args.Length < 4 || args.Length > 6)
                throw new ArgumentException("Apply requires assembly, date, and preview fingerprint.");
            string backupFolder = args.Length >= 5 ? Path.GetFullPath(args[4]) : DefaultBackupFolder();
            ScopeHints applyHints = args.Length == 6 ? ParseScopeHints(args[5]) : LoadDefaultScopeHints();
            return ApplyPlan(sw, root, args[2], args[3], backupFolder, applyHints, false);
        }
        catch (Exception error)
        {
            if (interactive)
                MessageBoxW(IntPtr.Zero, error.Message, "Date assembly files", MbIconError | MbSetForeground);
            Print(new { ok = false, partial = false, error = error.Message });
            return 1;
        }
    }

    private static string DefaultBackupFolder()
    {
        return Path.Combine(System.Environment.GetFolderPath(System.Environment.SpecialFolder.MyDocuments),
            "Excelsis Helper", "assembly-date-backups");
    }

    private static ScopeHints LoadDefaultScopeHints()
    {
        string file = Path.Combine(System.Environment.GetFolderPath(System.Environment.SpecialFolder.MyDocuments),
            "Excelsis Helper", "settings.json");
        if (!File.Exists(file)) return new ScopeHints();
        if (new FileInfo(file).Length > 65536) throw new InvalidDataException("Settings file is too large for project-scope detection.");
        return ParseScopeHints(File.ReadAllText(file));
    }

    private static ScopeHints ParseScopeHints(string json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new ScopeHints();
        if (json.Length > 65536) throw new InvalidDataException("Project-scope settings are too large.");
        var values = new JavaScriptSerializer().DeserializeObject(json) as Dictionary<string, object>;
        if (values == null) throw new InvalidDataException("Project-scope settings are invalid.");
        object locations;
        if (values.TryGetValue("locations", out locations))
        {
            values = locations as Dictionary<string, object>;
            if (values == null) throw new InvalidDataException("Project locations are invalid.");
        }
        object prefixes;
        object roots;
        values.TryGetValue("projectCodePrefixes", out prefixes);
        values.TryGetValue("projectRootNames", out roots);
        return new ScopeHints { Prefixes = ScopeList(prefixes), RootNames = ScopeList(roots) };
    }

    private static string[] ScopeList(object value)
    {
        if (value == null) return new string[0];
        IEnumerable sequence = value as IEnumerable;
        if (sequence == null || value is string) throw new InvalidDataException("Project-scope list is invalid.");
        var items = new HashSet<string>(Paths);
        foreach (object item in sequence)
        {
            string text = (item as string ?? "").Trim();
            if (text.Length == 0 || text.Length > 64) throw new InvalidDataException("Project-scope name is invalid.");
            items.Add(text);
            if (items.Count > 32) throw new InvalidDataException("Too many project-scope names.");
        }
        return items.ToArray();
    }

    private static int ApplyPlan(ISldWorks sw, string root, string date, string fingerprint,
        string backupFolder, ScopeHints hints, bool interactive)
    {
        if (!string.Equals(date, DateTime.Now.ToString("yyyy.MM.dd", CultureInfo.InvariantCulture),
            StringComparison.Ordinal))
            throw new InvalidOperationException("The local date changed; preview the rename again.");
        Plan applyPlan = BuildPlan(sw, root, date, hints);
        if (!string.Equals(applyPlan.Fingerprint, fingerprint, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("The assembly files or references changed after preview.");
        if (!interactive && applyPlan.MissingReferences.Count > 0 &&
            MessageBoxW(IntPtr.Zero, "The saved assembly contains missing references." +
                MissingReferenceWarning(applyPlan) +
                "\n\nOnly existing project files will be renamed. Continue?", "Date assembly files",
                MbYesNo | MbIconWarning | MbDefaultButton2 | MbSetForeground) != 6)
        {
            Print(new { ok = true, canceled = true });
            return 0;
        }
        CloseTargetAssembly(sw, applyPlan);
        if (sw.GetDocumentCount() != 0)
            throw new InvalidOperationException("SOLIDWORKS still has loaded documents. Close them and retry.");
        // Search-rule resolution can change when SOLIDWORKS unloads the assembly.
        VerifySourceFilesUnchanged(applyPlan);

        string backup = CreateVerifiedBackup(applyPlan, backupFolder);
        Console.Error.WriteLine("Verified backup: " + backup);
        VerifySourceFilesUnchanged(applyPlan);
        try
        {
            Apply(sw, applyPlan);
            if (interactive)
                MessageBoxW(IntPtr.Zero, "Renamed " + applyPlan.Models.Count + " model file(s) and " +
                    applyPlan.Drawings.Count + " drawing(s).\n\nAssembly: " + applyPlan.TargetRoot +
                    "\nBackup: " + backup + MissingReferenceWarning(applyPlan),
                    "Date assembly files", MbIconInformation | MbSetForeground);
            Print(new { ok = true, root = applyPlan.TargetRoot, backup,
                models = applyPlan.Models.Count, drawings = applyPlan.Drawings.Count,
                missingReferences = applyPlan.MissingReferences.OrderBy(x => x, Paths).ToArray(),
                relinkedReferences = ReferenceRepairCount(applyPlan) });
            return 0;
        }
        catch (Exception error)
        {
            if (interactive)
                MessageBoxW(IntPtr.Zero, "Rename stopped after file changes. Do not retry before checking the backup.\n\n" +
                    error.Message + "\n\nBackup: " + backup, "Date assembly files", MbIconError | MbSetForeground);
            Print(new { ok = false, partial = true, error = error.Message, backup });
            return 1;
        }
    }

    private static string ActiveAssemblyPath(ISldWorks sw)
    {
        IModelDoc2 active = (IModelDoc2)sw.ActiveDoc;
        if (active == null || active.GetType() != (int)swDocumentTypes_e.swDocASSEMBLY ||
            string.IsNullOrEmpty(active.GetPathName()))
            throw new InvalidOperationException("Make a saved SOLIDWORKS assembly active first.");
        if (active.GetSaveFlag())
            throw new InvalidOperationException("Save the active assembly before renaming its files.");
        return FullReferencePath(active.GetPathName());
    }

    private static Plan BuildPlan(ISldWorks sw, string root, string date, ScopeHints hints)
    {
        root = FullReferencePath(root);
        if (!File.Exists(root) || !Path.GetExtension(root).Equals(".SLDASM", StringComparison.OrdinalIgnoreCase))
            throw new FileNotFoundException("The selected assembly is not a saved SLDASM file.", root);
        if ((File.GetAttributes(root) & FileAttributes.ReparsePoint) != 0)
            throw new InvalidDataException("The assembly file is a linked file.");
        Plan plan = new Plan { Root = root, Date = date };
        plan.ScopeFolder = SelectScopeFolder(root, hints);
        RequireInsidePlan(plan, root);
        string toolbox = sw.GetUserPreferenceStringValue(
            (int)swUserPreferenceStringValue_e.swHoleWizardToolBoxFolder);
        plan.ToolboxRoot = LocateToolboxBrowser(toolbox);
        plan.TargetRoot = DatedName(root, date);
        plan.Models.Add(root, plan.TargetRoot);

        string[] dependencies = GetDependencies(sw, root, true, true);
        if (dependencies == null || dependencies.Length == 0)
            throw new InvalidDataException("The assembly dependency list is empty or unavailable.");
        for (int index = 0; index < dependencies.Length; index += 2)
            AddReferencedModel(plan, Path.GetFullPath(dependencies[index + 1]), date);
        CaptureModelReferencePlans(sw, plan);

        foreach (string drawing in FindDrawings(plan.ScopeFolder))
        {
            plan.DrawingInventory.Add(drawing);
            string[] resolved = GetDependencies(sw, drawing, false, true);
            string[] stored = GetDependencies(sw, drawing, false, false);
            if (resolved == null && stored == null) continue;
            if (resolved == null || stored == null || resolved.Length != stored.Length)
                throw new InvalidDataException("Could not reconcile drawing references: " + drawing);
            DrawingPlan item = new DrawingPlan { Source = drawing };
            for (int index = 0; index < resolved.Length; index += 2)
            {
                if (!string.Equals(resolved[index], stored[index], StringComparison.OrdinalIgnoreCase))
                    throw new InvalidDataException("Drawing reference order changed: " + drawing);
                string resolvedPath = FullReferencePath(resolved[index + 1]);
                string storedPath = Path.GetFullPath(stored[index + 1]);
                string target;
                if (plan.Models.TryGetValue(resolvedPath, out target))
                {
                    if (ReferenceFileExists(storedPath) && !Paths.Equals(FullReferencePath(storedPath), resolvedPath))
                        throw new InvalidDataException("Drawing resolves a different existing model: " + drawing);
                    item.References[storedPath] = target;
                }
            }
            if (item.References.Count == 0) continue;
            item.Target = DatedName(drawing, date);
            for (int index = 0; index < resolved.Length; index += 2)
            {
                string resolvedPath = FullReferencePath(resolved[index + 1]);
                if (plan.Models.ContainsKey(resolvedPath) || IsToolbox(plan, resolvedPath)) continue;
                string storedPath = Path.GetFullPath(stored[index + 1]);
                if (!plan.MissingReferences.Contains(resolvedPath) || !Paths.Equals(resolvedPath, storedPath))
                    throw new InvalidDataException("Drawing also uses a model outside this assembly: " + drawing);
                item.MissingReferences.Add(storedPath);
            }
            plan.Drawings.Add(item);
            if (plan.Drawings.Count > MaxDrawings) throw new InvalidDataException("Too many drawings for one rename.");
        }

        var targets = new HashSet<string>(Paths);
        foreach (KeyValuePair<string, string> pair in plan.Models)
        {
            if (!targets.Add(pair.Value) || File.Exists(pair.Value) || Directory.Exists(pair.Value))
                throw new IOException("Target model name already exists: " + pair.Value);
        }
        foreach (DrawingPlan drawing in plan.Drawings)
        {
            if (!targets.Add(drawing.Target) || File.Exists(drawing.Target) || Directory.Exists(drawing.Target))
                throw new IOException("Target drawing name already exists: " + drawing.Target);
        }
        plan.SourceStamps = CaptureSourceStamps(plan);
        plan.Fingerprint = Fingerprint(plan);
        return plan;
    }

    private static IEnumerable<string> FindDrawings(string root)
    {
        var pending = new Queue<string>();
        pending.Enqueue(root);
        int scanned = 0;
        while (pending.Count > 0)
        {
            string folder = pending.Dequeue();
            foreach (string file in Directory.EnumerateFiles(folder))
            {
                if (++scanned > MaxScannedFiles) throw new InvalidDataException("Drawing search exceeded its file safety limit.");
                if (Path.GetExtension(file).Equals(".SLDDRW", StringComparison.OrdinalIgnoreCase) &&
                    !Path.GetFileName(file).StartsWith("~$", StringComparison.Ordinal))
                {
                    if ((File.GetAttributes(file) & FileAttributes.ReparsePoint) != 0)
                        throw new InvalidDataException("Linked drawing inside assembly root: " + file);
                    yield return file;
                }
            }
            foreach (string child in Directory.EnumerateDirectories(folder))
            {
                if ((File.GetAttributes(child) & FileAttributes.ReparsePoint) != 0)
                    throw new InvalidDataException("Linked folder inside assembly root: " + child);
                pending.Enqueue(child);
            }
        }
    }

    private static string[] GetDependencies(ISldWorks sw, string file, bool traverse, bool search)
    {
        string[] raw = sw.GetDocumentDependencies2(file, traverse, search, false) as string[];
        if (raw != null && raw.Length % 2 != 0)
            throw new InvalidDataException("Malformed SOLIDWORKS dependency list: " + file);
        return raw;
    }

    private static string DatedName(string source, string date)
    {
        string stem = Path.GetFileNameWithoutExtension(source);
        if (ExistingDate.IsMatch(stem))
            throw new InvalidOperationException("A document already has an SZT date suffix: " + source);
        return Path.Combine(Path.GetDirectoryName(source), stem + "__SZT_" + date + Path.GetExtension(source));
    }

    private static bool ReferenceFileExists(string file)
    {
        try
        {
            if ((File.GetAttributes(file) & FileAttributes.Directory) != 0)
                throw new InvalidDataException("A model reference names a directory: " + file);
            return true;
        }
        catch (FileNotFoundException error)
        {
            if ((error.HResult & 0xffff) != 2) throw;
            return false;
        }
        catch (DirectoryNotFoundException error)
        {
            if ((error.HResult & 0xffff) != 3) throw;
            return false;
        }
    }

    private static string FullReferencePath(string file)
    {
        string full = Path.GetFullPath(file);
        if (full.StartsWith(@"\\", StringComparison.Ordinal) ||
            new DriveInfo(Path.GetPathRoot(full)).DriveType != DriveType.Network) return full;
        int bytes = 1024;
        IntPtr buffer = Marshal.AllocHGlobal(bytes);
        try
        {
            int result = WNetGetUniversalNameW(full, 1, buffer, ref bytes);
            if (result == 234 && bytes > 1024 && bytes <= 65536)
            {
                Marshal.FreeHGlobal(buffer);
                buffer = IntPtr.Zero;
                buffer = Marshal.AllocHGlobal(bytes);
                result = WNetGetUniversalNameW(full, 1, buffer, ref bytes);
            }
            if (result != 0) throw new IOException("Could not verify the mapped reference path: " + full,
                new Win32Exception(result));
            string universal = Marshal.PtrToStringUni(Marshal.ReadIntPtr(buffer));
            if (string.IsNullOrEmpty(universal) || !universal.StartsWith(@"\\", StringComparison.Ordinal))
                throw new InvalidDataException("Mapped reference has no verified UNC path: " + full);
            return Path.GetFullPath(universal);
        }
        finally { if (buffer != IntPtr.Zero) Marshal.FreeHGlobal(buffer); }
    }

    private static void AddReferencedModel(Plan plan, string source, string date)
    {
        source = FullReferencePath(source);
        if (IsToolbox(plan, source)) { plan.Toolbox.Add(source); return; }
        string extension = Path.GetExtension(source);
        if (!extension.Equals(".SLDPRT", StringComparison.OrdinalIgnoreCase) &&
            !extension.Equals(".SLDASM", StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("Unsupported referenced document: " + source);
        // Missing as-saved links are not files to rename; preserve them exactly.
        if (!ReferenceFileExists(source))
        {
            RequireNoUnresolvedLocalCopy(plan, source);
            plan.MissingReferences.Add(source);
        }
        else
        {
            RequireInsidePlan(plan, source);
            if (!plan.Models.ContainsKey(source)) plan.Models.Add(source, DatedName(source, date));
        }
        if (plan.Models.Count + plan.MissingReferences.Count > MaxModels)
            throw new InvalidDataException("Assembly exceeds the model safety limit.");
    }

    private static void RequireNoUnresolvedLocalCopy(Plan plan, string file)
    {
        string local = Path.Combine(Path.GetDirectoryName(plan.Root), Path.GetFileName(file));
        if (!Paths.Equals(local, file) && ReferenceFileExists(local))
            throw new InvalidDataException("SOLIDWORKS did not resolve a same-name local file; " +
                "the date tool will not guess its identity: " + file + " -> " + local);
    }

    private static string MissingReferenceWarning(Plan plan)
    {
        if (plan.MissingReferences.Count == 0) return "";
        string[] files = plan.MissingReferences.OrderBy(x => x, Paths).ToArray();
        return "\n\n" + files.Length + " missing reference(s) will stay unchanged. " +
            "This action does not repair or remove them:\n" + string.Join("\n", files.Take(8)) +
            (files.Length > 8 ? "\n... and " + (files.Length - 8) + " more." : "") +
            (ReferenceRepairCount(plan) > 0 ? "\n\n" + ReferenceRepairCount(plan) +
                " relocated reference(s) will be updated to the project files resolved by SOLIDWORKS." : "");
    }

    private static int ReferenceRepairCount(Plan plan)
    {
        return plan.ModelReferences.Sum(model => model.References.Count(pair => !Paths.Equals(pair.Key, pair.Value)));
    }

    private static bool HasUnreconciledReferences(Plan plan, string[] references)
    {
        for (int index = 0; index < references.Length; index += 2)
        {
            string file = Path.GetFullPath(references[index + 1]);
            if (!plan.Models.ContainsKey(file) && !IsToolbox(plan, file) && !plan.MissingReferences.Contains(file))
                return true;
        }
        return false;
    }

    private static void CaptureModelReferencePlans(ISldWorks sw, Plan plan)
    {
        string[] savedTree = GetDependencies(sw, plan.Root, true, false);
        if (savedTree == null) throw new InvalidDataException("Could not inspect the saved assembly references.");
        if (!HasUnreconciledReferences(plan, savedTree)) return;
        foreach (string model in plan.Models.Keys.OrderBy(x => x, Paths))
        {
            string[] stored = GetDependencies(sw, model, false, false);
            if (stored == null || stored.Length == 0 || !HasUnreconciledReferences(plan, stored)) continue;
            string[] resolved = GetDependencies(sw, model, false, true);
            plan.ModelReferences.Add(ReconcileModelReferences(plan, model, stored, resolved));
        }
    }

    private static ModelReferencePlan ReconcileModelReferences(Plan plan, string model, string[] stored, string[] resolved)
    {
        if (!plan.Models.ContainsKey(model))
            throw new InvalidDataException("Cannot update an unrelated model: " + model);
        if (resolved == null || resolved.Length != stored.Length)
            throw new InvalidDataException("Could not reconcile model references: " + model);
        ModelReferencePlan item = new ModelReferencePlan { Source = model };
        for (int index = 0; index < stored.Length; index += 2)
        {
            if (!Paths.Equals(stored[index], resolved[index]))
                throw new InvalidDataException("Model reference order changed: " + model);
            string oldPath = Path.GetFullPath(stored[index + 1]);
            string source = FullReferencePath(resolved[index + 1]);
            if (Paths.Equals(source, oldPath) && (plan.MissingReferences.Contains(source) ||
                (IsToolbox(plan, source) && !ReferenceFileExists(source))))
            {
                item.MissingReferences.Add(oldPath);
                continue;
            }
            if (!plan.Models.ContainsKey(source) && !IsToolbox(plan, source))
                throw new InvalidDataException("Model resolves a reference outside the confirmed assembly: " + source);
            if (!Paths.Equals(oldPath, source))
            {
                if (ReferenceFileExists(oldPath) && !Paths.Equals(FullReferencePath(oldPath), source))
                    throw new InvalidDataException("Model resolves a different existing file: " + oldPath + " -> " + source);
                if (!ReferenceFileExists(source) || !Paths.Equals(Path.GetFileName(oldPath), Path.GetFileName(source)))
                    throw new InvalidDataException("Could not verify the relocated model reference: " + oldPath + " -> " + source);
            }
            string previous;
            if (item.References.TryGetValue(oldPath, out previous) && !Paths.Equals(previous, source))
                throw new InvalidDataException("One saved reference resolves to different models: " + oldPath);
            item.References[oldPath] = source;
        }
        return item;
    }

    private static string WithSlash(string folder)
    {
        return Path.GetFullPath(folder).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
    }

    private static string SelectScopeFolder(string root, ScopeHints hints)
    {
        string assemblyFolder = WithSlash(Path.GetDirectoryName(root));
        if (hints == null) return assemblyFolder;
        string alternation = string.Join("|", hints.Prefixes.Select(Regex.Escape));
        Regex projectName = alternation.Length == 0 ? null : new Regex(
            @"^(?:" + alternation + @")-\d{2}-\d{2,3}(?:[_\-\s].*)?$",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
        var rootNames = new HashSet<string>(hints.RootNames, Paths);
        for (DirectoryInfo folder = new DirectoryInfo(Path.GetDirectoryName(root));
            folder != null; folder = folder.Parent)
        {
            if (projectName != null && projectName.IsMatch(folder.Name)) return WithSlash(folder.FullName);
            DirectoryInfo parent = folder.Parent;
            if (parent == null) continue;
            if (rootNames.Contains(parent.Name) && !Regex.IsMatch(folder.Name, @"^20\d{2}$"))
                return WithSlash(folder.FullName);
            if (Regex.IsMatch(parent.Name, @"^20\d{2}$") && parent.Parent != null &&
                rootNames.Contains(parent.Parent.Name))
                return WithSlash(folder.FullName);
        }
        return assemblyFolder;
    }

    private static bool IsInsideScope(string scope, string file)
    {
        return Path.GetFullPath(file).StartsWith(scope, StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsToolbox(Plan plan, string file)
    {
        return !string.IsNullOrEmpty(plan.ToolboxRoot) &&
            Path.GetExtension(file).Equals(".SLDPRT", StringComparison.OrdinalIgnoreCase) &&
            file.StartsWith(plan.ToolboxRoot, StringComparison.OrdinalIgnoreCase);
    }

    private static string LocateToolboxBrowser(string configured)
    {
        if (string.IsNullOrWhiteSpace(configured)) return "";
        string candidate = FullReferencePath(configured);
        for (int level = 0; level <= 2; level++)
        {
            if (Path.GetFileName(candidate.TrimEnd(Path.DirectorySeparatorChar))
                .Equals("browser", StringComparison.OrdinalIgnoreCase) && Directory.Exists(candidate))
                return WithSlash(candidate);
            string browser = Path.Combine(candidate, "browser");
            if (Directory.Exists(browser)) return WithSlash(browser);
            DirectoryInfo parent = Directory.GetParent(candidate);
            if (parent == null) break;
            candidate = parent.FullName;
        }
        return "";
    }

    private static void RequireInsidePlan(Plan plan, string file)
    {
        if (!IsInsideScope(plan.ScopeFolder, file))
            throw new InvalidDataException("Non-Toolbox reference is outside the project folder: " +
                file + " (project scope: " + plan.ScopeFolder + ")");
        string scope = Path.GetFullPath(plan.ScopeFolder);
        if (!Paths.Equals(scope, Path.GetPathRoot(scope)))
            scope = scope.TrimEnd(Path.DirectorySeparatorChar);
        for (string folder = Path.GetDirectoryName(file); !Paths.Equals(folder, scope);
            folder = Path.GetDirectoryName(folder))
        {
            if (string.IsNullOrEmpty(folder) || !IsInsideScope(plan.ScopeFolder, folder + Path.DirectorySeparatorChar))
                throw new InvalidDataException("Could not verify the reference folder: " + file);
            if ((File.GetAttributes(folder) & FileAttributes.ReparsePoint) != 0)
                throw new InvalidDataException("Linked folder inside the project scope: " + folder);
        }
        if ((File.GetAttributes(scope) & FileAttributes.ReparsePoint) != 0 ||
            (File.GetAttributes(file) & FileAttributes.ReparsePoint) != 0)
            throw new InvalidDataException("Linked project folder or document: " + file);
    }

    private static string Fingerprint(Plan plan)
    {
        var lines = new List<string> { plan.Root, plan.Date, plan.ScopeFolder };
        foreach (KeyValuePair<string, string> source in plan.SourceStamps.OrderBy(p => p.Key, Paths))
            lines.Add(source.Key + "|" + source.Value);
        foreach (DrawingPlan drawing in plan.Drawings.OrderBy(d => d.Source, Paths))
        {
            foreach (KeyValuePair<string, string> reference in drawing.References.OrderBy(p => p.Key, Paths))
                lines.Add(drawing.Source + "|" + reference.Key + "|" + reference.Value);
            foreach (string missing in drawing.MissingReferences.OrderBy(x => x, Paths))
                lines.Add("drawing-missing|" + drawing.Source + "|" + missing);
        }
        foreach (KeyValuePair<string, string> model in plan.Models.OrderBy(p => p.Key, Paths))
            lines.Add(model.Key + "|" + model.Value);
        foreach (string toolbox in plan.Toolbox.OrderBy(x => x, Paths)) lines.Add("toolbox|" + toolbox);
        foreach (string missing in plan.MissingReferences.OrderBy(x => x, Paths)) lines.Add("missing|" + missing);
        foreach (ModelReferencePlan model in plan.ModelReferences.OrderBy(x => x.Source, Paths))
        {
            foreach (KeyValuePair<string, string> reference in model.References.OrderBy(x => x.Key, Paths))
                lines.Add("model-ref|" + model.Source + "|" + reference.Key + "|" + reference.Value);
            foreach (string missing in model.MissingReferences.OrderBy(x => x, Paths))
                lines.Add("model-missing|" + model.Source + "|" + missing);
        }
        using (SHA256 sha = SHA256.Create())
            return Hex(sha.ComputeHash(Encoding.UTF8.GetBytes(string.Join("\n", lines))));
    }

    private static Dictionary<string, string> CaptureSourceStamps(Plan plan)
    {
        var stamps = new Dictionary<string, string>(Paths);
        foreach (string file in plan.Models.Keys.Concat(plan.DrawingInventory))
        {
            if (!File.Exists(file)) throw new FileNotFoundException("Source document is missing.", file);
            FileInfo info = new FileInfo(file);
            stamps.Add(file, info.Length + "|" + info.LastWriteTimeUtc.Ticks);
        }
        return stamps;
    }

    private static void VerifySourceFilesUnchanged(Plan plan)
    {
        foreach (ModelReferencePlan model in plan.ModelReferences)
            foreach (KeyValuePair<string, string> reference in model.References)
                if (!Paths.Equals(reference.Key, reference.Value) && ReferenceFileExists(reference.Key) &&
                    !Paths.Equals(FullReferencePath(reference.Key), reference.Value))
                    throw new InvalidOperationException("A relocated reference's original file appeared after preview: " + reference.Key);
        foreach (string missing in plan.MissingReferences)
        {
            if (ReferenceFileExists(missing))
                throw new InvalidOperationException("A missing reference appeared after preview. Run it again: " + missing);
            RequireNoUnresolvedLocalCopy(plan, missing);
        }
        var currentDrawings = new HashSet<string>(FindDrawings(plan.ScopeFolder), Paths);
        if (!currentDrawings.SetEquals(plan.DrawingInventory))
            throw new InvalidOperationException("The project drawing list changed after preview. Run it again.");
        foreach (KeyValuePair<string, string> source in plan.SourceStamps)
        {
            RequireInsidePlan(plan, source.Key);
            if (!File.Exists(source.Key))
                throw new FileNotFoundException("A source document disappeared after preview.", source.Key);
            FileInfo info = new FileInfo(source.Key);
            string current = info.Length + "|" + info.LastWriteTimeUtc.Ticks;
            if (!string.Equals(current, source.Value, StringComparison.Ordinal))
                throw new InvalidOperationException("A source document changed after preview: " + source.Key);
        }
        foreach (string target in plan.Models.Values.Concat(plan.Drawings.Select(d => d.Target)))
            if (File.Exists(target) || Directory.Exists(target))
                throw new IOException("A destination name appeared after preview: " + target);
    }


    private static void CloseTargetAssembly(ISldWorks sw, Plan plan)
    {
        Array loaded = sw.GetDocuments() as Array;
        int count = sw.GetDocumentCount();
        if (count == 0) return;
        if (loaded == null || loaded.Length != count)
            throw new InvalidOperationException("Could not verify all loaded SOLIDWORKS documents.");
        IModelDoc2 active = (IModelDoc2)sw.ActiveDoc;
        if (active == null || !Paths.Equals(FullReferencePath(active.GetPathName()), plan.Root))
            throw new InvalidOperationException("Make the target assembly active before renaming.");
        foreach (object item in loaded)
        {
            IModelDoc2 doc = item as IModelDoc2;
            if (doc == null || doc.GetSaveFlag())
                throw new InvalidOperationException("A SOLIDWORKS document has unsaved changes. Save it first.");
            string file = doc.GetPathName();
            if (!string.IsNullOrEmpty(file)) file = FullReferencePath(file);
            if (string.IsNullOrEmpty(file) ||
                (!plan.Models.ContainsKey(file) && !IsToolbox(plan, file)))
                throw new InvalidOperationException("Unrelated SOLIDWORKS document is loaded: " + file);
        }
        sw.CloseDoc(active.GetTitle());
    }

    private static string CreateVerifiedBackup(Plan plan, string backupFolder)
    {
        Directory.CreateDirectory(backupFolder);
        string backup = Path.Combine(backupFolder, Path.GetFileNameWithoutExtension(plan.Root) +
            "_before_SZT_" + DateTime.Now.ToString("yyyyMMdd_HHmmss", CultureInfo.InvariantCulture) +
            "_" + Guid.NewGuid().ToString("N").Substring(0, 8) + ".zip");
        var files = plan.Models.Keys.Concat(plan.Drawings.Select(d => d.Source)).OrderBy(x => x, Paths).ToList();
        var hashes = new Dictionary<string, string>(Paths);
        using (FileStream stream = new FileStream(backup, FileMode.CreateNew, FileAccess.Write, FileShare.None))
        using (ZipArchive archive = new ZipArchive(stream, ZipArchiveMode.Create))
        {
            foreach (string file in files)
            {
                string relative = file.Substring(plan.ScopeFolder.Length).Replace('\\', '/');
                ZipArchiveEntry entry = archive.CreateEntry(relative, CompressionLevel.Optimal);
                using (FileStream source = File.OpenRead(file))
                using (Stream target = entry.Open()) source.CopyTo(target);
                hashes.Add(relative, Hash(file));
            }
        }
        using (ZipArchive archive = ZipFile.OpenRead(backup))
        {
            if (archive.Entries.Count != files.Count) throw new InvalidDataException("Backup file count differs.");
            foreach (ZipArchiveEntry entry in archive.Entries)
            {
                string expected;
                if (!hashes.TryGetValue(entry.FullName, out expected))
                    throw new InvalidDataException("Unexpected backup entry: " + entry.FullName);
                using (Stream stream = entry.Open())
                    if (!string.Equals(Hash(stream), expected, StringComparison.OrdinalIgnoreCase))
                        throw new InvalidDataException("Backup hash differs: " + entry.FullName);
            }
        }
        return backup;
    }

    private static void Apply(ISldWorks sw, Plan plan)
    {
        string[] children = plan.Models.Keys.Where(x => !Paths.Equals(x, plan.Root)).OrderBy(x => x, Paths).ToArray();
        string[] targets = children.Select(x => plan.Models[x]).ToArray();
        if (sw.GetDocumentCount() != 0) throw new InvalidOperationException("SOLIDWORKS opened a document during rename.");
        foreach (ModelReferencePlan model in plan.ModelReferences)
        {
            if (sw.GetDocumentCount() != 0) throw new InvalidOperationException("SOLIDWORKS opened a document during rename.");
            foreach (KeyValuePair<string, string> reference in model.References)
                if (!Paths.Equals(reference.Key, reference.Value) &&
                    !sw.ReplaceReferencedDocument(model.Source, reference.Key, reference.Value))
                    throw new IOException("Could not update a relocated model reference: " + model.Source);
            string[] stored = GetDependencies(sw, model.Source, false, false);
            if (stored == null) throw new InvalidDataException("Repaired model has no reference list: " + model.Source);
            VerifyRepairedModelReferences(model, stored);
        }
        int result = sw.MoveDocument(plan.Root, plan.TargetRoot, children, targets, 0);
        if (result != 0) throw new IOException("Assembly MoveDocument failed with code " + result);
        foreach (ModelReferencePlan model in plan.ModelReferences)
        {
            ModelReferencePlan dated = DatedModelReferencePlan(plan, model);
            string[] stored = GetDependencies(sw, dated.Source, false, false);
            if (stored == null) throw new InvalidDataException("Renamed model has no reference list: " + dated.Source);
            bool updated = false;
            foreach (KeyValuePair<string, string> reference in dated.References)
            {
                if (Paths.Equals(reference.Key, reference.Value) || !DependencyContains(stored, reference.Key)) continue;
                if (sw.GetDocumentCount() != 0) throw new InvalidOperationException("SOLIDWORKS opened a document during rename.");
                if (!sw.ReplaceReferencedDocument(dated.Source, reference.Key, reference.Value))
                    throw new IOException("Could not update a dated model reference: " + dated.Source);
                updated = true;
            }
            if (updated) stored = GetDependencies(sw, dated.Source, false, false);
            if (stored == null) throw new InvalidDataException("Renamed model has no reference list: " + dated.Source);
            VerifyRepairedModelReferences(dated, stored);
        }
        VerifyModelReferences(sw, plan);

        foreach (DrawingPlan drawing in plan.Drawings)
        {
            if (sw.GetDocumentCount() != 0) throw new InvalidOperationException("SOLIDWORKS opened a document during rename.");
            foreach (KeyValuePair<string, string> reference in drawing.References)
                if (!sw.ReplaceReferencedDocument(drawing.Source, reference.Key, reference.Value))
                    throw new IOException("Could not update drawing reference: " + drawing.Source);
            VerifyDrawingReferences(sw, plan, drawing.Source, drawing);
            result = sw.MoveDocument(drawing.Source, drawing.Target, new string[0], new string[0], 0);
            if (result != 0) throw new IOException("Drawing MoveDocument failed with code " + result + ": " + drawing.Source);
            VerifyDrawingReferences(sw, plan, drawing.Target, drawing);
        }

        foreach (KeyValuePair<string, string> pair in plan.Models)
            if (File.Exists(pair.Key) || !File.Exists(pair.Value))
                throw new IOException("Model rename postcondition failed: " + pair.Key);
        foreach (DrawingPlan drawing in plan.Drawings)
            if (File.Exists(drawing.Source) || !File.Exists(drawing.Target))
                throw new IOException("Drawing rename postcondition failed: " + drawing.Source);
    }

    private static void VerifyModelReferences(ISldWorks sw, Plan plan)
    {
        string[] dependencies = GetDependencies(sw, plan.TargetRoot, true, false);
        if (dependencies == null) throw new InvalidDataException("Renamed assembly has no dependency list.");
        VerifyModelDependencyList(plan, dependencies);
    }

    private static void VerifyRepairedModelReferences(ModelReferencePlan model, string[] dependencies)
    {
        var expected = new HashSet<string>(model.References.Values, Paths);
        var actual = new HashSet<string>(Paths);
        var actualMissing = new HashSet<string>(Paths);
        for (int index = 0; index < dependencies.Length; index += 2)
        {
            string file = Path.GetFullPath(dependencies[index + 1]);
            if (model.MissingReferences.Contains(file) && !ReferenceFileExists(file)) actualMissing.Add(file);
            else if (expected.Contains(file) && ReferenceFileExists(file)) actual.Add(file);
            else throw new InvalidDataException("Repaired model stores an unexpected reference: " + file);
        }
        if (!actual.SetEquals(expected) || !actualMissing.SetEquals(model.MissingReferences))
            throw new InvalidDataException("Repaired model does not retain its confirmed references: " + model.Source);
    }

    private static bool DependencyContains(string[] dependencies, string file)
    {
        for (int index = 0; index < dependencies.Length; index += 2)
            if (Paths.Equals(Path.GetFullPath(dependencies[index + 1]), file)) return true;
        return false;
    }

    private static ModelReferencePlan DatedModelReferencePlan(Plan plan, ModelReferencePlan model)
    {
        ModelReferencePlan dated = new ModelReferencePlan { Source = plan.Models[model.Source] };
        foreach (string source in model.References.Values)
        {
            string target;
            dated.References[source] = plan.Models.TryGetValue(source, out target) ? target : source;
        }
        dated.MissingReferences.UnionWith(model.MissingReferences);
        return dated;
    }

    private static void VerifyModelDependencyList(Plan plan, string[] dependencies)
    {
        var expected = new HashSet<string>(plan.Models.Values.Where(x => !Paths.Equals(x, plan.TargetRoot)), Paths);
        var actual = new HashSet<string>(Paths);
        var actualMissing = new HashSet<string>(Paths);
        for (int index = 0; index < dependencies.Length; index += 2)
        {
            string file = Path.GetFullPath(dependencies[index + 1]);
            if (IsToolbox(plan, file)) continue;
            if (Paths.Equals(file, plan.TargetRoot) && ReferenceFileExists(file)) continue;
            if (plan.MissingReferences.Contains(file) && !ReferenceFileExists(file))
            {
                actualMissing.Add(file);
                continue;
            }
            if (!expected.Contains(file) || !File.Exists(file))
                throw new InvalidDataException("Renamed assembly stores an unexpected reference: " + file);
            actual.Add(file);
        }
        if (!actual.SetEquals(expected))
            throw new InvalidDataException("Renamed assembly is missing one or more model references.");
        if (!actualMissing.SetEquals(plan.MissingReferences))
            throw new InvalidDataException("Renamed assembly changed its preserved missing references.");
    }

    private static void VerifyDrawingReferences(ISldWorks sw, Plan plan, string file, DrawingPlan drawing)
    {
        string[] dependencies = GetDependencies(sw, file, false, false);
        if (dependencies == null) throw new InvalidDataException("Renamed drawing has no references: " + file);
        VerifyDrawingDependencyList(plan, file, drawing, dependencies);
    }

    private static void VerifyDrawingDependencyList(Plan plan, string file, DrawingPlan drawing, string[] dependencies)
    {
        var expected = new HashSet<string>(drawing.References.Values, Paths);
        var actual = new HashSet<string>(Paths);
        var actualMissing = new HashSet<string>(Paths);
        for (int index = 0; index < dependencies.Length; index += 2)
        {
            string dependency = Path.GetFullPath(dependencies[index + 1]);
            if (IsToolbox(plan, dependency)) continue;
            if (drawing.MissingReferences.Contains(dependency) && !ReferenceFileExists(dependency))
            {
                actualMissing.Add(dependency);
                continue;
            }
            if (!expected.Contains(dependency))
                throw new InvalidDataException("Drawing retained an unexpected model reference: " + file);
            actual.Add(dependency);
        }
        if (!actual.SetEquals(expected))
            throw new InvalidDataException("Drawing does not store every renamed model reference: " + file);
        if (!actualMissing.SetEquals(drawing.MissingReferences))
            throw new InvalidDataException("Drawing changed its preserved missing references: " + file);
    }

    private static string Hash(string file)
    {
        using (FileStream stream = File.OpenRead(file)) return Hash(stream);
    }

    private static string Hash(Stream stream)
    {
        using (SHA256 sha = SHA256.Create()) return Hex(sha.ComputeHash(stream));
    }

    private static string Hex(byte[] bytes)
    {
        return BitConverter.ToString(bytes).Replace("-", "");
    }

    private static void Print(object value)
    {
        // The installed host reads UTF-8, but legacy WinExe pipes may use an OEM code page.
        string json = new JavaScriptSerializer().Serialize(value);
        Console.WriteLine(Regex.Replace(json, @"[^\u0000-\u007f]", match =>
            "\\u" + ((int)match.Value[0]).ToString("x4", CultureInfo.InvariantCulture)));
    }
}
