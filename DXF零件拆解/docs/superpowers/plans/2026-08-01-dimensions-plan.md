# 尺寸標註功能（標尺寸/顯示既有尺寸/刪除尺寸）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓正式圖面的既有尺寸顯示在畫布、新增五種尺寸標註（線性/水平/垂直/直徑/半徑）並能刪除，存成真正的 DIMENSION 實體。

**Architecture:** ezdxf 原生 DIMENSION 實體（`add_aligned_dim`/`add_linear_dim`/`add_diameter_dim`/`add_radius_dim` + `render()`）。畫布渲染直接讀取每個尺寸的匿名幾何 block（`*D…`，內含 WCS 座標的 LINE/INSERT 箭頭/MTEXT 文字）。既有與新增尺寸共用同一條渲染路徑。刪除沿用 `entity.destroy()`；選取靠 `hit_test` 加 DIMENSION 分支。

**Tech Stack:** Python 3.12、ezdxf 1.4.4、Tkinter、PyInstaller。

## Global Constraints

- **禁止 commit/push/上傳**：使用者明確要求「完成前不要上傳/commit/push，一切留本機」。每個 Task 的 commit step 改為「本機驗證 checkpoint」，不執行任何 git 操作。
- Python venv：`C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe`
- ezdxf 1.4.4 API 已實測：`add_linear_dim/add_diameter_dim/add_radius_dim/add_aligned_dim` 回傳 **`DimStyleOverride`**，須呼叫 `render()` 產生真正的 DIMENSION 實體；用 `msp.query('DIMENSION')` 重新查詢才有 `get_measurement()`。
- 所有尺寸數值必須來自 DXF 向量資料，禁止猜測數值。
- 不可破壞 `dxf_parser.extract_entities/extract_dimensions/extract_texts`（main.py `_refresh_after_edit` 仍使用）。
- 快照機制（`_take_snapshot`/`_restore_snapshot`）不得改動；它已驗證可保留尺寸與 block。

---
### Task 1: dxf_parser DIMENSION 資料擴充

**Files:**
- Modify: `C:\Users\TW-10\Documents\firebase雲端資料夾\DXF零件拆解\dxf_parser.py:187-202`
- Test: `C:\Users\TW-10\AppData\Local\Temp\opencode\cad_smoke_test.py`

**Interfaces:**
- Consumes: 無（既有 `get_dimension_value`/`get_dim_text`）
- Produces: `build_entity_list()` 的 DIMENSION dict 新增欄位：`geometry`(str|None)、`value`(float|None)、`text`(str|None)、`dimtype`(int|None)、`center`(tuple|None)。

- [ ] **Step 1: 在 smoke test 加入既有尺寸資料的斷言**

在 `cad_smoke_test.py` 第 35 行 `check("entity_list built", ...)` 之後新增：

```python
dims_ents = [e for e in app.entity_list if e.get('type') == 'DIMENSION']
check("existing dims in entity_list", len(dims_ents) == 8, f"count={len(dims_ents)}")
if dims_ents:
    check("dim has geometry", all(e.get('geometry') for e in dims_ents))
    check("dim has value", all(e.get('value') is not None for e in dims_ents))
```

- [ ] **Step 2: 執行確認失敗**

Run: `C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe cad_smoke_test.py`
Expected: `[FAIL] existing dims in entity_list count=0`（目前 DIMENSION 被 build_entity_list 略過或無 geometry/value）

- [ ] **Step 3: 實作 build_entity_list DIMENSION 分支**

將 `dxf_parser.py:187-202` 的 DIMENSION 分支整段替換為：

```python
            elif dxf_type == 'DIMENSION':
                pts = []
                for attr in ('defpoint2', 'defpoint3'):
                    try:
                        p = getattr(e.dxf, attr)
                        pts.append((round(p.x, 3), round(p.y, 3)))
                    except Exception:
                        pass
                data['points'] = pts
                try:
                    data['geometry'] = e.dxf.geometry
                except Exception:
                    data['geometry'] = None
                try:
                    data['value'] = get_dimension_value(e)
                except Exception:
                    data['value'] = None
                try:
                    data['text'] = get_dim_text(e)
                except Exception:
                    data['text'] = None
                try:
                    data['dimtype'] = e.dxf.dimtype
                except Exception:
                    data['dimtype'] = None
                try:
                    p = e.dxf.defpoint
                    data['center'] = (round(p.x, 3), round(p.y, 3))
                except Exception:
                    data['center'] = None
```

注意：移除原本 `if pts: ... else: continue` 的跳過邏輯，讓徑向尺寸（可能無 defpoint2/3）也留在 entity_list。

