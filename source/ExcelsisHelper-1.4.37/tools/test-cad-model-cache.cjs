"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const native = fs.readFileSync(path.join(root, "scripts", "capture-sw-assembly-session.cs"), "utf8");
const geometry = fs.readFileSync(path.join(root, "scripts", "capture-sw-assembly-geometry.cs"), "utf8");
const cache = fs.readFileSync(path.join(root, "scripts", "capture-sw-assembly-cache.cs"), "utf8");
assert.match(native, /VerifyCaptureTarget\(sw, doc, assembly, sourcePath, configuration, expectedStamp, count\);\s*if \(command.op == "end"\)/);
for (const name of ["Approximate", "Exact", "Tessellate"]) {
  const lookup = native.indexOf(`geometryCache.${name}(`);
  assert.ok(lookup > native.lastIndexOf("ValidateSessionRequests(command.requests", lookup));
  assert.ok(native.lastIndexOf("ValidateSessionRequests(command.requests", lookup) > 0);
}
assert.match(cache, /64 \* 1024 \* 1024/);
assert.match(cache, /entry\.Configuration == request\.configuration/);
assert.match(cache, /entry\.Pose\[axis\] == request\.validatedTransform\[axis\]/);
assert.match(native, /axis < 13/);

if (process.platform !== "win32") {
  console.log("CAD session cache guard checks passed; native fixtures skipped on non-Windows.");
  process.exit(0);
}

