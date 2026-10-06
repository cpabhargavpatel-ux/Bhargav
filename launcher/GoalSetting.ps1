param([ValidateSet('start','stop')][string]$Action = 'start')
$ErrorActionPreference = 'SilentlyContinue'
$AppFolder = 'C:\Users\bpatel9\Desktop\Claude\Goal Setting Server'
$StartCmd  = ''   # leave empty to auto-detect
$State     = Join-Path $env:LOCALAPPDATA 'GoalSetting'
New-Item -ItemType Directory -Force $State | Out-Null
$PidFile = Join-Path $State 'pid.txt'; $PortFile = Join-Path $State 'port.txt'
Add-Type -AssemblyName System.Windows.Forms
function Msg($t) { [void][System.Windows.Forms.MessageBox]::Show($t, 'Goal Setting') }
function Test-Url($u) { try { [void](Invoke-WebRequest $u -UseBasicParsing -TimeoutSec 2); $true } catch { $_.Exception.Response -ne $null } }
function Get-Tree($rootPid) {
  $all = Get-CimInstance Win32_Process; $ids = @($rootPid); $grow = $true
  while ($grow) { $grow = $false
    foreach ($p in $all) { if ($ids -contains $p.ParentProcessId -and $ids -notcontains $p.ProcessId) { $ids += $p.ProcessId; $grow = $true } } }
  $ids
}

if ($Action -eq 'stop') {
  if (Test-Path $PidFile) { taskkill /F /T /PID (Get-Content $PidFile) | Out-Null; Remove-Item $PidFile, $PortFile }
  Msg 'Goal Setting server stopped.'; exit
}

# Already running? just open it.
if ((Test-Path $PidFile) -and (Test-Path $PortFile) -and (Get-Process -Id (Get-Content $PidFile))) {
  $u = "http://localhost:$(Get-Content $PortFile)/"
  if (Test-Url $u) { Start-Process $u; exit }
}

$cmd = $StartCmd
if (-not $cmd) {
  if (Test-Path "$AppFolder\package.json") {
    $pkg = Get-Content "$AppFolder\package.json" -Raw | ConvertFrom-Json
    if ($pkg.scripts.start) { $cmd = 'npm start' } elseif ($pkg.scripts.dev) { $cmd = 'npm run dev' } else { $cmd = 'node server.js' }
  } else {
    foreach ($f in 'app.py','server.py','main.py','manage.py') {
      if (Test-Path "$AppFolder\$f") { $cmd = if ($f -eq 'manage.py') { 'python manage.py runserver' } else { "python $f" }; break } }
  }
}
if (-not $cmd) { Msg "Could not find how to start the app in:`n$AppFolder"; exit }

$env:BROWSER = 'none'
$p = Start-Process cmd.exe -ArgumentList "/c $cmd > goal-app.log 2>&1" -WorkingDirectory $AppFolder -WindowStyle Hidden -PassThru
$p.Id | Set-Content $PidFile

# Auto-detect the port the server (or its children) starts listening on.
$port = $null
for ($i = 0; $i -lt 90 -and -not $port; $i++) {
  Start-Sleep -Milliseconds 500
  $ids = Get-Tree $p.Id
  $c = Get-NetTCPConnection -State Listen | Where-Object { $ids -contains $_.OwningProcess } | Sort-Object LocalPort | Select-Object -First 1
  if ($c) { $port = $c.LocalPort }
}
if (-not $port) { Msg "Server did not start. See goal-app.log in:`n$AppFolder"; exit }
$port | Set-Content $PortFile
$u = "http://localhost:$port/"
for ($i = 0; $i -lt 20 -and -not (Test-Url $u); $i++) { Start-Sleep -Milliseconds 500 }
Start-Process $u