- [ ] **Step 4: 執行確認通過**

Run: `C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe cad_smoke_test.py`
Expected: `[PASS] existing dims in entity_list count=8` 且原有全部 PASS。若新增後讓既有測試失敗（例如 snap 點變多），檢查 snap 測試是否仍 PASS（DIMENSION 的 snap 點本來就有，不受影響）。

- [ ] **Step 5: 本機驗證 checkpoint（不 commit）**

確認 `py_compile` 通過：`C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe -m py_compile dxf_parser.py`
（workdir = `DXF零件拆解`）

---
### Task 2: dxf_editor 尺寸建立與選取/移動支援

**Files:**
- Modify: `C:\Users\TW-10\Documents\firebase雲端資料夾\DXF零件拆解\dxf_editor.py`（`add_line` 之後、`_entity_distance` DIMENSION 分支、`move_entities`）
- Test: `C:\Users\TW-10\AppData\Local\Temp\opencode\cad_editor_test.py`

**Interfaces:**
- Consumes: Task 1 無直接依賴。
- Produces:
  - `DXFEditor.ensure_dimstyle() -> str`：回傳可用 dimstyle 名稱。
  - `DXFEditor.add_dimension(kind, p1=None, p2=None, location=None, distance=None, center=None, mpoint=None, text_height=2.5, arrow_size=1.0, layer=None, color=None) -> bool`：`kind` ∈ {'linear','horizontal','vertical','diameter','radius'}；linear 用 `distance`（帶正負號的垂直距離），horizontal/vertical 用 `location`，diameter/radius 用 `center`+`mpoint`。
  - `_entity_distance` DIMENSION 分支（內部）。
  - `move_entities` 對 DIMENSION 回傳 False 並拒絕移動。

- [ ] **Step 1: 在 editor test 加入失敗測試**

在 `cad_editor_test.py` 結尾（`root.destroy()` 之前）加入：

```python
# ---- dimension tests ----
doc3 = ezdxf.readfile(SAMPLE) if False else None
import ezdxf
from dxf_editor import DXFEditor
from dxf_parser import get_dimension_value
ed = DXFEditor(SAMPLE)
n0 = sum(1 for e in ed.msp.query('DIMENSION'))
assert ed.add_dimension('linear', p1=(0, 0), p2=(10, 0), distance=-5.0,
                        text_height=2.5, arrow_size=1.0), "add linear dim failed"
assert ed.add_dimension('horizontal', p1=(0, 0), p2=(10, 0), location=(0, -8),
                        text_height=2.5, arrow_size=1.0), "add horizontal dim failed"
assert ed.add_dimension('vertical', p1=(0, 0), p2=(0, 8), location=(-8, 0),
                        text_height=2.5, arrow_size=1.0), "add vertical dim failed"
assert ed.add_dimension('diameter', center=(20, 20), mpoint=(25, 20),
                        text_height=2.5, arrow_size=1.0), "add diameter dim failed"
assert ed.add_dimension('radius', center=(20, 0), mpoint=(25, 0),
                        text_height=2.5, arrow_size=1.0), "add radius dim failed"
dims = list(ed.msp.query('DIMENSION'))
assert len(dims) == n0 + 5, f"expected {n0+5} dims, got {len(dims)}"
lin = [d for d in dims if d.dxf.dimtype & 7 == 0][-1]
assert abs(get_dimension_value(lin) - 10.0) < 1e-6, f"linear value {get_dimension_value(lin)}"
dia = [d for d in dims if d.dxf.dimtype & 7 == 3][-1]
assert abs(get_dimension_value(dia) - 10.0) < 1e-6, f"diameter value {get_dimension_value(dia)}"
rad = [d for d in dims if d.dxf.dimtype & 7 == 4][-1]
assert abs(get_dimension_value(rad) - 5.0) < 1e-6, f"radius value {get_dimension_value(rad)}"
# hit_test selects a dimension
d = lin
hit = ed.hit_test(5, -5, tolerance=5.0)
assert hit is not None and hit.dxftype() == 'DIMENSION', f"hit_test {hit}"
# delete a dim
ed.delete_entity(lin)
assert sum(1 for e in ed.msp.query('DIMENSION')) == n0 + 4
# undo restores
ed.undo()
assert sum(1 for e in ed.msp.query('DIMENSION')) == n0 + 5, "undo did not restore dim"
# move rejected
moved = ed.move_entities([rad], 5, 5)
assert moved is False, "dimension should not be movable"
print("DIMENSION TESTS OK")
```

- [ ] **Step 2: 執行確認失敗**

