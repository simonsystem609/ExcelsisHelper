param(
  [Parameter(Mandatory = $true)][string]$InputJson,
  [int]$ThumbSize = 256,
  # Set by main.cjs when a recent batch tripped the shell-tier circuit
  # breaker (see ShellTierDisabled below) - skips straight to sw-api/sw-render
  # for this whole run instead of re-testing an already-unhealthy handler.
  [switch]$SkipShellTier,
  # Set by the "SW render retry" right-click action: skip shell + sw-api and go
  # straight to the (view-reorienting) SOLIDWORKS render, which the user has
  # explicitly asked for because the cheaper tiers gave a poor/blank result.
  [switch]$RenderOnly
)

# Extracts thumbnails using these methods (tried in order per file):
#   - DXF: native ASCII DXF geometry render for .dxf files.
#   - DWG: extract the BMP/PNG preview embedded in the .dwg binary.
#   1) IShellItemImageFactory (the same Shell API Windows Explorer uses).
#      Works without SOLIDWORKS running, fast, returns the preview the
#      Explorer thumbnail cache would show. PRIMARY method for SW files.
#   2) ISldWorks::GetPreviewBitmapFile() via cscript+VBS bridge - asks
#      SOLIDWORKS directly, then hand-decodes its (malformed) preview BMP.
#      Fallback when the shell tier returns no usable image.
#   3) Read-only SOLIDWORKS render via ModelDoc2.SaveBMP() - reorients the
#      view, so it is OFF for background work and only used by the explicit
#      "SW render retry" action (-RenderOnly, which skips tiers 1-2).
# (The old "visible window screen-capture" last-resort method was removed -
#  it had to bring SOLIDWORKS forward, disrupting the user.)
#
# Reads an input JSON file with [{ path, outPng }, ...] pairs and writes
# PNGs. Returns a JSON array describing per-file success/failure including
# which method produced the image.

Set-StrictMode -Version 1.0
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -AssemblyName System.Drawing

$script:MaxEmbeddedImageBytes = 16MB
$script:MaxDecodedImageDimension = 4096
$script:MaxDecodedPixels = 16 * 1024 * 1024
$script:MaxInputJsonBytes = 1MB
$script:MaxBatchItems = 32
$script:MaxDxfBytes = 32MB
$script:MaxDxfLines = 400000
$script:MaxDxfSegments = 100000

function Test-SafeImageDimensions {
  param([long]$Width, [long]$Height)
  if ($Width -le 0 -or $Height -le 0) { return $false }
  if ($Width -gt $script:MaxDecodedImageDimension -or $Height -gt $script:MaxDecodedImageDimension) { return $false }
  return (($Width * $Height) -le $script:MaxDecodedPixels)
}

$code = @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Drawing;
using System.Text;

namespace ExcelsisShellThumb {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct POINT {
    public int X;
    public int Y;
  }

