@echo off
chcp 65001 >nul
echo 正在打包 DXF 圖檔零件拆解系統...
echo.

set VENV_PYTHON=C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe

REM 安裝依賴 (如果尚未安裝)
"%VENV_PYTHON%" -m pip install -r requirements.txt >nul 2>&1

REM 用 PyInstaller 打包成單一執行檔
REM 加入 hidden-import 確保 matplotlib/ezdxf 等套件被正確包入
"%VENV_PYTHON%" -m PyInstaller ^
    --onefile ^
    --windowed ^
    --icon icon.ico ^
    --name "DXF零件拆解系統" ^
    --hidden-import matplotlib ^
    --hidden-import matplotlib.backends.backend_agg ^
    --hidden-import ezdxf ^
    --hidden-import openpyxl ^
    --hidden-import PIL ^
    --hidden-import PIL._tkinter_finder ^
    --collect-all matplotlib ^
    --collect-all ezdxf ^
    --hidden-import PIL ^
    --hidden-import PIL.ImageDraw ^
    --add-data "icon.ico;." ^
    main.py

echo.
if %errorlevel%==0 (
    echo 打包成功！
    echo 執行檔在：dist\DXF零件拆解系統.exe
    echo 將整份 dist 資料夾複製到客戶電腦即可使用
) else (
    echo 打包失敗，請檢查錯誤訊息
)
pause
