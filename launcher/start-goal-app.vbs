' Starts the Goal Setting server hidden (no cmd window), waits until it
' responds, then opens the browser. Edit the 3 settings below if needed.
Option Explicit

Const APP_FOLDER = "C:\Users\bpatel9\Desktop\Claude\Goal Setting Server"
Const APP_PORT   = 3000
' Leave START_CMD empty to auto-detect (npm start / npm run dev / app.py / server.py / main.py)
Const START_CMD  = ""

Dim sh, url, http, i, ready, cmd, fso
Set sh  = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
url = "http://localhost:" & APP_PORT & "/"

Function IsUp()
  On Error Resume Next
  Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
  http.setTimeouts 1000, 1000, 1000, 1000
  http.Open "GET", url, False
  http.Send
  IsUp = (Err.Number = 0)
  Err.Clear
End Function

If Not IsUp() Then
  cmd = START_CMD
  If cmd = "" Then
    If fso.FileExists(APP_FOLDER & "\package.json") Then
      Dim ts, txt
      Set ts = fso.OpenTextFile(APP_FOLDER & "\package.json", 1)
      txt = ts.ReadAll: ts.Close
      If InStr(txt, """start""") > 0 Then
        cmd = "npm start"
      Else
        cmd = "npm run dev"
      End If
    ElseIf fso.FileExists(APP_FOLDER & "\app.py") Then
      cmd = "python app.py"
    ElseIf fso.FileExists(APP_FOLDER & "\server.py") Then
      cmd = "python server.py"
    ElseIf fso.FileExists(APP_FOLDER & "\main.py") Then
      cmd = "python main.py"
    Else
      MsgBox "Could not detect how to start the app. Set START_CMD in this file.", 48, "Goal Setting"
      WScript.Quit 1
    End If
  End If
  sh.CurrentDirectory = APP_FOLDER
  ' window style 0 = hidden; BROWSER=none stops dev servers opening a 2nd tab
  sh.Environment("PROCESS")("BROWSER") = "none"
  sh.Run "cmd /c " & cmd & " > goal-app.log 2>&1", 0, False

  ready = False
  For i = 1 To 60
    WScript.Sleep 500
    If IsUp() Then ready = True: Exit For
  Next
  If Not ready Then
    MsgBox "Server did not respond on " & url & vbCrLf & "Check goal-app.log in the app folder (and the APP_PORT setting).", 48, "Goal Setting"
    WScript.Quit 1
  End If
End If

sh.Run url
