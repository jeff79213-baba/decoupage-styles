$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

Write-Host '=== 1. 建置安裝版 (IIFE) ==='
npx vite build --config vite.install.config.js
if ($LASTEXITCODE -ne 0) { throw 'vite build 失敗' }

$outDir = (Resolve-Path (Join-Path $PSScriptRoot '..\..\安裝版')).Path
$template = Join-Path $PSScriptRoot 'install-template.html'

Write-Host '=== 2. 複製 index.html ==='
Copy-Item -LiteralPath $template -Destination (Join-Path $outDir 'index.html') -Force

Write-Host '=== 3. 複製 nc.ico ==='
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'nc.ico') -Destination (Join-Path $outDir 'nc.ico') -Force

Write-Host '=== 4. 複製 建立桌面捷徑.vbs ==='
Copy-Item -LiteralPath (Join-Path $PSScriptRoot '建立桌面捷徑.vbs') -Destination (Join-Path $outDir '建立桌面捷徑.vbs') -Force

Write-Host '=== 5. 建立 安裝版內的 .lnk 捷徑 ==='
$ws = New-Object -ComObject WScript.Shell
$lnk = $ws.CreateShortcut((Join-Path $outDir 'CNC 程式編輯平台.lnk'))
$lnk.TargetPath = (Join-Path $outDir 'index.html')
$lnk.WorkingDirectory = $outDir
$lnk.IconLocation = (Join-Path $outDir 'nc.ico')
$lnk.Description = 'CNC 程式編輯平台'
$lnk.Save()

Write-Host '=== 完成 ==='
Get-ChildItem $outDir | Select-Object Name, Length