Run: `C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe cad_editor_test.py`
Expected: `AttributeError: 'DXFEditor' object has no attribute 'add_dimension'`（或 assert 失敗）

- [ ] **Step 3: 實作 ensure_dimstyle + add_dimension**

在 `dxf_editor.py` `add_text`（line 155-160）之後插入：

```python
    def ensure_dimstyle(self):
        for name in ('EZDXF', 'Standard', 'ISO-25'):
            if name in self.doc.dimstyles:
                return name
        if 'CAD_DIM' not in self.doc.dimstyles:
            self.doc.dimstyles.new('CAD_DIM', dxfattribs={'dimtxt': 2.5, 'dimasz': 1.0})
        return 'CAD_DIM'

    def add_dimension(self, kind, p1=None, p2=None, location=None, distance=None,
                      center=None, mpoint=None, text_height=2.5, arrow_size=1.0,
                      layer=None, color=None):
        self._push_undo()
        layer = layer or self.current_layer
        color = color or self.current_color
        style = self.ensure_dimstyle()
        ov = {'dimtxt': text_height, 'dimasz': arrow_size}
        dxf = {'layer': layer, 'color': color}
        try:
            if kind == 'linear':
                dso = self.msp.add_aligned_dim(p1=p1, p2=p2, distance=distance,
                                               dimstyle=style, override=ov, dxfattribs=dxf)
            elif kind == 'horizontal':
                dso = self.msp.add_linear_dim(base=location, p1=p1, p2=p2, angle=0,
                                              dimstyle=style, override=ov, dxfattribs=dxf)
            elif kind == 'vertical':
                dso = self.msp.add_linear_dim(base=location, p1=p1, p2=p2, angle=90,
                                              dimstyle=style, override=ov, dxfattribs=dxf)
            elif kind == 'diameter':
                dso = self.msp.add_diameter_dim(center=center, mpoint=mpoint,
                                                dimstyle=style, override=ov, dxfattribs=dxf)
            elif kind == 'radius':
                dso = self.msp.add_radius_dim(center=center, mpoint=mpoint,
                                              dimstyle=style, override=ov, dxfattribs=dxf)
            else:
                return False
            dso.render()
            return True
        except Exception:
            return False
```

- [ ] **Step 4: 實作 hit_test 的 DIMENSION 分支**

在 `_entity_distance`（`dxf_editor.py:319-367`）的 `elif dxf_type == 'TEXT':`（line 343）之前插入：

```python
            elif dxf_type == 'DIMENSION':
                best = None
                try:
                    blk = self.doc.blocks.get(e.dxf.geometry)
                    for sub in blk:
                        if sub.dxftype() == 'LINE':
                            d = self._point_to_segment_dist(
                                px, py, sub.dxf.start.x, sub.dxf.start.y,
                                sub.dxf.end.x, sub.dxf.end.y)
                            if best is None or d < best:
                                best = d
                except Exception:
                    pass
                try:
                    p2 = e.dxf.defpoint2
                    p3 = e.dxf.defpoint3
                    d = self._point_to_segment_dist(px, py, p2.x, p2.y, p3.x, p3.y)
                    if best is None or d < best:
                        best = d
                except Exception:
                    pass
                return best
```

- [ ] **Step 5: 實作 move_entities 阻擋尺寸**

將 `move_entities`（`dxf_editor.py:181-206`）開頭（`self._push_undo()` 之後）改為先過濾：

```python
    def move_entities(self, entities, dx, dy):
        if not entities:
            return False
        movable = [e for e in entities if e.dxftype() != 'DIMENSION']
        if not movable:
            return False
        self._push_undo()
        for e in movable:
            try:
                dxf_type = e.dxftype()
                if dxf_type == 'LINE':
                    e.dxf.start = (e.dxf.start.x + dx, e.dxf.start.y + dy)
                    e.dxf.end = (e.dxf.end.x + dx, e.dxf.end.y + dy)
                elif dxf_type == 'CIRCLE':
                    e.dxf.center = (e.dxf.center.x + dx, e.dxf.center.y + dy)
                elif dxf_type == 'ARC':
                    e.dxf.center = (e.dxf.center.x + dx, e.dxf.center.y + dy)
                elif dxf_type == 'TEXT':
                    e.dxf.insert = (e.dxf.insert.x + dx, e.dxf.insert.y + dy)
                elif dxf_type == 'MTEXT':
                    e.dxf.insert = (e.dxf.insert.x + dx, e.dxf.insert.y + dy)
                elif dxf_type in ('LWPOLYLINE', 'POLYLINE'):
                    for pt in e.get_points('xy'):
                        pass
                elif dxf_type == 'ELLIPSE':
                    e.dxf.center = (e.dxf.center.x + dx, e.dxf.center.y + dy)
            except Exception:
                pass
        return True
```

