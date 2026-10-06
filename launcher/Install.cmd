@echo off
rem Double-click once: puts "Goal Setting" and "Stop Goal Setting" shortcuts on your Desktop.
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
 "$d=[Environment]::GetFolderPath('Desktop');$h='%~dp0';$w=New-Object -ComObject WScript.Shell;" ^
 "foreach($x in @(@('Goal Setting','start',13),@('Stop Goal Setting','stop',131))){" ^
 "$s=$w.CreateShortcut(\"$d\$($x[0]).lnk\");$s.TargetPath=\"$env:WINDIR\System32\wscript.exe\";" ^
 "$s.Arguments='\"'+$h+'GoalSetting.vbs\" '+$x[1];$s.WorkingDirectory=$h;" ^
 "$s.IconLocation=\"$env:WINDIR\System32\shell32.dll,$($x[2])\";$s.Save()}"
echo Done. Look for "Goal Setting" on your Desktop.
pause
