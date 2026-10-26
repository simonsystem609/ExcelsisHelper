"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {spawnSync} = require("node:child_process");
const root = path.resolve(__dirname, "..");
const names = ["DxfTraceTiming", "DxfPrepareGeometry", "DxfOutlineFrame", "DxfProfilePair",
  "DxfProfileNumber", "DxfProfileAngle", "DxfProfileSplinePoint", "DxfProfileSplineError", "DxfProfileSpline", "DxfProfileCurve",
  "DxfExportBodyProfiles", "DxfComponentProfileBodies", "ExportAssemblyContextThinSolidDxf",
  "GetPartBodies", "DxfVisibleBodies"];
function procedure(source, name) {
  const match = source.match(new RegExp("^(?:(?:Public|Private) )?(?:Function|Sub) " + name + "\\([\\s\\S]*?^End (?:Function|Sub)", "mi"));
  assert.ok(match, name);
  return match[0];
}
function adapt(text) {
  return text.replace(/\s+_\r?\n\s*/g, " ")
    .replace(/\bSet\s+(?=[A-Za-z])/g, "").replace(/\bVariant\b/g, "Object")
    .replace(/\bLong\b/g, "Integer").replace(/\bEmpty\b/g, "Nothing")
    .replace(/\b(\d+(?:\.\d+)?)#/g, "$1R").replace(/\b(Trim|Str|Hex)\$/g, "$1")
    .replace(/^(\s*DxfProfileCurve = )Array\((.+)\)$/gm, "$1New Object() {$2}")
    .replace(/\bArray\(((?:[^()\r\n]|\([^()\r\n]*\))*)\)/g, "New Object() {$1}")
    .replace(/\bAbs\(/g, "Math.Abs(").replace(/\bAtn\(/g, "Math.Atan(").replace(/\bSqr\(/g, "Math.Sqrt(")
    .replace(/\bThen Err\.Raise (.+)$/gm, "Then Err.Raise($1)")
    .replace(/\bThen TraceRun (.+)$/gm, "Then TraceRun($1)")
    .replace(/^([ \t]*)(Err\.Raise|TraceRun|DxfTraceTiming|\w+\.(?:ApplyTransform|Write|Add)) (.+)$/gm, "$1$2($3)");
}
let previous;
for (const file of ["DXF_v16.swb", "DXF_v16_ROfriendy.swb"]) {
  const source = fs.readFileSync(path.join(root, "macros", file), "utf8");
  const code = names.map(name => procedure(source, name)).join("\n");
  if (previous) assert.equal(code, previous, "Both variants must share profile and safety logic");
  previous = code;
  assert.doesNotMatch(source, /ExportNormalViewToDxf|DxfShowNormalView|ExportAssemblyComponentViaTemporaryPart|CleanProjectedDxfChamferLoops|ShowNamedView2|CreateFeatureFromBody3|swApp\.NewPart/);
  assert.match(procedure(source, "ExportOnePart"), /selectedBodies = GetPartBodies\(swPart\)/);
  assert.match(procedure(source, "ExportThinSolidRegularDxf"), /DxfExportBodyProfiles\(swPart, bodies, Nothing, filePath\)/);
  assert.match(procedure(source, "ExportPartPrecutSimple"), /DxfExportBodyProfiles/);
  for (const name of ["ExportOnePart", "ExportOnePartInAssemblyContext", "ActivateConfigurationChecked"]) {
    assert.match(procedure(source, name), /DxfPrepareGeometry\(sw(?:Part|Model)\)/);
    assert.doesNotMatch(procedure(source, name), /\.ForceRebuild3|\.EditRebuild3/);
  }
  assert.match(procedure(source, "CloseCandidateDocument"), /swApp\.CloseDoc closeName/);
  assert.match(procedure(source, "CloseCandidateDocument"), /DxfTraceTiming "close-doc"/);
  if (process.platform !== "win32") continue;
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "dxf-native-profile-"));
  const input = path.join(folder, "checks.vb"), output = path.join(folder, "checks.exe");
  fs.writeFileSync(input, String.raw`Option Strict Off
Imports System
Imports System.IO
Imports Microsoft.VisualBasic
Module Checks
Dim swApp As New TestApp(), logs As New Collections.Generic.List(Of String)
Dim g_stopBatchReason As String="", stopNow As Boolean
Const swSolidBody As Integer=0
Dim folder As String=$FOLDER$
Sub Check(ok As Boolean, message As String)
  If Not ok Then Throw New Exception(message & Environment.NewLine & String.Join(Environment.NewLine, logs))
End Sub
Sub TraceRun(value As String)
  logs.Add(value)
End Sub
Function DiagnosticLineValue(value As String) As String
  Return value
End Function
Function DxfStopRequested() As Boolean
  Return stopNow
End Function
Function DxfFileBytes(target As String) As Double
  If Not File.Exists(target) Then Return -1
  Return New FileInfo(target).Length
End Function
Function TryGetPlaneNormalAndPoint(face As Object,n() As Double,p() As Double) As Boolean
  For i As Integer=0 To 2
    n(i)=face.Normal(i) : p(i)=face.Origin(i)
  Next
  Return True
End Function
Function GetFaceFootprintAxis(face As Object,n() As Double,u() As Double) As Boolean
  For i As Integer=0 To 2
    u(i)=face.Axis(i)
  Next
  Return True
End Function
Function FindLargestPlanarFaceInBodies(bodies As Object) As Object
  Return New TestFace()
End Function
Function GroupNumbers(text As String,code As String) As Double()
  Dim lines=text.Split(New String(){vbCrLf},StringSplitOptions.None)
  Dim result As New Collections.Generic.List(Of Double)
  For i As Integer=0 To lines.Length-2 Step 2
    If lines(i)=code Then result.Add(Double.Parse(lines(i+1),Globalization.CultureInfo.InvariantCulture))
  Next
  Return result.ToArray()
End Function
$CODE$
Sub Main()
  For Each state As Integer In New Integer() {0,2,1,3}
    Dim model As New TestModel With {.Status=state}
    Check(DxfPrepareGeometry(model),"rebuild state " & state)
    Check(model.EditCalls=If((state And 1)=0,0,1) And model.ForceCalls=0,"conditional incremental rebuild")
  Next
  Dim fallback As New TestModel With {.Status=1,.StaysStale=True}
  Check(DxfPrepareGeometry(fallback) And fallback.EditCalls=1 And fallback.ForceCalls=1,"bounded force fallback")
  fallback=New TestModel With {.ThrowStatus=True}
  Check(DxfPrepareGeometry(fallback) And fallback.ForceCalls=1,"unknown status uses conservative rebuild")
  fallback=New TestModel With {.Status=1,.StaysStale=True,.ForceFails=True}
  Check(Not DxfPrepareGeometry(fallback),"failed rebuild cannot export")
  Check(Not DxfPrepareGeometry(Nothing),"missing model")
  Dim face As New TestFace With {.Normal=New Double(){0,1,0},.Origin=New Double(){1,2,3}}
  Dim frame As TestTransform=DxfOutlineFrame(face)
  Dim point=frame.Point(New Double(){2,4,8},False)
  Check(Math.Abs(point(0)-1)<1e-12 And Math.Abs(point(1)+5)<1e-12 And Math.Abs(point(2)-2)<1e-12,"arbitrary-plane orthonormal coordinates")
  Dim body As New TestBody(), bodies As Object=New Object(){body}
  Dim target=Path.Combine(folder,"profile.dxf")
  Check(DxfExportBodyProfiles(Nothing,bodies,Nothing,target),"closed native outline exports")
  Check(swApp.Kernel.Calls=1 And body.Mutations=0,"reads source body without mutation")
  Check(File.ReadAllText(target).Contains("CIRCLE") And File.ReadAllText(target).Contains("$INSUNITS"),"analytic millimeter DXF")
  Dim saved=File.ReadAllText(target)
  Check(Not DxfExportBodyProfiles(Nothing,bodies,Nothing,target),"occupied output is rejected")
  Check(File.ReadAllText(target)=saved,"existing file is never replaced")
  For Each failure As String In New String() {"gap","empty","arrays","unsupported","cancel"}
    body=New TestBody() : bodies=New Object(){body}
    If failure="gap" Then body.Curves(1).First(0)+=0.001
    If failure="empty" Then body.Curves=New Object(){}
    If failure="arrays" Then body.Loops=New Integer(){0}
    If failure="unsupported" Then body.Curves(0).Kind="unsupported"
    stopNow=(failure="cancel")
    target=Path.Combine(folder,failure & ".dxf")
    Check(Not DxfExportBodyProfiles(Nothing,bodies,Nothing,target),"invalid/cancelled profile fails closed: " & failure)
    Check(Not File.Exists(target),"validation precedes all writes: " & failure)
    stopNow=False
  Next
  body=New TestBody()
  Dim hidden As New TestBody With {.Visible=False}
  Dim part As New TestModel With {.Bodies=New Object(){body,hidden}}
  bodies=GetPartBodies(part)
  Check(CType(bodies,Object()).Length=1,"only visible source bodies")
  target=Path.Combine(folder,"visible.dxf")
  Check(DxfExportBodyProfiles(Nothing,bodies,Nothing,target),"visible-only profile")
  Dim component As New TestComponent With {.Bodies=New Object(){body,hidden}}
  bodies=DxfComponentProfileBodies(component)
  Check(CType(bodies,Object()).Length=1,"component hidden body excluded")
  Check(Not Object.ReferenceEquals(bodies(0),body) And bodies(0).Mutations=1 And body.Mutations=0,"only disposable copies transformed")
  component.ThrowTotal=True
  Check(IsArray(DxfComponentProfileBodies(component)),"Transform2 fallback")
  component.NoTransform=True
  Check(Not IsArray(DxfComponentProfileBodies(component)),"missing placement fails closed")
  component=New TestComponent With {.Bodies=New Object(){New TestBody With {.FailTransform=True}}}
  Check(Not IsArray(DxfComponentProfileBodies(component)),"failed disposable transform cannot export")
  component=New TestComponent With {.Bodies=New Object(){New TestBody With {.FailCopy=True}}}
  Check(Not IsArray(DxfComponentProfileBodies(component)),"failed body copy cannot export")
  Dim splineCurve As New TestCurve With {.Data=New TestSplineData()}
  Dim closedText=DxfProfileSpline(splineCurve,True), openText=DxfProfileSpline(splineCurve,False)
  Check(Math.Abs(GroupNumbers(closedText,"10")(0)-2000)<1e-9,"closed rational control points are Cartesian")
  Check(Math.Abs(GroupNumbers(openText,"10")(0)-2000)<1e-9,"open native B-curves can also be Cartesian")
  Check(splineCurve.ClosestCalls<=146,"source checks are bounded")
  splineCurve.ExpectedHomogeneous=True
  For Each flag As Boolean In New Boolean(){False,True}
    Dim homogeneousText=DxfProfileSpline(splineCurve,flag)
    Check(Math.Abs(GroupNumbers(homogeneousText,"10")(0)-4000)<1e-9,"source-verified homogeneous controls remain supported")
  Next
  Dim w=Math.Sqrt(0.5)
  splineCurve=New TestCurve With {.Kind="splineCircle",.Center=New Double(){0,0,0},.Radius=1,
    .Data=New TestSplineData With {.Order=3,.ControlPointsCount=9,
      .Controls=New Double(){1,0,0,1, 1,1,0,w, 0,1,0,1, -1,1,0,w, -1,0,0,1, -1,-1,0,w, 0,-1,0,1, 1,-1,0,w, 1,0,0,1},
      .Knots=New Double(){0,0,0,1,1,2,2,3,3,4,4,4}}}
  Check(DxfProfileSpline(splineCurve,True).Contains("10" & vbCrLf & "1000" & vbCrLf),"closed rational circle stays exact")
  Dim controlsBefore=CType(splineCurve.Data.Controls.Clone(),Double())
  DxfProfileSpline(splineCurve,True)
  Check(System.Linq.Enumerable.SequenceEqual(controlsBefore,splineCurve.Data.Controls),"control data is never mutated")
  For i As Integer=0 To 8
    For axis As Integer=0 To 2
      splineCurve.Data.Controls(i*4+axis)*=splineCurve.Data.Controls(i*4+3)
    Next
  Next
  splineCurve.ExpectedHomogeneous=True
  Check(Math.Abs(GroupNumbers(DxfProfileSpline(splineCurve,True),"10")(1)-1000)<1e-9,"closed flag does not prohibit true homogeneous data")
  splineCurve=New TestCurve With {.Data=New TestSplineData With {.Dimension=3,.Controls=New Double(){2,3,0,4,5,0}}}
  Check(Math.Abs(GroupNumbers(DxfProfileSpline(splineCurve,False),"10")(0)-2000)<1e-9,"nonrational controls stay Cartesian")
  Dim q=(1+Math.Sqrt(2))/3
  splineCurve=New TestCurve With {.Kind="splineArc",.Center=New Double(){-0.105,-0.03,-0.005},.Radius=0.005,.SplineZSlope=-1,
    .Data=New TestSplineData With {.Order=4,.ControlPointsCount=4,
      .Controls=New Double(){-0.105,-0.035,-0.005,1, -0.1079289321881345,-0.035,-0.0020710678118655,q, -0.11,-0.0329289321881345,0,q, -0.11,-0.03,0,1},
      .Knots=New Double(){0,0,0,0,1,1,1,1}}}
  Dim cornerText=DxfProfileSpline(splineCurve,False)
  Check(Not cornerText.Contains("-134.") And Not cornerText.Contains("-136."),"translated cubic corner cannot grow pointed extensions")
  Check(Math.Abs(GroupNumbers(cornerText,"10")(1)-(-107.9289321881345))<1e-9,"translated rational corner keeps Cartesian controls")
  Dim nativePoint=DxfProfileSplinePoint(splineCurve.Data.Controls,splineCurve.Data.Knots,4,3,4,0.5,False)
  Check(Math.Abs(nativePoint(0)-(-0.105-0.005/Math.Sqrt(2)))<1e-12 And Math.Abs(nativePoint(1)-(-0.03-0.005/Math.Sqrt(2)))<1e-12,"independent quarter-circle midpoint")
  Check(Math.Abs(nativePoint(2)-(-0.005+0.005/Math.Sqrt(2)))<1e-12,"chamfer source remains three-dimensional during verification")
  For i As Integer=0 To 40
    nativePoint=DxfProfileSplinePoint(splineCurve.Data.Controls,splineCurve.Data.Knots,4,3,4,i/40.0,False)
    Check(nativePoint(0)>=-0.11-1e-12 And nativePoint(0)<=-0.105+1e-12 And nativePoint(1)>=-0.035-1e-12 And nativePoint(1)<=-0.03+1e-12,"corner remains in true bounds")
  Next
  For Each failure As String In New String(){"closest-throws","closest-empty","wrong-source","negative-weight","nonfinite-control","bad-domain","cancel"}
    Dim bad As New TestCurve With {.Data=New TestSplineData()}
    If failure="closest-throws" Then bad.ClosestThrows=True
    If failure="closest-empty" Then bad.ClosestEmpty=True
    If failure="wrong-source" Then bad.ClosestOffset=1
    If failure="negative-weight" Then bad.Data.Controls(3)=-1
    If failure="nonfinite-control" Then bad.Data.Controls(0)=Double.NaN
    If failure="bad-domain" Then bad.Data.Knots=New Double(){0,0,0,0}
    stopNow=(failure="cancel")
    Dim rejected As Boolean=False
    Try
      DxfProfileSpline(bad,False)
    Catch
      rejected=True
    End Try
    Check(rejected,"unverified spline fails closed: " & failure)
    stopNow=False
  Next
  body=New TestBody()
  body.Curves(0)=New TestCurve With {.Kind="spline",.Data=New TestSplineData(),.ClosestThrows=True}
  target=Path.Combine(folder,"unverified-spline.dxf")
  Check(Not DxfExportBodyProfiles(Nothing,New Object(){body},Nothing,target) And Not File.Exists(target),"source mismatch cannot create even an empty output")
  splineCurve.Data.Periodic=True
  Dim failed As Boolean=False
  Try
    DxfProfileSpline(splineCurve,False)
  Catch
    failed=True
  End Try
  Check(failed,"unexpected periodic spline is rejected")
  Check(Math.Abs(DxfProfileAngle(1,0))<1e-9 And Math.Abs(DxfProfileAngle(0,-1)-270)<1e-9,"DXF angle quadrants")
  Check(logs.Exists(Function(t) t.Contains("native-profile-total")),"profile timing retained")
  Check(logs.Exists(Function(t) t.Contains("spline-controls=cartesian")) And logs.Exists(Function(t) t.Contains("spline-controls=homogeneous")),"coordinate diagnostics include the verified mode")
  Console.WriteLine("PASS native profiles: analytic curves, native loop closure, visibility, safe copies/placements, source-verified rational conventions, translated-corner bounds, cancellation, no overwrite and conditional rebuilds. No SOLIDWORKS automation.")
End Sub
End Module
Class TestFace
Public Normal As Double()={0,0,1}, Origin As Double()={0,0,0}, Axis As Double()={1,0,0}
End Class
Class TestTransform
Public Data As Double()
Function Point(p As Double(),vector As Boolean) As Double()
  Dim result(2) As Double
  For j As Integer=0 To 2
    For i As Integer=0 To 2
      result(j)+=p(i)*Data(i*3+j)
    Next
    If Not vector Then result(j)+=Data(9+j)
  Next
  Return result
End Function
End Class
Class TestMath
Function CreateVector(data As Object) As Object
  Return data
End Function
Function CreateTransform(data As Object) As Object
  Return New TestTransform With {.Data=CType(CType(data,Double()).Clone(),Double())}
End Function
End Class
Class TestApp
Public Kernel As New TestKernel()
Function GetMathUtility() As Object
  Return New TestMath()
End Function
Function GetModeler() As Object
  Return Kernel
End Function
End Class
Class TestKernel
Public Calls As Integer
Function GetBodyOutline(bodies As Object,direction As Object,tolerance As Double,ByRef curves As Object,ByRef entities As Object,ByRef outlines As Object) As Integer
  Calls+=1
  curves=bodies(0).Curves : outlines=bodies(0).Loops : entities=New Object(){}
  Return CType(curves,Object()).Length
End Function
End Class
Class TestSplineData
Public Dimension As Integer=4, Order As Integer=2, ControlPointsCount As Integer=2, Periodic As Boolean
Public Controls As Double()={2,3,0,0.5,4,5,0,1}, Knots As Double()={0,0,1,1}
Function GetControlPoints(ByRef points As Object) As Boolean
  points=Controls
  Return True
End Function
Function GetKnotPoints(ByRef points As Object) As Boolean
  points=Knots
  Return True
End Function
End Class
Class TestCurve
Public Kind As String="line", First As Double()={0,0,0}, Last As Double()={0.1,0,0}
Public Center As Double()={0.02,0.03,0}, Axis As Double()={0,0,1}, Radius As Double=0.005
Public Data As TestSplineData
Public ExpectedHomogeneous As Boolean, ClosestThrows As Boolean, ClosestEmpty As Boolean, ClosestOffset As Double, ClosestCalls As Integer, SplineZSlope As Double
Function GetClosestPointOn(x As Double,y As Double,z As Double) As Object
  ClosestCalls+=1
  If ClosestThrows Then Throw New Exception("Native closest-point read failed")
  If ClosestEmpty Then Return Nothing
  If Kind="splineCircle" Or Kind="splineArc" Then
    Dim dx=x-Center(0), dy=y-Center(1), length=Math.Sqrt(dx*dx+dy*dy)
    If length=0 Then Return New Double(){Center(0)+Radius,Center(1),Center(2),0,0}
    Return New Double(){Center(0)+Radius*dx/length,Center(1)+Radius*dy/length,Center(2)+SplineZSlope*Radius*dx/length,0,0}
  End If
  Dim a(2), b(2), delta(2) As Double
  Dim last=(Data.ControlPointsCount-1)*Data.Dimension, numerator As Double=0, denominator As Double=0
  Dim wa=If(Data.Dimension=4 AndAlso ExpectedHomogeneous,Data.Controls(3),1.0)
  Dim wb=If(Data.Dimension=4 AndAlso ExpectedHomogeneous,Data.Controls(last+3),1.0)
  Dim input=New Double(){x,y,z}
  For axis As Integer=0 To 2
    a(axis)=Data.Controls(axis)/wa : b(axis)=Data.Controls(last+axis)/wb : delta(axis)=b(axis)-a(axis)
    numerator+=(input(axis)-a(axis))*delta(axis) : denominator+=delta(axis)*delta(axis)
  Next
  Dim amount=If(denominator>0,Math.Max(0,Math.Min(1,numerator/denominator)),0)
  Return New Double(){a(0)+amount*delta(0)+ClosestOffset,a(1)+amount*delta(1),a(2)+amount*delta(2),0,0}
End Function
Function Copy() As Object
  Dim result=CType(MemberwiseClone(),TestCurve)
  result.First=CType(First.Clone(),Double()) : result.Last=CType(Last.Clone(),Double())
  result.Center=CType(Center.Clone(),Double()) : result.Axis=CType(Axis.Clone(),Double())
  Return result
End Function
Sub ApplyTransform(frame As Object)
  First=frame.Point(First,False) : Last=frame.Point(Last,False)
  Center=frame.Point(Center,False) : Axis=frame.Point(Axis,True)
End Sub
Function GetEndParams(ByRef a As Double,ByRef b As Double,ByRef closed As Boolean,ByRef periodic As Boolean) As Boolean
  a=0 : b=1 : closed=(Kind="circle") : periodic=closed : Return True
End Function
Function Evaluate2(t As Double,derivatives As Integer) As Object
  Return If(t=0,First,Last)
End Function
ReadOnly Property IsLine As Boolean
Get
Return Kind="line"
End Get
End Property
ReadOnly Property IsCircle As Boolean
Get
Return Kind="circle"
End Get
End Property
ReadOnly Property CircleParams As Object
Get
Return New Double(){Center(0),Center(1),Center(2),Axis(0),Axis(1),Axis(2),Radius}
End Get
End Property
Function GetBCurveParams5(a As Boolean,b As Boolean,c As Boolean,d As Boolean) As Object
  Return Data
End Function
End Class
Class TestBody
Public Visible As Boolean=True, FailCopy As Boolean, FailTransform As Boolean, Mutations As Integer
Public Curves As Object()={New TestCurve With {.First=New Double(){0,0,0},.Last=New Double(){0.1,0,0}},
  New TestCurve With {.First=New Double(){0.1,0,0},.Last=New Double(){0.1,0.1,0}},
  New TestCurve With {.First=New Double(){0.1,0.1,0},.Last=New Double(){0,0.1,0}},
  New TestCurve With {.First=New Double(){0,0.1,0},.Last=New Double(){0,0,0}},
  New TestCurve With {.Kind="circle",.First=New Double(){0.025,0.03,0},.Last=New Double(){0.025,0.03,0}}}
Public Loops As Integer()={0,0,0,0,1}
Function Copy2(full As Boolean) As Object
  If FailCopy Then Return Nothing
  Return New TestBody With {.FailTransform=FailTransform}
End Function
Function ApplyTransform(transform As Object) As Boolean
  Mutations+=1
  Return Not FailTransform
End Function
End Class
Class TestComponent
Public Bodies As Object(), ThrowTotal As Boolean, NoTransform As Boolean
Function GetBodies3(kind As Integer,ByRef info As Object) As Object
  Return Bodies
End Function
Function GetTotalTransform(presentation As Boolean) As Object
  If presentation Then Throw New Exception("Presentation transforms must not be included")
  If ThrowTotal Then Throw New Exception("No total transform")
  Return Transform2
End Function
ReadOnly Property Transform2 As Object
Get
If NoTransform Then Return Nothing
Return New TestTransform With {.Data=New Double(){1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0}}
End Get
End Property
End Class
Class TestModel
Public Status As Integer, EditCalls As Integer, ForceCalls As Integer, ThrowStatus As Boolean, StaysStale As Boolean, ForceFails As Boolean
Public Bodies As Object()
ReadOnly Property Extension As Object
Get
Return Me
End Get
End Property
ReadOnly Property NeedsRebuild2 As Integer
Get
If ThrowStatus Then Throw New Exception("Unknown state")
Return Status
End Get
End Property
Function EditRebuild3() As Boolean
EditCalls+=1
If Not StaysStale Then Status=Status And 2
Return True
End Function
Function ForceRebuild3(topOnly As Boolean) As Boolean
ForceCalls+=1 : Status=Status And 2
Return Not ForceFails
End Function
Function GetBodies2(kind As Integer,visibleOnly As Boolean) As Object
  If Not visibleOnly Then Throw New Exception("Must request visible bodies")
  Return System.Linq.Enumerable.ToArray(System.Linq.Enumerable.Where(Bodies,Function(b) b.Visible))
End Function
End Class
`.replace("$FOLDER$", JSON.stringify(folder)).replace("$CODE$", adapt(code)));
  const compiler = path.join(process.env.WINDIR, "Microsoft.NET/Framework64/v4.0.30319/vbc.exe");
  const built = spawnSync(compiler, ["/nologo", "/target:exe", "/out:" + output, input],
    {encoding:"utf8", windowsHide:true, timeout:15000});
  assert.equal(built.status, 0, built.stdout + built.stderr);
  const result = spawnSync(output, [], {encoding:"utf8", windowsHide:true, timeout:15000});
  assert.equal(result.status, 0, result.stdout + result.stderr);
  console.log(file + ": " + result.stdout.trim());
}
