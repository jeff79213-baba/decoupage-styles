# UX 精修 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將尺寸標註改為下拉式選單（含圖示與懸停量法說明）、直線改為可連續繪製（右鍵結束、Esc 取消）、新增可存檔的設定按鈕（鎖點/線寬/文字與尺寸/網格/顏色）。

**Architecture:** 新增獨立 `settings.py`（設定存取），`main.py` 讀取設定並套用（畫布背景、線寬、鎖點容差/開關、文字與尺寸預設、鎖點標記顏色、網格渲染）。工具列 5 顆尺寸按鈕改為一個 `ttk.Menubutton` 下拉選單（`<<MenuSelect>>` 觸發 tooltip）。直線模式改為連續：每次點擊 commit 一段獨立 LINE 並保留錨點，右鍵結束、Esc 以 undo 深度回滾取消整段。

**Tech Stack:** Python 3.12（`.venv`）、Tkinter、ezdxf 1.4.4、PyInstaller。

## Global Constraints

- **禁止 commit / push / 上傳**：使用者明確要求「完成前不要 commit/push/上傳，一切留本機」。所有「Commit」步驟改為：將進度寫入 `C:\Users\TW-10\Documents\firebase雲端資料夾\DXF零件拆解\.superpowers\sdd\progress.md`（與本專案先前尺寸功能相同做法）。
- **外顯名稱統一用 DXF**（使用者要求）：視窗標題、exe 名稱、設定資料夾名一律用 `DXF`，不可再用 `CAD`（避免讓人誤以為可開啟 DWG）。內部程式碼名稱（class `CADPartsApp`、dimstyle `CAD_DIM`）不在此限。
- 每個任務實作於 `.superpowers/sdd/task-N-brief.md`，完成後寫 `task-N-report.md`。
- Python venv：`C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe`
- 測試檔案位於 `C:\Users\TW-10\AppData\Local\Temp\opencode\`：`cad_smoke_test.py`、`cad_editor_test.py`（既有，全部須保持 PASS）。
- PyInstaller 重建指令（見 Task 7）。
- 所有尺寸數值來自 DXF 向量資料，禁止猜值。
- 設定檔預設值（`settings.py`）即現況行為：線寬 2、鎖點容差 12px、鎖點開啟、文字高度 2.5、尺寸文字 2.5、箭頭 2.0、網格關、背景 `#f0f0f0`、鎖點標記 `#FFD400`。
- 不更動既有工具的既有行為（選取/矩形/圓形/文字/刪除/移動尺寸阻擋/undo/redo/圖層/零件分析/匯出）。
- `rect`/`circle` 維持原「2 點完成」行為，僅 `line` 改連續。

---

### Task 1: settings.py 設定模組

**Files:**
- Create: `C:\Users\TW-10\Documents\firebase雲端資料夾\DXF零件拆解\settings.py`
- Test: `C:\Users\TW-10\AppData\Local\Temp\opencode\settings_test.py`

**Interfaces:**
- Produces:
  - `DEFAULT_SETTINGS: dict`
  - `load_settings(path: str | None = None) -> dict`（缺檔/壞格式回退預設；未知鍵忽略；clamp 容差 1..50、網格間距 1..1000）
  - `save_settings(settings: dict, path: str | None = None) -> bool`（成功 True）
  - `settings_path() -> str`（`%APPDATA%\DXF零件拆解系統\settings.json`）

- [ ] **Step 1: 寫測試**

```python
import os, sys, tempfile, json
BASE = r"C:\Users\TW-10\Documents\firebase雲端資料夾\DXF零件拆解"
sys.path.insert(0, BASE)
from settings import DEFAULT_SETTINGS, load_settings, save_settings

tmp = os.path.join(tempfile.gettempdir(), 'cad_settings_test')
os.makedirs(tmp, exist_ok=True)
path = os.path.join(tmp, 'settings.json')
if os.path.exists(path):
    os.remove(path)

assert load_settings(path) == DEFAULT_SETTINGS, "missing -> defaults"

s2 = dict(DEFAULT_SETTINGS)
s2['snap_tolerance_px'] = 20
s2['grid_enabled'] = True
s2['grid_spacing'] = 25.0
s2['bg_color'] = '#112233'
assert save_settings(s2, path) is True, "save"
s3 = load_settings(path)
assert s3['snap_tolerance_px'] == 20, s3
assert s3['grid_enabled'] is True, s3
assert s3['grid_spacing'] == 25.0, s3
assert s3['bg_color'] == '#112233', s3

with open(path, 'w', encoding='utf-8') as f:
    f.write('{not json')
assert load_settings(path) == DEFAULT_SETTINGS, "bad json -> defaults"

with open(path, 'w', encoding='utf-8') as f:
    json.dump({'snap_tolerance_px': 5000, 'grid_spacing': -5, 'evil': 1}, f)
s5 = load_settings(path)
assert s5['snap_tolerance_px'] == 50, s5
assert s5['grid_spacing'] == 1.0, s5
assert 'evil' not in s5, s5

print("SETTINGS TESTS OK")
```

- [ ] **Step 2: 跑測試確認失敗**

