# 2026-08-01 UX 精修設計：量尺寸下拉選單、連續畫線、設定鈕

## 背景與目標

焊接廠 CAD 圖面拆解工具（Python + ezdxf + Tkinter，PyInstaller 單一 exe）的編輯功能 UX 精修，三項需求：

1. **量尺寸改下拉式選單**：5 顆尺寸按鈕（線性/水平/垂直/直徑/半徑）合併成一個下拉選單，選項帶量測圖示符號，滑鼠懸停時以 tooltip 說明量法。
2. **連續畫線**：直線工具可連續點擊接出多段線，右鍵結束、Esc 取消整段。
3. **設定鈕**：新增「設定」按鈕與設定視窗，將可設定規則集中管理並存檔，下次啟動自動載入。

**本階段仍遵守「完成前不 commit / push / 上傳，一切留本機」。**

## 現況（已確認）

- `main.py` 工具列 `_build_edit_toolbar`（main.py:131-174）用 `tools` list 建立按鈕，目前 11 個：select/line/rect/circle/text/delete/dim_linear/dim_horizontal/dim_vertical/dim_diameter/dim_radius。
- `set_edit_mode`（main.py:176-200）以 `edit_buttons[mode].state(['pressed'])` 標記按下；cursors dict 含 5 種 dim 模式。
- 直線/矩形/圓形共用同一 click 流程（main.py:766-793）：第 1 點設 `draw_start_dxf` + 錨點 + 預覽，第 2 點 commit 後清空。
- `_on_canvas_right_click`（main.py:818）→ 一律 `set_edit_mode('select')`；`_on_escape`（main.py:823）→ 一樣回 select。
- `SNAP_TOLERANCE_PX = 12`（main.py:27），`_update_snap_at`（main.py:637）用它算容差。
- 畫布背景 `bg='#f0f0f0'`（main.py:86）；鎖點標記 `_draw_snap_marker`（main.py:620）。
- `_commit_dim`（main.py:914）用 `h = 線寬×1.2`、`a = 線寬`；`add_text`（main.py:730）用 `height = 線寬×1.2`。
- `add_line`/`add_text`/`add_dimension` 各自 `_push_undo()`（dxf_editor.py），undo/redo 以 snapshot 運作。

## Feature ① 量尺寸下拉式選單 + 懸停 tooltip

### 設計

- `tools` list 移除 5 個 dim 按鈕；`edit_buttons` 不再包含 dim 鍵。
- 新增 `ttk.Menubutton`「量尺寸 ▾」放在原尺寸按鈕位置，內建 `tk.Menu`。
- 選單資料結構（模組常數）：

```
DIM_MENU_ITEMS = [
    ('↔ 線性', 'dim_linear',    '點 3 下：起點 → 終點 → 尺寸線位置'),
    ('↔ 水平', 'dim_horizontal','點 3 下：左點 → 右點 → 尺寸線位置（水平）'),
    ('↕ 垂直', 'dim_vertical',  '點 3 下：下點 → 上點 → 尺寸線位置（垂直）'),
    ('Ø 直徑', 'dim_diameter',  '點 2 下：圓周一點 → 引線方向'),
    ('R 半徑', 'dim_radius',    '點 2 下：圓周一點 → 引線方向'),
]
```

- 每個選單項目 `command=lambda m=mode: self.set_edit_mode(m)`。
- **tooltip**：`menu.bind('<<MenuSelect>>', ...)` → `idx = menu.index('active')`；idx 有效時以 Toplevel（`overrideredirect(True)`、`-topmost`）在游標旁（pointer + 偏移）顯示對應量法文字；`menu.bind('<<MenuUnpost>>', ...)` 隱藏。
- Menubutton 文字反映目前模式：dim 模式 →「量尺寸 ▾ · {label}」，其他 →「量尺寸 ▾」。在 `set_edit_mode` 中更新。
- 量法邏輯（`_commit_dim`、click 分支、status 提示）完全不變。

### 影響

- 移除 5 按鈕後 `set_edit_mode` 的 pressed 迴圈對 dim 模式不再有按鈕可標記 → 改為更新 menubutton 文字。
- 無頭測試：直接呼叫 tooltip 顯示/隱藏方法可驗證；選單項目存在性可用 `menu.entrycget(i, 'label')` 驗證。

## Feature ② 連續畫線

### 設計

- 僅改 `edit_mode == 'line'` 分支（main.py:766-793）：
  - 第 1 點：與現在相同（設 `draw_start_dxf`、錨點、預覽、提示）。
  - 之後每點一下：commit 一段 `add_line(draw_start_dxf, dxf_end)`，**然後不清空**：`draw_start_dxf = dxf_end`、重畫錨點、提示改為「再點一下繼續，右鍵結束，Esc 取消」。
- **右鍵結束**：`_on_canvas_right_click` 行為維持 → 回 select，已畫段保留。
- **Esc 取消整段**：
  - `set_edit_mode('line')` 時記錄 `self.line_undo_mark = len(self.editor.undo_stack)`（editor 為 None 時設 None）。
  - `_on_escape`：若 `edit_mode == 'line'` 且 `line_undo_mark` 有效 → `while len(undo_stack) > line_undo_mark: self.editor.undo()`，再 `set_edit_mode('select')`。
  - 結果：本次連續畫的段全部撤除，且 undo 歷史乾淨（不會留下「取消段」的 undo 記錄）。
