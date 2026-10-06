' Stops the hidden Goal Setting server (whatever is listening on APP_PORT).
Const APP_PORT = 3000
Dim sh
Set sh = CreateObject("WScript.Shell")
sh.Run "powershell -NoProfile -WindowStyle Hidden -Command ""Get-NetTCPConnection -LocalPort " & APP_PORT & " -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }""", 0, True
MsgBox "Goal Setting server stopped.", 64, "Goal Setting"