Run（workdir `C:\Users\TW-10\AppData\Local\Temp\opencode`）：`C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe settings_test.py`
Expected: `ModuleNotFoundError: No module named 'settings'`

- [ ] **Step 3: 實作 settings.py**

```python
import json
import os

APP_NAME = 'DXF零件拆解系統'

DEFAULT_SETTINGS = {
    'snap_enabled': True,
    'snap_tolerance_px': 12,
    'line_width': 2,
    'text_height': 2.5,
    'dim_text_height': 2.5,
    'dim_arrow_size': 2.0,
    'grid_enabled': False,
    'grid_spacing': 10.0,
    'bg_color': '#f0f0f0',
    'snap_marker_color': '#FFD400',
}

_KNOWN_KEYS = set(DEFAULT_SETTINGS)


def settings_dir():
    base = os.environ.get('APPDATA') or os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base, APP_NAME)


def settings_path():
    return os.path.join(settings_dir(), 'settings.json')


def load_settings(path=None):
    s = dict(DEFAULT_SETTINGS)
    try:
        with open(path or settings_path(), 'r', encoding='utf-8') as f:
            data = json.load(f)
        if isinstance(data, dict):
            for k in _KNOWN_KEYS:
                if k in data:
                    s[k] = data[k]
    except Exception:
        pass
    s['snap_tolerance_px'] = min(max(int(s.get('snap_tolerance_px', 12)), 1), 50)
    s['grid_spacing'] = min(max(float(s.get('grid_spacing', 10.0)), 1.0), 1000.0)
    return s


def save_settings(settings, path=None):
    try:
        p = path or settings_path()
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, 'w', encoding='utf-8') as f:
            json.dump(settings, f, ensure_ascii=False, indent=2)
        return True
    except Exception:
        return False
```

- [ ] **Step 4: 跑測試確認通過**

Run: 同 Step 2 指令。Expected: `SETTINGS TESTS OK`

- [ ] **Step 5: 更新 progress.md**

在 `.superpowers/sdd/progress.md` 記錄 Task 1 完成與產出介面。

---

### Task 2: main.py 設定整合（載入與套用）

**Files:**
- Modify: `C:\Users\TW-10\Documents\firebase雲端資料夾\DXF零件拆解\main.py`（import、`__init__`、畫布 bg、`line_width_var`、`_update_snap_at`、`_draw_snap_marker`、`add_text` 高度、`_commit_dim` h/a、新增 `apply_settings`）
- Test: `C:\Users\TW-10\AppData\Local\Temp\opencode\cad_smoke_test.py`（新增設定重置與套用檢查）

**Interfaces:**
- Consumes: Task 1 的 `load_settings`、`DEFAULT_SETTINGS`。
- Produces: `self.settings: dict`、`self.apply_settings() -> None`（供 Task 4 設定視窗呼叫）。

- [ ] **Step 1: 寫失敗測試（改 cad_smoke_test.py）**

在第 21 行 `app = CADPartsApp(root)` 之後插入：

```python
from settings import DEFAULT_SETTINGS
app.settings = dict(DEFAULT_SETTINGS)
app.apply_settings()
```

在 `app._on_file_loaded()`（第 37 行）與 `root.update()` 之後插入：

```python
check("settings bg applied", app.canvas.cget('bg') == '#f0f0f0', app.canvas.cget('bg'))
check("settings line width applied", app.line_width_var.get() == 2, str(app.line_width_var.get()))
```

- [ ] **Step 2: 跑 smoke test 確認失敗**

Run（workdir `C:\Users\TW-10\AppData\Local\Temp\opencode`）：`C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe cad_smoke_test.py`
Expected: `AttributeError: 'CADPartsApp' object has no attribute 'settings'`（或 `apply_settings` not defined）

- [ ] **Step 3: 實作 main.py 變更**

1) import 區（第 15 行 `from snap_helper import (...)` 之後）加：
```python
from settings import load_settings, DEFAULT_SETTINGS
```

2) `__init__`（第 68 行 `self._pan_last = None` 之後）加：
```python
        self.settings = load_settings()
```

3) 畫布（第 86 行）：
```python
        self.canvas = tk.Canvas(canvas_frame, bg=self.settings['bg_color'], highlightthickness=0, cursor='crosshair')
```

4) 線寬（第 170 行）：`tk.IntVar(value=2)` → `tk.IntVar(value=self.settings['line_width'])`

5) `_update_snap_at`（第 637-653 行）整段替換：
```python
    def _update_snap_at(self, sx, sy):
        if not self.settings.get('snap_enabled', True) or not self.snap_points:
            self.current_snap_point = None
            self.current_snap_screen = None
            self._clear_snap_marker()
            return
        wx, wy = self.screen_to_world(sx, sy)
        tol = self.settings['snap_tolerance_px'] / self._view_scale
        snap = find_nearest_snap((wx, wy), self.snap_points, tol)
        self.current_snap_point = snap
        if snap:
            m_sx, m_sy = self.world_to_screen(*snap['point'])
            self.current_snap_screen = (m_sx, m_sy)
            self._draw_snap_marker(m_sx, m_sy, snap['type'])
        else:
            self.current_snap_screen = None
            self._clear_snap_marker()
```

