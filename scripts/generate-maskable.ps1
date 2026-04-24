Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"
$publicDir = Join-Path $PSScriptRoot "..\public"
$src = Join-Path $publicDir "fox-logo.jpg"
$srcImg = [System.Drawing.Image]::FromFile($src)

function Save-Maskable([int]$size, [string]$outName, [string]$bg) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml($bg))
    $g.FillRectangle($brush, 0, 0, $size, $size)
    $brush.Dispose()

    # Android safe zone: icerik merkez %80 cap icinde olmali.
    # Kare icine %60 kenar boyutunda logo yerlestir (her yandan %20 padding).
    $padding = [int]($size * 0.20)
    $inner = $size - 2 * $padding
    $srcW = $srcImg.Width
    $srcH = $srcImg.Height
    $ratio = [Math]::Min($inner / $srcW, $inner / $srcH)
    $targetW = [int]($srcW * $ratio)
    $targetH = [int]($srcH * $ratio)
    $x = [int](($size - $targetW) / 2)
    $y = [int](($size - $targetH) / 2)

    $g.DrawImage($srcImg, $x, $y, $targetW, $targetH)

    $outPath = Join-Path $publicDir $outName
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Olusturuldu: $outPath"
}

Save-Maskable 512 "icon-maskable-512.png" "#ffffff"
Save-Maskable 192 "icon-maskable-192.png" "#ffffff"

$srcImg.Dispose()
Write-Host "Maskable ikonlar hazir."
