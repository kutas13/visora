Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"
$publicDir = Join-Path $PSScriptRoot "..\public"

function Get-IconBytes([string]$pngPath, [int]$size) {
    $img = [System.Drawing.Image]::FromFile($pngPath)
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($img, 0, 0, $size, $size)
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $bytes = $ms.ToArray()
    $ms.Dispose()
    $g.Dispose()
    $bmp.Dispose()
    $img.Dispose()
    return ,$bytes
}

$srcPng = Join-Path $publicDir "icon-192.png"

$sizes = @(16, 32, 48)
$imageData = @()
foreach ($s in $sizes) {
    $imageData += ,(Get-IconBytes $srcPng $s)
}

$icoPath = Join-Path $publicDir "favicon.ico"
$fs = [System.IO.File]::Open($icoPath, [System.IO.FileMode]::Create)
$bw = New-Object System.IO.BinaryWriter($fs)

# ICONDIR header: reserved(2) + type(2, =1 for icon) + count(2)
$bw.Write([UInt16]0)
$bw.Write([UInt16]1)
$bw.Write([UInt16]$sizes.Count)

# ICONDIRENTRY (16 bytes each)
$offset = 6 + (16 * $sizes.Count)
for ($i = 0; $i -lt $sizes.Count; $i++) {
    $size = $sizes[$i]
    $data = $imageData[$i]
    $width  = if ($size -ge 256) { 0 } else { [byte]$size }
    $height = if ($size -ge 256) { 0 } else { [byte]$size }
    $bw.Write([byte]$width)
    $bw.Write([byte]$height)
    $bw.Write([byte]0)   # color count
    $bw.Write([byte]0)   # reserved
    $bw.Write([UInt16]1) # color planes
    $bw.Write([UInt16]32)# bits per pixel
    $bw.Write([UInt32]$data.Length)
    $bw.Write([UInt32]$offset)
    $offset += $data.Length
}

# image data
foreach ($data in $imageData) {
    $bw.Write($data)
}

$bw.Close()
$fs.Close()
Write-Host "Olusturuldu: favicon.ico"