6) `_draw_snap_marker`（第 624-635 行）：三處硬編碼色替換為 `self.settings['snap_marker_color']`（`'#FFD400'` 兩處、`'#FF6A00'` 一處）。

7) `add_text` 高度（第 730 行）：`height = self.line_width_var.get() * 1.2` → `height = self.settings['text_height']`

8) `_commit_dim`（第 918-919 行）：
```python
        h = self.settings['dim_text_height']
        a = self.settings['dim_arrow_size']
```

9) 新增方法（放在 `_refresh_after_edit` 之後）：
```python
    def apply_settings(self):
        s = self.settings
        self.canvas.configure(bg=s['bg_color'])
        self.line_width_var.set(s['line_width'])
        if self.editor and self.parsed_data:
            self.render_canvas()
```

10) 視窗標題（第 35 行）外顯名稱改用 DXF：
`self.root.title('CAD 圖檔零件拆解系統')` → `self.root.title('DXF 圖檔零件拆解系統')`

- [ ] **Step 4: 跑 smoke test 確認通過**

Run: 同 Step 2。Expected: 全部 PASS（含新 2 個 settings 檢查），且既有 snap/dim/line 測試仍 PASS。

- [ ] **Step 5: 更新 progress.md**

---

### Task 3: 網格渲染

**Files:**
- Modify: `C:\Users\TW-10\Documents\firebase雲端資料夾\DXF零件拆解\main.py`（`render_canvas` 加入 `_draw_grid()` 呼叫、新增 `_draw_grid` 方法）
- Test: `C:\Users\TW-10\AppData\Local\Temp\opencode\cad_smoke_test.py`（新增網格 section）

**Interfaces:**
- Consumes: `self.settings['grid_enabled']`、`self.settings['grid_spacing']`（Task 2）。
- Produces: `_draw_grid() -> None`（畫 `tag='grid'` 線並 `tag_lower('grid')`）。

- [ ] **Step 1: 寫失敗測試**

在 smoke test 的 `root.destroy()`（第 280 行）之前、part highlight 檢查之後插入：

```python
# 11. grid rendering
app.settings['grid_enabled'] = True
app.settings['grid_spacing'] = 5.0
app.render_canvas()
root.update()
grid_items = app.canvas.find_withtag('grid')
check("grid drawn when enabled", len(grid_items) > 0, f"items={len(grid_items)}")
app.settings['grid_enabled'] = False
app.render_canvas()
root.update()
check("grid removed when disabled", len(app.canvas.find_withtag('grid')) == 0)
```

- [ ] **Step 2: 跑 smoke test 確認失敗**

Run: `C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe cad_smoke_test.py`
Expected: `[FAIL] grid drawn when enabled`（render_canvas 尚無網格）

- [ ] **Step 3: 實作 main.py 變更**

`render_canvas`（第 359-365 行，`if not self.editor...` 之後、`for ent in visible:` 之前）插入：

```python
        if self.settings.get('grid_enabled', False):
            self._draw_grid()
```

新增方法（放在 `render_canvas` 之後、`_draw_canvas_entity` 之前）：

```python
    def _draw_grid(self):
        spacing = float(self.settings.get('grid_spacing', 10.0))
        if spacing <= 0:
            return
        cw = self.canvas.winfo_width()
        ch = self.canvas.winfo_height()
        if cw < 2 or ch < 2:
            return
        x0, y0 = self._canvas_to_dxf(0, 0)
        x1, y1 = self._canvas_to_dxf(cw, ch)
        xmin, xmax = min(x0, x1), max(x0, x1)
        ymin, ymax = min(y0, y1), max(y0, y1)
        x = math.floor(xmin / spacing) * spacing
        while x <= xmax:
            sx, _ = self.world_to_screen(x, 0)
            self.canvas.create_line(sx, 0, sx, ch, fill='#DDDDDD', tags=('grid',))
            x += spacing
        y = math.floor(ymin / spacing) * spacing
        while y <= ymax:
            _, sy = self.world_to_screen(0, y)
            self.canvas.create_line(0, sy, cw, sy, fill='#DDDDDD', tags=('grid',))
            y += spacing
        self.canvas.tag_lower('grid')
```

注意 `render_canvas` 開頭已 `self.canvas.delete('all')`，舊網格自動清除。

- [ ] **Step 4: 跑 smoke test 確認通過**

Run: 同 Step 2。Expected: 全部 PASS。

- [ ] **Step 5: 更新 progress.md**

---

### Task 4: 設定視窗（設定按鈕 + open_settings）

**Files:**
- Modify: `C:\Users\TW-10\Documents\firebase雲端資料夾\DXF零件拆解\main.py`（`_build_main_toolbar` 加「設定」按鈕、`__init__` 加 `self._settings_win = None`、新增 `open_settings`）
- Test: `C:\Users\TW-10\AppData\Local\Temp\opencode\cad_smoke_test.py`（設定視窗可開可關）