- 切換其他工具／按其他按鈕：等同右鍵，保留已畫段（`set_edit_mode` 重置 `line_undo_mark` 但不 undo）。
- 每段仍是獨立 LINE（已確認），各自可 undo、可單獨刪除/選取/量尺寸/分析。

### 影響

- `_on_escape` 現在只負責回 select → 需加入 line 取消邏輯。
- 既有 smoke test 的直線測試（2 點、escape-cancel）需更新為連續行為。
- 注意：`rect`/`circle` 維持原 2 點行為不變。

## Feature ③ 設定鈕 + 設定檔

### 設計

- **儲存位置**：`%APPDATA%\DXF零件拆解系統\settings.json`（Windows 標準、可寫）。開發模式（未 frozen）沿用相同路徑，統一不放在專案資料夾。
- **設定項目與預設**：

```
snap_enabled       True
snap_tolerance_px  12
line_width         2
text_height        2.5      # add_text 高度（取代 線寬×1.2）
dim_text_height    2.5      # 尺寸 dimtxt
dim_arrow_size     2.0      # 尺寸 dimasz
grid_enabled       False
grid_spacing       10       # 世界單位
bg_color           '#f0f0f0'
snap_marker_color  '#FFD400'  # 黃
```

- **載入**：`__init__` 建立畫布後、建工具列前讀取 `settings.json`（不存在 → 用預設）。套用：`canvas.configure(bg=bg)`、`line_width_var.set(line_width)`、`self.snap_tolerance_px`、`self.snap_enabled`、`self.grid_enabled/spacing`、`self.text_height`、`self.dim_text_height/arrow_size`、`self.snap_marker_color`。
- **設定視窗**：`設定` 按鈕（放主工具列，匯出按鈕旁）→ `Toplevel`。欄位：
  - 鎖點：Checkbutton「啟用鎖點」 + Spinbox「容差(px) 1-50」
  - 預設線寬：Spinbox 1-10
  - 文字高度 / 尺寸文字高度：Spinbox 0.5-20（步進 0.5）
  - 箭頭大小：Spinbox 0.5-10
  - 網格：Checkbutton「顯示網格」 + Spinbox「間距 1-100」
  - 顏色：畫布背景、鎖點標記 → 各一個色塊按鈕，用 `colorchooser.askcolor`
  - 按鈕：確定 / 取消 / 重設為預設
  - 確定 → 寫入 self.settings、`save_settings()`、立即套用、關閉；取消 → 丟棄；重設 → 填回預設值。
- **套用點**：
  - `_update_snap_at`（main.py:644）：`tol = self.snap_tolerance_px / view_scale`；`snap_enabled` False 時 `_get_snapped_dxf`/`_update_snap_at` 直接回 None / 清 marker。
  - `add_text`（main.py:730）：`height = self.text_height`。
  - `_commit_dim`（main.py:918-919）：`h = self.dim_text_height`、`a = self.dim_arrow_size`。
  - `render_canvas`：`grid_enabled` 時先畫網格（tag `grid`，`tag_lower('grid')`）；背景色於設定套用時 `canvas.configure(bg=...)`。
  - `_draw_snap_marker`：顏色改用 `self.snap_marker_color`。
- **網格渲染**：在 `render_canvas` 中、畫實體前，依可見世界範圍（`_canvas_to_dxf` 反算四角）每隔 `grid_spacing` 畫垂直/水平線，`fill='#DDDDDD'`、`tags=('grid',)`，先刪舊 grid items，最後 `tag_lower('grid')`。`grid_enabled` False 則只刪不畫。

### 影響

- 新增 `settings.py`（或放 main.py 內函式）：`load_settings()/save_settings()/DEFAULT_SETTINGS`。獨立小單元，可單測。
- `line_width_var` 仍在工具列顯示，與設定同步（設定變更後 `set()` 回去）。
- 文字/尺寸預設改為直接取設定值，不再由線寬推算（預設值刻意貼近現況）。

## 錯誤處理

- `settings.json` 讀取失敗（格式錯/缺檔）→ 回退預設，不 crash。
- `save_settings()` 失敗 → 只顯示狀態列警告，不阻斷操作。
- 網格間距 ≤ 0 或過大 → 讀取時 clamp 到合理範圍（1..1000）。
- Esc 取消連續線時 `self.editor` 可能為 None → 有 guard。

## 測試策略（更新 smoke test + 新增設定測試）

- **連續線**：點 3 點 → 產生 2 條 LINE；Esc → 回到原本數量（undo 乾淨）；右鍵 → 段保留、回 select；rect/circle 仍 2 點。
- **下拉選單**：5 個 menu entry 存在、label 正確；`set_edit_mode('dim_linear')` 後 menubutton 文字更新；tooltip 方法可直接呼叫驗證文字內容。
- **設定**：`load_settings/save_settings` round-trip（含缺檔回退預設、壞格式回退）；設定後 `_update_snap_at` 用新容差；`snap_enabled=False` 不鎖點；`grid_enabled=True` 且 `render_canvas()` 後 canvas 有 `grid` items；背景色套用。
- 全部既有測試保持通過。

## 範圍外（YAGNI）

- 不做自動適配視窗設定（使用者未勾選）。
- 不做 LWPOLYLINE 合併。
- 不做格線吸附（snap to grid）。
- 不做 tooltip 的動畫/延遲。
