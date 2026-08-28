"""系統列圖示：win32gui 原生實現（背景執行緒運行 message loop）。

設計：tkinter 留在主執行緒，此 tray 在背景執行緒建立隱藏視窗並呼叫
Shell_NotifyIcon。tray 的關閉動作會把事件送回 tkinter 主執行緒處理，
避免跨執行緒操作 tkinter。
"""
import ctypes
import ctypes.wintypes as w
import os
import threading


WM_USER = 0x0400
WM_TRAYICON = WM_USER + 1
WM_COMMAND = 0x0111
WM_DESTROY = 0x0002
ID_EXIT = 1001
NIM_ADD = 0x00
NIM_DELETE = 0x02
NIF_MESSAGE = 0x01
NIF_ICON = 0x02
NIF_TIP = 0x04
IMAGE_ICON = 1
LR_LOADFROMFILE = 0x0010
LR_LOADFROMFILE_FLAGS = LR_LOADFROMFILE
WM_RBUTTONUP = 0x0205
TPM_RETURNCMD = 0x0100
TPM_LEFTALIGN = 0x0000


class NOTIFYICONDATAW(ctypes.Structure):
    _fields_ = [
        ("cbSize", w.DWORD),
        ("hWnd", w.HWND),
        ("uID", w.UINT),
        ("uFlags", w.UINT),
        ("uCallbackMessage", w.UINT),
        ("hIcon", w.HICON),
        ("szTip", ctypes.c_wchar * 128),
        ("dwState", w.DWORD),
        ("dwStateMask", w.DWORD),
        ("szInfo", ctypes.c_wchar * 256),
        ("uTimeout", w.UINT),
        ("uVersion", w.UINT),
        ("szInfoTitle", ctypes.c_wchar * 64),
        ("dwInfoFlags", w.DWORD),
        ("guidItem", ctypes.c_char * 16),
        ("hBalloonIcon", w.HICON),
    ]


WNDPROC = ctypes.WINFUNCTYPE(ctypes.c_long, w.HWND, w.UINT, w.WPARAM, w.LPARAM)


class WNDCLASSEXW(ctypes.Structure):
    _fields_ = [
        ("cbSize", w.UINT),
        ("style", w.UINT),
        ("lpfnWndProc", WNDPROC),
        ("cbClsExtra", ctypes.c_int),
        ("cbWndExtra", ctypes.c_int),
        ("hInstance", w.HINSTANCE),
        ("hIcon", w.HICON),
        ("hCursor", w.HANDLE),
        ("hbrBackground", w.HBRUSH),
        ("lpszMenuName", ctypes.c_wchar_p),
        ("lpszClassName", ctypes.c_wchar_p),
        ("hIconSm", w.HICON),
    ]


user32 = ctypes.windll.user32
shell32 = ctypes.windll.shell32

# 設定函式簽章，避免 64 位元指標截斷
user32.DefWindowProcW.restype = ctypes.c_long
user32.DefWindowProcW.argtypes = [w.HWND, w.UINT, w.WPARAM, w.LPARAM]
user32.CreateWindowExW.restype = w.HWND
user32.CreateWindowExW.argtypes = [
    w.DWORD, ctypes.c_wchar_p, ctypes.c_wchar_p, w.DWORD,
    ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int,
    w.HWND, w.HMENU, w.HINSTANCE, ctypes.c_void_p,
]
user32.LoadImageW.restype = w.HANDLE
user32.LoadImageW.argtypes = [
    w.HINSTANCE, ctypes.c_wchar_p, w.UINT, ctypes.c_int, ctypes.c_int, w.UINT,
]
user32.RegisterClassExW.argtypes = [ctypes.c_void_p]
user32.GetMessageW.argtypes = [ctypes.c_void_p, w.HWND, w.UINT, w.UINT]
user32.TrackPopupMenu.argtypes = [
    w.HMENU, w.UINT, ctypes.c_int, ctypes.c_int, ctypes.c_int, w.HWND, ctypes.c_void_p,
]
user32.GetCursorPos.argtypes = [ctypes.c_void_p]
user32.AppendMenuW.argtypes = [w.HMENU, w.UINT, ctypes.c_uint, ctypes.c_wchar_p]
user32.CreatePopupMenu.restype = w.HMENU
user32.DestroyMenu.argtypes = [w.HMENU]
user32.SetForegroundWindow.argtypes = [w.HWND]
user32.PostQuitMessage.argtypes = [ctypes.c_int]

