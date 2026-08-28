# 尺寸標註功能設計（標尺寸 / 顯示既有尺寸 / 刪除尺寸）

日期：2026-08-01
狀態：已獲使用者同意

## 背景與目標

使用者是焊接廠，處理正式圖面轉出的 DXF 檔。目前：

- 檔案中的 DIMENSION 實體**不會**顯示在畫布上（`render_canvas` 沒有 DIMENSION 繪製分支），只有零件分析與 Excel 匯出有用到尺寸數值。
- 工具列沒有「新增尺寸」的功能。
- 使用者要求：① 顯示正式圖面既有的尺寸；② 能「標尺寸」（新增尺寸標註）；③ 能刪除尺寸（如同 CAD）；④ 新增的標註要存成真正的 DIMENSION 實體（存檔後 AutoCAD 也看得到）。

「量尺寸」已確認 = 線性尺寸標註（永久留在圖面），由「線性」工具涵蓋。

## 技術方案（已驗證）

### ezdxf 1.4.4 尺寸 API（已實測）

- `msp.add_linear_dim(base, p1, p2, ...)` / `add_diameter_dim(...)` / `add_radius_dim(...)` 回傳的是 **`DimStyleOverride`** 物件（非 DIMENSION 實體）。
- 呼叫 `dso.render()` 才會在 modelspace 產生真正的 DIMENSION 實體，並自動建立匿名幾何 block（名稱如 `*D1`）。`render()` 回傳實體。
- 幾何 block 內以 **WCS 座標** 存放：LINE（延伸線/尺寸線/引線）、INSERT（箭頭 block）、MTEXT（尺寸文字）、POINT。
- 用 `msp.query('DIMENSION')` 重新查詢到的實體是基礎 `Dimension` 類別，具備 `get_measurement()`；`DimStyleOverride`/`LinearDimension` 直接呼叫會失敗，因此**一律重新查詢**取得數值。
- 刪除用 `entity.destroy()` 有效（必須 destroy 真正的 DIMENSION 實體，不能 destroy DimStyleOverride）。
- undo/redo 快照（`_take_snapshot`/`_restore_snapshot`）**可保留尺寸**：restore 只 destroy msp 實體、不會刪除 block；`default_copy` 複製 DIMENSION 後 block 仍存在且正常寫檔。
- dimstyle 需存在。real 檔案有自己的 dimstyle（如 sample.dxf 的 `Standard`）；新尺寸帶 `override={'dimtxt': h, 'dimasz': a}` 控制字高與箭頭大小。
- 箭頭 block：`_ARCHTICK` = LWPOLYLINE 兩點（斜線 tick）；`_CLOSEDFILLED` = SOLID；`_CLOSEDBLANK` = LWPOLYLINE 三角形。INSERT 需依 insert 點 + rotation 轉換後繪製。

## 功能規格

### 1. 顯示既有尺寸（畫布渲染）

- `dxf_parser.build_entity_list()` 的 DIMENSION 分支擴充：保留 `points`（defpoint2/defpoint3），並加上 `geometry`（`dim.dxf.geometry`，block 名）、`value`（`get_measurement()` 重新查詢）、`text`（`get_dim_text`）、`dimtype`、`layer`。
- `main.py` 新增 `_draw_canvas_dimension(ent)`：讀取幾何 block（`editor.doc.blocks.get(ent['geometry'])`），逐一繪製：
  - LINE → 畫布線段
  - INSERT → 依 insert + rotation 轉換箭頭 block 的幾何（LWPOLYLINE 線段 / SOLID 三角形），畫出箭頭 tick 或三角形
  - MTEXT → 在 insert 位置畫文字（內容用尺寸文字）
  - POINT → 略過
- block 不存在時退路：線性家族（dimtype & 7 屬線性）用 defpoint2/defpoint3/defpoint 自算延伸線、尺寸線、tick 與文字；徑向只用文字。
- 顏色沿用 `_color_for_entity` 的圖層顏色；tag 含 `('ent', 'ent_{id}', 'layer_{layer}')`，與其他圖元一致。

### 2. 標尺寸（新增工具）

工具列新增 5 個編輯模式按鈕：`dim_linear`、`dim_horizontal`、`dim_vertical`、`dim_diameter`、`dim_radius`。與既有編輯工具（線、矩形、圓、文字、選取、刪除）並列。

互動流程：

