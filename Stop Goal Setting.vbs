' Stops the hidden Goal Setting server (ends Node.js).
CreateObject("WScript.Shell").Run "taskkill /F /IM node.exe", 0, True
MsgBox "Goal Setting server stopped.", 64, "Goal Setting"
