@echo off
chcp 65001 >nul
title 電腦桌面翻譯小工具
cd /d "%~dp0"
start "" "C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\pythonw.exe" translator.py
echo 翻譯小工具已啟動（常駐於右下角，可隨時結束）
timeout /t 3 >nul
