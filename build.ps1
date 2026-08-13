# 从 src/startpage.html 构建扩展文件（MV3 扩展页禁止内联脚本，需拆分）
# 修改 src/startpage.html 后，运行本脚本生成根目录的 startpage.html / startpage.css / startpage.js
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$src  = Join-Path $root 'src\startpage.html'

$html = Get-Content $src -Raw -Encoding UTF8

$styleM  = [regex]::Match($html, '(?s)<style>(.*?)</style>')
$scriptM = [regex]::Match($html, '(?s)<script>(.*?)</script>')
if (-not $styleM.Success)  { throw '未找到 <style> 块' }
if (-not $scriptM.Success) { throw '未找到 <script> 块' }

# 内联样式 -> 外部 css
$out = $html.Remove($styleM.Index, $styleM.Length).Insert($styleM.Index, '<link rel="stylesheet" href="startpage.css">')
# 内联脚本 -> 外部 js
$scriptM2 = [regex]::Match($out, '(?s)<script>(.*?)</script>')
$out = $out.Remove($scriptM2.Index, $scriptM2.Length).Insert($scriptM2.Index, '<script src="startpage.js"></script>')

Set-Content -Path (Join-Path $root 'startpage.css') -Value $styleM.Groups[1].Value  -Encoding UTF8
Set-Content -Path (Join-Path $root 'startpage.js')  -Value $scriptM.Groups[1].Value -Encoding UTF8
Set-Content -Path (Join-Path $root 'startpage.html') -Value $out -Encoding UTF8

Write-Host '构建完成：startpage.html / startpage.css / startpage.js 已生成。'