- [ ] **Step 6: 執行確認通過**

Run: `C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe cad_editor_test.py`
Expected: `DIMENSION TESTS OK` 且原有 SAVE ROUNDTRIP / undo / redo / dimensions preserved 全部 PASS。

- [ ] **Step 7: 本機驗證 checkpoint（不 commit）**

`py_compile dxf_editor.py` 通過；`cad_editor_test.py` 全 PASS。

---
### Task 3: 畫布渲染既有與新增尺寸

**Files:**
- Modify: `C:\Users\TW-10\Documents\firebase雲端資料夾\DXF零件拆解\main.py`（`_draw_canvas_entity` 加入 DIMENSION 分支；`render_canvas` 重置 dim 狀態）
- Test: `C:\Users\TW-10\AppData\Local\Temp\opencode\cad_smoke_test.py`

**Interfaces:**
- Consumes: Task 1 的 `ent['geometry']`/`ent['text']`；Task 2 無。
- Produces: `_draw_canvas_dimension(ent)`、`_draw_dim_arrow(insert_ent, color, tags)`。

- [ ] **Step 1: 在 smoke test 加入渲染斷言**

在 `cad_smoke_test.py` 第 37 行 `check("canvas has items", ...)` 之後新增：

```python
dim_entities = [d for d in app.entity_list if d.get('type') == 'DIMENSION']
dim_rendered = all(len(app.canvas.find_withtag(f"ent_{d['id']}")) > 0 for d in dim_entities)
check("existing dims rendered on canvas", dim_rendered,
      f"dims={len(dim_entities)}")
```

（`_draw_canvas_dimension` 對每個尺寸使用 `tags=('ent', 'ent_{id}', 'layer_{layer}')`，所以 `find_withtag('ent_{handle}')` 能確認該尺寸有被畫出來。）

- [ ] **Step 2: 執行確認失敗**

Run: `C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe cad_smoke_test.py`
Expected: `[FAIL] existing dims rendered on canvas`（目前 DIMENSION 沒有繪製分支）

- [ ] **Step 3: 實作 _draw_canvas_dimension 與 _draw_dim_arrow**

在 `_draw_canvas_entity`（`main.py:355`）的 `elif etype in ('TEXT', 'MTEXT'):` 區塊之後、`except Exception:` 之前插入：

```python
            elif etype == 'DIMENSION':
                self._draw_canvas_dimension(ent, color, tags)
```

在 `_draw_canvas_entity` 之後新增兩個方法：

```python
    def _draw_canvas_dimension(self, ent, color, tags):
        geo_name = ent.get('geometry')
        try:
            blk = self.editor.doc.blocks.get(geo_name)
        except Exception:
            blk = None
        if blk is not None:
            for sub in blk:
                try:
                    if sub.dxftype() == 'LINE':
                        s, e = sub.dxf.start, sub.dxf.end
                        sx, sy = self.world_to_screen(s.x, s.y)
                        ex, ey = self.world_to_screen(e.x, e.y)
                        self.canvas.create_line(sx, sy, ex, ey, fill=color, width=1, tags=tags)
                    elif sub.dxftype() == 'INSERT':
                        self._draw_dim_arrow(sub, color, tags)
                    elif sub.dxftype() == 'MTEXT':
                        ins = sub.dxf.insert
                        sx, sy = self.world_to_screen(ins.x, ins.y)
                        try:
                            text = sub.plain_text()
                        except Exception:
                            text = ent.get('text') or ''
                        self.canvas.create_text(sx, sy, text=text, fill=color,
                                                font=('', 11), tags=tags)
                except Exception:
                    continue
            return
        pts = ent.get('points') or []
        if len(pts) >= 2:
            sx1, sy1 = self.world_to_screen(*pts[0])
            sx2, sy2 = self.world_to_screen(*pts[1])
            self.canvas.create_line(sx1, sy1, sx2, sy2, fill=color, width=1, tags=tags)
        text = ent.get('text')
        if text:
            sx, sy = self.world_to_screen(*(ent.get('center') or pts[0] or (0, 0)))
            self.canvas.create_text(sx, sy, text=text, fill=color, font=('', 11), tags=tags)

    def _draw_dim_arrow(self, insert_ent, color, tags):
        try:
            name = insert_ent.dxf.name
            rot = math.radians(getattr(insert_ent.dxf, 'rotation', 0))
            ins_x = insert_ent.dxf.insert.x
            ins_y = insert_ent.dxf.insert.y
            xs = float(getattr(insert_ent.dxf, 'xscale', 1) or 1)
            ys = float(getattr(insert_ent.dxf, 'yscale', 1) or 1)
            blk = self.editor.doc.blocks.get(name)
            pts = []
            for sub in blk:
                if sub.dxftype() == 'LINE':
                    pts.append((sub.dxf.start.x, sub.dxf.start.y))
                    pts.append((sub.dxf.end.x, sub.dxf.end.y))
                elif sub.dxftype() == 'LWPOLYLINE':
                    pts.extend(sub.get_points('xy'))
                elif sub.dxftype() == 'SOLID':
                    pts = [(sub.dxf.vtx0.x, sub.dxf.vtx0.y),
                           (sub.dxf.vtx1.x, sub.dxf.vtx1.y),
                           (sub.dxf.vtx2.x, sub.dxf.vtx2.y)]
            if not pts:
                return
            cosr, sinr = math.cos(rot), math.sin(rot)

            def transform(p):
                x, y = p
                return (ins_x + x * xs * cosr - y * ys * sinr,
                        ins_y + x * xs * sinr + y * ys * cosr)

            coords = []
            for p in pts:
                sx, sy = self.world_to_screen(*transform(p))
                coords.append(sx)
                coords.append(sy)
            self.canvas.create_line(*coords, fill=color, width=1, tags=tags)
        except Exception:
            pass
```

