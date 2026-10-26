using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Reflection;

internal static class DateAssemblyMissingTests
{
    private static Type helper;
    private static readonly BindingFlags HiddenStatic = BindingFlags.Static | BindingFlags.NonPublic;

    private static object Call(string method, params object[] args)
    {
        return helper.GetMethod(method, HiddenStatic).Invoke(null, args);
    }

    private static void Field(object value, string name, object data)
    {
        value.GetType().GetField(name).SetValue(value, data);
    }

    private static T Field<T>(object value, string name)
    {
        return (T)value.GetType().GetField(name).GetValue(value);
    }

    private static void Assert(bool condition, string message)
    {
        if (!condition) throw new Exception(message);
    }

    private static void Reject(string method, string message, params object[] args)
    {
        try { Call(method, args); }
        catch (TargetInvocationException error)
        {
            Assert(error.InnerException.Message.IndexOf(message, StringComparison.OrdinalIgnoreCase) >= 0,
                "Unexpected rejection: " + error.InnerException.Message);
            return;
        }
        throw new Exception("Expected rejection: " + message);
    }

    private static object Plan(string root, string scope)
    {
        object plan = Activator.CreateInstance(helper.GetNestedType("Plan", BindingFlags.NonPublic), true);
        Field(plan, "Root", root);
        Field(plan, "ScopeFolder", scope + Path.DirectorySeparatorChar);
        Field(plan, "Date", "2026.10.07");
        Field(plan, "TargetRoot", Path.Combine(scope, "machine__SZT_2026.10.07.SLDASM"));
        Field<Dictionary<string, string>>(plan, "Models").Add(root, Field<string>(plan, "TargetRoot"));
        return plan;
    }

