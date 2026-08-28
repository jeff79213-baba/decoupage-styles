"""浮動小圖示 + 累積翻譯清單卡（tkinter）。

所有 tkinter 操作都必須在主執行緒（mainloop）進行，因此跨執行緒的
事件透過一個 queue，再由 tkinter 的 after() 定期輪詢處理。

行為：
- 反白單字 → 顯示浮動「翻」圖示 + 清單卡
- 再反白其它單字 → 累積加到同一張清單卡（不重置、不跳動）
- 卡片保持開啟（黏住），直到點擊卡片以外的位置才整個消失
"""
import queue
import threading
import tkinter as tk

from core import speech, translate

ICON_SIZE = 24
CARD_BG = "#ffffff"
CARD_FG = "#222222"
ICON_BG = "#f5a623"
HOVER_BG = "#ffd97a"
CARD_W = 380
CARD_MAX_H = 320
CARD_PAD_X = 14
CARD_PAD_Y = 10


class Overlay:
    def __init__(self, root, on_rect_change=None):
        self.root = root
        self.on_rect_change = on_rect_change  # callable(rect|None) — 回報卡片/圖示範圍給 hook
        self.events = queue.Queue()
        self.rows = []            # 每筆: {"id","text","phonetic","translated"}
        self._row_seq = 0
        self.icon_shown = False
        self.card_shown = False
        self.pinned = False

        root.withdraw()  # 主視窗隱藏，只用浮動視窗

        self._build_icon()
        self._build_card()

        self.icon_x = 0
        self.icon_y = 0
        self.icon.bind("<Enter>", self._on_icon_enter)
        self.icon.bind("<Leave>", self._on_icon_leave)

        self._poll()

    def set_rect_callback(self, cb):
        """事後綁定「範圍變化」回呼（避免與 hook 建立的循環依賴）。"""
        self.on_rect_change = cb

    # ---- UI 建立 ----
    def _build_icon(self):
        self.icon = tk.Toplevel(self.root)
        self.icon.withdraw()
        self.icon.overrideredirect(True)
        self.icon.attributes("-topmost", True)
        self.icon.configure(bg=ICON_BG)
        lbl = tk.Label(
            self.icon, text="翻", font=("Segoe UI", 11, "bold"),
            bg=ICON_BG, fg="#ffffff", width=2, height=1,
            cursor="hand2",
        )
        lbl.pack()
        self.icon_lbl = lbl

    def _build_card(self):
        self.card = tk.Toplevel(self.root)
        self.card.withdraw()
        self.card.overrideredirect(True)
        self.card.attributes("-topmost", True)
        self.card.configure(bg=CARD_BG)

        # 可捲動的內容區
        self.canvas = tk.Canvas(self.card, bg=CARD_BG, highlightthickness=0,
                                width=CARD_W, height=200)
        self.scrollbar = tk.Scrollbar(self.card, orient="vertical",
                                      command=self.canvas.yview)
        self.canvas.configure(yscrollcommand=self.scrollbar.set)

        self.inner = tk.Frame(self.canvas, bg=CARD_BG)
        self._inner_window = self.canvas.create_window(
            (0, 0), window=self.inner, anchor="nw"
        )
        self.inner.bind("<Configure>", self._on_inner_configure)
        self.canvas.bind("<Configure>", self._on_canvas_configure)

        self.canvas.pack(side="left", fill="both", expand=True,
                         padx=(CARD_PAD_X, 2), pady=CARD_PAD_Y)
        self.scrollbar.pack(side="right", fill="y", pady=CARD_PAD_Y)

        self.card.bind("<Enter>", self._on_card_enter)
        self.card.bind("<Leave>", self._on_card_leave)

    def _on_inner_configure(self, _event=None):
        self.canvas.configure(scrollregion=self.canvas.bbox("all"))

    def _on_canvas_configure(self, event):
        self.canvas.itemconfigure(self._inner_window, width=event.width)

    # ---- 事件輪詢 ----
    def _poll(self):
        try:
            while True:
                event = self.events.get_nowait()
                self._handle_event(event)
        except queue.Empty:
            pass
        self.root.after(60, self._poll)

    def _handle_event(self, event):
        kind = event.get("type")
        if kind == "selection":
            self._add_word(event["text"], event["x"], event["y"])
        elif kind == "resolved":
            self._handle_resolved(event)
        elif kind == "dismiss":
            # 滑鼠鉤子會在「按下→放開但未拖曳」時送出 dismiss，
            # 包含點擊我們自己的小卡/小圖示。若點擊位置在卡片或圖示內則不隱藏。
            if not self._card_hovered():
                self._hide_all()

    # ---- 累積邏輯 ----
    def _add_word(self, text, x, y, source="external"):
        if not text or not text.strip():
            return
        text = text.strip()

        # 若卡片尚未顯示，先在該處顯示浮動圖示作為錨點
        if not self.card_shown:
            self._show_icon(x, y)

        # 附加一行
        self._row_seq += 1
        row = {"id": self._row_seq, "text": text,
               "phonetic": "", "translated": "翻譯中…"}
        self.rows.append(row)
        self._append_row_widget(row)
        self.pinned = True  # 黏住：直到點卡片外才消失
        self._show_card_container()
        if self.card_shown:
            self.card.lift()

        self._auto_scroll_bottom()

        # 背景抓翻譯
        threading.Thread(
            target=self._fetch_translation, args=(row["id"], text),
            daemon=True,
        ).start()

    def _append_row_widget(self, row):
        """在 inner frame 建立該行的介面並存放參考。"""
        f = tk.Frame(self.inner, bg=CARD_BG)
        f.pack(fill="x", pady=(0, 8), anchor="w")
        # 原文 — 用可選取的 Text，讓使用者能在卡片上反白其中的單字
        txt = tk.Text(
            f, font=("Segoe UI", 11, "bold"), bg=CARD_BG, fg=CARD_FG,
            relief="flat", highlightthickness=0, borderwidth=0,
            wrap="word", height=2, cursor="ibeam",
            selectbackground="#cce4ff", width=30,
        )
        txt.insert("1.0", row["text"])
        txt.bind("<ButtonRelease-1>", lambda e, t=txt, rid=row["id"]: self._on_text_release(t, rid))
        txt.pack(fill="x", anchor="w")
        # 音標
        ph = tk.Label(f, text="", font=("Segoe UI", 10, "italic"),
                      bg=CARD_BG, fg="#888888", anchor="w", justify="left",
                      wraplength=CARD_W - 80)
        ph.pack(fill="x")
        # 翻譯
        tr = tk.Label(f, text="翻譯中…", font=("Segoe UI", 11),
                      bg=CARD_BG, fg="#1a73e8", anchor="w", justify="left",
                      wraplength=CARD_W - 80)
        tr.pack(fill="x")
        # 發音鍵
        btn_row = tk.Frame(f, bg=CARD_BG)
        btn_row.pack(anchor="w", pady=(4, 0))
        btn = tk.Button(
            btn_row, text="🔊 唸給我聽", font=("Segoe UI", 9),
            bg="#eaf3ff", fg="#1a73e8", relief="flat",
            cursor="hand2",
            command=lambda t=row["text"]: speech.speak(t, lang="en"),
        )
        btn.pack()

        row["_frame"] = f
        row["_phonetic_lbl"] = ph
        row["_trans_lbl"] = tr
        row["_src_text"] = txt

    def _on_text_release(self, txt, rid):
        """在卡片內的原文 Text 上反白結束後，取選取文字並累積翻譯。"""
        try:
            ranges = txt.tag_ranges("sel")
            if not ranges:
                return
            sel = txt.get(ranges[0], ranges[1]).strip()
        except Exception:
            return
        if not sel:
            return
        # 將在卡片上反白的文字累積翻譯（原文行 on_release 已由全局鉤子略過）
        self._add_word(sel, 0, 0, source="card")

    def _auto_scroll_bottom(self):
        try:
            self.canvas.update_idletasks()
            self.canvas.yview_moveto(1.0)
        except Exception:
            pass

    def _fetch_translation(self, rid, text):
        result = translate.translate(text)
        self.events.put({"type": "resolved", "rid": rid, "result": result})

    def _handle_resolved(self, event):
        rid = event["rid"]
        result = event["result"]
        # 卡片可能已被關閉；找對應行更新
        row = next((r for r in self.rows if r["id"] == rid), None)
        if row is None:
            return
        row["phonetic"] = result.phonetic or ""
        row["translated"] = result.translated_text or "（無法取得翻譯）"
        # 只更新該行
        row["_phonetic_lbl"].configure(
            text=f"[{result.phonetic}]" if result.phonetic else "")
        row["_trans_lbl"].configure(text=row["translated"])

    # ---- 顯示控制 ----
    def _show_icon(self, x, y):
        self.icon_x = x + 12
        self.icon_y = y + 12
        self.icon.geometry(f"+{int(self.icon_x)}+{int(self.icon_y)}")
        self.icon.deiconify()
        self.icon_lift()
        self.icon_shown = True
        self.over_hover = False

    def _show_card_container(self):
        if not self.card_shown:
            self.card.geometry(f"+{int(self.icon_x)}+{int(self.icon_y + ICON_SIZE + 6)}")
            self.card.deiconify()
            self.card_shown = True
        # 控制高度：超過上限用捲動
        try:
            need = max(140, self.inner.winfo_reqheight() + CARD_PAD_Y * 2)
            h = min(need, CARD_MAX_H)
            self.canvas.configure(height=h)
            self.card.geometry(f"{CARD_W + 26}x{h}")
        except Exception:
            pass
        self._update_ignore_rect()

    def _update_ignore_rect(self):
        """回報卡片(+圖示)的螢幕範圍給 hook，使其忽略範圍內的滑鼠動作。"""
        rect = None
        try:
            if self.card_shown and self.card.winfo_viewable():
                x = self.card.winfo_rootx()
                y = self.card.winfo_rooty()
                w = self.card.winfo_width()
                h = self.card.winfo_height()
                rect = (x, y, x + w, y + h)
                if self.icon_shown:
                    rect = (
                        min(x, self.icon_x),
                        min(y, self.icon_y),
                        max(x + w, self.icon_x + ICON_SIZE * 2),
                        max(y + h, self.icon_y + ICON_SIZE * 2),
                    )
        except Exception:
            rect = None
        if self.on_rect_change is not None:
            try:
                self.on_rect_change(rect)
            except Exception:
                pass

    def _on_icon_enter(self, _event=None):
        self.over_hover = True
        self.icon.configure(bg=HOVER_BG)
        try:
            self.icon_lbl.configure(bg=HOVER_BG)
        except Exception:
            pass

    def _on_icon_leave(self, _event=None):
        self.over_hover = False
        self.icon.configure(bg=ICON_BG)
        try:
            self.icon_lbl.configure(bg=ICON_BG)
        except Exception:
            pass

    def _on_card_enter(self, _event=None):
        self.over_hover = True

    def _on_card_leave(self, _event=None):
        self.over_hover = False

    def _card_hovered(self):
        try:
            wx = self.root.winfo_pointerx()
            wy = self.root.winfo_pointery()
        except Exception:
            return False
        if not self.card_shown:
            return False
        try:
            gx = self.card.winfo_rootx()
            gy = self.card.winfo_rooty()
            gw = self.card.winfo_width()
            gh = self.card.winfo_height()
        except Exception:
            return False
        within_card = gx <= wx <= gx + gw and gy <= wy <= gy + gh
        within_icon = (
            self.icon_x <= wx <= self.icon_x + ICON_SIZE * 2
            and self.icon_y <= wy <= self.icon_y + ICON_SIZE * 2
        )
        return within_card or within_icon

    def _hide_card(self):
        if self.card_shown:
            self.card.withdraw()
            self.card_shown = False
        if self.on_rect_change is not None:
            try:
                self.on_rect_change(None)
            except Exception:
                pass

    def _hide_all(self):
        self.pinned = False
        self._hide_card()
        # 清除累積清單
        for row in self.rows:
            try:
                if row.get("_frame"):
                    row["_frame"].destroy()
            except Exception:
                pass
        self.rows.clear()
        self._row_seq = 0
        if self.icon_shown:
            self.icon.withdraw()
            self.icon_shown = False

    def icon_lift(self):
        try:
            self.icon.lift()
        except Exception:
            pass

    def notify_selection(self, text, x, y):
        self.events.put({"type": "selection", "text": text, "x": x, "y": y})

    def dismiss(self):
        self.events.put({"type": "dismiss"})
