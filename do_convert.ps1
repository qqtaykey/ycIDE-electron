$base = "D:\chungbin\ycIDE-html\支持库源码\commobj"
$srcElib = "D:\chungbin\ycIDE-html\支持库源码\krnln\elib"
$dstElib = "$base\elib"

$gbk = [System.Text.Encoding]::GetEncoding(936)
$utf8bom = New-Object System.Text.UTF8Encoding($true)
$bom = [byte[]](0xEF, 0xBB, 0xBF)

$converted = 0
$files = Get-ChildItem -Path "$base\*" -Include "*.cpp","*.h"
$files += Get-ChildItem -Path "$base\cppCode\*" -Include "*.cpp","*.h"

foreach ($f in $files) {
    $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        continue
    }
    try {
        $text = $gbk.GetString($bytes)
        $utf8bytes = $utf8bom.GetBytes($text)
        [System.IO.File]::WriteAllBytes($f.FullName, $utf8bytes)
        $converted++
    } catch {
        Write-Host "FAIL: $($f.FullName): $_"
    }
}

$elibFiles = @('lib2.h','fnshare.h','krnllib.h','lang.h','mtypes.h','PublicIDEFunctions.h','untshare.h')
foreach ($fn in $elibFiles) {
    $src = "$srcElib\$fn"
    $dst = "$dstElib\$fn"
    if (Test-Path $src) {
        Copy-Item $src $dst -Force
        Write-Host "Copied: $fn"
    }
}

Write-Host "Converted: $converted files"
