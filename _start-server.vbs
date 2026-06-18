Dim shell
Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "C:\Users\TW-10\Documents\firebase雲端資料夾"
shell.Run "C:\Users\TW-10\AppData\Roaming\npm\node_modules\opencode-ai\bin\opencode.exe serve --port 4097", 0, False
