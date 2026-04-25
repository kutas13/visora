Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"

$publicDir = Join-Path $PSScriptRoot "..\public"
$src = Join-Path $publicDir "visora-logo.png"

if (-not (Test-Path $src)) {
    throw "Kaynak logo bulunamadi: $src"
}

$srcImg = [System.Drawing.Image]::FromFile($src)

function Save-Png([int]$size, [string]$outName, [string]$bg) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    if ($bg -ne "transparent") {
        $brush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml($bg))
        $g.FillRectangle($brush, 0, 0, $size, $size)
        $brush.Dispose()
    }

    $srcW = $srcImg.Width
    $srcH = $srcImg.Height
    $padding = [Math]::Round($size * 0.08)
    $targetRatio = [Math]::Min(($size - 2 * $padding) / $srcW, ($size - 2 * $padding) / $srcH)
    $targetW = [int]($srcW * $targetRatio)
    $targetH = [int]($srcH * $targetRatio)
    $x = [int](($size - $targetW) / 2)
    $y = [int](($size - $targetH) / 2)

    $g.DrawImage($srcImg, $x, $y, $targetW, $targetH)

    $outPath = Join-Path $publicDir $outName
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Olusturuldu: $outPath"
}

# PWA icons (beyaz zemin)
Save-Png 192 "icon-192.png" "#ffffff"
Save-Png 512 "icon-512.png" "#ffffff"
Save-Png 180 "apple-touch-icon.png" "#ffffff"
Save-Png 32  "favicon-32.png" "#ffffff"
Save-Png 16  "favicon-16.png" "#ffffff"

$srcImg.Dispose()

Write-Host ""
Write-Host "Tum ikonlar basariyla olusturuldu."