**Interfaces:**
- Consumes: Task 1 `save_settings`、`DEFAULT_SETTINGS`；Task 2 `self.settings`、`self.apply_settings()`。
- Produces: `open_settings() -> None`（開啟 Toplevel，OK 時儲存+套用）。

- [ ] **Step 1: 寫失敗測試**

在 Task 3 的 grid section 之後插入：

```python
# 12. settings dialog opens and closes
app.open_settings()
root.update()
check("settings dialog opens", getattr(app, '_settings_win', None) is not None)
if getattr(app, '_settings_win', None) is not None:
    app._settings_win.destroy()
    app._settings_win = None
root.update()
```

- [ ] **Step 2: 跑 smoke test 確認失敗**

Expected: `AttributeError: 'CADPartsApp' object has no attribute 'open_settings'`

- [ ] **Step 3: 實作 main.py 變更**

1) `__init__`（Task 2 加的 `self.settings = load_settings()` 之後）加：
```python
        self._settings_win = None
```

2) `_build_main_toolbar`（第 125 行 separator 之後、第 126 行 匯出 Excel 之前）加：
```python
        ttk.Button(self.toolbar, text='設定', command=self.open_settings).pack(side=tk.RIGHT, padx=2)
```

3) 新增方法（放在 `apply_settings` 之後）：

```python
    def open_settings(self):
        win = tk.Toplevel(self.root)
        win.title('設定')
        win.transient(self.root)
        win.grab_set()
        self._settings_win = win
        s = dict(DEFAULT_SETTINGS)
        s.update(self.settings)
        vs = {}

        def add(key, kind, default):
            v = {'int': tk.IntVar, 'bool': tk.BooleanVar, 'float': tk.DoubleVar}[kind]()
            v.set(s.get(key, default))
            vs[key] = v

        add('snap_enabled', 'bool', True)
        add('snap_tolerance_px', 'int', 12)
        add('line_width', 'int', 2)
        add('text_height', 'float', 2.5)
        add('dim_text_height', 'float', 2.5)
        add('dim_arrow_size', 'float', 2.0)
        add('grid_enabled', 'bool', False)
        add('grid_spacing', 'float', 10.0)
        vs['bg_color'] = tk.StringVar(value=s['bg_color'])
        vs['snap_marker_color'] = tk.StringVar(value=s['snap_marker_color'])

        row = 0

        def row_title(text):
            nonlocal row
            ttk.Label(win, text=text, font=('', 10, 'bold')).grid(
                row=row, column=0, columnspan=3, sticky='w', padx=8, pady=(8, 2))
            row += 1

        row_title('鎖點')
        ttk.Checkbutton(win, text='啟用鎖點', variable=vs['snap_enabled']).grid(
            row=row, column=0, sticky='w', padx=8)
        ttk.Label(win, text='容差(px):').grid(row=row, column=1, sticky='e', padx=4)
        ttk.Spinbox(win, from_=1, to=50, width=5, textvariable=vs['snap_tolerance_px']).grid(
            row=row, column=2, sticky='w', padx=4)
        row += 1

        row_title('圖元')
        ttk.Label(win, text='預設線寬:').grid(row=row, column=0, sticky='w', padx=8)
        ttk.Spinbox(win, from_=1, to=10, width=5, textvariable=vs['line_width']).grid(
            row=row, column=1, sticky='w', padx=4)
        row += 1

        row_title('文字與尺寸')
        for label, key in (('文字高度:', 'text_height'), ('尺寸文字高度:', 'dim_text_height'),
                           ('箭頭大小:', 'dim_arrow_size')):
            ttk.Label(win, text=label).grid(row=row, column=0, sticky='w', padx=8)
            ttk.Spinbox(win, from_=0.5, to=20, increment=0.5, width=5,
                        textvariable=vs[key]).grid(row=row, column=1, sticky='w', padx=4)
            row += 1

        row_title('網格')
        ttk.Checkbutton(win, text='顯示網格', variable=vs['grid_enabled']).grid(
            row=row, column=0, sticky='w', padx=8)
        ttk.Label(win, text='間距(世界單位):').grid(row=row, column=1, sticky='e', padx=4)
        ttk.Spinbox(win, from_=1, to=100, width=6, textvariable=vs['grid_spacing']).grid(
            row=row, column=2, sticky='w', padx=4)
        row += 1

        row_title('顏色')
        btn = {}

        def color_pick(key):
            cur = vs[key].get()
            col = colorchooser.askcolor(cur, parent=win, title='選擇顏色')
            if col and col[1]:
                vs[key].set(col[1])
                btn[key].configure(bg=col[1])

        for label, key in (('畫布背景:', 'bg_color'), ('鎖點標記:', 'snap_marker_color')):
            ttk.Label(win, text=label).grid(row=row, column=0, sticky='w', padx=8)
            btn[key] = tk.Button(win, text='■', width=3, bg=vs[key].get(),
                                 command=lambda k=key: color_pick(k))
            btn[key].grid(row=row, column=1, sticky='w', padx=4)
            row += 1

        btns = ttk.Frame(win)
        btns.grid(row=row, column=0, columnspan=3, pady=10)

        def on_ok():
            for k, v in vs.items():
                try:
                    if k in ('bg_color', 'snap_marker_color'):
                        self.settings[k] = v.get()
                    elif k in ('snap_enabled', 'grid_enabled'):
                        self.settings[k] = bool(v.get())
                    elif k in ('snap_tolerance_px', 'line_width'):
                        self.settings[k] = int(v.get())
                    else:
                        self.settings[k] = float(v.get())
                except Exception:
                    pass
            self.settings['snap_tolerance_px'] = min(max(int(self.settings['snap_tolerance_px']), 1), 50)
            self.settings['grid_spacing'] = min(max(float(self.settings['grid_spacing']), 1.0), 1000.0)
            save_settings(self.settings)
            self.apply_settings()
            self._settings_win = None
            win.destroy()

        def on_reset():
            for k, v in vs.items():
                if k in DEFAULT_SETTINGS:
                    v.set(DEFAULT_SETTINGS[k])
                if k in btn:
                    btn[k].configure(bg=DEFAULT_SETTINGS[k])

        ttk.Button(btns, text='確定', command=on_ok).pack(side=tk.LEFT, padx=4)
        ttk.Button(btns, text='取消', command=win.destroy).pack(side=tk.LEFT, padx=4)
        ttk.Button(btns, text='重設為預設', command=on_reset).pack(side=tk.LEFT, padx=4)
```

