"""電腦桌面英文翻譯小工具 — 主程式。

啟動後常駐於系統列（橘色圓形圖示），於任何程式反白文字即彈出翻譯小卡。
關閉：右鍵系統列圖示 → 結束翻譯工具。
"""
import ctypes
import os
import sys
import tempfile
import tkinter as tk
from ctypes import wintypes

# 讓本工具用 `core/` 與 `ui/` 套件（當以基底直譯器啟動時需自行加入 .venv 套件路徑）
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_VENV_SITE = os.path.normpath(os.path.join(_THIS_DIR, "..", ".venv", "Lib", "site-packages"))
if _VENV_SITE not in sys.path and os.path.isdir(_VENV_SITE):
    sys.path.insert(0, _VENV_SITE)
if _THIS_DIR not in sys.path:
    sys.path.insert(0, _THIS_DIR)
# uv 的 venv 啟動器會委派到基底直譯器執行，導致「注入 .venv 套件路徑但沒注入
# pywin32 載入路徑」的環境。這裡補上 pywin32 所需的子目錄與 DLL 搜尋路徑，
# 讓 pyttsx3（SAPI5）能正常載入而保有發音功能。
try:
    for _sub in ("win32", os.path.join("win32", "lib")):
        _p = os.path.join(_VENV_SITE, _sub)
        if _p not in sys.path:
            sys.path.insert(0, _p)
    _sys32 = os.path.join(_VENV_SITE, "pywin32_system32")
    if os.path.isdir(_sys32) and hasattr(os, "add_dll_directory"):
        os.add_dll_directory(_sys32)
except Exception:
    pass

from core.hook import SelectionHook
from ui.overlay import Overlay
from ui.tray import create_tray

_LOCK_FILE = os.path.join(tempfile.gettempdir(), "opencode_translator.lock")


def _is_alive(pid: int) -> bool:
    """以 OpenProcess 檢查 pid 是否為存活程序（Windows 可靠作法）。"""
    if pid <= 0:
        return False
    PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
    kernel32 = ctypes.windll.kernel32
    kernel32.OpenProcess.restype = wintypes.HANDLE
    kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
    handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
    if handle:
        kernel32.CloseHandle(handle)
        return True
    return False



def _acquire_singleton() -> bool:
    """單一實例鎖：若已有存活的實例，回傳 False。"""
    try:
        if os.path.exists(_LOCK_FILE):
            with open(_LOCK_FILE, "r", encoding="utf-8") as f:
                old = int(f.read().strip() or "0")
            if old and _is_alive(old):
                return False
        pid = os.getpid()
        with open(_LOCK_FILE, "w", encoding="utf-8") as f:
            f.write(str(pid))
        return True
    except Exception:
        # 鎖存取失敗時，仍允許執行（避免無法使用）
        return True


def main():
    if not _acquire_singleton():
        # 已有一個實例在執行，直接結束，避免重複啟動。
        # 以 os._exit 強制結束（背景執行緒會阻擋正常的解釋器關閉）
        os._exit(0)

    root = tk.Tk()
    root.withdraw()

    overlay = Overlay(root)
    hook = SelectionHook(overlay.notify_selection, on_dismiss=overlay.dismiss)
    overlay.set_rect_callback(hook.set_ignore_rect)
    hook.start()

    def on_quit():
        # root.after 可從其它執行緒安全呼叫，把關閉送到 tkinter 主執行緒
        try:
            root.after(0, root.destroy)
        except Exception:
            pass

    create_tray(on_quit)
    root.mainloop()

    # 結束時清除鎖
    try:
        if os.path.exists(_LOCK_FILE):
            with open(_LOCK_FILE, "r", encoding="utf-8") as f:
                cur = f.read().strip()
            if cur == str(os.getpid()):
                os.remove(_LOCK_FILE)
    except Exception:
        pass


if __name__ == "__main__":
    main()
