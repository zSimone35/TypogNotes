$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent
$output = Join-Path $root 'src-tauri/windows'
# Current app mark (yellow feather on the brown primary), the same pairing as the app bar.
$logo = [System.Drawing.Image]::FromFile((Join-Path $root 'src-tauri/icons/Square310x310Logo.png'))
$brown = [System.Drawing.ColorTranslator]::FromHtml('#855133')
$brownDark = [System.Drawing.ColorTranslator]::FromHtml('#6a3e25')
$surface = [System.Drawing.ColorTranslator]::FromHtml('#FFF8F6')

# NSIS stretches these bitmaps to the page controls, which with Segoe UI 9 are already larger
# than the nominal 164x314 / 150x57 at 100 %: drawing at 2x means Windows only ever shrinks them.
$scale = 2

function New-Canvas([int]$width, [int]$height) {
    $bitmap = [System.Drawing.Bitmap]::new($width * $scale, $height * $scale, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $g = [System.Drawing.Graphics]::FromImage($bitmap)
    $g.SmoothingMode = 'AntiAlias'
    $g.InterpolationMode = 'HighQualityBicubic'
    $g.PixelOffsetMode = 'HighQuality'
    $g.CompositingQuality = 'HighQuality'
    return $bitmap, $g
}

function Save-Art($bitmap, [string]$name) {
    $bitmap.Save((Join-Path $output "$name.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $bitmap.Save((Join-Path $output "$name.bmp"), [System.Drawing.Imaging.ImageFormat]::Bmp)
    $bitmap.Dispose()
}

try {
    # Welcome/finish sidebar: soft vertical brown gradient, the mark centred in the upper half.
    $bitmap, $g = New-Canvas 164 314
    $rect = [System.Drawing.Rectangle]::new(0, 0, $bitmap.Width, $bitmap.Height)
    $gradient = [System.Drawing.Drawing2D.LinearGradientBrush]::new($rect, $brown, $brownDark, 90)
    $g.FillRectangle($gradient, $rect)
    $size = 96 * $scale
    $g.DrawImage($logo, [int](($bitmap.Width - $size) / 2), [int](104 * $scale - $size / 2), $size, $size)
    $gradient.Dispose(); $g.Dispose()
    Save-Art $bitmap 'sidebar'

    # Inner-page header: page colour, the mark on a brown rounded tile (like the app bar logo) on the right.
    $bitmap, $g = New-Canvas 150 57
    $g.Clear($surface)
    $tile = 41 * $scale; $radius = 12 * $scale
    $x = $bitmap.Width - $tile - 8 * $scale; $y = [int](($bitmap.Height - $tile) / 2)
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $path.AddArc($x, $y, $radius, $radius, 180, 90)
    $path.AddArc($x + $tile - $radius, $y, $radius, $radius, 270, 90)
    $path.AddArc($x + $tile - $radius, $y + $tile - $radius, $radius, $radius, 0, 90)
    $path.AddArc($x, $y + $tile - $radius, $radius, $radius, 90, 90)
    $path.CloseFigure()
    $brush = [System.Drawing.SolidBrush]::new($brown)
    $g.FillPath($brush, $path)
    $inset = 7 * $scale
    $g.DrawImage($logo, $x + $inset, $y + $inset, $tile - 2 * $inset, $tile - 2 * $inset)
    $brush.Dispose(); $path.Dispose(); $g.Dispose()
    Save-Art $bitmap 'header'
} finally { $logo.Dispose() }
