' 桌面英文翻譯小工具啟動器（Unicode 安全）
' 使用基底直譯器直接執行 translator.py（translator.py 會自行加入 .venv 套件路徑），
' 避免 uv 建立的 .venv 轉發器產生重複程序。

Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
venvDir = fso.GetParentFolderName(scriptDir) & "\.venv"
scriptPath = scriptDir & "\translator.py"

' 從 .venv\pyvenv.cfg 讀取 home（基底直譯器目錄）
baseHome = ""
cfgPath = venvDir & "\pyvenv.cfg"
If fso.FileExists(cfgPath) Then
    Set cfg = fso.OpenTextFile(cfgPath, 1)
    Do Until cfg.AtEndOfStream
        line = Trim(cfg.ReadLine)
        If Left(line, 5) = "home " Then
            eq = InStr(line, "=")
            If eq > 0 Then
                baseHome = Trim(Mid(line, eq + 1))
            End If
        End If
    Loop
    cfg.Close
End If

If baseHome = "" Then
    pythonExe = venvDir & "\Scripts\pythonw.exe"
Else
    pythonExe = baseHome & "\pythonw.exe"
End If

Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = scriptDir
shell.Run """" & pythonExe & """ """ & scriptPath & """", 0, False