- **線性 / 水平 / 垂直**（三下點選）：
  1. 第一下：鎖點取得 A 點，畫錨點標記（沿用 `_draw_anchor_marker`）
  2. 移動：預覽 A→滑鼠的虛線 + 鎖點（沿用 `_update_draw_preview` 流程）
  3. 第二下：鎖點取得 B 點
  4. 移動：預覽尺寸線（依類型投影，位置隨滑鼠）
  5. 第三下：決定尺寸線位置，建立尺寸
- **直徑 / 半徑**（兩下點選）：
  1. 第一下：鎖點（若點在圓周/圓心）取得圓心與半徑、圓周點
  2. 移動：預覽圓心→滑鼠的引線與文字
  3. 第二下：決定引線角度，建立尺寸

建立尺寸的 ezdxf 呼叫（`dxf_editor.add_dimension(...)`，統一 `_push_undo()`）：

- 線性（沿線）：`add_aligned_dim(p1, p2, location)` → render
- 水平：`add_linear_dim(base, p1, p2, angle=0)` → render
- 垂直：`add_linear_dim(base, p1, p2, angle=90)` → render
- 直徑：`add_diameter_dim(center, mpoint=圓周點, ...)` → render
- 半徑：`add_radius_dim(center, mpoint=圓周點, ...)` → render
- dimstyle：優先使用文件既有 dimstyle；無則建立 `CAD_DIM`。一律帶 `override={'dimtxt': h, 'dimasz': a}`，`h = 線寬設定 × 1.2`（與文字一致），`a = 線寬設定`。
- layer/color 沿用目前圖層設定。

### 3. 選取 / 刪除 / 移動

- `dxf_editor._entity_distance()` 新增 DIMENSION 分支：距離 = 幾何 block 所有 LINE 的最小點線距 與 文字位置距離 取較小者（block 缺失時退化為 defpoint2/defpoint3/defpoint 線段）。使 `hit_test` 可選中尺寸。
- 選取後，`move_entities` 需要能移動尺寸：移動時同步調整 defpoint/defpoint2/defpoint3 與幾何 block？——**此階段僅支援刪除，不支援移動尺寸**（避免 block 幾何不一致）。若選中尺寸，移動時提示「尺寸不支援移動，請刪除後重標」。
- 刪除：選取工具點尺寸 → 按刪除；或刪除工具點尺寸 → `entity.destroy()`（既有的 `delete_entity` 路徑），正常 undo/redo。

### 4. 資料完整性

- `extract_dimensions()` 維持現狀（重新查詢 msp，新增尺寸自動納入零件分析與 Excel 匯出）。
- undo/redo 沿用現有快照機制（已驗證保留尺寸與 block）。
- 儲存 DXF：尺寸與 block 一併寫出，AutoCAD 可正常顯示。

## 錯誤處理

- 幾何 block 缺失 → 退路渲染（線性自算 / 徑向文字），不崩潰。
- `get_measurement()` 失敗 → 尺寸文字回退為 `get_dim_text` 或數值字串；無值則顯示 `<無值>`。
- 圓形鎖點失敗（點到非圓形）→ 提示「請點到圓形」。
- 尺寸線位置與 A、B 重合（三下點成一直線）→ 給一個最小偏移，避免退化。

## 測試策略

- **單元測試**（沿用現有 smoke test 架構，`cad_smoke_test.py`）：
  - 新增 5 種尺寸工具，驗證 msp 出現 DIMENSION 實體、`get_measurement()` 數值正確（線性 = 兩點距離、直徑 = 2r、半徑 = r）。
  - 畫布渲染：render_canvas 後 DIMENSION 有對應 canvas items（數量增加）。
  - 既有尺寸顯示：載入 sample.dxf，canvas items 應包含尺寸圖形。
  - 刪除尺寸後 msp 數量 -1；undo 後恢復。
  - hit_test 能選中尺寸實體。
  - undo/redo 後尺寸與 block 仍存在、存檔回讀正常（沿用 `cad_editor_test.py` 回讀測試）。
- **E2E**：此功能無跨角色權限、金流、敏感資料、跨頁導向鏈，依 AGENTS.md 不需 E2E。

## 檔案影響

- `dxf_parser.py`：`build_entity_list()` DIMENSION 分支擴充（geometry/value/text/dimtype）。
- `dxf_editor.py`：新增 `add_dimension(kind, ...)`、`ensure_dimstyle()`、`_entity_distance()` DIMENSION 分支、`move_entities` 尺寸阻擋。
- `main.py`：工具列 5 個按鈕、`_draw_canvas_dimension()`、尺寸互動 handler、`_on_canvas_click` 尺寸分支、狀態列提示。
- `snap_helper.py`：不需改動（圓形鎖點已支援圓心/象限/圓周端點）。
