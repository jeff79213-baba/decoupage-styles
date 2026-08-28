import ezdxf
from ezdxf import units
from ezdxf.entities.copy import default_copy

MAX_UNDO = 20

LAYER_COLORS = {
    '0': 7,
    'DIM': 5,
    'TEXT': 3,
}

DEFAULT_LAYER_COLORS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 150, 160, 170, 180, 190]

class DXFEditor:
    def __init__(self, filepath=None):
        self.filepath = filepath
        self.doc = None
        self.msp = None
        self.undo_stack = []
        self.redo_stack = []
        self.layers = {}
        self.current_layer = '0'
        self.current_color = 7
        self.hidden_layers = set()
        self.locked_layers = set()
        if filepath:
            self.load(filepath)

    def load(self, filepath):
        self.filepath = filepath
        self.doc = ezdxf.readfile(filepath)
        self.msp = self.doc.modelspace()
        self._sync_layers()
        self.undo_stack = []
        self.redo_stack = []
        return True

    def _sync_layers(self):
        self.layers = {}
        for layer in self.doc.layers:
            name = layer.dxf.name
            color = layer.color if hasattr(layer.dxf, 'color') else 7
            self.layers[name] = {
                'name': name,
                'color': color,
                'hidden': False,
                'locked': False,
            }
        if '0' not in self.layers:
            self.layers['0'] = {'name': '0', 'color': 7, 'hidden': False, 'locked': False}
        if self.current_layer not in self.layers:
            self.current_layer = '0'

    def _push_undo(self):
        snapshot = self._take_snapshot()
        self.undo_stack.append(snapshot)
        if len(self.undo_stack) > MAX_UNDO:
            self.undo_stack.pop(0)
        self.redo_stack = []

    def _take_snapshot(self):
        arch = ezdxf.new(dxfversion=self.doc.dxfversion)
        arch_msp = arch.modelspace()
        for e in self.msp:
            try:
                arch_msp.add_entity(default_copy.copy(e))
            except Exception:
                pass
        layers = {}
        for name, info in self.layers.items():
            layers[name] = dict(info)
        return {
            'doc': arch,
            'layers': layers,
            'hidden_layers': set(self.hidden_layers),
            'locked_layers': set(self.locked_layers),
            'current_layer': self.current_layer,
        }

    def _restore_snapshot(self, snapshot):
        for e in list(self.msp):
            try:
                e.destroy()
            except Exception:
                pass
        arch_msp = snapshot['doc'].modelspace()
        for e in arch_msp:
            try:
                self.msp.add_entity(default_copy.copy(e))
            except Exception:
                pass
        self.layers = {}
        for name, info in snapshot['layers'].items():
            self.layers[name] = dict(info)
        self.hidden_layers = set(snapshot.get('hidden_layers', set()))
        self.locked_layers = set(snapshot.get('locked_layers', set()))
        self.current_layer = snapshot['current_layer']
        self._sync_dxf_layers()

    def _sync_dxf_layers(self):
        existing = {layer.dxf.name for layer in self.doc.layers}
        for name, info in self.layers.items():
            if name not in existing:
                layer = self.doc.layers.add(name)
                layer.color = info.get('color', 7)
            else:
                for layer in self.doc.layers:
                    if layer.dxf.name == name:
                        layer.color = info.get('color', 7)
                        break

    def undo(self):
        if not self.undo_stack:
            return False
        current = self._take_snapshot()
        self.redo_stack.append(current)
        snapshot = self.undo_stack.pop()
        self._restore_snapshot(snapshot)
        return True

    def redo(self):
        if not self.redo_stack:
            return False
        current = self._take_snapshot()
        self.undo_stack.append(current)
        snapshot = self.redo_stack.pop()
        self._restore_snapshot(snapshot)
        return True

    def add_line(self, start, end, layer=None, color=None):
        self._push_undo()
        layer = layer or self.current_layer
        color = color or self.current_color
        self.msp.add_line(start, end, dxfattribs={'layer': layer, 'color': color})
        return True

    def add_rectangle(self, p1, p2, layer=None, color=None):
        self._push_undo()
        layer = layer or self.current_layer
        color = color or self.current_color
        x1, y1 = p1
        x2, y2 = p2
        points = [(x1, y1), (x2, y1), (x2, y2), (x1, y2)]
        self.msp.add_lwpolyline(points, close=True, dxfattribs={'layer': layer, 'color': color})
        return True

    def add_circle(self, center, radius, layer=None, color=None):
        self._push_undo()
        layer = layer or self.current_layer
        color = color or self.current_color
        self.msp.add_circle(center, radius, dxfattribs={'layer': layer, 'color': color})
        return True

    def add_text(self, text, insert, height=2.5, layer=None, color=None):
        self._push_undo()
        layer = layer or self.current_layer
        color = color or self.current_color
        self.msp.add_text(text, dxfattribs={'layer': layer, 'color': color, 'height': height, 'insert': insert})
        return True

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

    def delete_entity(self, entity):
        self._push_undo()
        try:
            entity.destroy()
            return True
        except Exception:
            return False

    def delete_entities(self, entities):
        if not entities:
            return False
        self._push_undo()
        for e in entities:
            try:
                e.destroy()
            except Exception:
                pass
        return True

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

    def add_layer(self, name, color=7):
        if name in self.layers:
            return False
        self.layers[name] = {'name': name, 'color': color, 'hidden': False, 'locked': False}
        layer = self.doc.layers.add(name)
        layer.color = color
        return True

    def delete_layer(self, name):
        if name == '0':
            return False
        if name not in self.layers:
            return False
        to_delete = [e for e in self.msp if e.dxf.layer == name]
        for e in to_delete:
            try:
                e.destroy()
            except Exception:
                pass
        for layer in self.doc.layers:
            if layer.dxf.name == name:
                try:
                    layer.destroy()
                except Exception:
                    pass
                break
        del self.layers[name]
        if self.current_layer == name:
            self.current_layer = '0'
        self.hidden_layers.discard(name)
        self.locked_layers.discard(name)
        return True

    def rename_layer(self, old_name, new_name):
        if old_name not in self.layers or new_name in self.layers:
            return False
        if old_name == '0':
            return False
        info = self.layers.pop(old_name)
        info['name'] = new_name
        self.layers[new_name] = info
        for e in self.msp:
            if e.dxf.layer == old_name:
                e.dxf.layer = new_name
        for layer in self.doc.layers:
            if layer.dxf.name == old_name:
                layer.dxf.name = new_name
                break
        if self.current_layer == old_name:
            self.current_layer = new_name
        if old_name in self.hidden_layers:
            self.hidden_layers.discard(old_name)
            self.hidden_layers.add(new_name)
        if old_name in self.locked_layers:
            self.locked_layers.discard(old_name)
            self.locked_layers.add(new_name)
        return True

    def set_layer_color(self, name, color):
        if name not in self.layers:
            return False
        self.layers[name]['color'] = color
        for layer in self.doc.layers:
            if layer.dxf.name == name:
                layer.color = color
                break
        return True

    def toggle_layer_visibility(self, name):
        if name not in self.layers:
            return
        if name in self.hidden_layers:
            self.hidden_layers.discard(name)
            self.layers[name]['hidden'] = False
        else:
            self.hidden_layers.add(name)
            self.layers[name]['hidden'] = True

    def toggle_layer_lock(self, name):
        if name not in self.layers:
            return
        if name in self.locked_layers:
            self.locked_layers.discard(name)
            self.layers[name]['locked'] = False
        else:
            self.locked_layers.add(name)
            self.layers[name]['locked'] = True

    def is_entity_visible(self, entity):
        return entity.dxf.layer not in self.hidden_layers

    def is_entity_locked(self, entity):
        return entity.dxf.layer in self.locked_layers

    def get_visible_entities(self):
        return [e for e in self.msp if self.is_entity_visible(e)]

    def hit_test(self, dxf_x, dxf_y, tolerance=5.0):
        best = None
        best_dist = tolerance
        for e in self.msp:
            if not self.is_entity_visible(e):
                continue
            if self.is_entity_locked(e):
                continue
            d = self._entity_distance(e, dxf_x, dxf_y)
            if d is not None and d < best_dist:
                best_dist = d
                best = e
        return best

    def _entity_distance(self, e, px, py):
        dxf_type = e.dxftype()
        try:
            if dxf_type == 'LINE':
                sx, sy = e.dxf.start.x, e.dxf.start.y
                ex, ey = e.dxf.end.x, e.dxf.end.y
                return self._point_to_segment_dist(px, py, sx, sy, ex, ey)
            elif dxf_type == 'CIRCLE':
                cx, cy = e.dxf.center.x, e.dxf.center.y
                r = e.dxf.radius
                dist = ((px - cx)**2 + (py - cy)**2)**0.5
                return abs(dist - r)
            elif dxf_type in ('LWPOLYLINE', 'POLYLINE'):
                pts = [(p[0], p[1]) for p in e.get_points('xy')]
                min_d = float('inf')
                for i in range(len(pts) - 1):
                    d = self._point_to_segment_dist(px, py, pts[i][0], pts[i][1], pts[i+1][0], pts[i+1][1])
                    if d < min_d:
                        min_d = d
                if e.closed and len(pts) > 2:
                    d = self._point_to_segment_dist(px, py, pts[-1][0], pts[-1][1], pts[0][0], pts[0][1])
                    if d < min_d:
                        min_d = d
                return min_d if min_d < float('inf') else None
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
            elif dxf_type == 'TEXT':
                tx, ty = e.dxf.insert.x, e.dxf.insert.y
                h = e.dxf.height
                return ((px - tx)**2 + (py - ty)**2)**0.5 if abs(py - ty) < h * 2 else None
            elif dxf_type == 'ARC':
                cx, cy = e.dxf.center.x, e.dxf.center.y
                r = e.dxf.radius
                dist = ((px - cx)**2 + (py - cy)**2)**0.5
                if abs(dist - r) < 10:
                    import math
                    angle = math.degrees(math.atan2(py - cy, px - cx))
                    if angle < 0:
                        angle += 360
                    sa = e.dxf.start_angle % 360
                    ea = e.dxf.end_angle % 360
                    if sa <= ea:
                        if sa <= angle <= ea:
                            return abs(dist - r)
                    else:
                        if angle >= sa or angle <= ea:
                            return abs(dist - r)
                return None
        except Exception:
            return None
        return None

    def _point_to_segment_dist(self, px, py, sx, sy, ex, ey):
        dx = ex - sx
        dy = ey - sy
        len_sq = dx * dx + dy * dy
        if len_sq == 0:
            return ((px - sx)**2 + (py - sy)**2)**0.5
        t = max(0, min(1, ((px - sx) * dx + (py - sy) * dy) / len_sq))
        proj_x = sx + t * dx
        proj_y = sy + t * dy
        return ((px - proj_x)**2 + (py - proj_y)**2)**0.5

    def save(self):
        if not self.filepath:
            return False
        self._sync_dxf_layers()
        self.doc.saveas(self.filepath)
        return True

    def save_as(self, filepath):
        self.filepath = filepath
        self._sync_dxf_layers()
        self.doc.saveas(filepath)
        return True
