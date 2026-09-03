# hotkey-helper.ps1
# Global helper hotkeys for Excelsis Helper while the app is running.
#
# RegisterHotKey/WM_HOTKEY is the primary copy-path trigger because it remains
# compatible with injected input. A low-level hook is retained only as a
# fallback when another application already owns the configured key.
# Explorer path copy invokes Explorer's native Ctrl+C and uses the
# Shell.Application selection only as a fallback.
# Paste-project-date types Unicode directly with SendInput and leaves the
# clipboard unchanged.
param(
  [string]$PasteHotkey = "Ctrl+Space",
  [string]$CopyPathHotkey = "F7,F7",
  [string]$Prefix = "PRJ-",
  [string]$Template = "PRJ-[currentdate]",
  [string]$DateFormat = "yyyy.MM.dd",
  [string]$LogPath = "",
  [switch]$SelfTest
)

$ErrorActionPreference = "Stop"

Add-Type -ReferencedAssemblies "System.Windows.Forms" -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

public static class ExcelsisHotkeyHelper {
  private const int WH_KEYBOARD_LL = 13;
  private const int WM_KEYDOWN = 0x0100;
  private const int WM_KEYUP = 0x0101;
  private const int WM_SYSKEYDOWN = 0x0104;
  private const int WM_SYSKEYUP = 0x0105;
  private const int WM_HOTKEY = 0x0312;
  private const int LLKHF_INJECTED = 0x10;

  private const uint MOD_ALT = 0x0001;
  private const uint MOD_CONTROL = 0x0002;
  private const uint MOD_SHIFT = 0x0004;
  private const uint MOD_WIN = 0x0008;
  private const uint MOD_NOREPEAT = 0x4000;

  private const int VK_SHIFT = 0x10;
  private const int VK_CONTROL = 0x11;
  private const int VK_MENU = 0x12;
  private const int VK_SPACE = 0x20;
  private const int VK_RETURN = 0x0D;
  private const int VK_C = 0x43;
  private const int VK_X = 0x58;
  private const int VK_LSHIFT = 0xA0;
  private const int VK_RSHIFT = 0xA1;
  private const int VK_LCONTROL = 0xA2;
  private const int VK_RCONTROL = 0xA3;
  private const int VK_LMENU = 0xA4;
  private const int VK_RMENU = 0xA5;
  private const int VK_LWIN = 0x5B;
  private const int VK_RWIN = 0x5C;
  private const int VK_V = 0x56;

  private const uint INPUT_KEYBOARD = 1;
  private const uint KEYEVENTF_KEYUP = 0x0002;
  private const uint KEYEVENTF_UNICODE = 0x0004;
  private const int DOUBLE_TAP_MS = 500;

  private static readonly LowLevelKeyboardProc Proc = HookCallback;
  private static readonly HashSet<int> Down = new HashSet<int>();
  private static readonly HashSet<string> Fired = new HashSet<string>();
  private static int LastCopyTapKey = 0;
  private static long LastCopyTapAt = 0;
  private static IntPtr HookId = IntPtr.Zero;
  private static Hotkey PasteHotkey;
  private static Hotkey CopyPathHotkey;
  private static bool PasteRegisteredHotkey = false;
  // Register the copy-path hotkey through WM_HOTKEY. The low-level hook below
  // only handles double-taps when this registration is unavailable.
  private static bool CopyRegisteredHotkey = false;
  private static HotkeyWindow Window;
  private static string Prefix = "PRJ-";
  private static string Template = "PRJ-[currentdate]";
  private static string DateFormat = "yyyy.MM.dd";
  private static string LogPath = "";

  private sealed class Hotkey {
    public string Id;
    public string Raw;
    public int Trigger;
    public int[] Required;
    public bool DoubleTap;
    public bool Valid;
  }