- [ ] **Step 4: render_canvas 重置 dim 狀態並在 zoom 後重畫錨點**

在 `render_canvas`（`main.py:335-353`）開頭（`self.part_highlight_item = None` 之後）加入：

```python
        self.dim_preview_items = []
        self.dim_anchor_item = None
```

並在 `if self.selected_entity: self._draw_entity_highlight()` 之前（`render_canvas` 結尾附近）加入：

```python
        if getattr(self, 'dim_points', None):
            sx, sy = self.world_to_screen(*self.dim_points[0])
            self.dim_anchor_item = self.canvas.create_oval(
                sx - 5, sy - 5, sx + 5, sy + 5, outline='#FF0000', width=2)
```

- [ ] **Step 5: 執行確認通過**

Run: `C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe cad_smoke_test.py`
Expected: `[PASS] existing dims rendered on canvas` 且原有全部 PASS。

- [ ] **Step 6: 本機驗證 checkpoint（不 commit）**

`py_compile main.py` 通過；smoke test 全 PASS。

---
### Task 4: 尺寸工具 UI 與互動

**Files:**
- Modify: `C:\Users\TW-10\Documents\firebase雲端資料夾\DXF零件拆解\main.py`（`__init__` 狀態、`_build_edit_toolbar`、`set_edit_mode`、`_on_canvas_motion`、`_on_canvas_click`、新方法）
- Test: `C:\Users\TW-10\AppData\Local\Temp\opencode\cad_smoke_test.py`

**Interfaces:**
- Consumes: Task 2 的 `add_dimension(...)`；Task 3 的渲染。
- Produces: 模組常數 `DIM_LINEAR_MODES`、`DIM_RADIAL_MODES`；方法 `_clear_dim_anchor`、`_clear_dim_preview`、`_update_dim_preview`、`_pick_circle_under`、`_commit_dim`。

- [ ] **Step 1: 在 smoke test 加入互動測試**

在 `cad_smoke_test.py` 第 7 節（`redo re-adds line`）之後新增：

```python
# 7c. dimension tools - linear via 3 clicks
n_dims_before = sum(1 for e in app.editor.msp.query('DIMENSION'))
app.edit_mode = 'dim_linear'
a, b = (0, 0), (10, 0)
app._on_canvas_click(Ev(*app.world_to_screen(*a)))
app._on_canvas_click(Ev(*app.world_to_screen(*b)))
app._on_canvas_click(Ev(*app.world_to_screen(5, -5)))
root.update()
n_dims_after = sum(1 for e in app.editor.msp.query('DIMENSION'))
check("linear dim added", n_dims_after == n_dims_before + 1,
      f"before={n_dims_before} after={n_dims_after}")
check("dim points reset", app.dim_points == [])

# 7d. diameter via 2 clicks on a circle
from snap_helper import get_snap_points
circ = next(e for e in app.entity_list if e['type'] == 'CIRCLE')
cx, cy = circ['center']
app.edit_mode = 'dim_diameter'
app._on_canvas_click(Ev(*app.world_to_screen(cx + circ['radius'], cy)))
app._on_canvas_click(Ev(*app.world_to_screen(cx + circ['radius'] + 5, cy + 5)))
root.update()
n_dims_after2 = sum(1 for e in app.editor.msp.query('DIMENSION'))
check("diameter dim added", n_dims_after2 == n_dims_before + 2, f"after={n_dims_after2}")

# 7e. delete a dimension via hit_test + delete
dims_now = list(app.editor.msp.query('DIMENSION'))
app.edit_mode = 'delete'
sx, sy = app.world_to_screen(*b[0] if isinstance(b, tuple) else b)
# click near a dim line to delete the linear dim added above
dl = [d for d in dims_now if d.dxf.dimtype & 7 == 0][-1]
wx, wy = (dl.dxf.defpoint2.x + dl.dxf.defpoint3.x) / 2, (dl.dxf.defpoint2.y + dl.dxf.defpoint3.y) / 2
app._on_canvas_click(Ev(*app.world_to_screen(wx, wy - 5)))
root.update()
check("dim deleted via delete tool",
      sum(1 for e in app.editor.msp.query('DIMENSION')) == n_dims_after2 - 1)
```

