@echo off
rem Double-click: downloads the latest Goal Setting + French files from GitHub into THIS folder,
rem then restarts the server and opens the app.
rem Your goals database is never touched. Old copies of every replaced file (including public\app.html) are saved in "update-backup".
setlocal
set "APPDIR=%~dp0"
cd /d "%APPDIR%"
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "iex ((Get-Content -Raw -LiteralPath '%~f0') -split '#PSBEGIN')[-1]"
if errorlevel 1 (
  echo.
  pause
  exit /b 1
)
echo.
echo   Starting the server...
wscript //nologo "%APPDIR%Goal Setting.vbs"
exit /b
#PSBEGIN
$ErrorActionPreference = 'Stop'
$base = 'https://raw.githubusercontent.com/cpabhargavpatel-ux/Bhargav/claude/trusting-goldberg-zqrwem'
Set-Location -LiteralPath $env:APPDIR

# 1. stop any running Goal Setting server
Write-Host '  Stopping the server (if it is running)...'
$port = 8484
try { if (Test-Path 'config.json') { $m = [regex]::Match((Get-Content -Raw 'config.json'), '"port"\s*:\s*(\d+)'); if ($m.Success) { $port = [int]$m.Groups[1].Value } } } catch { }
$stopped = 0
try {
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -like '*server.mjs*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force; $stopped++ }
} catch { }
try {   # anything still listening on the app's port
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue; $stopped++ }
} catch { }
Start-Sleep -Milliseconds 800
$still = $false
try { $still = [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) } catch { }
if ($still) {
  Write-Host ('  Port ' + $port + ' is still busy - stopping all Node programs...')
  & taskkill /F /IM node.exe 2>$null | Out-Null
  Start-Sleep -Milliseconds 800
}
Write-Host ('  Stopped ' + $stopped + ' old server process(es).')

# 2. download the latest files (old ones are kept in update-backup)
New-Item -ItemType Directory -Force -Path 'update-backup', 'public', 'public\fonts' | Out-Null
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
# the list of files to update lives on GitHub (update-files.txt), so it can grow without changing this updater
$stamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()   # defeats GitHub's 5-minute download cache
$files = @()
try {
  $files = (Invoke-WebRequest -UseBasicParsing -Uri ($base + '/update-files.txt?t=' + $stamp)).Content -split "`r?`n" |
    ForEach-Object { $_.Trim() } | Where-Object { $_ }
} catch { Write-Host ('  FAILED   update-files.txt  (' + $_.Exception.Message + ')'); exit 1 }
$ok = $true
Write-Host '  Downloading the latest files...'
foreach ($f in $files) {
  $dest = $f -replace '/', '\'
  $tmp  = $dest + '.new'
  try {
    Invoke-WebRequest -UseBasicParsing -Uri ($base + '/' + ($f -replace ' ', '%20') + '?t=' + $stamp) -OutFile $tmp
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
if (-not $ok) {
  Write-Host "`n  Some files could not be downloaded. Check your internet connection and try again."
  exit 1
}
$bm = [regex]::Match((Get-Content -Raw 'server.mjs'), 'build [0-9]+-[0-9]+-[a-z]')
Write-Host ("`n  Update complete. Installed: " + $bm.Value)
