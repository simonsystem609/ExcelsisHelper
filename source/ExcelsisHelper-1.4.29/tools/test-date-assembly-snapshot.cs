using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Reflection;

internal static class TestDateAssemblySnapshot
{
    private static FieldInfo Field(Type type, string name)
    {
        return type.GetField(name, BindingFlags.Instance | BindingFlags.Public);
    }

    private static void Set(Type type, object instance, string name, object value)
    {
        Field(type, name).SetValue(instance, value);
    }

    private static void ExpectFailure(MethodInfo method, object plan, string message)
    {
        try { method.Invoke(null, new object[] { plan }); }
        catch (TargetInvocationException error)
        {
            if (error.InnerException != null && error.InnerException.Message.Contains(message)) return;
            throw;
        }
        throw new Exception("Expected rejection: " + message);
    }

    private static int Main(string[] args)
    {
        if (args.Length != 2) throw new ArgumentException("Expected helper EXE and test folder.");
        Type host = Assembly.LoadFrom(args[0]).GetType("DateAssemblyFiles", true);
        Type planType = host.GetNestedType("Plan", BindingFlags.NonPublic);
        object plan = Activator.CreateInstance(planType, true);
        MethodInfo capture = host.GetMethod("CaptureSourceStamps", BindingFlags.NonPublic | BindingFlags.Static);
        MethodInfo verify = host.GetMethod("VerifySourceFilesUnchanged", BindingFlags.NonPublic | BindingFlags.Static);
        if (capture == null || verify == null) throw new Exception("Snapshot methods not found.");

        string folder = args[1];
        Directory.CreateDirectory(folder);
        string root = Path.Combine(folder, "fixture.SLDASM");
        string drawing = Path.Combine(folder, "fixture.SLDDRW");
        string target = Path.Combine(folder, "fixture__SZT_2026.09.26.SLDASM");
        File.WriteAllText(root, "saved assembly");
        File.WriteAllText(drawing, "unrelated drawing");
        Set(planType, plan, "Root", root);
        Set(planType, plan, "ScopeFolder", folder.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar);
        ((IDictionary)Field(planType, "Models").GetValue(plan)).Add(root, target);
        ((ICollection<string>)Field(planType, "DrawingInventory").GetValue(plan)).Add(drawing);
        Set(planType, plan, "SourceStamps", capture.Invoke(null, new object[] { plan }));
        verify.Invoke(null, new object[] { plan });

        File.AppendAllText(root, " changed");
        ExpectFailure(verify, plan, "source document changed");
        Set(planType, plan, "SourceStamps", capture.Invoke(null, new object[] { plan }));
        File.WriteAllText(target, "collision");
        ExpectFailure(verify, plan, "destination name appeared");

        ((IDictionary)Field(planType, "Models").GetValue(plan))[root] =
            Path.Combine(folder, "fixture__SZT_2026.09.27.SLDASM");
        File.WriteAllText(Path.Combine(folder, "new.SLDDRW"), "new drawing");
        ExpectFailure(verify, plan, "drawing list changed");
        Console.WriteLine("Assembly-date post-close file checks passed.");
        return 0;
    }
}