- [ ] **Step 4: 跑 smoke test 確認通過**

Run: 同 Step 2。Expected: 全部 PASS（含「設定 dialog 開關」）。

- [ ] **Step 5: 更新 progress.md**

---

### Task 5: 連續畫線（line 工具）

**Files:**
- Modify: `C:\Users\TW-10\Documents\firebase雲端資料夾\DXF零件拆解\main.py`（`__init__` 加 `line_undo_mark`、`set_edit_mode` 記錄 mark、`_on_canvas_click` line 分支改連續、`_on_escape` 取消邏輯）
- Test: `C:\Users\TW-10\AppData\Local\Temp\opencode\cad_smoke_test.py`（改寫 section 5-7b）

**Interfaces:**
- Consumes: 既有 `add_line`、`_push_undo`/`undo`、`_draw_anchor_marker`、`_update_draw_preview`。
- Produces: `self.line_undo_mark: int | None`；行為：line 模式點擊連續、右鍵結束、Esc 回滾取消。

- [ ] **Step 1: 寫失敗測試（改寫 cad_smoke_test.py section 5-7b，第 106-165 行）**

整段替換為（在**全新的小圖文件**上進行，避免既有圖形干擾鎖點）：

```python
# 5. continuous line on a fresh doc
def msp_count():
    return sum(1 for _ in app.editor.msp)

docl = ezdxf.new()
app.editor = DXFEditor()
app.editor.doc = docl
app.editor.msp = docl.modelspace()
app.editor._sync_layers()
app.parsed_data = {'entities': build_entity_list(docl),
                   'bounding_box': {'xmin': 0, 'ymin': 0, 'xmax': 100, 'ymax': 100}}
app._render_bbox = app.parsed_data.get('bounding_box')
app._on_file_loaded()
app._set_view(2.0, 50.0, 50.0)
root.update()
n_before = msp_count()
a, b, c = (10, 10), (40, 10), (40, 40)

class Ev:
    def __init__(self, x, y):
        self.x = x
        self.y = y

sxa, sya = app.world_to_screen(*a)
sxb, syb = app.world_to_screen(*b)
scx, scy = app.world_to_screen(*c)
app.set_edit_mode('line')
app._on_canvas_click(Ev(sxa, sya))
root.update()
check("draw start snapped", app.draw_start_dxf is not None, str(app.draw_start_dxf))
check("anchor marker drawn", app.draw_anchor_item is not None, f"item={app.draw_anchor_item}")
app._on_canvas_motion(Ev(sxb, syb))
root.update()
check("preview drawn mid-draw", len(app.draw_preview_items) == 1, f"n={len(app.draw_preview_items)}")
check("no entity before 2nd click", msp_count() == n_before, f"count={msp_count()}")
app._on_canvas_click(Ev(sxb, syb))
root.update()
check("line added after 2nd click", msp_count() == n_before + 1, f"after={msp_count()}")
check("anchor persists after commit", app.draw_anchor_item is not None, f"item={app.draw_anchor_item}")
check("preview cleared after commit", len(app.draw_preview_items) == 0)
app._on_canvas_click(Ev(scx, scy))
root.update()
check("second segment added", msp_count() == n_before + 2, f"after={msp_count()}")
check("anchor at new point", app.draw_start_dxf == c, str(app.draw_start_dxf))

def xy(p, n=3):
    return tuple(round(float(p[i]), n) for i in range(2))

def has_line(s, e):
    return any(x.dxftype() == 'LINE' and xy(x.dxf.start) == xy(s)
               and xy(x.dxf.end) == xy(e) for x in app.editor.msp)

check("chained a->b", has_line(a, b))
check("chained b->c", has_line(b, c))

# 6. escape cancels whole in-progress line
app._on_escape()
root.update()
check("escape returns to select", app.edit_mode == 'select', app.edit_mode)
check("escape clears anchor", app.draw_anchor_item is None)
check("escape clears draw_start", app.draw_start is None and app.draw_start_dxf is None)
check("escape removes all segments", msp_count() == n_before, f"after={msp_count()}")

# 7. redo restores both segments
app.do_redo()
app.do_redo()
root.update()
check("redo re-adds segments", msp_count() == n_before + 2, f"after={msp_count()}")

# 7b. right-click finishes and keeps segments
app.set_edit_mode('line')
app._on_canvas_click(Ev(sxa, sya))
root.update()
check("re-anchor for right-click test", app.draw_anchor_item is not None)
app._on_canvas_click(Ev(sxb, syb))
root.update()
app._on_canvas_click(Ev(scx, scy))
root.update()
check("segments kept before right-click", msp_count() == n_before + 4, f"after={msp_count()}")
app._on_canvas_right_click(Ev(0, 0))
root.update()
check("right-click keeps segments", msp_count() == n_before + 4, f"after={msp_count()}")
check("right-click returns to select", app.edit_mode == 'select', app.edit_mode)
# cleanup: undo the two right-click segments
app.do_undo()
app.do_undo()
root.update()
check("cleanup back to baseline", msp_count() == n_before + 2, f"after={msp_count()}")

# 7c. reload sample; undo/redo preserves DIMENSION entities
app.parsed_data = parsed
app.editor = DXFEditor(SAMPLE)
app._render_bbox = parsed.get('bounding_box')
app._on_file_loaded()
root.update()
dims_b = sum(1 for e in app.editor.msp if e.dxftype() == 'DIMENSION')
app.editor.add_line((5, 5), (6, 6))
app.do_undo()
dims_a = sum(1 for e in app.editor.msp if e.dxftype() == 'DIMENSION')
check("undo preserves dimensions", dims_a == dims_b == 8, f"dims={dims_a}")
```

