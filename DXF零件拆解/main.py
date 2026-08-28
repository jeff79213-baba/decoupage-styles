import os
import sys
import math
import traceback
import tkinter as tk
from tkinter import ttk, filedialog, messagebox, simpledialog, colorchooser
import threading

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dxf_parser import parse_dxf, _render_entities_pillow, build_entity_list
from dxf_editor import DXFEditor
from part_analyzer import analyze
from report_generator import generate_excel
from snap_helper import (get_snap_points, get_intersection_points, find_nearest_snap,
                         SNAP_ENDPOINT, SNAP_MIDPOINT, SNAP_INTERSECTION)
from settings import load_settings, save_settings, DEFAULT_SETTINGS


def _resource_path(rel):
    base = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, rel)

LAYER_COLOR_HEX = {
    0: '#FFFFFF', 1: '#FF0000', 2: '#FFFF00', 3: '#00FF00',
    4: '#00FFFF', 5: '#0000FF', 6: '#FF00FF', 7: '#FFFFFF',
    8: '#808080', 9: '#C0C0C0', 10: '#FF0000', 11: '#FF7F7F',
    12: '#FF4500', 13: '#FF1493', 14: '#9400D3', 15: '#00CED1',
}

DRAW_COLOR_HEX = dict(LAYER_COLOR_HEX)
DRAW_COLOR_HEX[7] = '#000000'

DIM_LINEAR_MODES = ('dim_linear', 'dim_horizontal', 'dim_vertical')
DIM_RADIAL_MODES = ('dim_diameter', 'dim_radius')

DIM_MENU_ITEMS = [
    ('↔ 線性', 'dim_linear', '點 3 下：起點 → 終點 → 尺寸線位置'),
    ('↔ 水平', 'dim_horizontal', '點 3 下：左點 → 右點 → 尺寸線位置（水平）'),
    ('↕ 垂直', 'dim_vertical', '點 3 下：下點 → 上點 → 尺寸線位置（垂直）'),
    ('Ø 直徑', 'dim_diameter', '點 2 下：圓周一點 → 引線方向'),
    ('R 半徑', 'dim_radius', '點 2 下：圓周一點 → 引線方向'),
]

