' Goal Setting - one-click start. Put this file INSIDE your "Goal Setting Server" folder.
' Runs "START SERVER.cmd" hidden (no cmd window), finds the port, opens the browser.
Option Explicit
Dim sh, fso, dir, tmp, before, after, port, i, p, url, startCmd, n, line
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
tmp = sh.ExpandEnvironmentStrings("%TEMP%") & "\goal-ports.txt"
sh.CurrentDirectory = dir

Function ListeningPorts()
  Dim f, t, l, parts, a, d
  Set d = CreateObject("Scripting.Dictionary")
  sh.Run "cmd /c netstat -ano -p tcp | find ""LISTENING"" > """ & tmp & """", 0, True
  If fso.FileExists(tmp) Then
    Set f = fso.OpenTextFile(tmp, 1)
    Do Until f.AtEndOfStream
      l = Trim(f.ReadLine)
      parts = Split(Replace(Replace(l, "   ", " "), "  ", " "), " ")
      If UBound(parts) >= 1 Then
        a = parts(1)
        If InStr(a, ":") > 0 Then
          If Left(a, 9) = "127.0.0.1" Or Left(a, 7) = "0.0.0.0" Or Left(a, 3) = "[::" Then d(Mid(a, InStrRev(a, ":") + 1)) = 1
        End If
      End If
    Loop
    f.Close
  End If
  Set ListeningPorts = d
End Function

If fso.FileExists(dir & "\START SERVER.cmd") Then
  startCmd = """START SERVER.cmd"""
ElseIf fso.FileExists(dir & "\server.mjs") Then
  startCmd = "node server.mjs"
Else
  MsgBox "Put this file inside the Goal Setting Server folder (next to START SERVER.cmd).", 48, "Goal Setting"
  WScript.Quit
End If

Set before = ListeningPorts()
sh.Run "cmd /c """ & startCmd & " > goal-app.log 2>&1""", 0, False

port = ""
For i = 1 To 60
  WScript.Sleep 500
  Set after = ListeningPorts()
  For Each p In after.Keys
    If Not before.Exists(p) And port = "" Then port = p
  Next
  If port <> "" Then Exit For
Next

If port = "" Then
  sh.Run "notepad.exe """ & dir & "\goal-app.log""", 1, False
  MsgBox "The server did not start. The log is open in Notepad - please send me what it says.", 48, "Goal Setting"
  WScript.Quit
End If

WScript.Sleep 800
sh.Run "http://localhost:" & port & "/"
