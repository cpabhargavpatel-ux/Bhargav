@echo off
rem Double-click: downloads the latest Goal Setting + French IPA files from GitHub into THIS folder.
rem Your goals database and public\app.html are never touched. Old files are saved in "update-backup".
setlocal
set "APPDIR=%~dp0"
cd /d "%APPDIR%"
echo.
echo   Stopping the server (if it is running)...
if exist "Stop Goal Setting.vbs" wscript //nologo "Stop Goal Setting.vbs"
powershell -NoProfile -ExecutionPolicy Bypass -Command "iex ((Get-Content -Raw -LiteralPath '%~f0') -split '#PSBEGIN')[-1]"
echo.
pause
exit /b
#PSBEGIN
$ErrorActionPreference = 'Stop'
$base = 'https://raw.githubusercontent.com/cpabhargavpatel-ux/Bhargav/claude/trusting-goldberg-zqrwem'
$dir  = $env:APPDIR
Set-Location -LiteralPath $dir
New-Item -ItemType Directory -Force -Path 'update-backup', 'public' | Out-Null
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$files = 'server.mjs', 'public/french-ipa.html', 'Goal Setting.vbs', 'Stop Goal Setting.vbs', 'French IPA.vbs'
$ok = $true
Write-Host '  Downloading the latest files...'
foreach ($f in $files) {
  $dest = $f -replace '/', '\'
  $tmp  = $dest + '.new'
  try {
    Invoke-WebRequest -UseBasicParsing -Uri ($base + '/' + ($f -replace ' ', '%20')) -OutFile $tmp
    if ((Get-Item $tmp).Length -lt 50) { throw 'empty download' }
    if (Test-Path $dest) { Copy-Item $dest ('update-backup\' + ($dest -replace '\\', '_')) -Force }
    Move-Item $tmp $dest -Force
    Write-Host ('  updated  ' + $f)
  } catch {
    $ok = $false
    if (Test-Path $tmp) { Remove-Item $tmp -Force }
    Write-Host ('  FAILED   ' + $f + '  (' + $_.Exception.Message + ')')
  }
}
if ($ok) { Write-Host "`n  Done. Now double-click your 'Goal Setting' shortcut, then press Ctrl+F5 in the browser." }
else     { Write-Host "`n  Some files could not be downloaded. Check your internet connection and try again." }