  private delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);

  private sealed class HotkeyWindow : Form {
    protected override void SetVisibleCore(bool value) {
      base.SetVisibleCore(false);
    }

    protected override void WndProc(ref Message m) {
      if (m.Msg == WM_HOTKEY && m.WParam.ToInt32() == 1) {
        Log("WM_HOTKEY paste");
        RunSta(PasteProjectDate);
        return;
      }
      // id=2 is the copy-path hotkey (RegisterHotKey path). Handles both a
      // double-tap of a bare key (F7,F7) and a modifier+key combo.
      // RegisterHotKey fires system-wide regardless of foreground app, so the
      // Explorer check happens here, at fire time, not at registration time.
      if (m.Msg == WM_HOTKEY && m.WParam.ToInt32() == 2) {
        if (!ForegroundProcessIsExplorer()) return;
        if (CopyPathHotkey != null && CopyPathHotkey.DoubleTap) {
          long now = NowMs();
          long elapsed = LastCopyTapAt == 0 ? Int64.MaxValue : now - LastCopyTapAt;
          if (elapsed <= DOUBLE_TAP_MS) {
            LastCopyTapAt = 0;
            Log("WM_HOTKEY copy double-tap matched elapsedMs=" + elapsed);
            RunSta(CopyExplorerSelectionPaths);
          } else {
            LastCopyTapAt = now;
            Log("WM_HOTKEY copy first tap");
          }
        } else {
          Log("WM_HOTKEY copy (single combo) matched");
          RunSta(CopyExplorerSelectionPaths);
        }
        return;
      }
      base.WndProc(ref m);
    }
  }

  [StructLayout(LayoutKind.Sequential)]
  private struct KBDLLHOOKSTRUCT {
    public int vkCode;
    public int scanCode;
    public int flags;
    public int time;
    public IntPtr dwExtraInfo;
  }

  [StructLayout(LayoutKind.Sequential)]
  private struct INPUT {
    public uint type;
    public INPUTUNION U;
  }

  // The union must be sized to fit the LARGEST native member (MOUSEINPUT, 32
  // bytes on x64) even though we only ever populate ki. Without the mi member
  // here, Marshal.SizeOf(INPUT) comes out smaller than the real native INPUT
  // struct, and SendInput rejects every call with ERROR_INVALID_PARAMETER (87)
  // because the marshalled size doesn't match what it expects.
  [StructLayout(LayoutKind.Explicit)]
  private struct INPUTUNION {
    [FieldOffset(0)] public MOUSEINPUT mi;
    [FieldOffset(0)] public KEYBDINPUT ki;
  }

  [StructLayout(LayoutKind.Sequential)]
  private struct MOUSEINPUT {
    public int dx;
    public int dy;
    public uint mouseData;
    public uint dwFlags;
    public uint time;
    public IntPtr dwExtraInfo;
  }

  [StructLayout(LayoutKind.Sequential)]
  private struct KEYBDINPUT {
    public ushort wVk;
    public ushort wScan;
    public uint dwFlags;
    public uint time;
    public IntPtr dwExtraInfo;
  }

  [DllImport("user32.dll", SetLastError = true)]
  private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

  [DllImport("user32.dll", SetLastError = true)]
  private static extern bool UnhookWindowsHookEx(IntPtr hhk);

  [DllImport("user32.dll")]
  private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

  [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
  private static extern IntPtr GetModuleHandle(string lpModuleName);

  [DllImport("user32.dll")]
  private static extern short GetAsyncKeyState(int vKey);

  [DllImport("user32.dll")]
  private static extern IntPtr GetForegroundWindow();

  [DllImport("user32.dll")]
  private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

  [DllImport("user32.dll", SetLastError = true)]
  private static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

  [DllImport("user32.dll", SetLastError = true)]
  private static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

  [DllImport("user32.dll", SetLastError = true)]
  private static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);

  [DllImport("user32.dll", SetLastError = true)]
  private static extern bool UnregisterHotKey(IntPtr hWnd, int id);

  public static string SelfTest(string pasteHotkey, string copyPathHotkey, string prefix, string template, string dateFormat, string logPath) {
    LogPath = logPath == null ? "" : logPath.Trim();
    var paste = ParseHotkey(pasteHotkey, "Ctrl+Space", "paste");
    var copy = ParseHotkey(copyPathHotkey, "F7,F7", "copy");
    Prefix = String.IsNullOrWhiteSpace(prefix) ? "PRJ-" : prefix;
    Template = String.IsNullOrWhiteSpace(template) ? Prefix + "[currentdate]" : template;
    DateFormat = String.IsNullOrWhiteSpace(dateFormat) ? "yyyy.MM.dd" : dateFormat;
    string result = "paste=" + Describe(paste) + "; copy=" + Describe(copy) + "; sample=" + RenderProjectText();
    Log("self-test " + result);
    return result;
  }

  public static void Run(string pasteHotkey, string copyPathHotkey, string prefix, string template, string dateFormat, string logPath) {
    LogPath = logPath == null ? "" : logPath.Trim();
    PasteHotkey = ParseHotkey(pasteHotkey, "Ctrl+Space", "paste");
    CopyPathHotkey = ParseHotkey(copyPathHotkey, "F7,F7", "copy");
    Prefix = String.IsNullOrWhiteSpace(prefix) ? "PRJ-" : prefix;
    Template = String.IsNullOrWhiteSpace(template) ? Prefix + "[currentdate]" : template;
    DateFormat = String.IsNullOrWhiteSpace(dateFormat) ? "yyyy.MM.dd" : dateFormat;
    Log("starting paste=" + Describe(PasteHotkey) + " copy=" + Describe(CopyPathHotkey) + " template=" + Template + " dateFormat=" + DateFormat);
    Window = new HotkeyWindow();
    Window.CreateControl();
    Window.Show();
    Log("window handle=" + Window.Handle);
    PasteRegisteredHotkey = TryRegisterPasteHotkey(PasteHotkey);
    Log("register paste hotkey=" + PasteRegisteredHotkey + " lastError=" + Marshal.GetLastWin32Error());
    CopyRegisteredHotkey = TryRegisterCopyHotkey(CopyPathHotkey);
    Log("register copy hotkey=" + CopyRegisteredHotkey + " lastError=" + Marshal.GetLastWin32Error());
    HookId = SetHook(Proc);
    Log("keyboard hook=" + HookId + " lastError=" + Marshal.GetLastWin32Error());
    Application.Run(new ApplicationContext(Window));
    Log("message loop ended");
    if (HookId != IntPtr.Zero) UnhookWindowsHookEx(HookId);
    if (PasteRegisteredHotkey && Window != null) UnregisterHotKey(Window.Handle, 1);
    if (Window != null) UnregisterHotKey(Window.Handle, 2);
  }

  private static string Describe(Hotkey hotkey) {
    return hotkey.Valid ? hotkey.Raw : "invalid";
  }

  private static Hotkey ParseHotkey(string raw, string fallback, string id) {
    Hotkey hotkey = TryParseHotkey(raw, id);
    return hotkey.Valid ? hotkey : TryParseHotkey(fallback, id);
  }

  private static Hotkey TryParseHotkey(string raw, string id) {
    var hotkey = new Hotkey { Id = id, Raw = raw == null ? "" : raw.Trim(), Trigger = 0, Required = new int[0], Valid = false };
    string source = hotkey.Raw;
    if (String.IsNullOrWhiteSpace(source)) return hotkey;
    string[] tapTokens = source.Split(new char[] {','}, StringSplitOptions.RemoveEmptyEntries);
    if (tapTokens.Length == 2) {
      int first = KeyCode(tapTokens[0]);
      int second = KeyCode(tapTokens[1]);
      if (first != 0 && first == second) {
        hotkey.Trigger = first;
        hotkey.Required = new int[0];
        hotkey.DoubleTap = true;
        hotkey.Valid = true;
        return hotkey;
      }
      return hotkey;
    }
    string[] tokens = source.Split(new char[] {'+'}, StringSplitOptions.RemoveEmptyEntries);
    if (tokens.Length < 2) return hotkey;
    var keys = new List<int>();
    for (int i = 0; i < tokens.Length; i++) {
      int key = KeyCode(tokens[i]);
      if (key == 0) return hotkey;
      keys.Add(key);
    }
    hotkey.Trigger = keys[keys.Count - 1];
    keys.RemoveAt(keys.Count - 1);
    hotkey.Required = keys.ToArray();
    hotkey.Valid = true;
    return hotkey;
  }

  private static int KeyCode(string token) {
    string key = (token == null ? "" : token.Trim()).ToUpperInvariant();
    if (key.Length == 1) {
      char ch = key[0];
      if ((ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9')) return (int)ch;
    }
    switch (key) {
      case "CTRL":
      case "CONTROL": return VK_CONTROL;
      case "ALT":
      case "MENU": return VK_MENU;
      case "SHIFT": return VK_SHIFT;
      case "WIN":
      case "WINDOWS": return VK_LWIN;
      case "SPACE": return VK_SPACE;
      case "ENTER":
      case "RETURN": return VK_RETURN;
      case "TAB": return 0x09;
      case "ESC":
      case "ESCAPE": return 0x1B;
      case "BACKSPACE": return 0x08;
      case "DELETE":
      case "DEL": return 0x2E;
      case "INSERT":
      case "INS": return 0x2D;
      case "HOME": return 0x24;
      case "END": return 0x23;
      case "PAGEUP":
      case "PGUP": return 0x21;
      case "PAGEDOWN":
      case "PGDN": return 0x22;
      case "LEFT": return 0x25;
      case "UP": return 0x26;
      case "RIGHT": return 0x27;
      case "DOWN": return 0x28;
    }
    if (key.Length >= 2 && key[0] == 'F') {
      int n;
      if (Int32.TryParse(key.Substring(1), out n) && n >= 1 && n <= 24) return 0x70 + n - 1;
    }
    return 0;
  }

  private static IntPtr SetHook(LowLevelKeyboardProc proc) {
    using (Process currentProcess = Process.GetCurrentProcess())
    using (ProcessModule currentModule = currentProcess.MainModule) {
      return SetWindowsHookEx(WH_KEYBOARD_LL, proc, GetModuleHandle(currentModule.ModuleName), 0);
    }
  }

  private static IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam) {
    if (nCode >= 0) {
      int message = wParam.ToInt32();
      bool isDown = message == WM_KEYDOWN || message == WM_SYSKEYDOWN;
      bool isUp = message == WM_KEYUP || message == WM_SYSKEYUP;
      if (isDown || isUp) {
        KBDLLHOOKSTRUCT info = (KBDLLHOOKSTRUCT)Marshal.PtrToStructure(lParam, typeof(KBDLLHOOKSTRUCT));
        int vk = info.vkCode;
        bool injected = (info.flags & LLKHF_INJECTED) != 0;
        if (!injected) {
          bool wasDown = Down.Contains(vk);
          if (isDown) Down.Add(vk);
          if (isUp) Down.Remove(vk);
          if (vk == VK_SPACE || vk == VK_C || vk == VK_X || vk == VK_CONTROL || vk == VK_LCONTROL || vk == VK_RCONTROL) {
            Log((isDown ? "down" : "up") + " vk=" + vk + " ctrl=" + IsKeyDown(VK_CONTROL) + " space=" + IsKeyDown(VK_SPACE));
          }

          if (isDown) {
            if (!PasteRegisteredHotkey && Matches(PasteHotkey, vk)) {
              if (!Fired.Contains(PasteHotkey.Id)) {
                Fired.Add(PasteHotkey.Id);
                Log("hook paste matched");
                RunSta(PasteProjectDate);
              }
              return (IntPtr)1;
            }
            // Fallback only (see CopyRegisteredHotkey); WM_HOTKEY is the
            // primary mechanism for the copy hotkey.
            if (!CopyRegisteredHotkey && !wasDown && MatchesDoubleTap(CopyPathHotkey, vk) && ForegroundProcessIsExplorer()) {
              long now = NowMs();
              long elapsed = LastCopyTapKey == vk ? now - LastCopyTapAt : Int64.MaxValue;
              LastCopyTapKey = vk;
              LastCopyTapAt = now;
              if (elapsed >= 0 && elapsed <= DOUBLE_TAP_MS) {
                LastCopyTapKey = 0;
                LastCopyTapAt = 0;
                Log("double-tap copy matched elapsedMs=" + elapsed);
                RunSta(CopyExplorerSelectionPaths);
              } else {
                Log("double-tap copy first tap");
              }
              // Double-tap copy is observational: Explorer still receives the
              // configured key normally, preserving its single-key behavior.
            }
            if (!CopyRegisteredHotkey && Matches(CopyPathHotkey, vk) && ForegroundProcessIsExplorer()) {
              if (!Fired.Contains(CopyPathHotkey.Id)) {
                Fired.Add(CopyPathHotkey.Id);
                Log("hook copy matched");
                RunSta(CopyExplorerSelectionPaths);
              }
              return (IntPtr)1;
            }
          }

          if (isUp) {
            bool suppress = false;
            if (PasteHotkey != null && PasteHotkey.Trigger == vk && Fired.Contains(PasteHotkey.Id)) {
              Fired.Remove(PasteHotkey.Id);
              suppress = true;
            }
            if (CopyPathHotkey != null && CopyPathHotkey.Trigger == vk && Fired.Contains(CopyPathHotkey.Id)) {
              Fired.Remove(CopyPathHotkey.Id);
              suppress = true;
            }
            if (suppress) return (IntPtr)1;
          }
        }
      }
    }
    return CallNextHookEx(HookId, nCode, wParam, lParam);
  }

  private static bool Matches(Hotkey hotkey, int vk) {
    if (hotkey == null || !hotkey.Valid || hotkey.DoubleTap || hotkey.Trigger != vk) return false;
    for (int i = 0; i < hotkey.Required.Length; i++) {
      if (!IsKeyDown(hotkey.Required[i])) return false;
    }
    return true;
  }

  private static bool MatchesDoubleTap(Hotkey hotkey, int vk) {
    return hotkey != null && hotkey.Valid && hotkey.DoubleTap && hotkey.Trigger == vk;
  }

  private static long NowMs() {
    return DateTime.UtcNow.Ticks / TimeSpan.TicksPerMillisecond;
  }

  private static bool TryRegisterPasteHotkey(Hotkey hotkey) {
    if (hotkey == null || !hotkey.Valid || Window == null) return false;
    uint modifiers = 0;
    for (int i = 0; i < hotkey.Required.Length; i++) {
      int key = hotkey.Required[i];
      if (key == VK_CONTROL) modifiers |= MOD_CONTROL;
      else if (key == VK_SHIFT) modifiers |= MOD_SHIFT;
      else if (key == VK_MENU) modifiers |= MOD_ALT;
      else if (key == VK_LWIN) modifiers |= MOD_WIN;
      else return false;
    }
    if (modifiers == 0) return false;
    return RegisterHotKey(Window.Handle, 1, modifiers | MOD_NOREPEAT, (uint)hotkey.Trigger);
  }

  // Unlike TryRegisterPasteHotkey, a bare key with no modifiers IS allowed
  // here: F7,F7 double-tap is registered as bare F7 (WndProc id=2 measures the
  // elapsed time between successive WM_HOTKEY firings itself). A
  // modifier+key combo form is also supported for parity, in case the copy
  // hotkey is ever configured that way instead.
  private static bool TryRegisterCopyHotkey(Hotkey hotkey) {
    if (hotkey == null || !hotkey.Valid || Window == null) return false;
    uint modifiers = 0;
    for (int i = 0; i < hotkey.Required.Length; i++) {
      int key = hotkey.Required[i];
      if (key == VK_CONTROL) modifiers |= MOD_CONTROL;
      else if (key == VK_SHIFT) modifiers |= MOD_SHIFT;
      else if (key == VK_MENU) modifiers |= MOD_ALT;
      else if (key == VK_LWIN) modifiers |= MOD_WIN;
      else return false;
    }
    if (modifiers == 0 && !hotkey.DoubleTap) return false;
    return RegisterHotKey(Window.Handle, 2, modifiers | MOD_NOREPEAT, (uint)hotkey.Trigger);
  }

  private static bool IsKeyDown(int vk) {
    if (vk == VK_CONTROL) return Down.Contains(VK_LCONTROL) || Down.Contains(VK_RCONTROL) || AsyncDown(VK_CONTROL) || AsyncDown(VK_LCONTROL) || AsyncDown(VK_RCONTROL);
    if (vk == VK_SHIFT) return Down.Contains(VK_LSHIFT) || Down.Contains(VK_RSHIFT) || AsyncDown(VK_SHIFT) || AsyncDown(VK_LSHIFT) || AsyncDown(VK_RSHIFT);
    if (vk == VK_MENU) return Down.Contains(VK_LMENU) || Down.Contains(VK_RMENU) || AsyncDown(VK_MENU) || AsyncDown(VK_LMENU) || AsyncDown(VK_RMENU);
    if (vk == VK_LWIN) return Down.Contains(VK_LWIN) || Down.Contains(VK_RWIN) || AsyncDown(VK_LWIN) || AsyncDown(VK_RWIN);
    return Down.Contains(vk) || AsyncDown(vk);
  }

  private static bool AsyncDown(int vk) {
    return (GetAsyncKeyState(vk) & unchecked((short)0x8000)) != 0;
  }

  private static void RunSta(ThreadStart action) {
    Thread t = new Thread(delegate() {
      try { action(); } catch {}
    });
    t.IsBackground = true;
    t.SetApartmentState(ApartmentState.STA);
    t.Start();
  }

  private static void PasteProjectDate() {
    // Types the text directly into whatever field has focus via SendInput
    // (Unicode), instead of clipboard+Ctrl+V. This never touches the
    // clipboard, so it can't clobber whatever the user had copied before.
    string text = RenderProjectText();
    Log("paste requested text=" + text);
    WaitForHotkeyRelease(PasteHotkey, 1200);
    Thread.Sleep(30);
    TypeText(text);
    Log("paste typed (no clipboard used) length=" + text.Length);
  }

  private static string RenderProjectText() {
    string dateText = DateTime.Now.ToString(DateFormat, CultureInfo.InvariantCulture);
    string template = String.IsNullOrWhiteSpace(Template) ? Prefix + "[currentdate]" : Template;
    string[] tokens = new string[] { "[currentdate]", "[currendate]", "[date]" };
    bool replaced = false;
    for (int i = 0; i < tokens.Length; i++) {
      if (template.IndexOf(tokens[i], StringComparison.OrdinalIgnoreCase) >= 0) {
        template = ReplaceToken(template, tokens[i], dateText);
        replaced = true;
      }
    }
    return replaced ? template : template + dateText;
  }

  private static string ReplaceToken(string source, string token, string value) {
    if (String.IsNullOrEmpty(source) || String.IsNullOrEmpty(token)) return source;
    int index = source.IndexOf(token, StringComparison.OrdinalIgnoreCase);
    while (index >= 0) {
      source = source.Substring(0, index) + value + source.Substring(index + token.Length);
      index = source.IndexOf(token, index + value.Length, StringComparison.OrdinalIgnoreCase);
    }
    return source;
  }

  private static void WaitForHotkeyRelease(Hotkey hotkey, int timeoutMs) {
    if (hotkey == null) return;
    Stopwatch sw = Stopwatch.StartNew();
    while (sw.ElapsedMilliseconds < timeoutMs) {
      bool anyDown = IsKeyDown(hotkey.Trigger);
      for (int i = 0; i < hotkey.Required.Length; i++) {
        anyDown = anyDown || IsKeyDown(hotkey.Required[i]);
      }
      if (!anyDown) return;
      Thread.Sleep(10);
    }
  }

  private static void TypeText(string text) {
    if (String.IsNullOrEmpty(text)) return;
    foreach (char ch in text) {
      SendUnicodeChar(ch, false);
      SendUnicodeChar(ch, true);
      Thread.Sleep(1);
    }
  }

  private static void SendUnicodeChar(char ch, bool keyUp) {
    INPUT[] inputs = new INPUT[1];
    inputs[0].type = INPUT_KEYBOARD;
    inputs[0].U.ki.wVk = 0;
    inputs[0].U.ki.wScan = ch;
    inputs[0].U.ki.dwFlags = KEYEVENTF_UNICODE | (keyUp ? KEYEVENTF_KEYUP : 0);
    inputs[0].U.ki.time = 0;
    inputs[0].U.ki.dwExtraInfo = IntPtr.Zero;
    uint sent = SendInput(1, inputs, Marshal.SizeOf(typeof(INPUT)));
    if (sent == 0) Log("SendInput failed char=" + ((int)ch) + " keyUp=" + keyUp + " lastError=" + Marshal.GetLastWin32Error());
  }

  private static bool SetClipboardText(string text) {
    for (int i = 0; i < 8; i++) {
      try {
        Clipboard.SetText(text, TextDataFormat.UnicodeText);
        return true;
      } catch {
        Thread.Sleep(35);
      }
    }
    return false;
  }

  private static void SendCtrlV() {
    SendCtrlKey(VK_V);
  }

  private static void SendCtrlC() {
    SendCtrlKey(VK_C);
  }

  private static void SendCtrlKey(int vk) {
    bool ctrlWasDown = IsKeyDown(VK_CONTROL);
    if (!ctrlWasDown) SendKey(VK_CONTROL, false);
    SendKey(vk, false);
    SendKey(vk, true);
    if (!ctrlWasDown) SendKey(VK_CONTROL, true);
  }

  private static void SendKey(int vk, bool keyUp) {
    keybd_event((byte)vk, 0, keyUp ? KEYEVENTF_KEYUP : 0, UIntPtr.Zero);
  }

  private static bool ForegroundProcessIsExplorer() {
    try {
      uint pid;
      IntPtr hwnd = GetForegroundWindow();
      if (hwnd == IntPtr.Zero) return false;
      GetWindowThreadProcessId(hwnd, out pid);
      if (pid == 0) return false;
      using (Process proc = Process.GetProcessById((int)pid)) {
        return String.Equals(proc.ProcessName, "explorer", StringComparison.OrdinalIgnoreCase);
      }
    } catch {
      return false;
    }
  }

  private static void CopyExplorerSelectionPaths() {
    // Ctrl+C drives Explorer's own native copy command, so it reflects
    // whatever is ACTUALLY highlighted right now with zero ambiguity.
    // Shell.Application's Document.SelectedItems() COM property can return a
    // stale or incorrect item,
    // so it's now only a fallback for the rare case Ctrl+C doesn't produce a
    // file-drop clipboard (e.g. focus not truly on the list view).
    WaitForHotkeyRelease(CopyPathHotkey, 1200);
    SendCtrlC();
    string[] paths = GetClipboardFileDropPaths();
    Log("copy via ctrl+c paths=" + paths.Length);
    if (paths.Length == 0) {
      paths = GetExplorerSelectionPaths();
      Log("copy fallback via Shell.Application paths=" + paths.Length);
    }
    if (paths.Length == 0) return;
    bool ok = SetClipboardText(String.Join(Environment.NewLine, paths));
    Log("copy clipboard=" + ok);
  }

  private static string[] GetClipboardFileDropPaths() {
    for (int attempt = 0; attempt < 12; attempt++) {
      try {
        if (Clipboard.ContainsFileDropList()) {
          var drops = Clipboard.GetFileDropList();
          var paths = new List<string>();
          for (int i = 0; i < drops.Count; i++) {
            string path = drops[i];
            if (!String.IsNullOrWhiteSpace(path)) paths.Add(path);
          }
          if (paths.Count > 0) return paths.ToArray();
        }
      } catch {}
      Thread.Sleep(35);
    }
    return new string[0];
  }

  private static string[] GetExplorerSelectionPaths() {
    var paths = new List<string>();
    try {
      IntPtr foreground = GetForegroundWindow();
      if (foreground == IntPtr.Zero) return paths.ToArray();
      Type shellType = Type.GetTypeFromProgID("Shell.Application");
      if (shellType == null) return paths.ToArray();
      object shell = Activator.CreateInstance(shellType);
      object windows = Invoke(shell, "Windows", BindingFlags.InvokeMethod, null);
      int windowCount = Convert.ToInt32(Invoke(windows, "Count", BindingFlags.GetProperty, null));
      for (int i = 0; i < windowCount; i++) {
        object window = Invoke(windows, "Item", BindingFlags.InvokeMethod, new object[] { i });
        if (window == null) continue;
        int hwnd = Convert.ToInt32(Invoke(window, "HWND", BindingFlags.GetProperty, null));
        if ((IntPtr)hwnd != foreground) continue;
        object document = Invoke(window, "Document", BindingFlags.GetProperty, null);
        object selected = Invoke(document, "SelectedItems", BindingFlags.InvokeMethod, null);
        int count = Convert.ToInt32(Invoke(selected, "Count", BindingFlags.GetProperty, null));
        for (int itemIndex = 0; itemIndex < count; itemIndex++) {
          object item = Invoke(selected, "Item", BindingFlags.InvokeMethod, new object[] { itemIndex });
          if (item == null) continue;
          string path = Convert.ToString(Invoke(item, "Path", BindingFlags.GetProperty, null));
          if (!String.IsNullOrWhiteSpace(path)) paths.Add(path);
        }
        break;
      }
    } catch {}
    return paths.ToArray();
  }

  private static object Invoke(object target, string name, BindingFlags flags, object[] args) {
    if (target == null) return null;
    return target.GetType().InvokeMember(name, flags, null, target, args);
  }

  private static void Log(string message) {
    if (String.IsNullOrWhiteSpace(LogPath)) return;
    try {
      string dir = Path.GetDirectoryName(LogPath);
      if (!String.IsNullOrWhiteSpace(dir)) Directory.CreateDirectory(dir);
      File.AppendAllText(LogPath, DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff", CultureInfo.InvariantCulture) + " " + message + Environment.NewLine);
    } catch {}
  }
}
"@

if ($SelfTest) {
  [ExcelsisHotkeyHelper]::SelfTest($PasteHotkey, $CopyPathHotkey, $Prefix, $Template, $DateFormat, $LogPath)
  exit 0
}

[ExcelsisHotkeyHelper]::Run($PasteHotkey, $CopyPathHotkey, $Prefix, $Template, $DateFormat, $LogPath)
