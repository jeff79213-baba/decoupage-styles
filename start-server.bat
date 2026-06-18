@echo off
cd /d "C:\Users\TW-10\Documents\firebase雲端資料夾"
echo Starting OpenCode server...
start /b "" "C:\Users\TW-10\AppData\Roaming\npm\node_modules\opencode-ai\bin\opencode.exe" serve --port 4097
echo Waiting...
timeout /t 8 /nobreak >nul
echo Done. Server should be running.
exit