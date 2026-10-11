const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const watcher = fs.readFileSync(path.join(root, "scripts", "activity-watcher.ps1"), "utf8");
const code = watcher.match(/Add-Type -TypeDefinition @"\r?\n([\s\S]*?)\r?\n"@/)[1];
assert.doesNotMatch(code, /extern IntPtr SendMessage\(/);
assert.match(code, /SendMessageTimeout/);
assert.match(code, /0x02 \| 0x20/);
assert.match(code, /CamProbeBudgetMs = 150/);
assert.match(code, /TabMessageTimeoutMs = 35/);
assert.match(code, /viewProcessId == processId/);
assert.match(code, /tabProcessId == processId/);
assert.match(code, /IsWindowVisible\(cachedView\)/);
assert.doesNotMatch(watcher, /GetObject|SldWorks\.Application|winmgmts|Get-CimInstance/i);

if (process.platform === "win32") {
  const tempRoot = path.resolve(root, "..", "tmp");
  fs.mkdirSync(tempRoot, { recursive: true });
  const fixture = fs.mkdtempSync(path.join(tempRoot, "activity-probe-test-"));
  const csc = path.join(process.env.WINDIR, "Microsoft.NET", "Framework64", "v4.0.30319", "csc.exe");
  const original = path.join(fixture, "activity-native.cs");
  fs.writeFileSync(original, code, "utf8");
  execFileSync(csc, ["/nologo", "/target:library", `/out:${path.join(fixture, "activity-native.dll")}`, original], { windowsHide: true, timeout: 20000 });
  const bodies = {
    GetForegroundWindow: "return new IntPtr(10);",
    GetWindowThreadProcessId: "pid = (uint)Fake.ProcessId; return IsWindow(hWnd) ? 1u : 0u;",
    GetWindowText: "text.Append(hWnd.ToInt32() == 12 && !Fake.WrongTitle ? \"uiFeatureMgrActiveXView_c\" : \"\"); return text.Length;",
    GetClassName: "text.Append(hWnd.ToInt32() == 11 ? \"SysTabControl32\" : \"other\"); return text.Length;",
    GetParent: "int n=hWnd.ToInt32(); return new IntPtr(n==12 ? 11 : n==11 ? Fake.Root : 0);",
    EnumChildWindows: "Fake.Enumerations++; callback(new IntPtr(12), lParam); return true;",
    IsWindowVisible: "return Fake.Visible;",
    IsWindow: "return hWnd != IntPtr.Zero && !Fake.Invalid;",
    IsChild: "int a=parent.ToInt32(), b=child.ToInt32(); return (a==Fake.Root && (b==11 || b==12)) || (a==11 && b==12);",
    SendMessageTimeout: `Fake.Messages++; if(flags != 0x22 || timeout > 35 || timeout == 0) throw new Exception("Unbounded tab message.");
      result = new UIntPtr(message == 0x130B ? (uint)Fake.Selected : 6u);
      if(Fake.Hung) { System.Threading.Thread.Sleep((int)timeout); return IntPtr.Zero; } return new IntPtr(1);`,
    GetGUIThreadInfo: "info.hwndFocus=new IntPtr(Fake.Focus); return Fake.Focus!=0;",
    GetLastInputInfo: "return false;",
    GetTickCount64: "return 0ul;",
  };
  const mocked = code.replace(/\[DllImport\([^\n]+?\)\]\s*public static extern ([\s\S]*?)\);/g, (declaration, signature) => {
    const name = signature.match(/(\w+)\(/)[1];
    assert.ok(bodies[name], `Missing mock for ${name}`);
    return `public static ${signature}) { ${bodies[name]} }`;
  });
  assert.doesNotMatch(mocked, /DllImport/);
  const program = `
public static class Fake {
  public static int Root=10, ProcessId=100, Selected=5, Enumerations=0, Messages=0, Focus=0;
  public static bool Visible=true, WrongTitle=false, Hung=false, Invalid=false;
}
public static class ProbeTest {
  static void Check(bool condition, string message) { if(!condition) throw new Exception(message); }
  public static void Main() {
    Check(ExcelsisAct.IsSolidCamTabActive(new IntPtr(10)), "CAM tab not detected.");
    Check(Fake.Enumerations==1 && Fake.Messages==2, "Initial tab discovery failed.");
    Check(ExcelsisAct.IsSolidCamTabActive(new IntPtr(10)), "Cached tab not detected.");
    Check(Fake.Enumerations==1 && Fake.Messages==4, "Valid handles should skip child enumeration.");
    Fake.Selected=0;
    Check(!ExcelsisAct.IsSolidCamTabActive(new IntPtr(10)), "Inactive tab must not count as CAM.");
    Fake.Selected=5; Fake.Visible=false;
    Check(!ExcelsisAct.IsSolidCamTabActive(new IntPtr(10)), "Hidden tab must invalidate the cache.");
    Fake.Visible=true;
    Check(ExcelsisAct.IsSolidCamTabActive(new IntPtr(10)), "Tab should be rediscovered.");
    int enumerated=Fake.Enumerations; Fake.ProcessId=200;
    Check(ExcelsisAct.IsSolidCamTabActive(new IntPtr(10)) && Fake.Enumerations>enumerated, "PID reuse must invalidate handles.");
    Fake.Root=20;
    Check(ExcelsisAct.IsSolidCamTabActive(new IntPtr(20)), "Foreground change must rediscover the tab.");
    Fake.WrongTitle=true;
    Check(!ExcelsisAct.IsSolidCamTabActive(new IntPtr(20)), "Reused handle with wrong title must not count.");
    Fake.WrongTitle=false;
    Fake.Focus=12; enumerated=Fake.Enumerations;
    Check(ExcelsisAct.IsSolidCamTabActive(new IntPtr(20)), "Focused tree should recover.");
    Check(Fake.Enumerations==enumerated, "Focused-tree detection should not enumerate children.");
    Fake.Hung=true; var clock=System.Diagnostics.Stopwatch.StartNew();
    Check(!ExcelsisAct.IsSolidCamTabActive(new IntPtr(20)), "A timed-out tab must not report a CAM signal.");
    Check(clock.ElapsedMilliseconds<500, "Hung tab exceeded its bounded probe.");
    Check(!ExcelsisAct.IsSolidCamTabActive(IntPtr.Zero), "No foreground window must be inactive.");
    Console.WriteLine("SolidCAM bounded-message and validated-handle cache tests passed.");
  }
}`;
  const testSource = path.join(fixture, "activity-test.cs");
  const exe = path.join(fixture, "activity-test.exe");
  fs.writeFileSync(testSource, mocked + program, "utf8");
  execFileSync(csc, ["/nologo", `/out:${exe}`, testSource], { windowsHide: true, timeout: 20000 });
  console.log(execFileSync(exe, [], { windowsHide: true, encoding: "utf8", timeout: 10000 }).trim());
  const idleLine = watcher.match(/\$idleMs = \[int64\][^\r\n]+/)[0].replace('[ExcelsisAct]::GetTickCount64()', '$ticks');
  const idleTest = path.join(fixture, "idle-math.ps1");
  fs.writeFileSync(idleTest, `
$ErrorActionPreference='Stop'
$ticksList=[uint64[]]@(10000,4294967400,8589950000)
$values=@()
for($index=0;$index -lt 3;$index++) {
  [uint64]$ticks=$ticksList[$index]
  [int64]$expected=100*($index+1)
  $lii=@{dwTime=[uint32](($ticks-$expected) -band [uint64]4294967295)}
  ${idleLine}
  if($idleMs -ne $expected) { throw 'Incorrect idle time after Windows tick rollover.' }
  $values += $idleMs
}
$values | ConvertTo-Json -Compress
`, "utf8");
  assert.deepEqual(JSON.parse(execFileSync("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-ExecutionPolicy", "Bypass", "-File", idleTest],
    { windowsHide: true, encoding: "utf8", timeout: 10000 })), [100, 200, 300]);
} else {
  console.log("SolidCAM bounded-message and handle-validation static checks passed; native mock skipped on non-Windows.");
}
