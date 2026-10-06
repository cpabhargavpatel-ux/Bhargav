# Run once: creates "Goal Setting" shortcuts on your Desktop.
$desktop = [Environment]::GetFolderPath('Desktop')
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$ws = New-Object -ComObject WScript.Shell
foreach ($p in @(@('Goal Setting','start-goal-app.vbs',13), @('Stop Goal Setting','stop-goal-app.vbs',131))) {
  $s = $ws.CreateShortcut("$desktop\$($p[0]).lnk")
  $s.TargetPath = "$env:WINDIR\System32\wscript.exe"
  $s.Arguments = "`"$here\$($p[1])`""
  $s.WorkingDirectory = $here
  $s.IconLocation = "$env:WINDIR\System32\shell32.dll,$($p[2])"
  $s.Save()
}
Write-Host "Shortcuts created on Desktop."