shell32.Shell_NotifyIconW.argtypes = [w.DWORD, ctypes.c_void_p]
shell32.Shell_NotifyIconW.restype = w.BOOL


def _icon_path():
    return os.path.join(os.path.dirname(os.path.dirname(__file__)), "icon.ico")


class TrayIcon:
    """建立可點右鍵的系統列圖示。quit_cb 在主執行緒被呼叫。"""

    def __init__(self, quit_cb):
        self.quit_cb = quit_cb
        self._thread = None

    def _wnd_proc(self, hWnd, msg, wParam, lParam):
        if msg == WM_TRAYICON:
            if lParam == WM_RBUTTONUP:
                self._show_menu(hWnd)
        elif msg == WM_COMMAND:
            if (wParam & 0xFFFF) == ID_EXIT:
                self._safe_quit()
        elif msg == WM_DESTROY:
            user32.PostQuitMessage(0)
        return user32.DefWindowProcW(hWnd, msg, wParam, lParam)

    def _safe_quit(self):
        # quit_cb 需在 tkinter 主執行緒執行，透過 daemon thread 送 queue
        try:
            self.quit_cb()
        except Exception:
            pass

    def _show_menu(self, hWnd):
        hMenu = user32.CreatePopupMenu()
        user32.AppendMenuW(hMenu, 0, ID_EXIT, "結束翻譯工具")
        pt = w.POINT()
        user32.GetCursorPos(ctypes.byref(pt))
        user32.SetForegroundWindow(hWnd)
        cmd = user32.TrackPopupMenu(hMenu, TPM_LEFTALIGN | TPM_RETURNCMD,
                                    pt.x, pt.y, 0, hWnd, None)
        if cmd == ID_EXIT:
            self._safe_quit()
        user32.DestroyMenu(hMenu)

    def _run(self):
        hInst = ctypes.windll.kernel32.GetModuleHandleW(None)

        wndproc = WNDPROC(self._wnd_proc)

        wc = WNDCLASSEXW()
        wc.cbSize = ctypes.sizeof(wc)
        wc.lpfnWndProc = wndproc
        wc.hInstance = hInst
        wc.lpszClassName = "OpenCodeTranslatorTray"
        user32.RegisterClassExW(ctypes.byref(wc))

        hWnd = user32.CreateWindowExW(
            0, "OpenCodeTranslatorTray", None, 0,
            0, 0, 0, 0, None, None, hInst, None
        )

        hIcon = user32.LoadImageW(
            None, _icon_path(), IMAGE_ICON, 0, 0, LR_LOADFROMFILE
        )
        if not hIcon:
            return

        nid = NOTIFYICONDATAW()
        nid.cbSize = ctypes.sizeof(nid)
        nid.hWnd = hWnd
        nid.uID = 1
        nid.uFlags = NIF_MESSAGE | NIF_ICON | NIF_TIP
        nid.uCallbackMessage = WM_TRAYICON
        nid.hIcon = hIcon
        nid.szTip = "桌面翻譯小工具"
        shell32.Shell_NotifyIconW(NIM_ADD, ctypes.byref(nid))

        msg = w.MSG()
        while user32.GetMessageW(ctypes.byref(msg), None, 0, 0) != 0:
            user32.TranslateMessage(ctypes.byref(msg))
            user32.DispatchMessageW(ctypes.byref(msg))

        shell32.Shell_NotifyIconW(NIM_DELETE, ctypes.byref(nid))
        if hIcon:
            user32.DestroyIcon(hIcon)

    def start(self):
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()


def create_tray(on_quit) -> TrayIcon:
    """建立並啟動系統列圖示。"""
    tray = TrayIcon(on_quit)
    tray.start()
    return tray
