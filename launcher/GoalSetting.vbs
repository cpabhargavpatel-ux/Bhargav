' Hidden launcher stub: runs GoalSetting.ps1 with no window at all.
Dim fso, dir, arg
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
arg = "start"
If WScript.Arguments.Count > 0 Then arg = WScript.Arguments(0)
CreateObject("WScript.Shell").Run "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & dir & "\GoalSetting.ps1"" " & arg, 0, False
