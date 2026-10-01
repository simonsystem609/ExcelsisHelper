"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const script = path.join(__dirname, "..", "scripts", "hotkey-helper.ps1");
const source = fs.readFileSync(script, "utf8");
const csharp = source.match(/-TypeDefinition @"\r?\n([\s\S]*?)\r?\n"@/)[1];

function run(args, succeeds = true) {
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-STA", "-ExecutionPolicy", "Bypass", ...args], {
    encoding: "utf8", timeout: 30000, windowsHide: true,
  });
  assert.ifError(result.error);
  assert.equal(result.status === 0, succeeds, result.stderr || result.stdout);
  return result.stdout.trim();
}
function replaceMethod(text, name, body) {
  const declaration = new RegExp(`private static [^\\r\\n]+ ${name}\\([^]*?\\) \\{`).exec(text);
  assert.ok(declaration, name);
  const start = declaration.index + declaration[0].length;
  let depth = 1, end = start;
  for (; end < text.length && depth; end++) {
    if (text[end] === "{") depth++;
    if (text[end] === "}") depth--;
  }
  return text.slice(0, start) + body + text.slice(end - 1);
}

if (process.platform === "win32") {
  const selfTest = (rows) => run(["-File", script, "-SelfTest", "-MacroShortcutsBase64",
    Buffer.from(JSON.stringify(rows)).toString("base64")]);
  assert.match(run(["-File", script, "-SelfTest"]), /radius=Alt\+R,dxf=Alt\+D/);
  assert.match(selfTest([]), /macros=; sample=/);
  assert.match(selfTest([{ id: "custom", shortcut: "Ctrl+Shift+F8" }]), /custom=Ctrl\+Shift\+F8/);
  run(["-File", script, "-SelfTest", "-MacroShortcutsBase64", Buffer.from(JSON.stringify([
    { id: "a", shortcut: "Alt+D" }, { id: "b", shortcut: "Alt+D" },
  ])).toString("base64")], false);

  // Exercise production dispatch/registration with only Win32 boundaries stubbed.
  // No global registrations, hooks, key injection or SOLIDWORKS attachment occur.
  let testSource = csharp;
  testSource = replaceMethod(testSource, "ForegroundProcessIsSolidWorks", " return TestForeground; ");
  testSource = replaceMethod(testSource, "IsKeyDown", " return TestKeys.Contains(vk); ");
  const register = /\[DllImport\("user32.dll", SetLastError = true\)\]\s*private static extern bool RegisterHotKey\([^;]+;/;
  const unregister = /\[DllImport\("user32.dll", SetLastError = true\)\]\s*private static extern bool UnregisterHotKey\([^;]+;/;
  assert.match(testSource, register);
  assert.match(testSource, unregister);
  testSource = testSource.replace(register, `private static bool RegisterHotKey(IntPtr hwnd, int id, uint modifiers, uint vk) {
    Check((modifiers & MOD_NOREPEAT) != 0, "no-repeat modifier");
    TestRegistered.Add(id); return true;
  }`).replace(unregister, `private static bool UnregisterHotKey(IntPtr hwnd, int id) {
    TestRegistered.Remove(id); return true;
  }`);
  const testMembers = `
  private static bool TestForeground;
  private static readonly HashSet<int> TestKeys = new HashSet<int>();
  private static readonly HashSet<int> TestRegistered = new HashSet<int>();
  private static void Check(bool ok, string message) { if (!ok) throw new Exception(message); }
  private static void DispatchTestHotkey(int id) {
    var message = Message.Create(IntPtr.Zero, WM_HOTKEY, (IntPtr)id, IntPtr.Zero);
    typeof(HotkeyWindow).GetMethod("WndProc", BindingFlags.NonPublic | BindingFlags.Instance).Invoke(Window, new object[] {message});
  }
  public static string VerifyMacroHotkeys() {
    ConfigureMacroShortcuts(new string[] {"radius", "dxf", "bom"}, new string[] {"Alt+R", "Alt+D", "Ctrl+Shift+B"});
    Window = new HotkeyWindow();
    try {
      UpdateMacroRegistrations();
      Check(TestRegistered.Count == 0, "no bindings outside SOLIDWORKS");
      TestForeground = true;
      UpdateMacroRegistrations();
      Check(TestRegistered.Count == 3, "all user bindings registered");
      var output = new StringWriter();
      var originalOutput = Console.Out;
      Console.SetOut(output);
      try {
        DispatchTestHotkey(101);
        Check(output.ToString().Trim() == "EXCELSIS_HOTKEY_EVENT:macro:dxf", "DXF event dispatch");
        output.GetStringBuilder().Length = 0;
        DispatchTestHotkey(102);
        Check(output.ToString().Trim() == "EXCELSIS_HOTKEY_EVENT:macro:bom", "custom macro event dispatch");
        output.GetStringBuilder().Length = 0;
        TestForeground = false;
        DispatchTestHotkey(100);
        Check(output.ToString() == "" && TestRegistered.Count == 0, "focus loss unregisters and ignores queued events");
      } finally { Console.SetOut(originalOutput); }
      TestKeys.Add(VK_MENU);
      Check(MatchesMacroHotkey(MacroShortcuts[1].Hotkey, 0x44), "Alt+D fallback matches");
      Check(!MatchesMacroHotkey(MacroShortcuts[0].Hotkey, 0x44), "wrong macro key does not match");
      TestKeys.Add(VK_CONTROL);
      Check(!MatchesMacroHotkey(MacroShortcuts[1].Hotkey, 0x44), "extra modifiers cannot launch a different shortcut");
      ConfigureMacroShortcuts(new string[0], new string[0]);
      Check(MacroShortcuts.Length == 0, "empty list disables only macro shortcuts");
    } finally { Window.Dispose(); Window = null; }
    return "Macro hotkey foreground, registration, dispatch and modifier tests passed.";
  }
`;
  testSource = testSource.slice(0, testSource.lastIndexOf("}")) + testMembers + "}\n";
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "excelsis-macro-hotkeys-"));
  const harness = path.join(dir, "test.ps1");
  fs.writeFileSync(harness, `$ErrorActionPreference = 'Stop'\nAdd-Type -ReferencedAssemblies 'System.Windows.Forms' -TypeDefinition @'\n${testSource}\n'@\n[ExcelsisHotkeyHelper]::VerifyMacroHotkeys()\n`);
  assert.match(run(["-File", harness]), /tests passed/);
}
assert.match(source, /!wasDown[\s\S]*?MatchesMacroHotkey\(binding.Hotkey, vk\)/);
assert.match(source, /Fired.Add\(binding.Hotkey.Id\)/);
assert.match(source, /Fired.Remove\(binding.Hotkey.Id\)/);
console.log("Configurable macro hotkeys compiled and passed isolated foreground/dispatch tests; no live hooks or CAD calls.");
