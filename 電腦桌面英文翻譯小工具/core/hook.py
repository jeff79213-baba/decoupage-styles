"""全局滑鼠鉤子：偵測反白動作並觸發翻譯。"""
import time
import threading

from pynput import mouse

from core import clipboard


class SelectionHook:
    """監聽滑鼠，偵測反白選取並回呼。"""

    DRAG_THRESHOLD = 8          # 拖曳位移門檻（px）
    COPY_DELAY = 0.15           # 送 Ctrl+C 前的延遲
    MIN_TEXT_LENGTH = 1

    def __init__(self, on_selected, on_dismiss=None):
        self.on_selected = on_selected  # callable(text, x, y)
        self.on_dismiss = on_dismiss    # callable() — 點擊別處時隱藏
        self._pressed_x = 0.0
        self._pressed_y = 0.0
        self._dragging = False
        self._prev_clip = ""
        self._last_release = 0.0
        self._listener = None
        self._processing = False
        self._lock = threading.Lock()
        self._ignore_rect = None  # (x0, y0, x1, y1) — 卡片範圍，內部反白交由 UI 自行處理

    def set_ignore_rect(self, rect):
        """設定要忽略的滑鼠範圍（通常是翻譯卡片），None 表示不忽略。"""
        with self._lock:
            self._ignore_rect = rect

    def _point_in_rect(self, x, y):
        with self._lock:
            rect = self._ignore_rect
        if not rect:
            return False
        x0, y0, x1, y1 = rect
        return x0 <= x <= x1 and y0 <= y <= y1

    def on_move(self, x, y):
        if self._dragging:
            pass  # 拖曳中

    def on_click(self, x, y, button, pressed):
        if button != mouse.Button.left:
            return
        if pressed:
            self._pressed_x = x
            self._pressed_y = y
            self._dragging = True
            self._prev_clip = clipboard.read()
        else:
            if not self._dragging:
                return
            self._dragging = False
            # 若按下位置落在忽略範圍（卡片）內，交由卡片內部自行處理反白，
            # 全局鉤子完全不介入（不 dismiss、不選取、不送 Ctrl+C）。
            if self._point_in_rect(self._pressed_x, self._pressed_y):
                return
            dx = x - self._pressed_x
            dy = y - self._pressed_y
            dist = (dx * dx + dy * dy) ** 0.5
            if dist < self.DRAG_THRESHOLD:
                if self.on_dismiss:
                    threading.Thread(target=self.on_dismiss, daemon=True).start()
                return  # 只是點擊，不是選取

            if self._processing:
                return
            self._processing = True
            try:
                self._handle_selection(x, y)
            finally:
                self._processing = False

    def _handle_selection(self, x, y):
        time.sleep(self.COPY_DELAY)
        # 複製前先再讀一次剪貼簿作為比較基準
        before = clipboard.read()
        text = None
        if before == self._prev_clip:
            text = clipboard.capture_selection(before)
        else:
            text = before

        # 還原使用者原剪貼簿
        clipboard.restore(self._prev_clip)

        if text and len(text.strip()) >= self.MIN_TEXT_LENGTH:
            text = text.strip()
            threading.Thread(
                target=self._notify, args=(text, x, y), daemon=True
            ).start()

    def _notify(self, text, x, y):
        try:
            self.on_selected(text, x, y)
        except Exception:
            pass

    def start(self):
        self._listener = mouse.Listener(
            on_move=self.on_move,
            on_click=self.on_click,
        )
        self._listener.start()

    def stop(self):
        if self._listener:
            try:
                self._listener.stop()
            except Exception:
                pass