- [ ] **Step 2: 跑 smoke test 確認失敗**

Expected: `[FAIL] anchor persists after commit`（現行為 commit 後清空錨點）

- [ ] **Step 3: 實作 main.py 變更**

1) `__init__`（第 53 行 `self.dim_preview_items = []` 之後）加：
```python
        self.line_undo_mark = None
```

2) `set_edit_mode`（第 176-200 行）：在 `self.edit_mode = mode`（第 177 行）之後加：
```python
        self.line_undo_mark = None
```
在方法結尾（cursor config 之後，第 200 行 `self.canvas.configure(...)` 之後）加：
```python
        if mode == 'line' and self.editor is not None:
            self.line_undo_mark = len(self.editor.undo_stack)
```

3) `_on_canvas_click`（第 766-793 行）整段替換：
```python
        elif self.edit_mode == 'line':
            if self.draw_start is None:
                self.draw_start_dxf = self._get_snapped_dxf(event)
                if self.current_snap_screen:
                    self.draw_start = self.current_snap_screen
                else:
                    self.draw_start = (event.x, event.y)
                self._draw_anchor_marker()
                self._update_draw_preview(event)
                self.status_label.config(text='再點一下畫下一段，右鍵結束，Esc 取消', foreground='blue')
            else:
                dxf_start = self.draw_start_dxf
                dxf_end = self._get_snapped_dxf(event)
                self._clear_draw_preview()
                self._clear_snap_marker()
                if math.hypot(dxf_end[0] - dxf_start[0], dxf_end[1] - dxf_start[1]) > 1e-9:
                    self.editor.add_line(dxf_start, dxf_end)
                self.draw_start_dxf = dxf_end
                if self.current_snap_screen:
                    self.draw_start = self.current_snap_screen
                else:
                    self.draw_start = (event.x, event.y)
                self._clear_anchor_marker()
                self._draw_anchor_marker()
                self._refresh_after_edit()
                self.status_label.config(text='再點一下畫下一段，右鍵結束，Esc 取消', foreground='blue')
        elif self.edit_mode in ('rect', 'circle'):
            if self.draw_start is None:
                self.draw_start_dxf = self._get_snapped_dxf(event)
                if self.current_snap_screen:
                    self.draw_start = self.current_snap_screen
                else:
                    self.draw_start = (event.x, event.y)
                self._draw_anchor_marker()
                self._update_draw_preview(event)
                self.status_label.config(text='再點一下完成，按 Esc / 右鍵取消', foreground='blue')
            else:
                dxf_start = self.draw_start_dxf
                dxf_end = self._get_snapped_dxf(event)
                self._clear_draw_preview()
                self._clear_snap_marker()
                self._clear_anchor_marker()
                if self.edit_mode == 'rect':
                    self.editor.add_rectangle(dxf_start, dxf_end)
                elif self.edit_mode == 'circle':
                    radius = math.hypot(dxf_end[0] - dxf_start[0], dxf_end[1] - dxf_start[1])
                    if radius > 0.1:
                        self.editor.add_circle(dxf_start, radius)
                self.draw_start = None
                self.draw_start_dxf = None
                self._refresh_after_edit()
                self.status_label.config(text=f'已新增 {self.edit_mode}', foreground='green')
```