- [ ] **Step 2: 執行確認失敗**

Run: `C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe cad_smoke_test.py`
Expected: `[FAIL] linear dim added`（dim_linear 尚未處理）

- [ ] **Step 3: 新增模組常數與 __init__ 狀態**

在 `main.py` 頂部（import 區之後）加入：

```python
DIM_LINEAR_MODES = ('dim_linear', 'dim_horizontal', 'dim_vertical')
DIM_RADIAL_MODES = ('dim_diameter', 'dim_radius')
```

在 `__init__`（`self.draw_anchor_item = None` 附近，約 line 46）加入：

```python
        self.dim_points = []
        self.dim_radius = 0.0
        self.dim_anchor_item = None
        self.dim_preview_items = []
```

- [ ] **Step 4: 工具列新增 5 個按鈕**

將 `_build_edit_toolbar`（`main.py:126-129`）的 `tools` list 改為：

```python
        tools = [
            ('select', '選取'), ('line', '直線'), ('rect', '矩形'),
            ('circle', '圓形'), ('text', '文字'), ('delete', '刪除'),
            ('dim_linear', '線性'), ('dim_horizontal', '水平'), ('dim_vertical', '垂直'),
            ('dim_diameter', '直徑'), ('dim_radius', '半徑'),
        ]
```

- [ ] **Step 5: set_edit_mode 重置尺寸狀態 + cursor**

在 `set_edit_mode`（`main.py:167-184`）的 `self._clear_anchor_marker()` 之後加入：

```python
        self.dim_points = []
        self.dim_radius = 0.0
        self._clear_dim_preview()
        self._clear_dim_anchor()
```

並將 cursor dict（line 182-183）改為：

```python
        cursors = {'select': 'arrow', 'line': 'crosshair', 'rect': 'crosshair',
                   'circle': 'crosshair', 'text': 'xterm', 'delete': 'X_cursor',
                   'dim_linear': 'crosshair', 'dim_horizontal': 'crosshair',
                   'dim_vertical': 'crosshair', 'dim_diameter': 'crosshair',
                   'dim_radius': 'crosshair'}
```

- [ ] **Step 6: 實作尺寸互動方法**

在 `_clear_anchor_marker`（約 line 704）之後插入：

