' French IPA Trainer - one-click start (no cmd window). Separate from the Goal Setting app.
' Runs "node server.mjs" hidden, waits until it answers, opens the browser.
Option Explicit
Dim sh, fso, dir, port, url, i, ok, txt, m

Set sh  = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = dir

port = 8484
If fso.FileExists(dir & "\config.json") Then
  txt = fso.OpenTextFile(dir & "\config.json", 1).ReadAll
  With CreateObject("VBScript.RegExp")
    .Pattern = """port""\s*:\s*(\d+)"
    If .Test(txt) Then port = CLng(.Execute(txt)(0).SubMatches(0))
  End With
End If
url = "http://localhost:" & port & "/"

Function IsUp()
  On Error Resume Next
  Dim h
  Set h = CreateObject("MSXML2.ServerXMLHTTP.6.0")
  h.setTimeouts 1000, 1000, 1000, 1000
  h.Open "GET", url, False
  h.Send
  IsUp = (Err.Number = 0)
  Err.Clear
End Function

If Not IsUp() Then
  ' Run node directly (not START SERVER.cmd - cmd's built-in START swallows that name).
  sh.Run "cmd /c node server.mjs > goal-app.log 2>&1", 0, False
  ok = False
  For i = 1 To 40
    WScript.Sleep 500
    If IsUp() Then ok = True: Exit For
  Next
  If Not ok Then
    sh.Run "notepad.exe """ & dir & "\goal-app.log""", 1, False
    MsgBox "The server did not start. The log is open in Notepad." & vbCrLf & _
           "If it says 'node is not recognized', install Node.js 24 LTS from https://nodejs.org", 48, "Goal Setting"
    WScript.Quit 1
  End If
End If

sh.Run url & "french-ipa.html"