    private static int Main(string[] args)
    {
        try
        {
            helper = Assembly.LoadFrom(args[0]).GetType("DateAssemblyFiles", true);
            string folder = Path.Combine(args[1], "project");
            Directory.CreateDirectory(folder);
            string root = Path.Combine(folder, "machine.SLDASM");
            string part = Path.Combine(folder, "plate.SLDPRT");
            File.WriteAllText(root, "offline metadata fixture, not a CAD document");
            File.WriteAllText(part, "offline metadata fixture, not a CAD document");
            object plan = Plan(root, folder);
            string missing = Path.Combine(args[1], "designer-pc", "spring.SLDPRT");
            string rootBefore = File.ReadAllText(root);
            string partBefore = File.ReadAllText(part);
            string initialFingerprint = (string)Call("Fingerprint", plan);
            Call("AddReferencedModel", plan, missing, "2026.10.07");
            Call("AddReferencedModel", plan, missing.ToUpperInvariant(), "2026.10.07");
            Assert(Field<HashSet<string>>(plan, "MissingReferences").Count == 1, "Missing references must deduplicate.");
            Assert(Field<Dictionary<string, string>>(plan, "Models").Count == 1, "Missing reference entered rename list.");
            Assert(initialFingerprint != (string)Call("Fingerprint", plan), "Missing links must affect preview identity.");
            Assert(((string)Call("MissingReferenceWarning", plan)).Contains(missing), "Missing-link warning must name the file.");
            Call("AddReferencedModel", plan, part, "2026.10.07");
            Call("AddReferencedModel", plan, part, "2026.10.07");
            Assert(Field<Dictionary<string, string>>(plan, "Models").Count == 2, "Existing part must rename once.");
            Assert(File.ReadAllText(root) == rootBefore && File.ReadAllText(part) == partBefore,
                "Reference classification must not edit source files.");

            string foreign = Path.Combine(args[1], "foreign.SLDPRT");
            File.WriteAllText(foreign, "unrelated existing part");
            Reject("AddReferencedModel", "outside the project folder", plan, foreign, "2026.10.07");
            Assert(!Field<Dictionary<string, string>>(plan, "Models").ContainsKey(foreign), "Foreign part entered rename list.");
            Reject("AddReferencedModel", "unsupported referenced document", plan,
                Path.Combine(args[1], "unavailable.step"), "2026.10.07");
            string directory = Path.Combine(folder, "directory.SLDPRT");
            Directory.CreateDirectory(directory);
            Reject("ReferenceFileExists", "names a directory", directory);

            string local = Path.Combine(folder, "spring.SLDPRT");
            File.WriteAllText(local, "unconfirmed same-name model");
            Reject("AddReferencedModel", "will not guess its identity", plan, missing, "2026.10.07");
            File.Move(local, local + ".preserved");

            Field(plan, "SourceStamps", Call("CaptureSourceStamps", plan));
            Call("VerifySourceFilesUnchanged", plan);
            Directory.CreateDirectory(Path.GetDirectoryName(missing));
            File.WriteAllText(missing, "reference appeared after preview");
            Reject("VerifySourceFilesUnchanged", "missing reference appeared after preview", plan);
            File.Move(missing, missing + ".preserved");
            File.WriteAllText(local, "same-name model appeared after preview");
            Reject("VerifySourceFilesUnchanged", "will not guess its identity", plan);
            File.Move(local, local + ".later-preserved");

            string targetPart = Field<Dictionary<string, string>>(plan, "Models")[part];
            File.WriteAllText(targetPart, "post-rename model fixture");
            string[] complete = { "plate", targetPart, "spring", missing };
            Call("VerifyModelDependencyList", plan, complete);
            Reject("VerifyModelDependencyList", "missing one or more model references", plan,
                new string[] { "spring", missing });
            Reject("VerifyModelDependencyList", "changed its preserved missing references", plan,
                new string[] { "plate", targetPart });
            Reject("VerifyModelDependencyList", "unexpected reference", plan,
                new string[] { "plate", targetPart, "spring", missing, "unknown", foreign + ".SLDPRT" });
            Reject("VerifyModelDependencyList", "unexpected reference", plan,
                new string[] { "plate", part, "spring", missing });
            File.WriteAllText(missing, "no longer a missing reference");
            Reject("VerifyModelDependencyList", "unexpected reference", plan, complete);
            File.Move(missing, missing + ".post-rename-preserved");

            object drawing = Activator.CreateInstance(helper.GetNestedType("DrawingPlan", BindingFlags.NonPublic), true);
            Field<Dictionary<string, string>>(drawing, "References").Add(part, targetPart);
            Field<HashSet<string>>(drawing, "MissingReferences").Add(missing);
            string drawingPath = Path.Combine(folder, "plate.SLDDRW");
            Call("VerifyDrawingDependencyList", plan, drawingPath, drawing, complete);
            Reject("VerifyDrawingDependencyList", "does not store every renamed model reference", plan,
                drawingPath, drawing, new string[] { "spring", missing });
            Reject("VerifyDrawingDependencyList", "changed its preserved missing references", plan,
                drawingPath, drawing, new string[] { "plate", targetPart });
            Reject("VerifyDrawingDependencyList", "unexpected model reference", plan, drawingPath, drawing,
                new string[] { "plate", targetPart, "spring", missing + ".SLDPRT" });

            string relocated = Path.Combine(args[1], "designer-pc", "plate.SLDPRT");
            string[] oldLinks = { "plate", relocated, "spring", missing };
            string[] resolvedLinks = { "plate", part, "spring", missing };
            Assert((bool)Call("HasUnreconciledReferences", plan, oldLinks), "Saved aliases must trigger reconciliation.");
            Assert(!(bool)Call("HasUnreconciledReferences", plan, resolvedLinks), "Known references need no repair scan.");
            object repaired = Call("ReconcileModelReferences", plan, root, oldLinks, resolvedLinks);
            Assert(Field<Dictionary<string, string>>(repaired, "References")[relocated] == part,
                "Only the API-resolved existing source should replace a stale saved link.");
            Assert(Field<HashSet<string>>(repaired, "MissingReferences").Contains(missing),
                "Repair must preserve unrelated missing links.");
            Call("VerifyRepairedModelReferences", repaired, resolvedLinks);
            Reject("VerifyRepairedModelReferences", "unexpected reference", repaired, oldLinks);
            Reject("VerifyRepairedModelReferences", "does not retain its confirmed references", repaired,
                new string[] { "plate", part });
            Reject("ReconcileModelReferences", "outside the confirmed assembly", plan, root,
                new string[] { "foreign", relocated }, new string[] { "foreign", foreign });
            Reject("ReconcileModelReferences", "order changed", plan, root,
                oldLinks, new string[] { "wrong label", part, "spring", missing });
            Reject("ReconcileModelReferences", "could not reconcile", plan, root, oldLinks, null);
            Reject("ReconcileModelReferences", "unrelated model", plan, foreign, oldLinks, resolvedLinks);
            Reject("ReconcileModelReferences", "could not verify the relocated", plan, root,
                new string[] { "plate", missing + ".SLDPRT" }, new string[] { "plate", part });
            string repairFingerprint = (string)Call("Fingerprint", plan);
            ((IList)Field<object>(plan, "ModelReferences")).Add(repaired);
            Assert(repairFingerprint != (string)Call("Fingerprint", plan), "Resolved aliases must affect preview identity.");
            Assert((int)Call("ReferenceRepairCount", plan) == 1, "Repair count should exclude unchanged links.");
            object dated = Call("DatedModelReferencePlan", plan, repaired);
            Assert(Field<string>(dated, "Source") == Field<string>(plan, "TargetRoot"), "Dated owner must stay in its rename plan.");
            Assert(Field<Dictionary<string, string>>(dated, "References")[part] == targetPart,
                "Relocated model links must finish at the dated source, not the old filename.");
            Call("VerifyRepairedModelReferences", dated, complete);
            Reject("VerifyRepairedModelReferences", "unexpected reference", dated, resolvedLinks);
            Assert((bool)Call("DependencyContains", resolvedLinks, part), "Exact stored references must be found.");
            Assert(!(bool)Call("DependencyContains", resolvedLinks, targetPart), "Other names must not trigger reference replacement.");
            File.WriteAllText(Field<string>(plan, "TargetRoot"), "dated assembly fixture");
            Call("VerifyModelDependencyList", plan, new string[] {
                "plate", targetPart, "spring", missing, "in-context root", Field<string>(plan, "TargetRoot") });
            File.WriteAllText(relocated, "real foreign file appeared after preview");
            Reject("VerifySourceFilesUnchanged", "original file appeared after preview", plan);
            Reject("ReconcileModelReferences", "different existing file", plan, root, oldLinks, resolvedLinks);
            File.Move(relocated, relocated + ".preserved");

            object capped = Plan(root, folder);
            for (int i = 0; i < 4999; i++)
                Field<HashSet<string>>(capped, "MissingReferences").Add(Path.Combine(args[1], "missing-" + i + ".SLDPRT"));
            Reject("AddReferencedModel", "model safety limit", capped, missing, "2026.10.07");
            Console.WriteLine("Missing-reference preservation and rename guards passed; resolved relocation checks passed.");
            return 0;
        }
        catch (Exception error)
        {
            Console.Error.WriteLine(error);
            return 1;
        }
    }
}
