Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

Dim dir
dir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = dir

WshShell.Run """" & dir & "\..\.venv\Scripts\python.exe"" fetch_news.py", 0, True

Dim deployCmd
deployCmd = "cmd /c ""C:\Users\TW-10\AppData\Roaming\npm\firebase.cmd deploy --only hosting --project opencode-sk >> deploy_log.txt 2>&1"""
WshShell.Run deployCmd, 0, True
