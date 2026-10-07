' Stops the hidden Goal Setting server (only the program using the app's port).
Dim sh, fso, dir, port, txt
Set sh  = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
port = 8484
If fso.FileExists(dir & "\config.json") Then
  txt = fso.OpenTextFile(dir & "\config.json", 1).ReadAll
  With CreateObject("VBScript.RegExp")
    .Pattern = """port""\s*:\s*(\d+)"
    If .Test(txt) Then port = CLng(.Execute(txt)(0).SubMatches(0))
  End With
End If
sh.Run "powershell -NoProfile -WindowStyle Hidden -Command ""Get-NetTCPConnection -LocalPort " & port & " -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }""", 0, True
MsgBox "Goal Setting server stopped.", 64, "Goal Setting"