```python
    def _clear_dim_anchor(self):
        if self.dim_anchor_item is not None:
            self.canvas.delete(self.dim_anchor_item)
            self.dim_anchor_item = None

    def _clear_dim_preview(self):
        for item_id in self.dim_preview_items:
            self.canvas.delete(item_id)
        self.dim_preview_items = []

    def _pick_circle_under(self, event):
        dx, dy = self._canvas_to_dxf(event.x, event.y)
        tol = 8.0 / self._view_scale
        best = None
        best_d = tol
        hidden = self.editor.hidden_layers
        for ent in self.entity_list:
            if ent.get('type') != 'CIRCLE' or ent.get('layer') in hidden:
                continue
            cx, cy = ent['center']
            r = ent['radius']
            d = abs(math.hypot(dx - cx, dy - cy) - r)
            if d < best_d:
                best_d = d
                best = ent
        if best is None:
            return None
        cx, cy = best['center']
        r = best['radius']
        ang = math.atan2(dy - cy, dx - cx)
        return {'center': (cx, cy), 'radius': r,
                'point': (cx + r * math.cos(ang), cy + r * math.sin(ang))}

    def _update_dim_preview(self, event):
        self._update_snap_at(event.x, event.y)
        self._clear_dim_preview()
        color = 'red'
        if self.edit_mode in DIM_LINEAR_MODES:
            if len(self.dim_points) == 1:
                a = self.dim_points[0]
                sx, sy = self.world_to_screen(*a)
                ex, ey = self.current_snap_screen if self.current_snap_screen else (event.x, event.y)
                self.dim_preview_items.append(
                    self.canvas.create_line(sx, sy, ex, ey, fill=color, width=2, dash=(4, 4)))
            elif len(self.dim_points) == 2:
                p1, p2 = self.dim_points
                v = round(math.hypot(p2[0] - p1[0], p2[1] - p1[1]), 2)
                if self.edit_mode == 'dim_horizontal':
                    v = round(abs(p2[0] - p1[0]), 2)
                elif self.edit_mode == 'dim_vertical':
                    v = round(abs(p2[1] - p1[1]), 2)
                sx1, sy1 = self.world_to_screen(*p1)
                sx2, sy2 = self.world_to_screen(*p2)
                ex, ey = self.current_snap_screen if self.current_snap_screen else (event.x, event.y)
                self.dim_preview_items.append(
                    self.canvas.create_line(sx1, sy1, sx2, sy2, fill=color, width=1, dash=(2, 2)))
                self.dim_preview_items.append(
                    self.canvas.create_text(ex, ey - 8, text=str(v), fill=color, font=('', 11)))
        elif self.edit_mode in DIM_RADIAL_MODES:
            if self.dim_points:
                cx, cy = self.dim_points[0]
                sx, sy = self.world_to_screen(cx, cy)
                ex, ey = self.current_snap_screen if self.current_snap_screen else (event.x, event.y)
                self.dim_preview_items.append(
                    self.canvas.create_line(sx, sy, ex, ey, fill=color, width=1, dash=(2, 2)))
                prefix = 'Ø' if self.edit_mode == 'dim_diameter' else 'R'
                v = round(self.dim_radius * (2 if self.edit_mode == 'dim_diameter' else 1), 2)
                self.dim_preview_items.append(
                    self.canvas.create_text(ex, ey - 8, text=f'{prefix}{v}', fill=color, font=('', 11)))

    def _commit_dim(self, loc):
        kind = self.edit_mode.replace('dim_', '')
        h = self.line_width_var.get() * 1.2
        a = self.line_width_var.get()
        if self.edit_mode in DIM_LINEAR_MODES:
            p1, p2 = self.dim_points[0], self.dim_points[1]
            if kind == 'linear':
                dx = p2[0] - p1[0]
                dy = p2[1] - p1[1]
                L = math.hypot(dx, dy)
                if L < 1e-9:
                    self.dim_points = []
                    return
                dist = (dx * (loc[1] - p1[1]) - dy * (loc[0] - p1[0])) / L
                ok = self.editor.add_dimension(kind, p1=p1, p2=p2, distance=dist,
                                               text_height=h, arrow_size=a)
            else:
                ok = self.editor.add_dimension(kind, p1=p1, p2=p2, location=loc,
                                               text_height=h, arrow_size=a)
        else:
            cx, cy = self.dim_points[0]
            ang = math.atan2(loc[1] - cy, loc[0] - cx)
            mpt = (cx + self.dim_radius * math.cos(ang),
                   cy + self.dim_radius * math.sin(ang))
            ok = self.editor.add_dimension(kind, center=(cx, cy), mpoint=mpt,
                                           text_height=h, arrow_size=a)
        self.dim_points = []
        self.dim_radius = 0.0
        self._clear_dim_preview()
        self._clear_dim_anchor()
        self._refresh_after_edit()
        self.status_label.config(
            text='已新增尺寸' if ok else '尺寸建立失敗', foreground='green' if ok else 'red')
```

- [ ] **Step 7: 接通 _on_canvas_motion 與 _on_canvas_click**

將 `_on_canvas_motion`（`main.py:560-571`）改為：

```python
    def _on_canvas_motion(self, event):
        if not self.editor or not self.parsed_data:
            return
        if self._panning:
            return
        if self.edit_mode in ('line', 'rect', 'circle'):
            if self.draw_start is not None:
                self._update_draw_preview(event)
            else:
                self._update_snap_at(event.x, event.y)
        elif self.edit_mode in DIM_LINEAR_MODES or self.edit_mode in DIM_RADIAL_MODES:
            self._update_dim_preview(event)
        else:
            self._update_snap_at(event.x, event.y)
```

在 `_on_canvas_click`（`main.py:591-658`）的 `elif self.edit_mode in ('line', 'rect', 'circle'):` 分支之前插入：