4) `_on_escape`（第 821-824 行）整段替換：
```python
    def _on_escape(self, event=None):
        if (self.edit_mode == 'line'
                and getattr(self, 'line_undo_mark', None) is not None
                and self.editor is not None):
            while len(self.editor.undo_stack) > self.line_undo_mark:
                self.editor.undo()
            self.line_undo_mark = None
            self._refresh_after_edit()
            self.status_label.config(text='已取消連續線', foreground='orange')
        self.set_edit_mode('select')
```

- [ ] **Step 4: 跑 smoke test 確認通過**

Run: 同 Step 2。Expected: 全部 PASS。再跑 editor test：`C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe cad_editor_test.py` → `ALL EDITOR TESTS PASSED`。

- [ ] **Step 5: 更新 progress.md**

---

### Task 6: 量尺寸下拉式選單 + tooltip

**Files:**
- Modify: `C:\Users\TW-10\Documents\firebase雲端資料夾\DXF零件拆解\main.py`（`DIM_MENU_ITEMS` 常數、`__init__` 3 個屬性、`_build_edit_toolbar` 移除 5 按鈕加 menubutton、`set_edit_mode` 更新 menubutton 文字、新增 4 個 tooltip 方法）
- Test: `C:\Users\TW-10\AppData\Local\Temp\opencode\cad_smoke_test.py`（新增下拉選單檢查）

**Interfaces:**
- Consumes: 既有 `set_edit_mode`、dim click 流程（不變）。
- Produces: `self.dim_menubtn`（`ttk.Menubutton`）、`self.dim_menu`（`tk.Menu`）、`self._show_dim_tooltip/_hide_dim_tooltip/_on_dim_menu_select/_on_dim_menu_unpost`。

- [ ] **Step 1: 寫失敗測試**

在 Task 4 的 settings dialog section 之後插入：

```python
# 13. dimension dropdown menu + hover tooltip
labels = [app.dim_menu.entrycget(i, 'label') for i in range(5)]
check("dim menu 5 items", len(labels) == 5, str(labels))
check("dim menu labels",
      labels == ['↔ 線性', '↔ 水平', '↕ 垂直', 'Ø 直徑', 'R 半徑'], str(labels))
app.set_edit_mode('dim_linear')
root.update()
check("menubtn reflects mode", '線性' in app.dim_menubtn.cget('text'),
      app.dim_menubtn.cget('text'))
app.dim_menu.activate(0)
app._on_dim_menu_select(None)
root.update()
tl = getattr(app, 'dim_tooltip', None)
check("tooltip shown", tl is not None)
if tl is not None:
    t = tl.winfo_children()[0].cget('text')
    check("tooltip shows measure hint", '點 3 下' in t, t)
app._on_dim_menu_unpost(None)
root.update()
check("tooltip hidden on unpost", getattr(app, 'dim_tooltip', None) is None)
app.set_edit_mode('select')
root.update()
check("menubtn resets", app.dim_menubtn.cget('text') == '量尺寸 ▾',
      app.dim_menubtn.cget('text'))
```

- [ ] **Step 2: 跑 smoke test 確認失敗**

Expected: `AttributeError: 'CADPartsApp' object has no attribute 'dim_menu'`

- [ ] **Step 3: 實作 main.py 變更**

1) 模組常數（`DIM_RADIAL_MODES` 之後）加：
```python
DIM_MENU_ITEMS = [
    ('↔ 線性', 'dim_linear', '點 3 下：起點 → 終點 → 尺寸線位置'),
    ('↔ 水平', 'dim_horizontal', '點 3 下：左點 → 右點 → 尺寸線位置（水平）'),
    ('↕ 垂直', 'dim_vertical', '點 3 下：下點 → 上點 → 尺寸線位置（垂直）'),
    ('Ø 直徑', 'dim_diameter', '點 2 下：圓周一點 → 引線方向'),
    ('R 半徑', 'dim_radius', '點 2 下：圓周一點 → 引線方向'),
]
```

2) `__init__`（`self.dim_preview_items = []` 之後）加：
```python
        self.dim_menubtn = None
        self.dim_menu = None
        self.dim_tooltip = None
```

3) `_build_edit_toolbar`（第 133-138 行）`tools` list 改為：
```python
        tools = [
            ('select', '選取'), ('line', '直線'), ('rect', '矩形'),
            ('circle', '圓形'), ('text', '文字'), ('delete', '刪除'),
        ]
```
在 for 迴圈（第 143 行結尾）之後、`ttk.Separator`（第 144 行）之前加：
```python
        self.dim_menubtn = ttk.Menubutton(self.edit_toolbar, text='量尺寸 ▾')
        self.dim_menubtn.pack(side=tk.LEFT, padx=1)
        self.dim_menu = tk.Menu(self.dim_menubtn, tearoff=0)
        self.dim_menubtn.config(menu=self.dim_menu)
        for label, mode, hint in DIM_MENU_ITEMS:
            self.dim_menu.add_command(label=label, command=lambda m=mode: self.set_edit_mode(m))
        self.dim_menu.bind('<<MenuSelect>>', self._on_dim_menu_select)
        self.dim_menu.bind('<<MenuUnpost>>', self._on_dim_menu_unpost)
```

