"""剪貼簿安全讀寫：模擬複製後讀取，並還原原本內容。"""
import time
from typing import Optional

import pyperclip

try:
    from pynput.keyboard import Controller as KeyboardController, Key
    _HAS_KEYBOARD = True
except Exception:  # pragma: no cover - 環境缺少時退化
    _HAS_KEYBOARD = False


def read() -> str:
    """讀取目前剪貼簿內容（文字）。"""
    try:
        return pyperclip.paste()
    except Exception:
        return ""


def send_copy() -> None:
    """模擬送出 Ctrl+C 到目前聚焦的視窗。"""
    if not _HAS_KEYBOARD:
        return
    try:
        kb = KeyboardController()
        kb.press(Key.ctrl)
        kb.press("c")
        kb.release("c")
        kb.release(Key.ctrl)
    except Exception:
        pass


def capture_selection(prev: str, timeout: float = 1.2) -> Optional[str]:
    """送出 Ctrl+C 並讀取選取文字。

    若新的剪貼簿內容與複製前不同，代表有選取文字，傳回該文字；
    否則傳回 None（表示沒有實際選取）。
    """
    send_copy()
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        last = read()
        if last not in ("", ) and last != prev:
            break
        time.sleep(0.02)

    if last is None or last == prev or last == "":
        return None
    return last


def restore(original: str) -> None:
    """還原原本的剪貼簿內容。"""
    try:
        pyperclip.copy(original)
    except Exception:
        pass