```python
        elif self.edit_mode in DIM_LINEAR_MODES:
            if len(self.dim_points) < 2:
                pt = self._get_snapped_dxf(event)
                self.dim_points.append(pt)
                self._clear_dim_anchor()
                sx, sy = self.world_to_screen(*pt)
                self.dim_anchor_item = self.canvas.create_oval(
                    sx - 5, sy - 5, sx + 5, sy + 5, outline='#FF0000', width=2)
                self._update_dim_preview(event)
                if len(self.dim_points) == 2:
                    self.status_label.config(text='移動滑鼠選定尺寸線位置，再點一下', foreground='blue')
                else:
                    self.status_label.config(text='點第二個點', foreground='blue')
            else:
                loc = self._get_snapped_dxf(event)
                self._commit_dim(loc)
        elif self.edit_mode in DIM_RADIAL_MODES:
            if not self.dim_points:
                hit = self._pick_circle_under(event)
                if hit is None:
                    self.status_label.config(text='請點到圓形', foreground='orange')
                    return
                self.dim_points.append(hit['center'])
                self.dim_radius = hit['radius']
                self._clear_dim_anchor()
                sx, sy = self.world_to_screen(*hit['center'])
                self.dim_anchor_item = self.canvas.create_oval(
                    sx - 5, sy - 5, sx + 5, sy + 5, outline='#FF0000', width=2)
                self._update_dim_preview(event)
                self.status_label.config(text='移動滑鼠決定引線方向，再點一下', foreground='blue')
            else:
                self._commit_dim(self._get_snapped_dxf(event))
```

注意：`DIM_LINEAR_MODES`/`DIM_RADIAL_MODES` 分支必須放在 `elif self.edit_mode == 'text':` 之後、`elif self.edit_mode in ('line', 'rect', 'circle'):` 之前，確保不與既有工具衝突。

- [ ] **Step 8: 執行確認通過**

Run: `C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe cad_smoke_test.py`
Expected: `[PASS] linear dim added`、`[PASS] diameter dim added`、`[PASS] dim deleted via delete tool` 且原有全部 PASS。

- [ ] **Step 9: 本機驗證 checkpoint（不 commit）**

`py_compile main.py` 通過；smoke test 全 PASS；`cad_editor_test.py` 仍全 PASS。

---
### Task 5: 整合驗證與重建 exe

**Files:**
- Run: 全部既有測試 + 重建 exe

**Interfaces:**
- Consumes: Task 1-4 全部。

- [ ] **Step 1: 執行全部測試**

Run（workdir = `C:\Users\TW-10\AppData\Local\Temp\opencode`）：
`C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe cad_smoke_test.py`
`C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe cad_editor_test.py`
Expected: 兩者全 PASS。

- [ ] **Step 2: 手動載入 sample.dxf 確認 8 個既有尺寸顯示、可選取、可刪除、undo/redo 正常**

Run：`cd DXF零件拆解 && .\..\.venv\Scripts\python.exe main.py`
Expected：載入 sample.dxf 後畫布看到尺寸線與數值；選取模式可點到尺寸；刪除尺寸後 undo 可恢復。

- [ ] **Step 3: 重建 exe**

先結束執行中的 exe：
```powershell
Get-Process | Where-Object { $_.ProcessName -like "*CAD*" } | Stop-Process -Force -ErrorAction SilentlyContinue
```
再重建（workdir = `DXF零件拆解`）：
```powershell
C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe -m PyInstaller --onefile --windowed --name "CAD零件拆解系統" --hidden-import matplotlib --hidden-import matplotlib.backends.backend_agg --hidden-import ezdxf --hidden-import openpyxl --hidden-import PIL --hidden-import PIL._tkinter_finder --hidden-import PIL.ImageDraw --collect-all matplotlib --collect-all ezdxf main.py
```
Expected: `Build complete!`

- [ ] **Step 4: 啟動 exe 確認存活**

```powershell
Start-Process -FilePath "C:\Users\TW-10\Documents\firebase雲端資料夾\DXF零件拆解\dist\CAD零件拆解系統.exe"
Start-Sleep -Seconds 8
Get-Process | Where-Object { $_.ProcessName -like "*CAD*" }
```
Expected: 有 PID 且 8 秒後仍存活。結束後清理：
```powershell
Get-Process | Where-Object { $_.ProcessName -like "*CAD*" } | Stop-Process -Force -ErrorAction SilentlyContinue
```

- [ ] **Step 5: 本機驗證 checkpoint（不 commit / 不上傳）**

全部測試 PASS、exe 可啟動。向使用者回報「已完成，未上傳（依指示）」。