class CADPartsApp:
    def __init__(self, root):
        self.root = root
        self.root.title('DXF 圖檔零件拆解系統')
        try:
            self.root.iconbitmap(_resource_path('icon.ico'))
        except Exception:
            pass
        self.root.geometry('1400x900')
        self.root.minsize(1000, 650)
        self.current_file = None
        self.parsed_data = None
        self.analysis_result = None
        self.preview_pil_image = None
        self.selected_part_id = None
        self.part_bounds_map = {}
        self.editor = None
        self.edit_mode = 'select'
        self.draw_start = None
        self.draw_start_dxf = None
        self.draw_preview_items = []
        self.draw_anchor_item = None
        self.dim_points = []
        self.dim_radius = 0.0
        self.dim_anchor_item = None
        self.dim_preview_items = []
        self.line_undo_mark = None
        self.dim_menubtn = None
        self.dim_menu = None
        self.dim_tooltip = None
        self.selected_entity = None
        self.selected_entity_highlight = None
        self.drag_start = None
        self._render_bbox = None
        self._pan_x = 0.0
        self._pan_y = 0.0
        self._view_scale = 1.0
        self.entity_list = []
        self.snap_points = []
        self.snap_marker_item = None
        self.current_snap_point = None
        self.current_snap_screen = None
        self.part_highlight_item = None
        self._panning = False
        self._pan_last = None
        self.settings = load_settings()
        self._settings_win = None
        try:
            self.setup_ui()
        except Exception as e:
            messagebox.showerror('初始化失敗', f'{str(e)}\n\n{traceback.format_exc()}')
            raise

    def setup_ui(self):
        self.toolbar = ttk.Frame(self.root, padding=3)
        self.toolbar.pack(fill=tk.X)
        self._build_main_toolbar()
        self.edit_toolbar = ttk.Frame(self.root, padding=3)
        self.edit_toolbar.pack(fill=tk.X)
        self._build_edit_toolbar()
        paned = ttk.PanedWindow(self.root, orient=tk.VERTICAL)
        paned.pack(fill=tk.BOTH, expand=True, padx=8, pady=(0, 8))
        canvas_frame = ttk.LabelFrame(paned, text='圖面預覽', padding=3)
        paned.add(canvas_frame, weight=3)
        self.canvas = tk.Canvas(canvas_frame, bg=self.settings['bg_color'], highlightthickness=0, cursor='crosshair')
        self.canvas.pack(fill=tk.BOTH, expand=True)
        self.canvas.create_text(10, 10, anchor='nw', text='請選取 DXF 檔案以顯示預覽', fill='gray', font=('', 11))
        self.canvas.bind('<Configure>', self._on_canvas_resize)
        self.canvas.bind('<Button-1>', self._on_canvas_click)
        self.canvas.bind('<B1-Motion>', self._on_canvas_drag)
        self.canvas.bind('<ButtonRelease-1>', self._on_canvas_release)
        self.canvas.bind('<Button-3>', self._on_canvas_right_click)
        self.canvas.bind('<Motion>', self._on_canvas_motion)
        self.canvas.bind('<MouseWheel>', self._on_mousewheel)
        self.canvas.bind('<Button-2>', self._on_pan_start)
        self.canvas.bind('<B2-Motion>', self._on_pan_move)
        self.canvas.bind('<ButtonRelease-2>', self._on_pan_end)
        self.canvas.bind('<Escape>', self._on_escape)
        self.root.bind('<Control-z>', lambda e: self.do_undo())
        self.root.bind('<Control-y>', lambda e: self.do_redo())
        self.root.bind('<Delete>', lambda e: self.do_delete_selected())
        bottom_frame = ttk.Frame(paned)
        paned.add(bottom_frame, weight=1)
        self.notebook = ttk.Notebook(bottom_frame)
        self.notebook.pack(fill=tk.BOTH, expand=True)
        self.parts_frame = ttk.Frame(self.notebook)
        self.notebook.add(self.parts_frame, text='零件材料清單')
        self.issues_frame = ttk.Frame(self.notebook)
        self.notebook.add(self.issues_frame, text='問題清單')
        self.export_frame = ttk.Frame(self.notebook)
        self.notebook.add(self.export_frame, text='匯出報表')
        self.setup_parts_tab()
        self.setup_issues_tab()
        self.setup_export_tab()
        self.set_edit_mode('select')

    def _build_main_toolbar(self):
        ttk.Button(self.toolbar, text='選取 DXF', command=self.select_file).pack(side=tk.LEFT, padx=2)
        ttk.Separator(self.toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=4)
        self.file_label = ttk.Label(self.toolbar, text='尚未選擇檔案')
        self.file_label.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=4)
        ttk.Button(self.toolbar, text='儲存', command=self.do_save).pack(side=tk.RIGHT, padx=2)
        ttk.Button(self.toolbar, text='另存新檔', command=self.do_save_as).pack(side=tk.RIGHT, padx=2)
        ttk.Separator(self.toolbar, orient=tk.VERTICAL).pack(side=tk.RIGHT, fill=tk.Y, padx=4)
        ttk.Button(self.toolbar, text='設定', command=self.open_settings).pack(side=tk.RIGHT, padx=2)
        ttk.Button(self.toolbar, text='匯出 Excel', command=self.export_excel).pack(side=tk.RIGHT, padx=2)
        ttk.Button(self.toolbar, text='匯出圖片', command=self.export_preview_image).pack(side=tk.RIGHT, padx=2)
        self.status_label = ttk.Label(self.toolbar, text='就緒', foreground='gray')
        self.status_label.pack(side=tk.RIGHT, padx=(8, 0))

    def _build_edit_toolbar(self):
        self.edit_buttons = {}
        tools = [
            ('select', '選取'), ('line', '直線'), ('rect', '矩形'),
            ('circle', '圓形'), ('text', '文字'), ('delete', '刪除'),
        ]
        for tool_id, label in tools:
            btn = ttk.Button(self.edit_toolbar, text=label, width=6,
                             command=lambda t=tool_id: self.set_edit_mode(t))
            btn.pack(side=tk.LEFT, padx=1)
            self.edit_buttons[tool_id] = btn

        self.dim_menubtn = ttk.Menubutton(self.edit_toolbar, text='量尺寸 ▾')
        self.dim_menubtn.pack(side=tk.LEFT, padx=1)
        self.dim_menu = tk.Menu(self.dim_menubtn, tearoff=0)
        self.dim_menubtn.config(menu=self.dim_menu)
        for label, mode, hint in DIM_MENU_ITEMS:
            self.dim_menu.add_command(label=label, command=lambda m=mode: self.set_edit_mode(m))
        self.dim_menu.bind('<<MenuSelect>>', self._on_dim_menu_select)
        self.dim_menu.bind('<<MenuUnpost>>', self._on_dim_menu_unpost)
        ttk.Separator(self.edit_toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=4)
        tk.Button(self.edit_toolbar, text='↺', font=('Segoe UI Symbol', 12), width=3,
                  command=self.do_undo, relief=tk.RAISED).pack(side=tk.LEFT, padx=1)
        tk.Button(self.edit_toolbar, text='↻', font=('Segoe UI Symbol', 12), width=3,
                  command=self.do_redo, relief=tk.RAISED).pack(side=tk.LEFT, padx=1)
        ttk.Separator(self.edit_toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=4)
        ttk.Label(self.edit_toolbar, text='圖層:').pack(side=tk.LEFT, padx=(4, 2))
        self.layer_var = tk.StringVar(value='0')
        self.layer_combo = ttk.Combobox(self.edit_toolbar, textvariable=self.layer_var,
                                         values=['0'], width=12, state='readonly')
        self.layer_combo.pack(side=tk.LEFT, padx=2)
        self.layer_combo.bind('<<ComboboxSelected>>', self._on_layer_change)
        ttk.Button(self.edit_toolbar, text='+', width=2, command=self.do_add_layer).pack(side=tk.LEFT, padx=1)
        ttk.Button(self.edit_toolbar, text='-', width=2, command=self.do_delete_layer).pack(side=tk.LEFT, padx=1)
        ttk.Button(self.edit_toolbar, text='改名', width=4, command=self.do_rename_layer).pack(side=tk.LEFT, padx=1)
        self.layer_color_btn = tk.Button(self.edit_toolbar, text='■', width=2, bg='#FFFFFF',
                                          command=self.do_change_layer_color, relief=tk.RAISED)
        self.layer_color_btn.pack(side=tk.LEFT, padx=1)
        self.layer_hide_var = tk.BooleanVar(value=False)
        ttk.Checkbutton(self.edit_toolbar, text='顯示', variable=self.layer_hide_var,
                         command=self.do_toggle_layer_visibility).pack(side=tk.LEFT, padx=2)
        self.layer_lock_var = tk.BooleanVar(value=False)
        ttk.Checkbutton(self.edit_toolbar, text='鎖定', variable=self.layer_lock_var,
                         command=self.do_toggle_layer_lock).pack(side=tk.LEFT, padx=2)
        ttk.Separator(self.edit_toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=4)
        ttk.Label(self.edit_toolbar, text='線寬:').pack(side=tk.LEFT, padx=(4, 2))
        self.line_width_var = tk.IntVar(value=self.settings['line_width'])
        ttk.Spinbox(self.edit_toolbar, from_=1, to=10, width=3, textvariable=self.line_width_var).pack(side=tk.LEFT, padx=2)
        ttk.Separator(self.edit_toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=4)
        ttk.Button(self.edit_toolbar, text='適配視窗', width=8, command=self._fit_view).pack(side=tk.LEFT, padx=2)
        ttk.Label(self.edit_toolbar, text='滾輪縮放 / 中鍵平移 / 黃色鎖點', foreground='gray').pack(side=tk.LEFT, padx=(6, 2))

    def set_edit_mode(self, mode):
        self.edit_mode = mode
        self.line_undo_mark = None
        self.draw_start = None
        self.draw_start_dxf = None
        self._clear_draw_preview()
        self._clear_anchor_marker()
        self.dim_points = []
        self.dim_radius = 0.0
        self._clear_dim_preview()
        self._clear_dim_anchor()
        self.selected_entity = None
        self._clear_entity_highlight()
        self._clear_snap_marker()
        self.current_snap_point = None
        self.current_snap_screen = None
        for tid, btn in self.edit_buttons.items():
            btn.state(['!pressed'])
        if mode in self.edit_buttons:
            self.edit_buttons[mode].state(['pressed'])
        if self.dim_menubtn is not None:
            if mode.startswith('dim_'):
                label = next(l for l, m, _ in DIM_MENU_ITEMS if m == mode)
                self.dim_menubtn.config(text=f'量尺寸 ▾ · {label}')
            else:
                self.dim_menubtn.config(text='量尺寸 ▾')
        cursors = {'select': 'arrow', 'line': 'crosshair', 'rect': 'crosshair',
                   'circle': 'crosshair', 'text': 'xterm', 'delete': 'X_cursor',
                   'dim_linear': 'crosshair', 'dim_horizontal': 'crosshair',
                   'dim_vertical': 'crosshair', 'dim_diameter': 'crosshair',
                   'dim_radius': 'crosshair'}
        self.canvas.configure(cursor=cursors.get(mode, 'crosshair'))
        if mode == 'line' and self.editor is not None:
            self.line_undo_mark = len(self.editor.undo_stack)

    def setup_parts_tab(self):
        cols = ('件號', '圖層', '形狀', '長度', '寬度', '厚度', '標註數', '備註')
        frame = ttk.Frame(self.parts_frame)
        frame.pack(fill=tk.BOTH, expand=True)
        vsb = ttk.Scrollbar(frame, orient=tk.VERTICAL)
        hsb = ttk.Scrollbar(frame, orient=tk.HORIZONTAL)
        self.parts_tree = ttk.Treeview(frame, columns=cols, show='headings',
                                        yscrollcommand=vsb.set, xscrollcommand=hsb.set)
        vsb.config(command=self.parts_tree.yview)
        hsb.config(command=self.parts_tree.xview)
        vsb.pack(side=tk.RIGHT, fill=tk.Y)
        hsb.pack(side=tk.BOTTOM, fill=tk.X)
        self.parts_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        for col in cols:
            self.parts_tree.heading(col, text=col)
            self.parts_tree.column(col, width=100, anchor=tk.CENTER)
        self.parts_tree.column('備註', width=150, anchor=tk.W)
        self.parts_tree.column('件號', width=80)
        self.parts_tree.column('形狀', width=90)
        self.parts_tree.bind('<<TreeviewSelect>>', self._on_part_select)

    def setup_issues_tab(self):
        cols = ('零件編號', '區域', '問題描述', '可能原因')
        frame = ttk.Frame(self.issues_frame)
        frame.pack(fill=tk.BOTH, expand=True)
        vsb = ttk.Scrollbar(frame, orient=tk.VERTICAL)
        hsb = ttk.Scrollbar(frame, orient=tk.HORIZONTAL)
        self.issues_tree = ttk.Treeview(frame, columns=cols, show='headings',
                                         yscrollcommand=vsb.set, xscrollcommand=hsb.set)
        vsb.config(command=self.issues_tree.yview)
        hsb.config(command=self.issues_tree.xview)
        vsb.pack(side=tk.RIGHT, fill=tk.Y)
        hsb.pack(side=tk.BOTTOM, fill=tk.X)
        self.issues_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        for col in cols:
            self.issues_tree.heading(col, text=col)
            self.issues_tree.column(col, width=120, anchor=tk.W)
        self.issues_tree.column('零件編號', width=80, anchor=tk.CENTER)
        self.issues_tree.tag_configure('issue', foreground='red')

    def setup_export_tab(self):
        ttk.Label(self.export_frame, text='匯出選項', font=('', 11, 'bold')).pack(anchor=tk.W, pady=(8, 5))
        self.export_info = ttk.Label(self.export_frame, text='請先載入 DXF 檔案', foreground='gray')
        self.export_info.pack(anchor=tk.W, pady=(0, 5))

    def select_file(self):
        path = filedialog.askopenfilename(
            title='選擇 DXF 檔案',
            filetypes=[('DXF 檔案', '*.dxf'), ('所有檔案', '*.*')])
        if not path:
            return
        self.current_file = path
        self.file_label.config(text=os.path.basename(path))
        self.status_label.config(text='解析中...', foreground='orange')
        self.selected_part_id = None
        self.selected_entity = None
        self._clear_entity_highlight()
        self.root.update_idletasks()
        threading.Thread(target=self.process_file, args=(path,), daemon=True).start()

    def process_file(self, path):
        try:
            self.parsed_data = parse_dxf(path)
            if 'error' in self.parsed_data:
                self.root.after(0, lambda: self.show_error(self.parsed_data['error']))
                return
            self.editor = DXFEditor(path)
            self.root.after(0, self._on_file_loaded)
        except Exception as e:
            self.root.after(0, lambda: self.show_error(f'解析失敗：{str(e)}'))

    def _on_file_loaded(self):
        self._sync_layer_ui()
        self.analysis_result = analyze(self.parsed_data)
        self._render_bbox = self.parsed_data.get('bounding_box')
        self._build_part_bounds_map()
        self.update_parts_table()
        self.update_issues_table()
        self._fit_view()
        self.update_export_info()
        self.status_label.config(text='完成', foreground='green')
        self.set_edit_mode('select')

    def _sync_layer_ui(self):
        if not self.editor:
            return
        layer_names = sorted(self.editor.layers.keys(), key=lambda x: (x != '0', x))
        self.layer_combo['values'] = layer_names
        self.layer_var.set(self.editor.current_layer)
        self._update_layer_color_btn()
        info = self.editor.layers.get(self.editor.current_layer, {})
        self.layer_hide_var.set(info.get('hidden', False))
        self.layer_lock_var.set(info.get('locked', False))

    def _update_layer_color_btn(self):
        if not self.editor:
            return
        info = self.editor.layers.get(self.editor.current_layer, {})
        color_num = info.get('color', 7)
        hex_color = LAYER_COLOR_HEX.get(color_num, '#FFFFFF')
        self.layer_color_btn.configure(bg=hex_color)

    def _build_part_bounds_map(self):
        self.part_bounds_map = {}
        if not self.analysis_result:
            return
        bbox = self.parsed_data.get('bounding_box', {})
        bx_min = bbox.get('xmin', 0)
        by_min = bbox.get('ymin', 0)
        bx_max = bbox.get('xmax', 1)
        by_max = bbox.get('ymax', 1)
        for part in self.analysis_result.get('parts', []):
            pid = part.get('part_id')
            bounds = part.get('bounds')
            if pid and bounds:
                self.part_bounds_map[pid] = {
                    'dx_min': bounds[0], 'dy_min': bounds[1],
                    'dx_max': bounds[2], 'dy_max': bounds[3],
                    'bbox': (bx_min, by_min, bx_max, by_max),
                }

    def update_parts_table(self):
        for item in self.parts_tree.get_children():
            self.parts_tree.delete(item)
        if not self.analysis_result:
            return
        for p in self.analysis_result.get('parts', []):
            vals = (p.get('part_id', ''), p.get('layer', ''), p.get('shape', ''),
                    p.get('length') or '', p.get('width') or '', p.get('thickness') or '',
                    p.get('dimension_count', 0), p.get('note', ''))
            self.parts_tree.insert('', tk.END, values=vals, iid=p.get('part_id', ''))

    def update_issues_table(self):
        for item in self.issues_tree.get_children():
            self.issues_tree.delete(item)
        if not self.analysis_result:
            return
        for iss in self.analysis_result.get('issues', []):
            vals = (iss.get('part_id', ''), iss.get('zone', ''),
                    iss.get('description', ''), iss.get('reason', ''))
            self.issues_tree.insert('', tk.END, values=vals, tags=('issue',))

    def update_preview(self, highlight_part_id=None):
        if highlight_part_id and self.part_bounds_map.get(highlight_part_id):
            self.render_canvas()
            self._highlight_part(highlight_part_id)
            return
        self.render_canvas()

    def render_canvas(self):
        self.canvas.delete('all')
        self._clear_snap_marker()
        self.draw_anchor_item = None
        self.draw_preview_items = []
        self.part_highlight_item = None
        self.dim_preview_items = []
        self.dim_anchor_item = None
        if not self.editor or not self.parsed_data:
            self._show_placeholder('請選取 DXF 檔案以顯示預覽')
            return
        if self.settings.get('grid_enabled', False):
            self._draw_grid()
        self.entity_list = build_entity_list(self.editor.doc)
        hidden = self.editor.hidden_layers
        visible = [ent for ent in self.entity_list if ent.get('layer') not in hidden]
        self.snap_points = get_snap_points(visible) + get_intersection_points(visible)
        for ent in visible:
            self._draw_canvas_entity(ent)
        if self.draw_start is not None and self.draw_start_dxf is not None:
            self._draw_anchor_marker()
        if getattr(self, 'dim_points', None):
            sx, sy = self.world_to_screen(*self.dim_points[0])
            self.dim_anchor_item = self.canvas.create_oval(
                sx - 5, sy - 5, sx + 5, sy + 5, outline='#FF0000', width=2)
        if self.selected_entity:
            self._draw_entity_highlight()

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

    def _draw_canvas_entity(self, ent):
        eid = ent.get('id')
        tags = ('ent', 'ent_{}'.format(eid), 'layer_{}'.format(ent.get('layer')))
        etype = ent.get('type')
        color = self._color_for_entity(ent)
        try:
            if etype in ('LINE', 'XLINE', 'RAY', 'LWPOLYLINE', 'POLYLINE', 'SPLINE'):
                pts = ent.get('points') or []
                if len(pts) < 2:
                    return
                coords = []
                for p in pts:
                    sx, sy = self.world_to_screen(p[0], p[1])
                    coords.append(sx)
                    coords.append(sy)
                self.canvas.create_line(*coords, fill=color, width=self.line_width_var.get(), tags=tags)
            elif etype == 'CIRCLE':
                cx, cy = self.world_to_screen(*ent['center'])
                r = ent['radius'] * self._view_scale
                self.canvas.create_oval(cx - r, cy - r, cx + r, cy + r,
                                        outline=color, width=self.line_width_var.get(), tags=tags)
            elif etype == 'ARC':
                cx, cy = self.world_to_screen(*ent['center'])
                r = ent['radius'] * self._view_scale
                sa = ent['start_angle']
                ea = ent['end_angle']
                if ea < sa:
                    ea += 360
                self.canvas.create_arc(cx - r, cy - r, cx + r, cy + r,
                                       start=-sa, extent=-(ea - sa), style=tk.ARC,
                                       outline=color, width=self.line_width_var.get(), tags=tags)
            elif etype == 'ELLIPSE':
                self._draw_ellipse_approx(ent, color, tags)
            elif etype in ('TEXT', 'MTEXT'):
                sx, sy = self.world_to_screen(*ent['position'])
                h = (ent.get('height') or 2.5) * self._view_scale
                size = min(max(10, int(h)), 96)
                self.canvas.create_text(sx, sy, text=ent.get('text', ''),
                                        fill=color, font=('', size), tags=tags)
            elif etype == 'DIMENSION':
                self._draw_canvas_dimension(ent, color, tags)
        except Exception:
            pass

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
            pos = ent.get('center') or (pts[0] if pts else (0, 0))
            sx, sy = self.world_to_screen(*pos)
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

    def _draw_ellipse_approx(self, ent, color, tags):
        cx, cy = ent['center']
        mx, my = ent.get('major_axis') or (0, 0)
        ratio = ent.get('ratio') or 1.0
        major = math.hypot(mx, my)
        angle = math.atan2(my, mx)
        minor = major * ratio
        coords = []
        for i in range(64):
            t = 2 * math.pi * i / 64.0
            wx = cx + major * math.cos(t) * math.cos(angle) - minor * math.sin(t) * math.sin(angle)
            wy = cy + major * math.cos(t) * math.sin(angle) + minor * math.sin(t) * math.cos(angle)
            sx, sy = self.world_to_screen(wx, wy)
            coords.append(sx)
            coords.append(sy)
        self.canvas.create_line(*coords, fill=color, width=self.line_width_var.get(), tags=tags)

    def _color_for_entity(self, ent):
        layer = ent.get('layer')
        color_num = 7
        if self.editor and layer in self.editor.layers:
            color_num = self.editor.layers[layer].get('color', 7)
        else:
            color_num = ent.get('color', 7)
        return DRAW_COLOR_HEX.get(color_num, '#000000')

    def _show_placeholder(self, text):
        self.preview_pil_image = None
        self.canvas.delete('all')
        cw = max(self.canvas.winfo_width(), 100)
        ch = max(self.canvas.winfo_height(), 100)
        self.canvas.create_text(cw//2, ch//2, text=text, fill='gray', font=('', 14))

    def world_to_screen(self, wx, wy):
        return (wx * self._view_scale + self._pan_x, -wy * self._view_scale + self._pan_y)

    def screen_to_world(self, sx, sy):
        return ((sx - self._pan_x) / self._view_scale, -(sy - self._pan_y) / self._view_scale)

    def _canvas_to_dxf(self, cx, cy):
        return self.screen_to_world(cx, cy)

    def _dxf_to_canvas(self, dx, dy):
        return self.world_to_screen(dx, dy)

    def _set_view(self, scale, pan_x, pan_y):
        self._view_scale = max(scale, 1e-9)
        self._pan_x = pan_x
        self._pan_y = pan_y

    def _fit_view(self):
        if not self.parsed_data:
            return
        bbox = self._render_bbox or self.parsed_data.get('bounding_box', {})
        cw = max(self.canvas.winfo_width(), 100)
        ch = max(self.canvas.winfo_height(), 100)
        xmin = bbox.get('xmin', 0)
        ymin = bbox.get('ymin', 0)
        xmax = bbox.get('xmax', 1000)
        ymax = bbox.get('ymax', 1000)
        span_x = max(xmax - xmin, 1e-6)
        span_y = max(ymax - ymin, 1e-6)
        scale = min((cw - 40) / span_x, (ch - 40) / span_y)
        pan_x = cw / 2.0 - (xmin + xmax) / 2.0 * scale
        pan_y = ch / 2.0 + (ymin + ymax) / 2.0 * scale
        self._set_view(scale, pan_x, pan_y)
        self.render_canvas()

    def _on_mousewheel(self, event):
        if not self.parsed_data or not self.editor:
            return
        factor = 1.1 if event.delta > 0 else 1 / 1.1
        self._zoom_at(event.x, event.y, factor)

    def _zoom_at(self, sx, sy, factor):
        new_scale = max(self._view_scale * factor, 1e-9)
        wx, wy = self.screen_to_world(sx, sy)
        self._set_view(new_scale, sx - wx * new_scale, sy + wy * new_scale)
        self.render_canvas()

    def _on_pan_start(self, event):
        if not self.parsed_data or not self.editor:
            return
        self._panning = True
        self._pan_last = (event.x, event.y)
        self.canvas.configure(cursor='fleur')

    def _on_pan_move(self, event):
        if not self._panning or self._pan_last is None:
            return
        dx = event.x - self._pan_last[0]
        dy = event.y - self._pan_last[1]
        self._pan_last = (event.x, event.y)
        self._set_view(self._view_scale, self._pan_x + dx, self._pan_y + dy)
        self.render_canvas()

    def _on_pan_end(self, event):
        self._panning = False
        self._pan_last = None
        self.set_edit_mode(self.edit_mode)

    def _on_canvas_resize(self, event=None):
        if self.parsed_data and self.editor:
            self.render_canvas()

    def _highlight_part(self, part_id):
        if self.part_highlight_item:
            self.canvas.delete(self.part_highlight_item)
            self.part_highlight_item = None
        info = self.part_bounds_map.get(part_id)
        if not info:
            return
        x1, y1 = self.world_to_screen(info['dx_min'], info['dy_min'])
        x2, y2 = self.world_to_screen(info['dx_max'], info['dy_max'])
        self.part_highlight_item = self.canvas.create_rectangle(
            x1, y1, x2, y2, outline='red', width=3, dash=(6, 3))

    def _clear_snap_marker(self):
        if self.snap_marker_item is not None:
            self.canvas.delete(self.snap_marker_item)
            self.snap_marker_item = None

    def _draw_snap_marker(self, sx, sy, snap_type):
        self._clear_snap_marker()
        if snap_type is None:
            return
        if snap_type == SNAP_ENDPOINT:
            self.snap_marker_item = self.canvas.create_rectangle(
                sx - 5, sy - 5, sx + 5, sy + 5, outline='#000000', fill=self.settings['snap_marker_color'], width=1)
        elif snap_type == SNAP_MIDPOINT:
            self.snap_marker_item = self.canvas.create_polygon(
                sx, sy - 6, sx + 5, sy + 3, sx - 5, sy + 3, outline='#000000', fill=self.settings['snap_marker_color'], width=1)
        elif snap_type == SNAP_INTERSECTION:
            self.snap_marker_item = self.canvas.create_polygon(
                sx, sy - 6, sx + 6, sy, sx, sy + 6, sx - 6, sy, outline='#000000', fill=self.settings['snap_marker_color'], width=1)
        else:
            self.snap_marker_item = self.canvas.create_oval(
                sx - 5, sy - 5, sx + 5, sy + 5, outline='#000000', fill=self.settings['snap_marker_color'], width=1)

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

    def _get_snapped_dxf(self, event):
        self._update_snap_at(event.x, event.y)
        if self.current_snap_point:
            return self.current_snap_point['point']
        return self.screen_to_world(event.x, event.y)

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

    def _update_draw_preview(self, event):
        self._update_snap_at(event.x, event.y)
        self._clear_draw_preview()
        sx, sy = self.world_to_screen(*self.draw_start_dxf)
        ex, ey = self.current_snap_screen if self.current_snap_screen else (event.x, event.y)
        if self.edit_mode == 'line':
            self.draw_preview_items.append(
                self.canvas.create_line(sx, sy, ex, ey, fill='red', width=2, dash=(4, 4)))
        elif self.edit_mode == 'rect':
            x1, y1 = min(sx, ex), min(sy, ey)
            x2, y2 = max(sx, ex), max(sy, ey)
            self.draw_preview_items.append(
                self.canvas.create_rectangle(x1, y1, x2, y2, outline='red', width=2, dash=(4, 4)))
        elif self.edit_mode == 'circle':
            r = ((ex - sx)**2 + (ey - sy)**2)**0.5
            self.draw_preview_items.append(
                self.canvas.create_oval(sx-r, sy-r, sx+r, sy+r, outline='red', width=2, dash=(4, 4)))

    def _on_canvas_click(self, event):
        if not self.editor or not self.parsed_data:
            return
        dxf_x, dxf_y = self._canvas_to_dxf(event.x, event.y)
        if self.edit_mode == 'select':
            entity = self.editor.hit_test(dxf_x, dxf_y, tolerance=8.0 / self._view_scale)
            self._clear_snap_marker()
            self.current_snap_point = None
            self.current_snap_screen = None
            if entity:
                if self.editor.is_entity_locked(entity):
                    self.status_label.config(text='該圖層已鎖定', foreground='orange')
                    return
                self.selected_entity = entity
                self.drag_start = (event.x, event.y)
                self._draw_entity_highlight()
                self.status_label.config(text=f'已選取: {entity.dxftype()} @ {entity.dxf.layer}', foreground='blue')
            else:
                self.selected_entity = None
                self._clear_entity_highlight()
                self.status_label.config(text='就緒', foreground='gray')
        elif self.edit_mode == 'delete':
            entity = self.editor.hit_test(dxf_x, dxf_y, tolerance=8.0 / self._view_scale)
            if entity:
                if self.editor.is_entity_locked(entity):
                    self.status_label.config(text='該圖層已鎖定', foreground='orange')
                    return
                self.editor.delete_entity(entity)
                self.selected_entity = None
                self._clear_entity_highlight()
                self._refresh_after_edit()
                self.status_label.config(text='已刪除圖元', foreground='green')
        elif self.edit_mode == 'text':
            text_content = simpledialog.askstring('輸入文字', '請輸入文字內容:', parent=self.root)
            if text_content:
                dxf_point = self._get_snapped_dxf(event)
                height = self.settings['text_height']
                self.editor.add_text(text_content, dxf_point, height=height)
                self._refresh_after_edit()
                self.status_label.config(text='已新增文字', foreground='green')
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

    def _on_canvas_drag(self, event):
        if not self.editor or not self.parsed_data:
            return
        if self.edit_mode in ('line', 'rect', 'circle') and self.draw_start is not None:
            self._update_draw_preview(event)
        elif self.edit_mode == 'select' and self.selected_entity and self.drag_start:
            d1 = self._canvas_to_dxf(event.x, event.y)
            d2 = self._canvas_to_dxf(self.drag_start[0], self.drag_start[1])
            dx_dxf = d1[0] - d2[0]
            dy_dxf = d1[1] - d2[1]
            if abs(dx_dxf) > 0.01 or abs(dy_dxf) > 0.01:
                ok = self.editor.move_entities([self.selected_entity], dx_dxf, dy_dxf)
                if not ok:
                    self.status_label.config(text='尺寸不支援移動，請刪除後重標', foreground='red')
                self.drag_start = (event.x, event.y)
                self._refresh_after_edit()

    def _on_canvas_release(self, event):
        if not self.editor or not self.parsed_data:
            return
        if self.edit_mode == 'select' and self.drag_start:
            self.drag_start = None

    def _on_canvas_right_click(self, event):
        self.set_edit_mode('select')
        self.selected_entity = None
        self._clear_entity_highlight()

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

    def _clear_draw_preview(self):
        for item_id in self.draw_preview_items:
            self.canvas.delete(item_id)
        self.draw_preview_items = []

    def _draw_anchor_marker(self):
        self._clear_anchor_marker()
        if self.draw_start_dxf is None:
            return
        sx, sy = self.world_to_screen(*self.draw_start_dxf)
        self.draw_anchor_item = self.canvas.create_oval(
            sx - 5, sy - 5, sx + 5, sy + 5, outline='#FF0000', width=2)

    def _clear_anchor_marker(self):
        if self.draw_anchor_item is not None:
            self.canvas.delete(self.draw_anchor_item)
            self.draw_anchor_item = None

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
        h = self.settings['dim_text_height']
        a = self.settings['dim_arrow_size']
        if self.edit_mode in DIM_LINEAR_MODES:
            p1, p2 = self.dim_points[0], self.dim_points[1]
            dx = p2[0] - p1[0]
            dy = p2[1] - p1[1]
            L = math.hypot(dx, dy)
            if L < 1e-9:
                self._fail_dim('兩點過近，無法建立尺寸')
                return
            if kind == 'linear':
                dist = (dx * (loc[1] - p1[1]) - dy * (loc[0] - p1[0])) / L
                if abs(dist) < 1e-9:
                    self._fail_dim('尺寸線與測量點重疊，無法建立尺寸')
                    return
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

    def _fail_dim(self, message):
        self.dim_points = []
        self.dim_radius = 0.0
        self._clear_dim_preview()
        self._clear_dim_anchor()
        self.status_label.config(text=message, foreground='red')

    def _draw_entity_highlight(self):
        self._clear_entity_highlight()
        if not self.selected_entity:
            return
        e = self.selected_entity
        try:
            dxf_type = e.dxftype()
            if dxf_type == 'LINE':
                cx1, cy1 = self._dxf_to_canvas(e.dxf.start.x, e.dxf.start.y)
                cx2, cy2 = self._dxf_to_canvas(e.dxf.end.x, e.dxf.end.y)
                self.selected_entity_highlight = self.canvas.create_line(
                    cx1, cy1, cx2, cy2, fill='red', width=3, dash=(6, 3))
            elif dxf_type == 'CIRCLE':
                cx, cy = self._dxf_to_canvas(e.dxf.center.x, e.dxf.center.y)
                r = e.dxf.radius * self._view_scale
                self.selected_entity_highlight = self.canvas.create_oval(
                    cx-r, cy-r, cx+r, cy+r, outline='red', width=3, dash=(6, 3))
            elif dxf_type == 'LWPOLYLINE':
                pts = [self._dxf_to_canvas(p[0], p[1]) for p in e.get_points('xy')]
                flat = [c for p in pts for c in p]
                self.selected_entity_highlight = self.canvas.create_line(
                    *flat, fill='red', width=3, dash=(6, 3))
            elif dxf_type == 'TEXT':
                cx, cy = self._dxf_to_canvas(e.dxf.insert.x, e.dxf.insert.y)
                self.selected_entity_highlight = self.canvas.create_text(
                    cx, cy, text='x', fill='red', font=('', 14, 'bold'))
            elif dxf_type == 'MTEXT':
                cx, cy = self._dxf_to_canvas(e.dxf.insert.x, e.dxf.insert.y)
                self.selected_entity_highlight = self.canvas.create_text(
                    cx, cy, text='x', fill='red', font=('', 14, 'bold'))
        except Exception:
            pass

    def _clear_entity_highlight(self):
        if self.selected_entity_highlight:
            self.canvas.delete(self.selected_entity_highlight)
            self.selected_entity_highlight = None

    def _refresh_after_edit(self):
        if self.editor and self.parsed_data:
            try:
                from dxf_parser import extract_entities, extract_dimensions, extract_texts
                self.parsed_data['entities'] = extract_entities(self.editor.msp)
                self.parsed_data['dimensions'] = extract_dimensions(self.editor.msp)
                self.parsed_data['texts'] = extract_texts(self.editor.msp)
            except Exception:
                pass
            self.render_canvas()
            self.analysis_result = analyze(self.parsed_data)
            self._build_part_bounds_map()
            self.update_parts_table()
            self.update_issues_table()
            self.update_export_info()

    def apply_settings(self):
        s = self.settings
        self.canvas.configure(bg=s['bg_color'])
        self.line_width_var.set(s['line_width'])
        if self.editor and self.parsed_data:
            self.render_canvas()

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

    def _on_part_select(self, event):
        sel = self.parts_tree.selection()
        if not sel:
            self.selected_part_id = None
            self.update_preview()
            return
        self.selected_part_id = sel[0]
        self.update_preview(highlight_part_id=sel[0])

    def _on_layer_change(self, event=None):
        if not self.editor:
            return
        new_layer = self.layer_var.get()
        if new_layer in self.editor.layers:
            self.editor.current_layer = new_layer
            self._update_layer_color_btn()
            info = self.editor.layers.get(new_layer, {})
            self.layer_hide_var.set(info.get('hidden', False))
            self.layer_lock_var.set(info.get('locked', False))

    def do_add_layer(self):
        if not self.editor:
            return
        name = simpledialog.askstring('新增圖層', '圖層名稱:', parent=self.root)
        if not name or not name.strip():
            return
        color = len(self.editor.layers) % 14
        if self.editor.add_layer(name.strip(), color):
            self._sync_layer_ui()
            self.status_label.config(text=f'已新增圖層: {name}', foreground='green')
        else:
            messagebox.showwarning('警告', f'圖層 {name} 已存在')

    def do_delete_layer(self):
        if not self.editor:
            return
        layer = self.layer_var.get()
        if layer == '0':
            messagebox.showwarning('警告', '無法刪除預設圖層 0')
            return
        if messagebox.askyesno('確認', f'確定要刪除圖層 "{layer}" 及其所有圖元？'):
            if self.editor.delete_layer(layer):
                self._sync_layer_ui()
                self._refresh_after_edit()
                self.status_label.config(text=f'已刪除圖層: {layer}', foreground='green')

    def do_rename_layer(self):
        if not self.editor:
            return
        old_name = self.layer_var.get()
        if old_name == '0':
            messagebox.showwarning('警告', '無法重新命名預設圖層 0')
            return
        new_name = simpledialog.askstring('重新命名圖層', f'將 "{old_name}" 改為:', parent=self.root)
        if not new_name or not new_name.strip():
            return
        if self.editor.rename_layer(old_name, new_name.strip()):
            self._sync_layer_ui()
            self.status_label.config(text=f'圖層已重新命名為: {new_name}', foreground='green')

    def do_change_layer_color(self):
        if not self.editor:
            return
        info = self.editor.layers.get(self.editor.current_layer, {})
        hex_color = LAYER_COLOR_HEX.get(info.get('color', 7), '#FFFFFF')
        result = colorchooser.askcolor(initialcolor=hex_color, parent=self.root, title='選擇圖層顏色')
        if result and result[1]:
            color_map = {'#FF0000': 1, '#FFFF00': 2, '#00FF00': 3, '#00FFFF': 4,
                         '#0000FF': 5, '#FF00FF': 6, '#FFFFFF': 7, '#808080': 8, '#C0C0C0': 9}
            new_color = color_map.get(result[1].upper(), 7)
            self.editor.set_layer_color(self.editor.current_layer, new_color)
            self._update_layer_color_btn()
            self._refresh_after_edit()

    def do_toggle_layer_visibility(self):
        if not self.editor:
            return
        self.editor.toggle_layer_visibility(self.editor.current_layer)
        self._refresh_after_edit()

    def do_toggle_layer_lock(self):
        if not self.editor:
            return
        self.editor.toggle_layer_lock(self.editor.current_layer)

    def do_undo(self):
        if not self.editor:
            return
        if self.editor.undo():
            self._sync_layer_ui()
            self._refresh_after_edit()
            self.selected_entity = None
            self._clear_entity_highlight()
            self.status_label.config(text='已復原', foreground='green')
        else:
            self.status_label.config(text='無法復原', foreground='orange')

    def do_redo(self):
        if not self.editor:
            return
        if self.editor.redo():
            self._sync_layer_ui()
            self._refresh_after_edit()
            self.selected_entity = None
            self._clear_entity_highlight()
            self.status_label.config(text='已重做', foreground='green')
        else:
            self.status_label.config(text='無法重做', foreground='orange')

    def do_delete_selected(self):
        if not self.editor or not self.selected_entity:
            return
        if self.editor.is_entity_locked(self.selected_entity):
            self.status_label.config(text='該圖層已鎖定', foreground='orange')
            return
        if self.editor.delete_entity(self.selected_entity):
            self.selected_entity = None
            self._clear_entity_highlight()
            self._refresh_after_edit()
            self.status_label.config(text='已刪除圖元', foreground='green')

    def do_save(self):
        if not self.editor:
            return
        if self.editor.save():
            self.status_label.config(text='已儲存', foreground='green')
            messagebox.showinfo('完成', f'已儲存：\n{self.editor.filepath}')
        else:
            self.status_label.config(text='儲存失敗', foreground='red')

    def do_save_as(self):
        if not self.editor:
            return
        path = filedialog.asksaveasfilename(
            title='另存新檔', defaultextension='.dxf',
            filetypes=[('DXF 檔案', '*.dxf'), ('所有檔案', '*.*')])
        if not path:
            return
        if self.editor.save_as(path):
            self.file_label.config(text=os.path.basename(path))
            self.status_label.config(text='已另存新檔', foreground='green')
            messagebox.showinfo('完成', f'已儲存：\n{path}')
        else:
            self.status_label.config(text='儲存失敗', foreground='red')

    def update_export_info(self):
        if self.analysis_result:
            pc = len(self.analysis_result.get('parts', []))
            ic = len(self.analysis_result.get('issues', []))
            self.export_info.config(text=f'已分析完成：{pc} 個零件，{ic} 個問題', foreground='black')

    def show_error(self, msg):
        self.status_label.config(text='錯誤', foreground='red')
        messagebox.showerror('錯誤', msg)

    def export_excel(self):
        if not self.analysis_result:
            messagebox.showwarning('警告', '請先載入並分析 DXF 檔案')
            return
        path = filedialog.asksaveasfilename(
            title='儲存 Excel 報表', defaultextension='.xlsx',
            filetypes=[('Excel 檔案', '*.xlsx')])
        if not path:
            return
        try:
            generate_excel(self.analysis_result, path)
            messagebox.showinfo('完成', f'已儲存：\n{path}')
        except Exception as e:
            messagebox.showerror('錯誤', f'匯出失敗：{str(e)}')

    def export_preview_image(self):
        if not self.editor:
            messagebox.showwarning('警告', '請先載入 DXF 檔案')
            return
        path = filedialog.asksaveasfilename(
            title='儲存預覽圖', defaultextension='.png',
            filetypes=[('PNG 圖片', '*.png')])
        if not path:
            return
        try:
            entities = self.parsed_data.get('entities', []) if self.parsed_data else []
            dimensions = self.parsed_data.get('dimensions', []) if self.parsed_data else []
            texts = self.parsed_data.get('texts', []) if self.parsed_data else []
            ok = _render_entities_pillow(entities, dimensions, texts, path, bbox=self._render_bbox)
            if ok:
                messagebox.showinfo('完成', f'已儲存：\n{path}')
            else:
                messagebox.showerror('錯誤', '匯出圖片失敗')
        except Exception as e:
            messagebox.showerror('錯誤', f'匯出失敗：{str(e)}')

def main():
    sys.excepthook = lambda typ, val, tb: messagebox.showerror(
        '錯誤', f'{typ.__name__}: {val}\n{"".join(traceback.format_tb(tb))}')
    try:
        root = tk.Tk()
        CADPartsApp(root)
        root.mainloop()
    except Exception as e:
        messagebox.showerror('程式錯誤', f'{str(e)}\n\n{traceback.format_exc()}')

if __name__ == '__main__':
    main()