  [ComImport]
  [Guid("BCC18B79-BA16-442F-80C4-8A59C30C463B")]
  [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  internal interface IShellItemImageFactory {
    [PreserveSig]
    int GetImage([In, MarshalAs(UnmanagedType.Struct)] Size size, int flags, out IntPtr phbm);
  }

  public static class Util {
    private delegate bool EnumWindowProc(IntPtr hwnd, IntPtr lParam);

    [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
    private static extern void SHCreateItemFromParsingName(
      [MarshalAs(UnmanagedType.LPWStr)] string pszPath,
      IntPtr pbc,
      [In] ref Guid riid,
      [MarshalAs(UnmanagedType.Interface)] out IShellItemImageFactory ppv);

    [DllImport("gdi32.dll")]
    private static extern bool DeleteObject(IntPtr hObject);

    [DllImport("user32.dll")]
    private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    private static extern bool GetClientRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    private static extern bool ClientToScreen(IntPtr hWnd, ref POINT lpPoint);

    [DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern bool BringWindowToTop(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    private static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern IntPtr GetAncestor(IntPtr hWnd, uint gaFlags);

    [DllImport("user32.dll")]
    private static extern bool EnumChildWindows(IntPtr hWnd, EnumWindowProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    public static Rectangle WindowRectangle(IntPtr hwnd) {
      RECT r;
      if (!GetWindowRect(hwnd, out r)) {
        throw new System.ComponentModel.Win32Exception();
      }
      return Rectangle.FromLTRB(r.Left, r.Top, r.Right, r.Bottom);
    }

    public static bool BringToFront(IntPtr hwnd) {
      if (hwnd == IntPtr.Zero) { return false; }
      if (IsIconic(hwnd)) {
        ShowWindow(hwnd, 9); // SW_RESTORE
      } else {
        ShowWindow(hwnd, 5); // SW_SHOW
      }
      BringWindowToTop(hwnd);
      return SetForegroundWindow(hwnd);
    }

    public static IntPtr RootWindow(IntPtr hwnd) {
      IntPtr root = GetAncestor(hwnd, 2); // GA_ROOT
      return root == IntPtr.Zero ? hwnd : root;
    }

    public static Rectangle ClientRectangleOnScreen(IntPtr hwnd) {
      RECT r;
      if (!GetClientRect(hwnd, out r)) {
        throw new System.ComponentModel.Win32Exception();
      }
      POINT p = new POINT();
      p.X = 0;
      p.Y = 0;
      if (!ClientToScreen(hwnd, ref p)) {
        throw new System.ComponentModel.Win32Exception();
      }
      return Rectangle.FromLTRB(p.X, p.Y, p.X + (r.Right - r.Left), p.Y + (r.Bottom - r.Top));
    }

    private static string WindowText(IntPtr hwnd) {
      StringBuilder sb = new StringBuilder(256);
      GetWindowText(hwnd, sb, sb.Capacity);
      return sb.ToString();
    }

    private static bool Intersects(Rectangle a, Rectangle b) {
      return a.Left < b.Right && a.Right > b.Left && a.Top < b.Bottom && a.Bottom > b.Top;
    }

    // SOLIDWORKS' model-view HWND can cover the whole MDI document area.
    // The FeatureManager tree is drawn by sibling child windows over the
    // left edge, so CopyFromScreen sees it unless we trim that strip.
    public static Rectangle TrimSolidWorksViewport(Rectangle rect, IntPtr mainHwnd) {
      int leftTrim = rect.Left;
      EnumChildWindows(mainHwnd, delegate(IntPtr child, IntPtr lParam) {
        if (!IsWindowVisible(child)) { return true; }
        if (WindowText(child) != "Tree Container Wnd") { return true; }
        Rectangle childRect;
        try {
          childRect = WindowRectangle(child);
        } catch {
          return true;
        }
        if (!Intersects(rect, childRect)) { return true; }
        int interTop = Math.Max(rect.Top, childRect.Top);
        int interBottom = Math.Min(rect.Bottom, childRect.Bottom);
        int interHeight = interBottom - interTop;
        if (interHeight < Math.Max(250, rect.Height * 55 / 100)) { return true; }
        if (childRect.Width < 80 || childRect.Width > Math.Max(520, rect.Width / 2)) { return true; }
        if (childRect.Left > rect.Left + Math.Max(90, rect.Width / 4)) { return true; }
        int candidate = Math.Min(childRect.Right + 2, rect.Right - 120);
        if (candidate > leftTrim) { leftTrim = candidate; }
        return true;
      }, IntPtr.Zero);
      if (leftTrim > rect.Left && leftTrim < rect.Right - 120) {
        return Rectangle.FromLTRB(leftTrim, rect.Top, rect.Right, rect.Bottom);
      }
      return rect;
    }

    private static int ColorDistance(Color a, Color b) {
      int dr = a.R - b.R;
      int dg = a.G - b.G;
      int db = a.B - b.B;
      return Math.Abs(dr) + Math.Abs(dg) + Math.Abs(db);
    }

    private static Color AverageColor(Color a, Color b, Color c) {
      return Color.FromArgb((a.R + b.R + c.R) / 3, (a.G + b.G + c.G) / 3, (a.B + b.B + c.B) / 3);
    }

    private static bool IsSolidWorksReferenceBlue(Color px) {
      int max = Math.Max(px.R, Math.Max(px.G, px.B));
      int min = Math.Min(px.R, Math.Min(px.G, px.B));
      if (max - min < 45) { return false; }
      return px.B > 135 && px.B - px.R > 55 && px.B - px.G > 18 && px.R < 150;
    }

    public static Rectangle FindVisualContentBounds(Bitmap bmp) {
      if (bmp == null || bmp.Width < 20 || bmp.Height < 20) {
        return Rectangle.Empty;
      }
      Color bg = AverageColor(
        bmp.GetPixel(Math.Min(8, bmp.Width - 1), Math.Min(8, bmp.Height - 1)),
        bmp.GetPixel(Math.Max(0, bmp.Width - 9), Math.Min(8, bmp.Height - 1)),
        bmp.GetPixel(Math.Max(0, bmp.Width - 9), Math.Max(0, bmp.Height - 9))
      );
      int minX = bmp.Width;
      int minY = bmp.Height;
      int maxX = -1;
      int maxY = -1;
      int step = Math.Max(1, Math.Min(bmp.Width, bmp.Height) / 220);
      int edgeGuard = Math.Max(2, Math.Min(10, Math.Min(bmp.Width, bmp.Height) / 80));
      int x0 = edgeGuard;
      int x1 = Math.Max(x0 + 1, bmp.Width - edgeGuard);
      int y0 = edgeGuard;
      int y1 = Math.Max(y0 + 1, bmp.Height - edgeGuard);
      for (int y = y0; y < y1; y += step) {
        for (int x = x0; x < x1; x += step) {
          Color px = bmp.GetPixel(x, y);
          if (!IsSolidWorksReferenceBlue(px) && ColorDistance(px, bg) > 34) {
            if (x < minX) { minX = x; }
            if (x > maxX) { maxX = x; }
            if (y < minY) { minY = y; }
            if (y > maxY) { maxY = y; }
          }
        }
      }
      if (maxX <= minX || maxY <= minY) {
        return Rectangle.Empty;
      }
      int contentW = maxX - minX + 1;
      int contentH = maxY - minY + 1;
      if (contentW < 12 || contentH < 12) {
        return Rectangle.Empty;
      }
      int pad = Math.Max(12, Math.Max(contentW, contentH) / 7);
      minX = Math.Max(0, minX - pad);
      minY = Math.Max(0, minY - pad);
      maxX = Math.Min(bmp.Width - 1, maxX + pad);
      maxY = Math.Min(bmp.Height - 1, maxY + pad);
      return Rectangle.FromLTRB(minX, minY, maxX + 1, maxY + 1);
    }

    public static void Save(string path, string outPng, int size) {
      Guid iid = typeof(IShellItemImageFactory).GUID;
      IShellItemImageFactory factory;
      SHCreateItemFromParsingName(path, IntPtr.Zero, ref iid, out factory);
      IntPtr hbmp = IntPtr.Zero;
      // SIIGBF_THUMBNAILONLY (0x8) + SIIGBF_BIGGERSIZEOK (0x1) - try
      // real thumbnail first. If that fails, fall back to letting the
      // shell render an icon-based image; the caller validates with
      // IsLikelyIcon() and rejects icon-style results.
      int hr = factory.GetImage(new Size(size, size), 0x1 | 0x8, out hbmp);
      if (hr != 0 || hbmp == IntPtr.Zero) {
        hr = factory.GetImage(new Size(size, size), 0x1, out hbmp);
        if (hr != 0 || hbmp == IntPtr.Zero) {
          throw new System.IO.IOException("GetImage hr=0x" + hr.ToString("X"));
        }
      }
      try {
        using (Bitmap bmp = Image.FromHbitmap(hbmp)) {
          bmp.Save(outPng, System.Drawing.Imaging.ImageFormat.Png);
        }
      } finally {
        DeleteObject(hbmp);
      }
    }

    // Returns true when the image looks like a generic file-icon placeholder
    // (the kind SOLIDWORKS' shell extension hands back for files that have
    // no embedded preview) rather than a real 3D render. Real SW previews
    // are anti-aliased renders with thousands of unique colors; default
    // icons have a flat palette of ~10-30 colors. We sample on a grid and
    // bail out early once we see >= MIN_COLORS distinct ARGB values.
    public static bool IsLikelyIcon(string pngPath) {
      const int MIN_COLORS = 120;
      try {
        using (Bitmap bmp = (Bitmap)Image.FromFile(pngPath)) {
          int w = bmp.Width;
          int h = bmp.Height;
          if (w <= 0 || h <= 0) { return true; }
          int step = Math.Max(1, Math.Min(w, h) / 48);
          HashSet<int> seen = new HashSet<int>();
          for (int y = 0; y < h; y += step) {
            for (int x = 0; x < w; x += step) {
              seen.Add(bmp.GetPixel(x, y).ToArgb());
              if (seen.Count >= MIN_COLORS) { return false; }
            }
          }
          return true;
        }
      } catch {
        // If we can't even read the file, treat as failed (icon-like).
        return true;
      }
    }
  }
}
"@

Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing -ErrorAction Stop

function Test-SolidWorksRunning {
  $proc = @(Get-Process -Name "SLDWORKS" -ErrorAction SilentlyContinue)
  return ($proc.Count -gt 0)
}

function Add-DxfLineSegment {
  param(
    [System.Collections.Generic.List[object]]$Segments,
    [double]$X1,
    [double]$Y1,
    [double]$X2,
    [double]$Y2
  )
  if ($Segments.Count -ge $script:MaxDxfSegments) { return }
  if (([double]::IsNaN($X1)) -or ([double]::IsNaN($Y1)) -or ([double]::IsNaN($X2)) -or ([double]::IsNaN($Y2))) { return }
  if (([double]::IsInfinity($X1)) -or ([double]::IsInfinity($Y1)) -or ([double]::IsInfinity($X2)) -or ([double]::IsInfinity($Y2))) { return }
  $dx = $X2 - $X1
  $dy = $Y2 - $Y1
  if (($dx * $dx + $dy * $dy) -lt 0.000000000001) { return }
  $Segments.Add([ordered]@{ x1 = $X1; y1 = $Y1; x2 = $X2; y2 = $Y2 }) | Out-Null
}

function Add-DxfArcSegments {
  param(
    [System.Collections.Generic.List[object]]$Segments,
    [double]$Cx,
    [double]$Cy,
    [double]$R,
    [double]$A1Deg,
    [double]$A2Deg,
    [bool]$Clockwise = $false,
    [int]$MinimumSteps = 8
  )
  if (([double]::IsNaN($Cx)) -or ([double]::IsNaN($Cy)) -or ([double]::IsNaN($R)) -or $R -le 0) { return }
  $start = $A1Deg * [Math]::PI / 180.0
  $end = $A2Deg * [Math]::PI / 180.0
  if ($Clockwise) {
    while ($end -ge $start) { $end -= 2.0 * [Math]::PI }
  } else {
    while ($end -le $start) { $end += 2.0 * [Math]::PI }
  }
  $sweep = $end - $start
  $steps = [Math]::Max($MinimumSteps, [int][Math]::Ceiling([Math]::Abs($sweep) / ([Math]::PI / 24.0)))
  $prevX = $Cx + [Math]::Cos($start) * $R
  $prevY = $Cy + [Math]::Sin($start) * $R
  for ($i = 1; $i -le $steps; $i++) {
    $t = $start + $sweep * ($i / [double]$steps)
    $x = $Cx + [Math]::Cos($t) * $R
    $y = $Cy + [Math]::Sin($t) * $R
    Add-DxfLineSegment -Segments $Segments -X1 $prevX -Y1 $prevY -X2 $x -Y2 $y
    $prevX = $x
    $prevY = $y
  }
}

function Add-DxfBulgeOrLine {
  param(
    [System.Collections.Generic.List[object]]$Segments,
    [object]$P1,
    [object]$P2
  )
  if ($null -eq $P1 -or $null -eq $P2) { return }
  $x1 = [double]$P1.x
  $y1 = [double]$P1.y
  $x2 = [double]$P2.x
  $y2 = [double]$P2.y
  $bulge = 0.0
  try { $bulge = [double]$P1.bulge } catch {}
  if ([Math]::Abs($bulge) -lt 0.000000001) {
    Add-DxfLineSegment -Segments $Segments -X1 $x1 -Y1 $y1 -X2 $x2 -Y2 $y2
    return
  }
  $dx = $x2 - $x1
  $dy = $y2 - $y1
  $chord = [Math]::Sqrt($dx * $dx + $dy * $dy)
  if ($chord -le 0.000000001) { return }
  $midX = ($x1 + $x2) / 2.0
  $midY = ($y1 + $y2) / 2.0
  $offset = $chord * (1.0 - $bulge * $bulge) / (4.0 * $bulge)
  $perpX = -$dy / $chord
  $perpY = $dx / $chord
  $cx = $midX + $perpX * $offset
  $cy = $midY + $perpY * $offset
  $r = [Math]::Sqrt(($x1 - $cx) * ($x1 - $cx) + ($y1 - $cy) * ($y1 - $cy))
  $a1 = [Math]::Atan2($y1 - $cy, $x1 - $cx) * 180.0 / [Math]::PI
  $a2 = [Math]::Atan2($y2 - $cy, $x2 - $cx) * 180.0 / [Math]::PI
  Add-DxfArcSegments -Segments $Segments -Cx $cx -Cy $cy -R $r -A1Deg $a1 -A2Deg $a2 -Clockwise:($bulge -lt 0) -MinimumSteps 10
}

function Get-DxfNumber {
  param([object[]]$Pairs, [int]$Code, [double]$Default = [double]::NaN)
  foreach ($pair in $Pairs) {
    if ([int]$pair.code -ne $Code) { continue }
    $value = 0.0
    if ([double]::TryParse([string]$pair.value, [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$value)) {
      return $value
    }
  }
  return $Default
}

function Get-DxfInteger {
  param([object[]]$Pairs, [int]$Code, [int]$Default = 0)
  foreach ($pair in $Pairs) {
    if ([int]$pair.code -ne $Code) { continue }
    $value = 0
    if ([int]::TryParse(([string]$pair.value).Trim(), [ref]$value)) { return $value }
  }
  return $Default
}

function Add-DxfPolyline {
  param(
    [System.Collections.Generic.List[object]]$Segments,
    [System.Collections.Generic.List[object]]$Points,
    [bool]$Closed
  )
  if ($null -eq $Points -or $Points.Count -lt 2) { return }
  for ($i = 0; $i -lt ($Points.Count - 1); $i++) {
    Add-DxfBulgeOrLine -Segments $Segments -P1 $Points[$i] -P2 $Points[$i + 1]
  }
  if ($Closed) {
    Add-DxfBulgeOrLine -Segments $Segments -P1 $Points[$Points.Count - 1] -P2 $Points[0]
  }
}

function Add-DxfEllipse {
  param(
    [System.Collections.Generic.List[object]]$Segments,
    [object[]]$EntityPairs
  )
  $cx = Get-DxfNumber -Pairs $EntityPairs -Code 10
  $cy = Get-DxfNumber -Pairs $EntityPairs -Code 20
  $mx = Get-DxfNumber -Pairs $EntityPairs -Code 11
  $my = Get-DxfNumber -Pairs $EntityPairs -Code 21
  $ratio = Get-DxfNumber -Pairs $EntityPairs -Code 40
  if (([double]::IsNaN($cx)) -or ([double]::IsNaN($cy)) -or ([double]::IsNaN($mx)) -or ([double]::IsNaN($my)) -or ([double]::IsNaN($ratio))) { return }
  $tStart = Get-DxfNumber -Pairs $EntityPairs -Code 41 -Default 0.0
  $tEnd = Get-DxfNumber -Pairs $EntityPairs -Code 42 -Default (2.0 * [Math]::PI)
  if ($tEnd -le $tStart) { $tEnd += 2.0 * [Math]::PI }
  $sweep = $tEnd - $tStart
  $steps = [Math]::Max(32, [int][Math]::Ceiling($sweep / ([Math]::PI / 32.0)))
  $prevX = $cx + $mx * [Math]::Cos($tStart) - $my * $ratio * [Math]::Sin($tStart)
  $prevY = $cy + $my * [Math]::Cos($tStart) + $mx * $ratio * [Math]::Sin($tStart)
  for ($i = 1; $i -le $steps; $i++) {
    $t = $tStart + $sweep * ($i / [double]$steps)
    $x = $cx + $mx * [Math]::Cos($t) - $my * $ratio * [Math]::Sin($t)
    $y = $cy + $my * [Math]::Cos($t) + $mx * $ratio * [Math]::Sin($t)
    Add-DxfLineSegment -Segments $Segments -X1 $prevX -Y1 $prevY -X2 $x -Y2 $y
    $prevX = $x
    $prevY = $y
  }
}

function Add-DxfSplineApproximation {
  param(
    [System.Collections.Generic.List[object]]$Segments,
    [object[]]$EntityPairs
  )
  $points = New-Object System.Collections.Generic.List[object]
  $point = $null
  foreach ($pair in $EntityPairs) {
    $code = [int]$pair.code
    if ($code -eq 10 -or $code -eq 11) {
      if ($point -ne $null -and -not [double]::IsNaN([double]$point.x) -and -not [double]::IsNaN([double]$point.y)) {
        $points.Add($point) | Out-Null
      }
      $point = [ordered]@{ x = [double]::Parse([string]$pair.value, [System.Globalization.CultureInfo]::InvariantCulture); y = [double]::NaN; bulge = 0.0 }
    } elseif (($code -eq 20 -or $code -eq 21) -and $point -ne $null) {
      $point.y = [double]::Parse([string]$pair.value, [System.Globalization.CultureInfo]::InvariantCulture)
    }
  }
  if ($point -ne $null -and -not [double]::IsNaN([double]$point.x) -and -not [double]::IsNaN([double]$point.y)) {
    $points.Add($point) | Out-Null
  }
  Add-DxfPolyline -Segments $Segments -Points $points -Closed:$false
}

function Get-DxfPreviewSegments {
  param([string]$DxfPath)

  $fileInfo = Get-Item -LiteralPath $DxfPath -ErrorAction SilentlyContinue
  if ($null -eq $fileInfo -or $fileInfo.Length -le 0 -or $fileInfo.Length -gt $script:MaxDxfBytes) { return @() }
  $lines = [System.IO.File]::ReadAllLines($DxfPath, [System.Text.Encoding]::Default)
  if ($lines.Length -lt 8 -or $lines.Length -gt $script:MaxDxfLines) { return @() }

  $pairs = New-Object System.Collections.Generic.List[object]
  for ($i = 0; $i -lt ($lines.Length - 1); $i += 2) {
    $codeText = $lines[$i].Trim()
    $code = 0
    if (-not [int]::TryParse($codeText, [ref]$code)) { continue }
    $pairs.Add([ordered]@{ code = $code; value = $lines[$i + 1].Trim() }) | Out-Null
  }

  $segments = New-Object System.Collections.Generic.List[object]
  $inEntities = $false
  $count = $pairs.Count
  $i = 0
  while ($i -lt $count) {
    $pair = $pairs[$i]
    if ([int]$pair.code -eq 0 -and ([string]$pair.value).ToUpperInvariant() -eq "SECTION") {
      $sectionName = ""
      if (($i + 1) -lt $count -and [int]$pairs[$i + 1].code -eq 2) { $sectionName = ([string]$pairs[$i + 1].value).ToUpperInvariant() }
      $inEntities = ($sectionName -eq "ENTITIES")
      $i += 1
      continue
    }
    if ($inEntities -and [int]$pair.code -eq 0 -and ([string]$pair.value).ToUpperInvariant() -eq "ENDSEC") { break }
    if (-not $inEntities -or [int]$pair.code -ne 0) {
      $i += 1
      continue
    }

    $type = ([string]$pair.value).ToUpperInvariant()
    $j = $i + 1
    while ($j -lt $count -and [int]$pairs[$j].code -ne 0) { $j += 1 }
    $entityPairs = @()
    if ($j -gt ($i + 1)) { $entityPairs = @($pairs[($i + 1)..($j - 1)]) }

    if ($type -eq "LINE") {
      Add-DxfLineSegment -Segments $segments `
        -X1 (Get-DxfNumber -Pairs $entityPairs -Code 10) `
        -Y1 (Get-DxfNumber -Pairs $entityPairs -Code 20) `
        -X2 (Get-DxfNumber -Pairs $entityPairs -Code 11) `
        -Y2 (Get-DxfNumber -Pairs $entityPairs -Code 21)
    } elseif ($type -eq "CIRCLE") {
      Add-DxfArcSegments -Segments $segments `
        -Cx (Get-DxfNumber -Pairs $entityPairs -Code 10) `
        -Cy (Get-DxfNumber -Pairs $entityPairs -Code 20) `
        -R (Get-DxfNumber -Pairs $entityPairs -Code 40) `
        -A1Deg 0 -A2Deg 360 -MinimumSteps 96
    } elseif ($type -eq "ARC") {
      Add-DxfArcSegments -Segments $segments `
        -Cx (Get-DxfNumber -Pairs $entityPairs -Code 10) `
        -Cy (Get-DxfNumber -Pairs $entityPairs -Code 20) `
        -R (Get-DxfNumber -Pairs $entityPairs -Code 40) `
        -A1Deg (Get-DxfNumber -Pairs $entityPairs -Code 50) `
        -A2Deg (Get-DxfNumber -Pairs $entityPairs -Code 51)
    } elseif ($type -eq "LWPOLYLINE") {
      $points = New-Object System.Collections.Generic.List[object]
      $point = $null
      foreach ($ep in $entityPairs) {
        $code = [int]$ep.code
        if ($code -eq 10) {
          if ($point -ne $null -and -not [double]::IsNaN([double]$point.x) -and -not [double]::IsNaN([double]$point.y)) { $points.Add($point) | Out-Null }
          $point = [ordered]@{ x = [double]::Parse([string]$ep.value, [System.Globalization.CultureInfo]::InvariantCulture); y = [double]::NaN; bulge = 0.0 }
        } elseif ($code -eq 20 -and $point -ne $null) {
          $point.y = [double]::Parse([string]$ep.value, [System.Globalization.CultureInfo]::InvariantCulture)
        } elseif ($code -eq 42 -and $point -ne $null) {
          $point.bulge = [double]::Parse([string]$ep.value, [System.Globalization.CultureInfo]::InvariantCulture)
        }
      }
      if ($point -ne $null -and -not [double]::IsNaN([double]$point.x) -and -not [double]::IsNaN([double]$point.y)) { $points.Add($point) | Out-Null }
      Add-DxfPolyline -Segments $segments -Points $points -Closed:(((Get-DxfInteger -Pairs $entityPairs -Code 70) -band 1) -ne 0)
    } elseif ($type -eq "POLYLINE") {
      $closed = (((Get-DxfInteger -Pairs $entityPairs -Code 70) -band 1) -ne 0)
      $points = New-Object System.Collections.Generic.List[object]
      $k = $j
      while ($k -lt $count -and [int]$pairs[$k].code -eq 0) {
        $subType = ([string]$pairs[$k].value).ToUpperInvariant()
        if ($subType -eq "SEQEND") {
          $k += 1
          break
        }
        if ($subType -ne "VERTEX") { break }
        $m = $k + 1
        while ($m -lt $count -and [int]$pairs[$m].code -ne 0) { $m += 1 }
        $vertexPairs = @()
        if ($m -gt ($k + 1)) { $vertexPairs = @($pairs[($k + 1)..($m - 1)]) }
        $vx = Get-DxfNumber -Pairs $vertexPairs -Code 10
        $vy = Get-DxfNumber -Pairs $vertexPairs -Code 20
        $bulge = Get-DxfNumber -Pairs $vertexPairs -Code 42 -Default 0.0
        if (-not [double]::IsNaN($vx) -and -not [double]::IsNaN($vy)) {
          $points.Add([ordered]@{ x = $vx; y = $vy; bulge = $bulge }) | Out-Null
        }
        $k = $m
      }
      Add-DxfPolyline -Segments $segments -Points $points -Closed:$closed
      $i = $k
      continue
    } elseif ($type -eq "ELLIPSE") {
      Add-DxfEllipse -Segments $segments -EntityPairs $entityPairs
    } elseif ($type -eq "SPLINE") {
      Add-DxfSplineApproximation -Segments $segments -EntityPairs $entityPairs
    }
    $i = $j
  }

  return $segments.ToArray()
}

function Get-ThumbnailViaDxfRender {
  param([string]$DxfPath, [string]$OutPng, [int]$Size)

  if (-not ([System.IO.Path]::GetExtension($DxfPath).Equals(".dxf", [System.StringComparison]::OrdinalIgnoreCase))) { return $false }
  $segments = @(Get-DxfPreviewSegments -DxfPath $DxfPath)
  if ($segments.Count -eq 0) { return $false }

  $minX = [double]::PositiveInfinity
  $minY = [double]::PositiveInfinity
  $maxX = [double]::NegativeInfinity
  $maxY = [double]::NegativeInfinity
  foreach ($s in $segments) {
    foreach ($x in @([double]$s.x1, [double]$s.x2)) {
      if ($x -lt $minX) { $minX = $x }
      if ($x -gt $maxX) { $maxX = $x }
    }
    foreach ($y in @([double]$s.y1, [double]$s.y2)) {
      if ($y -lt $minY) { $minY = $y }
      if ($y -gt $maxY) { $maxY = $y }
    }
  }
  $w = $maxX - $minX
  $h = $maxY - $minY
  if ([double]::IsNaN($w) -or [double]::IsInfinity($w) -or [double]::IsNaN($h) -or [double]::IsInfinity($h) -or $w -le 0 -or $h -le 0) { return $false }

  $bmp = $null
  $g = $null
  $pen = $null
  try {
    $bmp = New-Object System.Drawing.Bitmap -ArgumentList $Size, $Size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::FromArgb(245, 247, 250))
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $pad = [Math]::Max(16, [int]($Size * 0.08))
    $scale = [Math]::Min(($Size - 2 * $pad) / [double]$w, ($Size - 2 * $pad) / [double]$h)
    if ($scale -le 0 -or [double]::IsNaN($scale) -or [double]::IsInfinity($scale)) { return $false }
    $drawW = $w * $scale
    $drawH = $h * $scale
    $ox = ($Size - $drawW) / 2.0
    $oy = ($Size - $drawH) / 2.0
    $penWidth = [Math]::Max(1.2, [Math]::Min(2.8, $Size / 120.0))
    $pen = New-Object System.Drawing.Pen -ArgumentList ([System.Drawing.Color]::FromArgb(28, 38, 52)), $penWidth
    foreach ($s in $segments) {
      $x1 = $ox + (([double]$s.x1 - $minX) * $scale)
      $y1 = $oy + $drawH - (([double]$s.y1 - $minY) * $scale)
      $x2 = $ox + (([double]$s.x2 - $minX) * $scale)
      $y2 = $oy + $drawH - (([double]$s.y2 - $minY) * $scale)
      $g.DrawLine($pen, [single]$x1, [single]$y1, [single]$x2, [single]$y2)
    }
    $bmp.Save($OutPng, [System.Drawing.Imaging.ImageFormat]::Png)
    return (Test-Path -LiteralPath $OutPng -PathType Leaf)
  } catch {
    Remove-Item -LiteralPath $OutPng -Force -ErrorAction SilentlyContinue
    return $false
  } finally {
    if ($pen -ne $null) { $pen.Dispose() }
    if ($g -ne $null) { $g.Dispose() }
    if ($bmp -ne $null) { $bmp.Dispose() }
  }
}

function Save-ImageBytesAsPng {
  param([byte[]]$Bytes, [string]$OutPng, [int]$Size = 256)

  if ($null -eq $Bytes -or $Bytes.Length -lt 16 -or $Bytes.Length -gt $script:MaxEmbeddedImageBytes) { return $false }
  $ms = $null
  $src = $null
  $thumb = $null
  $g = $null
  try {
    $ms = [System.IO.MemoryStream]::new($Bytes)
    $src = [System.Drawing.Bitmap]::FromStream($ms)
    if (-not (Test-SafeImageDimensions -Width $src.Width -Height $src.Height)) { return $false }
    $thumb = New-Object System.Drawing.Bitmap -ArgumentList $Size, $Size
    $g = [System.Drawing.Graphics]::FromImage($thumb)
    $g.Clear([System.Drawing.Color]::FromArgb(245, 247, 250))
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $scale = [Math]::Min($Size / [double]$src.Width, $Size / [double]$src.Height)
    if ($scale -le 0 -or [double]::IsNaN($scale) -or [double]::IsInfinity($scale)) { return $false }
    $drawW = [Math]::Max(1, [int][Math]::Round($src.Width * $scale))
    $drawH = [Math]::Max(1, [int][Math]::Round($src.Height * $scale))
    $dstX = [int](($Size - $drawW) / 2)
    $dstY = [int](($Size - $drawH) / 2)
    $dst = New-Object System.Drawing.Rectangle -ArgumentList $dstX, $dstY, $drawW, $drawH
    $g.DrawImage($src, $dst)
    $thumb.Save($OutPng, [System.Drawing.Imaging.ImageFormat]::Png)
    return (Test-Path -LiteralPath $OutPng -PathType Leaf)
  } catch {
    Remove-Item -LiteralPath $OutPng -Force -ErrorAction SilentlyContinue
    return $false
  } finally {
    if ($g -ne $null) { $g.Dispose() }
    if ($thumb -ne $null) { $thumb.Dispose() }
    if ($src -ne $null) { $src.Dispose() }
    if ($ms -ne $null) { $ms.Dispose() }
  }
}

function Get-ThumbnailViaDwgEmbeddedPreview {
  param([string]$DwgPath, [string]$OutPng, [int]$Size)

  # Embedded-preview table parsing follows the MIT-licensed DwgThumbnailReader
  # algorithm by kinkumas, translated from DwgThumbnail.cs at commit
  # 5168f535a5275777577d4939763bf98d498b7b57. See
  # https://github.com/kinkumas/DwgThumbnailReader for source and license.
  if (-not ([System.IO.Path]::GetExtension($DwgPath).Equals(".dwg", [System.StringComparison]::OrdinalIgnoreCase))) { return $false }
  $fs = $null
  $br = $null
  try {
    $fs = [System.IO.File]::Open($DwgPath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
    if ($fs.Length -lt 32) { return $false }
    $magic = New-Object byte[] 2
    if ($fs.Read($magic, 0, 2) -ne 2 -or $magic[0] -ne 65 -or $magic[1] -ne 67) { return $false } # "AC"
    $br = [System.IO.BinaryReader]::new($fs)
    $fs.Seek(13, [System.IO.SeekOrigin]::Begin) | Out-Null
    $previewTableOffset = 20 + $br.ReadInt32()
    if ($previewTableOffset -lt 0 -or $previewTableOffset -ge $fs.Length) { return $false }
    $fs.Seek($previewTableOffset, [System.IO.SeekOrigin]::Begin) | Out-Null
    $imageCount = [int]$br.ReadByte()
    if ($imageCount -le 0 -or $imageCount -gt 32) { return $false }

    for ($i = 0; $i -lt $imageCount; $i++) {
      if (($fs.Position + 9) -gt $fs.Length) { return $false }
      $imageType = [int]$br.ReadByte()
      $imageOffset = $br.ReadInt32()
      $imageLength = $br.ReadInt32()
      if ($imageOffset -lt 0 -or $imageLength -le 0 -or $imageLength -gt $script:MaxEmbeddedImageBytes -or ([int64]$imageOffset + [int64]$imageLength) -gt $fs.Length) { continue }

      if ($imageType -eq 6) {
        $fs.Seek($imageOffset, [System.IO.SeekOrigin]::Begin) | Out-Null
        $pngBytes = $br.ReadBytes($imageLength)
        if (Save-ImageBytesAsPng -Bytes $pngBytes -OutPng $OutPng -Size $Size) { return $true }
      } elseif ($imageType -eq 2) {
        $fs.Seek($imageOffset, [System.IO.SeekOrigin]::Begin) | Out-Null
        if (($fs.Position + 24) -gt $fs.Length) { continue }
        $br.ReadBytes(14) | Out-Null
        $bitDepth = [int]$br.ReadUInt16()
        $br.ReadBytes(4) | Out-Null
        $rawImageSize = [uint32]$br.ReadUInt32()
        $colorTableBytes = if ($bitDepth -gt 0 -and $bitDepth -lt 9) { [uint32](4 * [Math]::Pow(2, $bitDepth)) } else { [uint32]0 }
        $pixelBytes = if ($rawImageSize -gt 0) { $rawImageSize } else { [uint32]([Math]::Max(0, $imageLength - 40 - $colorTableBytes)) }
        if ([int64]$pixelBytes -gt $script:MaxEmbeddedImageBytes -or (54L + [int64]$colorTableBytes + [int64]$pixelBytes) -gt $script:MaxEmbeddedImageBytes) { continue }

        $fs.Seek($imageOffset, [System.IO.SeekOrigin]::Begin) | Out-Null
        $dibBytes = $br.ReadBytes($imageLength)
        $bmpMs = [System.IO.MemoryStream]::new()
        $bw = [System.IO.BinaryWriter]::new($bmpMs)
        try {
          $bw.Write([uint16]19778) # "BM"
          $bw.Write([int](54 + $colorTableBytes + $pixelBytes))
          $bw.Write([uint16]0)
          $bw.Write([uint16]0)
          $bw.Write([int](54 + $colorTableBytes))
          $bw.Write($dibBytes)
          $bw.Flush()
          if (Save-ImageBytesAsPng -Bytes $bmpMs.ToArray() -OutPng $OutPng -Size $Size) { return $true }
        } finally {
          $bw.Dispose()
          $bmpMs.Dispose()
        }
      }
    }
    return $false
  } catch {
    Remove-Item -LiteralPath $OutPng -Force -ErrorAction SilentlyContinue
    return $false
  } finally {
    if ($br -ne $null) { $br.Dispose() }
    elseif ($fs -ne $null) { $fs.Dispose() }
  }
}

function Test-DwgShellIconImage {
  param([string]$PngPath)

  $bmp = $null
  try {
    $bmp = [System.Drawing.Bitmap]::FromFile($PngPath)
    if ($bmp.Width -lt 48 -or $bmp.Height -lt 48) { return $true }
    $step = [Math]::Max(1, [int]([Math]::Min($bmp.Width, $bmp.Height) / 64))
    $total = 0
    $dark = 0
    $edrawGreen = 0
    for ($y = 0; $y -lt $bmp.Height; $y += $step) {
      for ($x = 0; $x -lt $bmp.Width; $x += $step) {
        $px = $bmp.GetPixel($x, $y)
        $total++
        if (($px.R + $px.G + $px.B) -lt 90) { $dark++ }
        if ($px.G -gt 120 -and $px.R -gt 80 -and $px.R -lt 190 -and $px.B -lt 110 -and ($px.G - $px.B) -gt 55) { $edrawGreen++ }
      }
    }
    if ($total -le 0) { return $true }
    return (($dark / [double]$total) -gt 0.28 -and ($edrawGreen / [double]$total) -gt 0.10)
  } catch {
    return $true
  } finally {
    if ($bmp -ne $null) { $bmp.Dispose() }
  }
}

function Test-SolidWorksBadColorPreview {
  param([string]$PngPath)

  $bmp = $null
  try {
    $bmp = [System.Drawing.Bitmap]::FromFile($PngPath)
    if ($bmp.Width -lt 80 -or $bmp.Height -lt 80) { return $false }
    $step = [Math]::Max(1, [int]([Math]::Min($bmp.Width, $bmp.Height) / 72))
    $total = 0
    $neonGreen = 0
    $solidRed = 0
    for ($y = 0; $y -lt $bmp.Height; $y += $step) {
      for ($x = 0; $x -lt $bmp.Width; $x += $step) {
        $px = $bmp.GetPixel($x, $y)
        $total++
        if ($px.G -gt 175 -and $px.R -lt 95 -and $px.B -lt 95) { $neonGreen++ }
        if ($px.R -gt 145 -and $px.G -lt 125 -and $px.B -lt 125) { $solidRed++ }
      }
    }
    if ($total -le 0) { return $false }
    return (($neonGreen / [double]$total) -gt 0.16 -and ($solidRed / [double]$total) -gt 0.035)
  } catch {
    return $false
  } finally {
    if ($bmp -ne $null) { $bmp.Dispose() }
  }
}

# True when a PNG is (near-)uniform - blank. Unlike IsLikelyIcon (which needs
# >=120 colours and so rejects legitimately simple B/W previews), this only
# fires on genuinely empty output: one colour covering ~everything. Used to
# reject a blank sw-api/sw-render result so it is never saved (the caller then
# leaves no thumbnail rather than caching a white square that the app's own
# blank-detector would just keep trying to regenerate).
function Test-IsBlankImage {
  param([string]$PngPath)
  $bmp = $null
  try {
    $bmp = [System.Drawing.Bitmap]::FromFile($PngPath)
    if ($bmp.Width -lt 8 -or $bmp.Height -lt 8) { return $true }
    $step = [Math]::Max(1, [int]([Math]::Min($bmp.Width, $bmp.Height) / 48))
    $counts = @{}
    $sampled = 0
    for ($y = 0; $y -lt $bmp.Height; $y += $step) {
      for ($x = 0; $x -lt $bmp.Width; $x += $step) {
        $c = $bmp.GetPixel($x, $y).ToArgb()
        if ($counts.ContainsKey($c)) { $counts[$c]++ } else { $counts[$c] = 1 }
        $sampled++
      }
    }
    if ($sampled -le 0) { return $true }
    $dominant = 0
    foreach ($v in $counts.Values) { if ($v -gt $dominant) { $dominant = $v } }
    return (($dominant / [double]$sampled) -gt 0.985)
  } catch {
    return $false
  } finally {
    if ($bmp -ne $null) { $bmp.Dispose() }
  }
}

function Get-ThumbnailValidationError {
  param([string]$PngPath, [string]$SourcePath)

  $ext = [System.IO.Path]::GetExtension($SourcePath)
  if ([ExcelsisShellThumb.Util]::IsLikelyIcon($PngPath)) { return "looks-like-icon" }
  if ($ext.Equals(".dwg", [System.StringComparison]::OrdinalIgnoreCase) -and (Test-DwgShellIconImage -PngPath $PngPath)) {
    return "dwg-shell-icon"
  }
  if ($ext.Equals(".slddrw", [System.StringComparison]::OrdinalIgnoreCase) -and (Test-SolidWorksBadColorPreview -PngPath $PngPath)) {
    return "bad-color-map"
  }
  return ""
}

# Decodes the bitmap SOLIDWORKS' GetPreviewBitmapFile writes into a clean
# grayscale thumbnail PNG. SOLIDWORKS writes an 8-bpp RLE8 BMP whose header
# is malformed (bfOffBits points at the palette instead of past it), so GDI+
# (Bitmap.FromFile) decodes it to garbage colors. We parse it by hand: read
# the 256-colour palette at offset 54, RLE8/uncompressed-decode the indices,
# map the single most-used index (the viewport background, whatever colour the
# user had set) to white and everything else to its luminance, then crop to
# the model and centre it on white. Result is a consistent B/W isometric
# preview regardless of the user's SOLIDWORKS background/part colours.
function Convert-SwPreviewToThumbnail {
  param([string]$BmpPath, [string]$OutPng, [int]$Size = 256)

  $fileInfo = Get-Item -LiteralPath $BmpPath -ErrorAction SilentlyContinue
  if ($null -eq $fileInfo -or $fileInfo.Length -lt 54 -or $fileInfo.Length -gt $script:MaxEmbeddedImageBytes) { return $false }
  $b = [System.IO.File]::ReadAllBytes($BmpPath)
  if ($b.Length -lt 54 -or $b[0] -ne 66 -or $b[1] -ne 77) { return $false }
  $w = [int64][BitConverter]::ToInt32($b, 18)
  $h = [int64][BitConverter]::ToInt32($b, 22)
  $bpp = [BitConverter]::ToInt16($b, 28)
  $comp = [BitConverter]::ToInt32($b, 30)
  $clrUsed = [BitConverter]::ToInt32($b, 46)
  if ($h -lt 0) { $h = -$h }
  if ($w -lt 8 -or $h -lt 8 -or -not (Test-SafeImageDimensions -Width $w -Height $h)) { return $false }
  if ($bpp -gt 8) {
    if ($bpp -notin @(16, 24, 32)) { return $false }
    return (Save-ImageBytesAsPng -Bytes $b -OutPng $OutPng -Size $Size)
  }
  if ($bpp -ne 8) { return $false }
  if ($clrUsed -le 0) { $clrUsed = [int][Math]::Pow(2, $bpp) }
  if ($clrUsed -le 0 -or $clrUsed -gt 256) { return $false }

  # Decode palette indices (BMP rows are bottom-up) and count index usage.
  $pixelCount = [int]($w * $h)
  $idx = New-Object 'byte[]' $pixelCount
  $hist = New-Object 'int[]' $clrUsed
  $dataOff = 54 + ($clrUsed * 4)
  if ($dataOff -gt $b.Length) { return $false }
  $x = 0; $y = 0
  if ($comp -eq 1 -and $bpp -eq 8) {
    $p = $dataOff
    while ($p -lt ($b.Length - 1)) {
      $n = $b[$p]; $c = $b[$p + 1]; $p += 2
      if ($n -gt 0) {
        if ($c -ge $clrUsed) { return $false }
        for ($k = 0; $k -lt $n; $k++) { if ($x -lt $w -and $y -lt $h) { $idx[(($h - 1 - $y) * $w) + $x] = $c; $hist[$c]++ }; $x++ }
      } else {
        if ($c -eq 0) { $x = 0; $y++ }
        elseif ($c -eq 1) { break }
        elseif ($c -eq 2) {
          if (($p + 1) -ge $b.Length) { break }
          $x += $b[$p]; $y += $b[$p + 1]; $p += 2
        }
        else {
          if (($p + $c) -gt $b.Length) { break }
          for ($k = 0; $k -lt $c; $k++) { $v = $b[$p + $k]; if ($v -ge $clrUsed) { return $false }; if ($x -lt $w -and $y -lt $h) { $idx[(($h - 1 - $y) * $w) + $x] = $v; $hist[$v]++ }; $x++ }
          $p += $c; if (($c -band 1) -eq 1) { $p++ }
        }
      }
    }
  } elseif ($comp -eq 0 -and $bpp -eq 8) {
    $stride = [int][Math]::Floor(($w + 3) / 4) * 4
    for ($row = 0; $row -lt $h; $row++) {
      $srcRow = $dataOff + (($h - 1 - $row) * $stride)
      if (($srcRow + $w) -gt $b.Length) { return $false }
      for ($col = 0; $col -lt $w; $col++) { $v = $b[$srcRow + $col]; if ($v -ge $clrUsed) { return $false }; $idx[($row * $w) + $col] = $v; $hist[$v]++ }
    }
  } else { return $false }

  # Dominant index = background -> white; every other index -> its luminance.
  $bgIdx = 0; $bgMax = -1
  for ($i = 0; $i -lt $clrUsed; $i++) { if ($hist[$i] -gt $bgMax) { $bgMax = $hist[$i]; $bgIdx = $i } }
  $lut = New-Object 'byte[]' $clrUsed
  for ($i = 0; $i -lt $clrUsed; $i++) {
    $o = 54 + ($i * 4)
    $lum = [int][Math]::Round((0.299 * $b[$o + 2]) + (0.587 * $b[$o + 1]) + (0.114 * $b[$o]))
    if ($lum -gt 255) { $lum = 255 }
    $lut[$i] = [byte]$lum
  }
  $lut[$bgIdx] = 255

  # Build a 24bpp gray image via LockBits (fast) and track the model bounds.
  $full = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  try {
    $rect = New-Object System.Drawing.Rectangle 0, 0, $w, $h
    $bd = $full.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::WriteOnly, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $stride = $bd.Stride
    $bufferBytes = [int64]$stride * $h
    if ($bufferBytes -le 0 -or $bufferBytes -gt ($script:MaxDecodedPixels * 4L)) {
      $full.UnlockBits($bd)
      return $false
    }
    $buf = New-Object 'byte[]' ([int]$bufferBytes)
    $minX = $w; $minY = $h; $maxX = -1; $maxY = -1
    for ($yy = 0; $yy -lt $h; $yy++) {
      $rowBase = $yy * $stride
      $idxBase = $yy * $w
      for ($xx = 0; $xx -lt $w; $xx++) {
        $g = $lut[$idx[$idxBase + $xx]]
        $o = $rowBase + ($xx * 3)
        $buf[$o] = $g; $buf[$o + 1] = $g; $buf[$o + 2] = $g
        if ($g -lt 235) {
          if ($xx -lt $minX) { $minX = $xx }; if ($xx -gt $maxX) { $maxX = $xx }
          if ($yy -lt $minY) { $minY = $yy }; if ($yy -gt $maxY) { $maxY = $yy }
        }
      }
    }
    [System.Runtime.InteropServices.Marshal]::Copy($buf, 0, $bd.Scan0, $buf.Length)
    $full.UnlockBits($bd)

    if ($maxX -le $minX -or $maxY -le $minY) { $minX = 0; $minY = 0; $maxX = $w - 1; $maxY = $h - 1 }
    $pad = [int]([Math]::Max($maxX - $minX, $maxY - $minY) * 0.06) + 8
    $minX = [Math]::Max(0, $minX - $pad); $minY = [Math]::Max(0, $minY - $pad)
    $maxX = [Math]::Min($w - 1, $maxX + $pad); $maxY = [Math]::Min($h - 1, $maxY + $pad)
    $cw = $maxX - $minX + 1; $ch = $maxY - $minY + 1

    $out = New-Object System.Drawing.Bitmap $Size, $Size, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $gfx = [System.Drawing.Graphics]::FromImage($out)
    try {
      $gfx.Clear([System.Drawing.Color]::White)
      $gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $scale = [Math]::Min($Size / [double]$cw, $Size / [double]$ch)
      $dw = [int][Math]::Round($cw * $scale); $dh = [int][Math]::Round($ch * $scale)
      $dx = [int][Math]::Floor(($Size - $dw) * 0.5); $dy = [int][Math]::Floor(($Size - $dh) * 0.5)
      $sr = New-Object System.Drawing.Rectangle $minX, $minY, $cw, $ch
      $dr = New-Object System.Drawing.Rectangle $dx, $dy, $dw, $dh
      $gfx.DrawImage($full, $dr, $sr, [System.Drawing.GraphicsUnit]::Pixel)
      $out.Save($OutPng, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally { $gfx.Dispose(); $out.Dispose() }
  } finally { $full.Dispose() }
  return (Test-Path -LiteralPath $OutPng -PathType Leaf)
}

# Calls ISldWorks::GetPreviewBitmapFile(swPath, config, bmpOut) via a
# cscript+VBS bridge. SOLIDWORKS writes the requested .bmp path and
# returns True/False. We decode that (malformed) BMP into a clean grayscale
# PNG at outPng via Convert-SwPreviewToThumbnail. Returns $true on success.
function Get-ThumbnailViaSolidWorks {
  param([string]$SwPath, [string]$OutPng, [int]$Size = 256)

  if (-not (Test-SolidWorksRunning)) { return $false }

  $bmpOut = Join-Path ([System.IO.Path]::GetTempPath()) ("excelsis-swprev-{0}.bmp" -f ([Guid]::NewGuid().ToString("N")))
  $vbs = @'
Option Explicit
On Error Resume Next
Dim sw, src, bmpPath, ok, names, i, nm
src = WScript.Arguments(0)
bmpPath = WScript.Arguments(1)
Set sw = GetObject(, "SldWorks.Application")
If sw Is Nothing Or Err.Number <> 0 Then
  WScript.StdErr.WriteLine "bind-failed: " & Err.Description
  WScript.Quit 2
End If

' The embedded preview bitmap is stored PER NAMED CONFIGURATION. Passing an
' empty config name works on some SOLIDWORKS versions but silently returns
' nothing on others (confirmed on SW 2025: "" -> false, "Default" -> real
' preview). So try the file's actual configuration names first (read without
' opening the file via GetConfigurationNames), then a "Default" fallback, and
' only then the empty name. First one that yields a bitmap wins.
ok = False

Err.Clear
names = sw.GetConfigurationNames(src)
If Err.Number <> 0 Then Err.Clear
If IsArray(names) Then
  For i = LBound(names) To UBound(names)
    If Not ok Then
      nm = "" & names(i)
      If Len(nm) > 0 Then
        Err.Clear
        ok = CBool(sw.GetPreviewBitmapFile(src, nm, bmpPath))
        If Err.Number <> 0 Then ok = False : Err.Clear
      End If
    End If
  Next
End If

If Not ok Then
  Err.Clear
  ok = CBool(sw.GetPreviewBitmapFile(src, "Default", bmpPath))
  If Err.Number <> 0 Then ok = False : Err.Clear
End If

If Not ok Then
  Err.Clear
  ok = CBool(sw.GetPreviewBitmapFile(src, "", bmpPath))
  If Err.Number <> 0 Then ok = False : Err.Clear
End If

If Not ok Then
  WScript.StdErr.WriteLine "no-preview-any-config"
  WScript.Quit 4
End If
WScript.StdOut.WriteLine bmpPath
WScript.Quit 0
'@

  $vbsPath = Join-Path ([System.IO.Path]::GetTempPath()) ("excelsis-swprev-{0}.vbs" -f ([Guid]::NewGuid().ToString("N")))
  Set-Content -LiteralPath $vbsPath -Value $vbs -Encoding ASCII
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = "cscript.exe"
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.Arguments = '//NoLogo "' + $vbsPath + '" "' + ($SwPath -replace '"','""') + '" "' + ($bmpOut -replace '"','""') + '"'
  $process = [System.Diagnostics.Process]::Start($psi)
  if (-not $process.WaitForExit(10000)) {
    try { $process.Kill() } catch {}
    Remove-Item -LiteralPath $vbsPath -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $bmpOut -Force -ErrorAction SilentlyContinue
    return $false
  }
  $process.StandardOutput.ReadToEnd() | Out-Null
  $stderr = $process.StandardError.ReadToEnd().Trim()
  Remove-Item -LiteralPath $vbsPath -Force -ErrorAction SilentlyContinue
  if ($process.ExitCode -ne 0) {
    if ($stderr) { $script:LastSolidWorksPreviewError = $stderr }
    Remove-Item -LiteralPath $bmpOut -Force -ErrorAction SilentlyContinue
    return $false
  }

  $bmpPath = $bmpOut
  if (-not (Test-Path -LiteralPath $bmpPath -PathType Leaf)) { return $false }

  try {
    # SW's preview BMP is a malformed 8-bpp RLE that GDI+ mis-decodes, so hand
    # it to our own decoder which produces a clean grayscale PNG.
    return (Convert-SwPreviewToThumbnail -BmpPath $bmpPath -OutPng $OutPng -Size $Size)
  } catch {
    return $false
  } finally {
    Remove-Item -LiteralPath $bmpPath -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $bmpOut -Force -ErrorAction SilentlyContinue
  }
}

# Last-resort fallback for files that do not have an embedded preview.
# It opens the document read-only/silent in SOLIDWORKS, zooms to fit, saves a
# temporary BMP of the model window, and converts that BMP to the cached PNG.
function Get-ThumbnailViaSolidWorksRender {
  param([string]$SwPath, [string]$OutPng, [int]$Size)
  $script:LastSolidWorksRenderError = ""

  if (-not (Test-SolidWorksRunning)) {
    $script:LastSolidWorksRenderError = "sw-not-running"
    return $false
  }

  $bmpOut = Join-Path ([System.IO.Path]::GetTempPath()) ("excelsis-swthumb-render-{0}.bmp" -f ([Guid]::NewGuid().ToString("N")))
  $vbs = @'
Option Explicit
On Error Resume Next

Dim sw, src, bmpOut, thumbSize, docType, doc, activeDoc, title, openErrors, openWarnings, activateErrors, openedByUs, ok, activePath, oldHideAllTypes, haveOldHideAllTypes
src = WScript.Arguments(0)
bmpOut = WScript.Arguments(1)
thumbSize = CLng(WScript.Arguments(2))

Function DocTypeFromPath(filePath)
  Dim ext
  ext = LCase(Mid(filePath, InStrRev(filePath, ".") + 1))
  If ext = "sldprt" Then
    DocTypeFromPath = 1
  ElseIf ext = "sldasm" Then
    DocTypeFromPath = 2
  ElseIf ext = "slddrw" Then
    DocTypeFromPath = 3
  Else
    DocTypeFromPath = 0
  End If
End Function

Set sw = GetObject(, "SldWorks.Application")
If sw Is Nothing Or Err.Number <> 0 Then
  WScript.StdErr.WriteLine "bind-failed: " & Err.Description
  WScript.Quit 2
End If

sw.Visible = True
docType = DocTypeFromPath(src)
If docType = 0 Then
  WScript.StdErr.WriteLine "unsupported-doc-type"
  WScript.Quit 3
End If

openedByUs = False
Err.Clear
Set activeDoc = sw.ActiveDoc
If Err.Number <> 0 Then Err.Clear

If Not activeDoc Is Nothing Then
  activePath = ""
  Err.Clear
  activePath = CStr(activeDoc.GetPathName())
  If Err.Number <> 0 Then activePath = "" : Err.Clear
  If LCase(activePath) = LCase(src) Then
    Set doc = activeDoc
  End If
End If

Err.Clear
If doc Is Nothing Then
  Set doc = sw.GetOpenDocumentByName(src)
  If Err.Number <> 0 Then Err.Clear
End If

If doc Is Nothing Then
  openedByUs = True
  openErrors = 0
  openWarnings = 0
  Err.Clear
  Set doc = sw.OpenDoc6(src, docType, 259, "", openErrors, openWarnings)
  If Err.Number <> 0 Then
    WScript.StdErr.WriteLine "open-failed: " & Err.Description
    WScript.Quit 4
  End If
End If

If doc Is Nothing Then
  WScript.StdErr.WriteLine "open-returned-nothing"
  WScript.Quit 5
End If

title = ""
Err.Clear
title = CStr(doc.GetTitle())
If Err.Number <> 0 Then title = "" : Err.Clear

If Len(title) > 0 Then
  Err.Clear
  activateErrors = 0
  Set doc = sw.ActivateDoc3(title, False, CLng(0), activateErrors)
  If Err.Number <> 0 Then Err.Clear
End If

If doc Is Nothing Then
  Err.Clear
  Set doc = sw.ActiveDoc
  If Err.Number <> 0 Then Err.Clear
End If

If doc Is Nothing Then
  WScript.StdErr.WriteLine "activate-returned-nothing"
  If openedByUs And Len(title) > 0 Then sw.CloseDoc title
  WScript.Quit 8
End If

Err.Clear
doc.ClearSelection2 True
If Err.Number <> 0 Then Err.Clear

haveOldHideAllTypes = False
oldHideAllTypes = False
Err.Clear
oldHideAllTypes = CBool(doc.GetUserPreferenceToggle(198))
If Err.Number = 0 Then
  haveOldHideAllTypes = True
Else
  Err.Clear
End If

Err.Clear
doc.SetUserPreferenceToggle 198, True
If Err.Number <> 0 Then Err.Clear

If docType <> 3 Then
  Err.Clear
  doc.ShowNamedView2 "*Isometric", 7
  If Err.Number <> 0 Then Err.Clear
End If

Err.Clear
doc.ViewZoomtofit2
If Err.Number <> 0 Then Err.Clear

Err.Clear
doc.GraphicsRedraw2
If Err.Number <> 0 Then Err.Clear

Err.Clear
ok = CBool(doc.SaveBMP(bmpOut, 0, 0))
If Err.Number <> 0 Then
  WScript.StdErr.WriteLine "savebmp-failed: " & Err.Description
  If haveOldHideAllTypes Then doc.SetUserPreferenceToggle 198, oldHideAllTypes
  If openedByUs And Len(title) > 0 Then sw.CloseDoc title
  WScript.Quit 6
End If

If haveOldHideAllTypes Then
  Err.Clear
  doc.SetUserPreferenceToggle 198, oldHideAllTypes
  If Err.Number <> 0 Then Err.Clear
End If

If openedByUs And Len(title) > 0 Then
  Err.Clear
  sw.CloseDoc title
End If

If Not ok Then
  WScript.StdErr.WriteLine "savebmp-returned-false"
  WScript.Quit 7
End If

WScript.StdOut.WriteLine bmpOut
WScript.Quit 0
'@

  $vbsPath = Join-Path ([System.IO.Path]::GetTempPath()) ("excelsis-swthumb-render-{0}.vbs" -f ([Guid]::NewGuid().ToString("N")))
  Set-Content -LiteralPath $vbsPath -Value $vbs -Encoding ASCII
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = "cscript.exe"
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.Arguments = '//NoLogo "' + $vbsPath + '" "' + ($SwPath -replace '"','""') + '" "' + ($bmpOut -replace '"','""') + '" "' + [string]$Size + '"'
  $process = [System.Diagnostics.Process]::Start($psi)
  if (-not $process.WaitForExit(20000)) {
    try { $process.Kill() } catch {}
    Remove-Item -LiteralPath $vbsPath -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $bmpOut -Force -ErrorAction SilentlyContinue
    $script:LastSolidWorksRenderError = "timeout"
    return $false
  }
  $process.StandardOutput.ReadToEnd() | Out-Null
  $stderr = $process.StandardError.ReadToEnd().Trim()
  Remove-Item -LiteralPath $vbsPath -Force -ErrorAction SilentlyContinue
  if ($process.ExitCode -ne 0) {
    $script:LastSolidWorksRenderError = if ($stderr) { $stderr } else { "exit-" + [string]$process.ExitCode }
    Remove-Item -LiteralPath $bmpOut -Force -ErrorAction SilentlyContinue
    return $false
  }

  $renderedBmp = $bmpOut
  if (-not (Test-Path -LiteralPath $renderedBmp -PathType Leaf)) {
    $script:LastSolidWorksRenderError = "missing-bmp:" + $renderedBmp
    Remove-Item -LiteralPath $bmpOut -Force -ErrorAction SilentlyContinue
    return $false
  }

  try {
    $renderedInfo = Get-Item -LiteralPath $renderedBmp -ErrorAction Stop
    if ($renderedInfo.Length -lt 16 -or $renderedInfo.Length -gt $script:MaxEmbeddedImageBytes) {
      throw "Rendered bitmap exceeds the safe decode limit."
    }
    $bmp = [System.Drawing.Bitmap]::FromFile($renderedBmp)
    try {
      if (-not (Test-SafeImageDimensions -Width $bmp.Width -Height $bmp.Height)) {
        throw "Rendered bitmap dimensions exceed the safe decode limit."
      }
      $srcRect = [ExcelsisShellThumb.Util]::FindVisualContentBounds($bmp)
      if ($srcRect.IsEmpty -or $srcRect.Width -lt 12 -or $srcRect.Height -lt 12) {
        $srcRect = New-Object System.Drawing.Rectangle -ArgumentList 0, 0, $bmp.Width, $bmp.Height
      }

      $scale = [Math]::Min($Size / [double]$srcRect.Width, $Size / [double]$srcRect.Height)
      $drawW = [Math]::Max(1, [int][Math]::Round($srcRect.Width * $scale))
      $drawH = [Math]::Max(1, [int][Math]::Round($srcRect.Height * $scale))
      $dstX = [int][Math]::Floor(($Size - $drawW) / 2)
      $dstY = [int][Math]::Floor(($Size - $drawH) / 2)
      $dstRect = New-Object System.Drawing.Rectangle -ArgumentList $dstX, $dstY, $drawW, $drawH

      $thumbBmp = $null
      $thumbGraphics = $null
      $thumbBmp = New-Object System.Drawing.Bitmap -ArgumentList $Size, $Size
      $thumbGraphics = [System.Drawing.Graphics]::FromImage($thumbBmp)
      try {
        $thumbGraphics.Clear([System.Drawing.Color]::FromArgb(245, 247, 250))
        $thumbGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $thumbGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $thumbGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $thumbGraphics.DrawImage($bmp, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
        $thumbBmp.Save($OutPng, [System.Drawing.Imaging.ImageFormat]::Png)
      } finally {
        if ($thumbGraphics -ne $null) { $thumbGraphics.Dispose() }
        if ($thumbBmp -ne $null) { $thumbBmp.Dispose() }
      }
    } finally {
      $bmp.Dispose()
    }
    return (Test-Path -LiteralPath $OutPng -PathType Leaf)
  } catch {
    $script:LastSolidWorksRenderError = "convert:" + $_.Exception.Message
    return $false
  } finally {
    Remove-Item -LiteralPath $renderedBmp -Force -ErrorAction SilentlyContinue
  }
}

if ($ThumbSize -lt 32 -or $ThumbSize -gt 1024) {
  [ordered]@{ results = @(); shellTierUnhealthy = $false } | ConvertTo-Json -Compress
  exit 0
}

try {
  $inputInfo = Get-Item -LiteralPath $InputJson -ErrorAction Stop
  if ($inputInfo.Length -le 0 -or $inputInfo.Length -gt $script:MaxInputJsonBytes) { throw "Input manifest exceeds the safe size limit." }
  $pairs = Get-Content -LiteralPath $InputJson -Raw -Encoding UTF8 | ConvertFrom-Json
} catch {
  [ordered]@{ results = @(); shellTierUnhealthy = $false } | ConvertTo-Json -Compress
  exit 0
}

if ($null -eq $pairs) {
  [ordered]@{ results = @(); shellTierUnhealthy = $false } | ConvertTo-Json -Compress
  exit 0
}
$pairs = @($pairs | Select-Object -First $script:MaxBatchItems)

# Shell-tier per-file timeout + circuit breaker (1.1.4). IShellItemImageFactory
# (tier "shell" below) is the SAME COM handler Windows Explorer itself uses for
# these files (SOLIDWORKS registers sldpropertyhandler.dll for its part/
# assembly/drawing extensions), and it has been observed to run slow or get
# stuck independent of our own process - Explorer can be seen pegging a core
# with that same DLL loaded while nothing of ours is even running. A single
# hung call here used to block this entire sequential loop up to the caller's
# outer process timeout (main.cjs, 90s), failing every file queued after it
# too. Two consecutive slow/timed-out files now disable this tier for the
# REST of this batch (falling through to sw-api/sw-render/no-thumbnail
# instead) rather than continuing to hammer an apparently-unhealthy handler
# file after file. shellTierUnhealthy is reported back to main.cjs so it can
# put new batches on a cooldown instead of immediately retrying the same tier.
$SHELL_TIMEOUT_MS = 4000
$SHELL_TRIP_THRESHOLD = 2
$script:ShellConsecutiveSlow = 0
$script:ShellTierDisabled = [bool]$SkipShellTier
# Distinct from ShellTierDisabled: only true when THIS run's own circuit
# breaker actually tripped (real observed slow/timed-out calls), never just
# because -SkipShellTier pre-disabled the tier. If we reported "unhealthy"
# whenever we were merely told to skip, main.cjs's cooldown would extend
# itself forever (every skipped run "confirming" unhealthy with no new
# evidence) - the cooldown could never expire and go test the tier again.
$script:ShellTierTrippedThisRun = $false

# Runs Util.Save on a background runspace in THIS SAME process (no extra
# process spawn, unlike Start-Job) and stops waiting after $SHELL_TIMEOUT_MS
# instead of blocking on one slow/hung file. On timeout we deliberately do NOT
# Dispose()/Stop() the pipeline: it is blocked inside a native COM call, and
# Stop() can itself hang waiting for a managed-code safe point a blocked
# native call never reaches. We just stop waiting for it - the abandoned
# runspace is reclaimed when this whole script process exits (batch end or
# the caller's outer timeout), either way bounded.
function Invoke-ShellThumbnailWithTimeout {
  param([string]$ItemPath, [string]$ItemOut, [int]$Size)
  $ps = [System.Management.Automation.PowerShell]::Create()
  $rs = [System.Management.Automation.Runspaces.RunspaceFactory]::CreateRunspace()
  $rs.Open()
  $ps.Runspace = $rs
  [void]$ps.AddScript({
    param($p, $o, $s)
    [ExcelsisShellThumb.Util]::Save($p, $o, $s)
  }).AddArgument($ItemPath).AddArgument($ItemOut).AddArgument($Size)
  $async = $ps.BeginInvoke()
  $completed = $async.AsyncWaitHandle.WaitOne($SHELL_TIMEOUT_MS)
  if (-not $completed) {
    return @{ ok = $false; timedOut = $true; error = "shell-timeout" }
  }
  try {
    $ps.EndInvoke($async) | Out-Null
    if ($ps.HadErrors) {
      $errRecord = $ps.Streams.Error | Select-Object -First 1
      return @{ ok = $false; timedOut = $false; error = "shell:" + $errRecord.ToString() }
    }
    return @{ ok = $true; timedOut = $false; error = "" }
  } catch {
    return @{ ok = $false; timedOut = $false; error = "shell:" + $_.Exception.Message }
  } finally {
    $rs.Close()
    $ps.Dispose()
  }
}

$results = New-Object System.Collections.Generic.List[object]
foreach ($pair in $pairs) {
  $itemPath = [string]$pair.path
  $itemOut = [string]$pair.outPng
  $allowSolidWorksRender = $false
  try { $allowSolidWorksRender = [bool]$pair.allowSolidWorksRender } catch {}
  # "SW render retry" (-RenderOnly) forces the reorienting render and skips the
  # cheaper tiers entirely - see the tier guards below.
  if ($RenderOnly) { $allowSolidWorksRender = $true }
  $ok = $false
  $method = ""
  $err = ""

  $outDir = [System.IO.Path]::GetDirectoryName($itemOut)
  if (-not [string]::IsNullOrWhiteSpace($outDir) -and -not (Test-Path -LiteralPath $outDir)) {
    try { New-Item -ItemType Directory -Force -Path $outDir | Out-Null } catch {}
  }

  # DXF does not reliably have a Windows thumbnail handler. Try our own
  # geometry pass first so Doc Search can show an actual outline preview.
  if ((-not $ok) -and (-not $RenderOnly)) {
    try {
      if (Get-ThumbnailViaDxfRender -DxfPath $itemPath -OutPng $itemOut -Size $ThumbSize) {
        $ok = $true
        $method = "dxf-render"
        $err = ""
      }
    } catch {
      $err = "dxf-render:" + $_.Exception.Message
    }
  }

  # DWG often carries its own BMP/PNG preview in the binary file. Extracting
  # that is much safer than opening eDrawings just to make a thumbnail.
  if ((-not $ok) -and (-not $RenderOnly)) {
    try {
      if (Get-ThumbnailViaDwgEmbeddedPreview -DwgPath $itemPath -OutPng $itemOut -Size $ThumbSize) {
        $ok = $true
        $method = "dwg-embedded"
        $err = ""
      }
    } catch {
      if ($err) { $err += " | " }
      $err += "dwg-embedded:" + $_.Exception.Message
    }
  }

  # 1) Shell extension first. It's fast and gives real previews for any
  # file whose Explorer thumbnail handler can read the embedded image.
  # Per-file timeout + circuit breaker: see the header comment above the
  # SHELL_TIMEOUT_MS/Invoke-ShellThumbnailWithTimeout definitions.
  if ((-not $ok) -and (-not $RenderOnly) -and (-not $script:ShellTierDisabled)) {
    $shellResult = Invoke-ShellThumbnailWithTimeout -ItemPath $itemPath -ItemOut $itemOut -Size $ThumbSize
    if ($shellResult.ok -and (Test-Path -LiteralPath $itemOut -PathType Leaf)) {
      $script:ShellConsecutiveSlow = 0
      # Validate: SOLIDWORKS' shell extension cheerfully returns the
      # yellow file-type icon for .SLDPRT/.SLDASM files that have no
      # embedded preview saved. That image LOOKS like a valid PNG to us
      # but is useless to the user. IsLikelyIcon counts unique colours;
      # if there are very few we treat the result as a placeholder and
      # discard it so the SW-API fallback (or no thumbnail at all) wins.
      $validationError = Get-ThumbnailValidationError -PngPath $itemOut -SourcePath $itemPath
      if (-not [string]::IsNullOrWhiteSpace($validationError)) {
        Remove-Item -LiteralPath $itemOut -Force -ErrorAction SilentlyContinue
        $err = "shell:" + $validationError
      } else {
        $ok = $true
        $method = "shell"
      }
    } else {
      $err = $shellResult.error
      if ($shellResult.timedOut) {
        $script:ShellConsecutiveSlow++
        if ($script:ShellConsecutiveSlow -ge $SHELL_TRIP_THRESHOLD) {
          $script:ShellTierDisabled = $true
          $script:ShellTierTrippedThisRun = $true
        }
      } else {
        $script:ShellConsecutiveSlow = 0
      }
    }
  }

  # 2) Fallback: ask SOLIDWORKS for the file's saved preview. For files
  # whose shell extension returned an icon placeholder, this either
  # produces a real embedded preview or also returns nothing (in which
  # case we end up with no thumbnail and the UI shows the type badge,
  # which is better than a yellow file-icon).
  if ((-not $ok) -and (-not $RenderOnly)) {
    try {
      # Our own decoder produces the thumbnail from SOLIDWORKS' real embedded
      # preview (never a shell placeholder icon), so the IsLikelyIcon check is
      # not applied here - it would false-reject legitimately low-colour B/W
      # previews. A returned bitmap is by definition a real saved preview.
      if (Get-ThumbnailViaSolidWorks -SwPath $itemPath -OutPng $itemOut -Size $ThumbSize) {
        if (Test-IsBlankImage -PngPath $itemOut) {
          Remove-Item -LiteralPath $itemOut -Force -ErrorAction SilentlyContinue
          if ($err) { $err += " | " }
          $err += "sw-api:blank"
        } else {
          $ok = $true
          $method = "sw-api"
          $err = ""
        }
      } else {
        if ($err) { $err += " | " }
        $err += "sw-api:no-saved-preview"
      }
    } catch {
      if ($err) { $err += " | " }
      $err += "sw-api:" + $_.Exception.Message
    }
  }

  # 3) Optional slower fallback: if SOLIDWORKS is open, render the document
  # window read-only. Normal background passes keep this disabled so merely
  # listing recent docs cannot open/render parts behind the user's back.
  if ((-not $ok) -and $allowSolidWorksRender) {
    try {
      if (Get-ThumbnailViaSolidWorksRender -SwPath $itemPath -OutPng $itemOut -Size $ThumbSize) {
        $renderExt = [System.IO.Path]::GetExtension($itemPath)
        if ($renderExt.Equals(".slddrw", [System.StringComparison]::OrdinalIgnoreCase) -and (Test-SolidWorksBadColorPreview -PngPath $itemOut)) {
          Remove-Item -LiteralPath $itemOut -Force -ErrorAction SilentlyContinue
          if ($err) { $err += " | " }
          $err += "sw-render:bad-color-map"
        } elseif (Test-IsBlankImage -PngPath $itemOut) {
          Remove-Item -LiteralPath $itemOut -Force -ErrorAction SilentlyContinue
          if ($err) { $err += " | " }
          $err += "sw-render:blank"
        } else {
          $ok = $true
          $method = "sw-render"
          $err = ""
        }
      } else {
        if ($err) { $err += " | " }
        $err += "sw-render:" + $(if ($script:LastSolidWorksRenderError) { $script:LastSolidWorksRenderError } else { "no-bmp" })
      }
    } catch {
      if ($err) { $err += " | " }
      $err += "sw-render:" + $_.Exception.Message
    }
  }

  $results.Add([ordered]@{
    path = $itemPath
    outPng = $itemOut
    ok = $ok
    method = $method
    error = $err
  })
}

[ordered]@{
  results = $results.ToArray()
  shellTierUnhealthy = $script:ShellTierTrippedThisRun
} | ConvertTo-Json -Depth 4 -Compress