const tmp = path.resolve(root, "..", "tmp");
fs.mkdirSync(tmp, { recursive: true });
const fixture = fs.mkdtempSync(path.join(tmp, "cad-cache-test-"));
const requestType = geometry.slice(geometry.indexOf("    public sealed class ExactRequest"), geometry.indexOf("    public sealed class ExactInput"));
const verify = native.slice(native.indexOf("    private static void VerifyCaptureTarget"), native.indexOf("    private static ExactRequest[] ValidateSessionRequests"));
const validate = native.match(/    private static ExactRequest\[\] ValidateSessionRequests[\s\S]*?\r?\n    \}/)[0];
const numeric = geometry.match(/    private static double\[\] NumericArray[\s\S]*?\r?\n    \}/)[0];
const program = String.raw`
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using SolidWorks.Interop.sldworks;

namespace SolidWorks.Interop.sldworks {
  public class MathTransform { public object ArrayData; }
  public class IComponent2 {
    public double[] Pose; public int Checks;
    public MathTransform GetTotalTransform(bool value) { Checks++; return new MathTransform { ArrayData=Pose }; }
  }
  [ComVisible(true)] public class IModelDoc2 {
    public string PathValue="C:\\Models\\Main.SLDASM"; public int Stamp=42;
    public ConfigurationManager ConfigurationManager=new ConfigurationManager();
    public string GetPathName() { return PathValue; }
    public int GetUpdateStamp() { return Stamp; }
  }
  public class ConfigurationManager { public Configuration ActiveConfiguration=new Configuration(); }
  public class Configuration { public string Name="Default"; }
  public class IAssemblyDoc { public int Count=1; public int GetComponentCount(bool value) { return Count; } }
  public class ISldWorks { public IModelDoc2 Open; public object GetOpenDocumentByName(string value) { return Open; } }
}

internal static partial class CaptureSwAssemblyGeometry {
${requestType}
${verify}
${validate}
${numeric}
  static void Check(bool value, string message) { if(!value) throw new Exception(message); }
  static void Reject(Action action, string message) {
    try { action(); } catch(InvalidDataException) { return; } catch(InvalidOperationException) { return; }
    throw new Exception(message);
  }
  static double[] Pose() { return new double[] {1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0}; }
  static ExactRequest Request(int index=0, string config="Default") {
    return new ExactRequest { sourceIndex=index, name="Part-"+index, sourcePath="C:\\Models\\Part.SLDPRT",
      configuration=config, transform=Pose(), validatedTransform=Pose() };
  }
  static ExactGeometry Measured(bool shape, double[][] directions) {
    double[][] supports=null;
    if(directions != null) {
      supports=new double[directions.Length][];
      for(int index=0; index<directions.Length; index++) {
        double lo=directions[index][0]+2*directions[index][1]+3*directions[index][2];
        supports[index]=new double[] {lo,lo+1};
      }
    }
    return new ExactGeometry { Box=new double[] {0,0,0,1,1,1}, BodyCount=1,
      Shape3=shape ? (double?)2 : null, Shape4=shape ? (double?)3 : null, Supports=supports };
  }
  static byte[] Triangles(int vertices=3) {
    byte[] bytes=new byte[12+vertices*24];
    Array.Copy(new byte[] {83,87,84,82,73,49,0,0}, bytes, 8);
    Array.Copy(BitConverter.GetBytes((uint)vertices),0,bytes,8,4); return bytes;
  }
  public static void Main() {
    var cache=new CaptureGeometryCache(); var req=Request();
    int approx=0, exact=0, tess=0;
    Func<double[]> box=()=>{ approx++; return new double[] {0,0,0,1,1,1}; };
    cache.Approximate(req,box); cache.Approximate(req,box);
    Check(approx==1,"Approximate requests were not reused.");
    Func<bool,double[][],ExactGeometry> measure=(shape,dirs)=>{ exact++; return Measured(shape,dirs); };
    cache.Exact(req,measure); cache.Exact(req,measure);
    Check(exact==1,"Exact bounds should not reuse approximate bounds, but should reuse exact results.");
    req.supportDirections=new double[][] {new double[] {1,0,0},new double[] {0,1,0}};
    cache.Exact(req,measure); cache.Exact(req,measure);
    Check(exact==2,"Support upgrade must capture once.");
    req.includeShape=true;
    cache.Exact(req,(shape,dirs)=>{ Check(shape && dirs==null,"Shape upgrade should retain known supports."); exact++; return Measured(shape,dirs); });
    var reused=cache.Exact(req,measure);
    Check(exact==3 && reused.Shape3==2 && reused.Supports.Length==2,"Combined metrics not retained.");
    req.supportDirections=new double[][] {new double[] {0,1,0},new double[] {1,0,0}};
    reused=cache.Exact(req,measure);
    Check(exact==3 && reused.Supports[0][0]==2 && reused.Supports[1][0]==1,"Support order is not respected.");
    req.supportDirections=new double[][] {new double[] {0,1,0},new double[] {0,0,1}};
    cache.Exact(req,(shape,dirs)=>{ Check(!shape && dirs.Length==1 && dirs[0][2]==1,"Only missing support directions should be captured."); exact++; return Measured(shape,dirs); });
    Check(cache.Exact(req,measure).Supports[1][0]==3 && exact==4,"Support upgrade failed.");
    cache.Tessellate(req,()=>{ tess++; return Triangles(); });
    cache.Tessellate(req,()=>{ tess++; return Triangles(); });
    Check(tess==1,"Repeated tessellation not reused.");

    var other=Request(1); cache.Exact(other,measure); cache.Tessellate(other,()=>{ tess++; return Triangles(); });
    Check(exact==5 && tess==2,"Occurrences with identical files must not share geometry.");
    var config=Request(0,"MirrorConfig"); cache.Exact(config,measure);
    Check(exact==6,"Different configurations must not share geometry.");
    config.validatedTransform[9]=0.00000001;
    cache.Exact(config,measure);
    Check(exact==7,"Even a small validated pose change must invalidate cached metrics.");

    var missing=Request(10); int failed=0;
    cache.Exact(missing,(shape,dirs)=>{ failed++; return new ExactGeometry(); });
    cache.Exact(missing,(shape,dirs)=>{ failed++; return new ExactGeometry(); });
    Check(failed==2,"Missing geometry must not be negatively cached.");
    cache.Exact(missing,measure); missing.includeShape=true;
    int shapeFailures=0;
    cache.Exact(missing,(shape,dirs)=>{ shapeFailures++; return Measured(false,dirs); });
    cache.Exact(missing,(shape,dirs)=>{ shapeFailures++; return Measured(false,dirs); });
    Check(shapeFailures==2,"Failed shape measurements must be retried.");
    Reject(()=>cache.Tessellate(Request(20),()=>new byte[12]),"Invalid tessellation was accepted.");
    var changed=Request(21); cache.Exact(changed,measure); changed.includeShape=true;
    Reject(()=>cache.Exact(changed,(shape,dirs)=>{ var value=Measured(shape,dirs); value.BodyCount=2; return value; }),"A changed body count reused old metrics.");

    var bounded=new CaptureGeometryCache(5000);
    for(int index=0; index<5; index++) bounded.Tessellate(Request(index),()=>Triangles());
    Check((int)bounded.Profile()["evictions"]>0 && (long)bounded.Profile()["peakBytes"]<=5000,"Cache exceeds its memory bound.");
    var tiny=new CaptureGeometryCache(1000); int largeCaptures=0;
    tiny.Tessellate(req,()=>{ largeCaptures++; return Triangles(300); });
    tiny.Tessellate(req,()=>{ largeCaptures++; return Triangles(300); });
    Check(largeCaptures==2 && (long)tiny.Profile()["retainedBytes"]==0,"Oversized cache items must not be retained.");
    var fresh=new CaptureGeometryCache(); int freshCaptures=0;
    fresh.Exact(req,(shape,dirs)=>{ freshCaptures++; return Measured(shape,dirs); });
    Check(freshCaptures==1,"Geometry was reused across exports.");

    // Exercise the actual session guards before a full cache hit, using only local mocks.
    var checkedRequest=Request(); var component=new IComponent2 { Pose=Pose() };
    var components=new List<IComponent2> {component};
    var records=new List<Dictionary<string,object>> {new Dictionary<string,object> {
      {"name",checkedRequest.name},{"sourcePath",checkedRequest.sourcePath},{"configuration",checkedRequest.configuration}}};
    var doc=new IModelDoc2(); var app=new ISldWorks {Open=doc}; var assembly=new IAssemblyDoc();
    var guarded=new CaptureGeometryCache(); int guardedReads=0;
    Action get=()=>{ VerifyCaptureTarget(app,doc,assembly,doc.PathValue,"Default",42,1);
      ValidateSessionRequests(new ExactRequest[] {checkedRequest},components,records,2000);
      guarded.Exact(checkedRequest,(shape,dirs)=>{guardedReads++;return Measured(shape,dirs);}); };
    get(); get(); Check(guardedReads==1 && component.Checks==2,"Cache hits bypassed live pose validation.");
    doc.Stamp=43; Reject(get,"Changed update stamp was ignored."); doc.Stamp=42;
    doc.ConfigurationManager.ActiveConfiguration.Name="Other"; Reject(get,"Changed assembly configuration was ignored."); doc.ConfigurationManager.ActiveConfiguration.Name="Default";
    app.Open=null; Reject(get,"Closed assembly was ignored."); app.Open=new IModelDoc2();
    Reject(get,"Reopened assembly identity was ignored."); app.Open=doc;
    assembly.Count=2; Reject(get,"Changed component count was ignored."); assembly.Count=1;
    component.Pose[9]=1; Reject(get,"Changed component pose was ignored."); component.Pose=Pose();
    component.Pose[12]=2; Reject(get,"Changed component scale was ignored."); component.Pose=Pose();
    checkedRequest.configuration="Other"; Reject(get,"Changed component configuration was ignored."); checkedRequest.configuration="Default";
    checkedRequest.transform[0]=double.NaN; Reject(get,"Non-finite requested pose was ignored.");
    Check(guardedReads==1,"A failed guard still reached geometry capture.");
    Console.WriteLine("CAD occurrence cache, metric upgrades, memory bounds and session guard tests passed.");
  }
}`;
const input = path.join(fixture, "cache-test.cs");
const executable = path.join(fixture, "cache-test.exe");
fs.writeFileSync(input, program, "utf8");
const csc = path.join(process.env.WINDIR, "Microsoft.NET", "Framework64", "v4.0.30319", "csc.exe");
execFileSync(csc, ["/nologo", `/out:${executable}`, path.join(root, "scripts", "capture-sw-assembly-cache.cs"), input],
  { windowsHide: true, encoding: "utf8", timeout: 20000 });
console.log(execFileSync(executable, [], { windowsHide: true, encoding: "utf8", timeout: 10000 }).trim());