4) `set_edit_mode`：在 pressed 迴圈與 cursor config 之間（第 193 行 `if mode in self.edit_buttons:` 區塊之後）加：
```python
        if self.dim_menubtn is not None:
            if mode.startswith('dim_'):
                label = next(l for l, m, _ in DIM_MENU_ITEMS if m == mode)
                self.dim_menubtn.config(text=f'量尺寸 ▾ · {label}')
            else:
                self.dim_menubtn.config(text='量尺寸 ▾')
```

5) 新增方法（放在 `_commit_dim` 之後、`_draw_entity_highlight` 之前）：
```python
    def _show_dim_tooltip(self, text, x, y):
        self._hide_dim_tooltip()
        if not text:
            return
        tl = tk.Toplevel(self.root)
        tl.overrideredirect(True)
        tl.attributes('-topmost', True)
        tl.geometry(f'+{x + 15}+{y + 15}')
        tk.Label(tl, text=text, bg='#FFFFE0', relief='solid', borderwidth=1,
                 padx=6, pady=3, font=('', 10)).pack()
        self.dim_tooltip = tl

    def _hide_dim_tooltip(self):
        tl = getattr(self, 'dim_tooltip', None)
        if tl is not None:
            try:
                tl.destroy()
            except Exception:
                pass
            self.dim_tooltip = None

    def _on_dim_menu_select(self, event):
        try:
            idx = self.dim_menu.index('active')
        except Exception:
            idx = None
        if idx is not None and 0 <= idx < len(DIM_MENU_ITEMS):
            label, mode, hint = DIM_MENU_ITEMS[idx]
            x, y = self.dim_menu.winfo_pointerxy()
            self._show_dim_tooltip(f'{label}｜{hint}', x, y)
        else:
            self._hide_dim_tooltip()

    def _on_dim_menu_unpost(self, event):
        self._hide_dim_tooltip()
```

- [ ] **Step 4: 跑 smoke test 確認通過**

Run: 同 Step 2。Expected: 全部 PASS（含新 6 個下拉檢查）。既有 7c-7f dim 測試仍 PASS（它們直接設 `edit_mode`）。

- [ ] **Step 5: 更新 progress.md**

---

### Task 7: 整合驗證與重建 exe

**Files:**
- Run: 全部既有測試 + 重建 exe

**Interfaces:**
- Consumes: Task 1-6 全部。

- [ ] **Step 1: 跑全部測試**

Run（workdir `C:\Users\TW-10\AppData\Local\Temp\opencode`）：
`C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe settings_test.py`
`C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe cad_smoke_test.py`
`C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe cad_editor_test.py`
Expected: 三者全 PASS（smoke 含新增的 settings/grid/dialog/dropdown/連續線檢查）。

- [ ] **Step 2: 重建 exe**

先結束執行中的 exe：
```powershell
Get-Process | Where-Object { $_.ProcessName -like "*CAD*" -or $_.ProcessName -like "*DXF*" } | Stop-Process -Force -ErrorAction SilentlyContinue
```
再重建（workdir `DXF零件拆解`）：
```powershell
C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe -m PyInstaller --onefile --windowed --name "DXF零件拆解系統" --hidden-import matplotlib --hidden-import matplotlib.backends.backend_agg --hidden-import ezdxf --hidden-import openpyxl --hidden-import PIL --hidden-import PIL._tkinter_finder --hidden-import PIL.ImageDraw --collect-all matplotlib --collect-all ezdxf main.py
```
Expected: `Build complete!`（exe 檔名改為 `DXF零件拆解系統.exe`）

- [ ] **Step 3: 啟動 exe 確認存活**

```powershell
Start-Process -FilePath "C:\Users\TW-10\Documents\firebase雲端資料夾\DXF零件拆解\dist\DXF零件拆解系統.exe"
Start-Sleep -Seconds 8
Get-Process | Where-Object { $_.ProcessName -like "*DXF*" -or $_.ProcessName -like "*CAD*" }
```
Expected: 有 PID 且 8 秒後仍存活（ProcessName 含中文時可能顯示為 `DXF零件拆解系統`）。結束後清理：
```powershell
Get-Process | Where-Object { $_.ProcessName -like "*DXF*" -or $_.ProcessName -like "*CAD*" } | Stop-Process -Force -ErrorAction SilentlyContinue
```

- [ ] **Step 4: 本機驗證 checkpoint**

全部測試 PASS、exe 可啟動。更新 progress.md 為「完成」。向使用者回報「已完成，未上傳（依指示）」。

## Global Constraints（重申）

- **禁止 commit/push/上傳**。所有 checkpoint 以 `.superpowers/sdd/progress.md` 記錄。
- 測試命令一律用 `C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe`。
- 不留下額外暫存檔案在專案資料夾（暫存驗證腳本放 `C:\Users\TW-10\AppData\Local\Temp\opencode`）。
