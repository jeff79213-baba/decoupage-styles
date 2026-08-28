import os
import math
import json
import ezdxf
from ezdxf import units
from PIL import Image, ImageDraw, ImageFont

def _find_font(size):
    candidates = [
        r'C:\Windows\Fonts\msyh.ttc',
        r'C:\Windows\Fonts\msyh.ttf',
        r'C:\Windows\Fonts\arial.ttf',
        r'C:\Windows\Fonts\segoeui.ttf',
        r'C:\Windows\Fonts\simhei.ttf',
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()

class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        try:
            return float(obj)
        except (TypeError, ValueError):
            return super().default(obj)

def mm_to_inch(value_mm):
    return value_mm / 25.4

def get_unit_factor(doc):
    doc_units = doc.units
    if doc_units in (units.MM, units.M):
        return 1.0
    elif doc_units in (units.IN, units.FT):
        return 25.4
    return 1.0

def get_dimension_value(dim):
    try:
        return dim.get_measurement()
    except Exception:
        return None

def get_dim_text(dim):
    try:
        text = dim.dxf.text
        if text and text.strip() and text.strip() != '<>':
            return text.strip()
    except Exception:
        pass
    val = get_dimension_value(dim)
    if val is not None:
        return f"{round(val, 2)}"
    return None

def extract_entities(msp):
    entities = []
    for e in msp:
        dxf_type = e.dxftype()
        if dxf_type in ('LINE', 'XLINE', 'RAY'):
            try:
                start = tuple(round(c, 3) for c in e.dxf.start)
                end = tuple(round(c, 3) for c in e.dxf.end)
                entities.append({
                    'type': dxf_type, 'layer': e.dxf.layer,
                    'points': [start, end],
                    'color': e.dxf.color
                })
            except Exception:
                pass
        elif dxf_type == 'LWPOLYLINE':
            try:
                points = [(round(p[0], 3), round(p[1], 3)) for p in e.get_points('xy')]
                entities.append({
                    'type': dxf_type, 'layer': e.dxf.layer,
                    'points': points,
                    'closed': e.closed,
                    'color': e.dxf.color
                })
            except Exception:
                pass
        elif dxf_type == 'POLYLINE':
            try:
                points = [(round(v.dxf.location.x, 3), round(v.dxf.location.y, 3)) for v in e.vertices]
                entities.append({
                    'type': dxf_type, 'layer': e.dxf.layer,
                    'points': points,
                    'closed': e.is_closed,
                    'color': e.dxf.color
                })
            except Exception:
                pass
        elif dxf_type == 'CIRCLE':
            try:
                cx, cy = round(e.dxf.center.x, 3), round(e.dxf.center.y, 3)
                r = round(e.dxf.radius, 3)
                entities.append({
                    'type': dxf_type, 'layer': e.dxf.layer,
                    'center': (cx, cy),
                    'radius': r,
                    'color': e.dxf.color
                })
            except Exception:
                pass
        elif dxf_type == 'ARC':
            try:
                cx, cy = round(e.dxf.center.x, 3), round(e.dxf.center.y, 3)
                r = round(e.dxf.radius, 3)
                entities.append({
                    'type': dxf_type, 'layer': e.dxf.layer,
                    'center': (cx, cy),
                    'radius': r,
                    'start_angle': round(e.dxf.start_angle, 2),
                    'end_angle': round(e.dxf.end_angle, 2),
                    'color': e.dxf.color
                })
            except Exception:
                pass
        elif dxf_type == 'ELLIPSE':
            try:
                cx, cy = round(e.dxf.center.x, 3), round(e.dxf.center.y, 3)
                mx, my = round(e.dxf.major_axis.x, 3), round(e.dxf.major_axis.y, 3)
                ratio = round(e.dxf.ratio, 4)
                entities.append({
                    'type': dxf_type, 'layer': e.dxf.layer,
                    'center': (cx, cy),
                    'major_axis': (mx, my),
                    'ratio': ratio,
                    'color': e.dxf.color
                })
            except Exception:
                pass
        elif dxf_type == 'SPLINE':
            try:
                if hasattr(e, 'control_points') and len(e.control_points) > 0:
                    pts = [(round(p.x, 3), round(p.y, 3)) for p in e.control_points]
                    entities.append({
                        'type': dxf_type, 'layer': e.dxf.layer,
                        'points': pts,
                        'color': e.dxf.color
                    })
            except Exception:
                pass
    return entities

def build_entity_list(dxf_doc):
    """Return unified entity dicts keyed by DXF handle (single source of truth).

    Each dict: {"id": handle, "type", "layer", "color", plus geometry fields}
    Geometry fields: "points", or "center"/"radius", or "text"/"position".
    """
    msp = dxf_doc.modelspace()
    entities = []
    for e in msp:
        try:
            dxf_type = e.dxftype()
            handle = e.dxf.handle if hasattr(e.dxf, 'handle') else None
            layer = e.dxf.layer
            color = e.dxf.color if hasattr(e.dxf, 'color') else 7
            data = {'id': handle, 'type': dxf_type, 'layer': layer, 'color': color}
            if dxf_type in ('LINE', 'XLINE', 'RAY'):
                data['points'] = [
                    (round(e.dxf.start.x, 3), round(e.dxf.start.y, 3)),
                    (round(e.dxf.end.x, 3), round(e.dxf.end.y, 3))]
            elif dxf_type == 'LWPOLYLINE':
                pts = e.get_points('xyb')
                data['points'] = [(round(p[0], 3), round(p[1], 3)) for p in pts]
                data['bulges'] = [round(p[2], 6) for p in pts]
                data['closed'] = e.closed
            elif dxf_type == 'POLYLINE':
                pts = [(v.dxf.location.x, v.dxf.location.y) for v in e.vertices]
                data['points'] = [(round(p[0], 3), round(p[1], 3)) for p in pts]
                data['bulges'] = [round(v.dxf.bulge if hasattr(v.dxf, 'bulge') else 0.0, 6) for v in e.vertices]
                data['closed'] = e.is_closed
            elif dxf_type == 'CIRCLE':
                data['center'] = (round(e.dxf.center.x, 3), round(e.dxf.center.y, 3))
                data['radius'] = round(e.dxf.radius, 3)
            elif dxf_type == 'ARC':
                data['center'] = (round(e.dxf.center.x, 3), round(e.dxf.center.y, 3))
                data['radius'] = round(e.dxf.radius, 3)
                data['start_angle'] = round(e.dxf.start_angle, 2)
                data['end_angle'] = round(e.dxf.end_angle, 2)
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
            elif dxf_type == 'ELLIPSE':
                data['center'] = (round(e.dxf.center.x, 3), round(e.dxf.center.y, 3))
                data['major_axis'] = (round(e.dxf.major_axis.x, 3), round(e.dxf.major_axis.y, 3))
                data['ratio'] = round(e.dxf.ratio, 4)
            elif dxf_type == 'TEXT':
                data['text'] = e.dxf.text
                data['position'] = (round(e.dxf.insert.x, 3), round(e.dxf.insert.y, 3))
                data['height'] = round(e.dxf.height, 2)
            elif dxf_type == 'MTEXT':
                data['text'] = e.text
                data['position'] = (round(e.dxf.insert.x, 3), round(e.dxf.insert.y, 3))
                data['height'] = round(e.dxf.char_height, 2)
            elif dxf_type == 'SPLINE':
                data['points'] = [(round(p.x, 3), round(p.y, 3)) for p in e.control_points]
            else:
                continue
            entities.append(data)
        except Exception:
            continue
    return entities


def extract_dimensions(msp):
    dimensions = []
    for dim in msp.query('DIMENSION'):
        try:
            val = get_dimension_value(dim)
            if val is None:
                continue
            text = get_dim_text(dim) or str(round(val, 2))
            pos = None
            try:
                tp = dim.get_text_pos()
                pos = (round(tp.x, 3), round(tp.y, 3))
            except Exception:
                try:
                    def_pt = dim.dxf.defpoint
                    pos = (round(def_pt.x, 3), round(def_pt.y, 3))
                except Exception:
                    pos = (0, 0)
            defpt2 = None
            defpt3 = None
            try:
                dp2 = dim.dxf.defpoint2
                defpt2 = (round(dp2.x, 3), round(dp2.y, 3))
            except Exception:
                pass
            try:
                dp3 = dim.dxf.defpoint3
                defpt3 = (round(dp3.x, 3), round(dp3.y, 3))
            except Exception:
                pass
            dimensions.append({
                'value': round(val, 2),
                'text': text,
                'unit': 'mm',
                'position': pos,
                'defpoint2': defpt2,
                'defpoint3': defpt3,
                'layer': dim.dxf.layer,
                'dimtype': str(dim.dxf.dimtype),
            })
        except Exception:
            continue
    return dimensions

def extract_texts(msp):
    texts = []
    for txt in msp.query('TEXT'):
        try:
            texts.append({
                'content': txt.dxf.text,
                'position': (round(txt.dxf.insert.x, 3), round(txt.dxf.insert.y, 3)),
                'layer': txt.dxf.layer,
                'height': round(txt.dxf.height, 2),
            })
        except Exception:
            pass
    for mtxt in msp.query('MTEXT'):
        try:
            texts.append({
                'content': mtxt.dxf.text,
                'position': (round(mtxt.dxf.insert.x, 3), round(mtxt.dxf.insert.y, 3)),
                'layer': mtxt.dxf.layer,
                'height': round(mtxt.dxf.char_height, 2),
            })
        except Exception:
            pass
    return texts

def compute_bounding_box(entities, dimensions, texts):
    all_points = []
    for ent in entities:
        if 'points' in ent:
            all_points.extend(ent['points'])
        if 'center' in ent:
            cx, cy = ent['center']
            if 'radius' in ent:
                all_points.append((cx - ent['radius'], cy - ent['radius']))
                all_points.append((cx + ent['radius'], cy + ent['radius']))
            else:
                all_points.append((cx, cy))
    for dim in dimensions:
        all_points.append(dim['position'])
    for txt in texts:
        all_points.append(txt['position'])
    if not all_points:
        return {'xmin': 0, 'ymin': 0, 'xmax': 1000, 'ymax': 1000}
    xs = [p[0] for p in all_points]
    ys = [p[1] for p in all_points]
    margin_x = max(10, (max(xs) - min(xs)) * 0.05)
    margin_y = max(10, (max(ys) - min(ys)) * 0.05)
    return {
        'xmin': float(round(min(xs) - margin_x, 1)),
        'ymin': float(round(min(ys) - margin_y, 1)),
        'xmax': float(round(max(xs) + margin_x, 1)),
        'ymax': float(round(max(ys) + margin_y, 1)),
    }

def _render_entities_pillow(entities, dimensions, texts, output_path, img_w=1600, img_h=1000, bbox=None):
    if bbox:
        xmin = bbox.get('xmin', 0)
        ymin = bbox.get('ymin', 0)
        xmax = bbox.get('xmax', 1000)
        ymax = bbox.get('ymax', 1000)
    else:
        all_pts = []
        for ent in entities:
            if 'points' in ent:
                all_pts.extend(ent['points'])
            if 'center' in ent:
                cx, cy = ent['center']
                if 'radius' in ent:
                    all_pts.append((cx - ent['radius'], cy - ent['radius']))
                    all_pts.append((cx + ent['radius'], cy + ent['radius']))
                else:
                    all_pts.append((cx, cy))
        for d in dimensions:
            all_pts.append(d['position'])
        for t in texts:
            all_pts.append(t['position'])
        if not all_pts:
            return False
        xs = [p[0] for p in all_pts]
        ys = [p[1] for p in all_pts]
        xmin, xmax = min(xs), max(xs)
        ymin, ymax = min(ys), max(ys)
        pad = max(10, (xmax - xmin) * 0.05)
        xmin -= pad; xmax += pad
        ymin -= pad; ymax += pad
    span_x = xmax - xmin
    span_y = ymax - ymin
    if span_x <= 0 or span_y <= 0:
        return False
    scale = min(img_w / span_x, img_h / span_y)
    def tx(x):
        return (x - xmin) * scale
    def ty(y):
        return img_h - (y - ymin) * scale
    img = Image.new('RGB', (img_w, img_h), 'white')
    draw = ImageDraw.Draw(img)
    font_small = _find_font(14)
    font_big = _find_font(16)
    for ent in entities:
        try:
            if ent['type'] in ('LINE', 'LWPOLYLINE', 'POLYLINE'):
                pts = ent.get('points') or []
                if len(pts) < 2:
                    continue
                coords = []
                for p in pts:
                    coords.append((tx(p[0]), ty(p[1])))
                draw.line(coords, fill='black', width=2, joint='curve')
            elif ent['type'] == 'CIRCLE':
                cx, cy = ent['center']
                r = ent['radius']
                x0 = tx(cx - r); y0 = ty(cy + r)
                x1 = tx(cx + r); y1 = ty(cy - r)
                draw.ellipse([x0, y0, x1, y1], outline='black', width=2)
            elif ent['type'] == 'ARC':
                cx, cy = ent['center']
                r = ent['radius']
                a1 = ent['start_angle']
                a2 = ent['end_angle']
                if a2 < a1:
                    a2 += 360
                x0 = tx(cx - r); y0 = ty(cy + r)
                x1 = tx(cx + r); y1 = ty(cy - r)
                draw.arc([x0, y0, x1, y1], start=a1, end=a2, fill='black', width=2)
        except Exception:
            continue
    for d in dimensions:
        try:
            pos = d['position']
            text = str(d.get('text', ''))
            px, py = tx(pos[0]), ty(pos[1])
            bbox = draw.textbbox((px, py), text, font=font_small)
            draw.rectangle(bbox, fill='white')
            draw.text((px, py), text, fill=(0, 0, 180), font=font_small)
        except Exception:
            continue
    for t in texts:
        try:
            pos = t['position']
            content = str(t.get('content', ''))
            if not content.strip():
                continue
            px, py = tx(pos[0]), ty(pos[1])
            bbox = draw.textbbox((px, py), content, font=font_big)
            draw.rectangle(bbox, fill='white')
            draw.text((px, py), content, fill=(0, 120, 0), font=font_big)
        except Exception:
            continue
    img.save(output_path, 'PNG')
    return True

def export_preview(doc, output_path, parsed_data=None):
    os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else '.', exist_ok=True)
    if parsed_data:
        try:
            if _render_entities_pillow(
                parsed_data.get('entities', []),
                parsed_data.get('dimensions', []),
                parsed_data.get('texts', []),
                output_path
            ):
                return True
        except Exception as e:
            print(f"Pillow render error: {e}")
    return False

def parse_dxf(filepath):
    if not os.path.exists(filepath):
        return {'error': f'File not found: {filepath}'}
    doc = ezdxf.readfile(filepath)
    msp = doc.modelspace()
    entities = extract_entities(msp)
    dimensions = extract_dimensions(msp)
    texts = extract_texts(msp)
    bbox = compute_bounding_box(entities, dimensions, texts)
    all_pts = []
    for ent in entities:
        if 'points' in ent:
            all_pts.extend(ent['points'])
        if 'center' in ent:
            cx, cy = ent['center']
            if 'radius' in ent:
                all_pts.append((cx - ent['radius'], cy - ent['radius']))
                all_pts.append((cx + ent['radius'], cy + ent['radius']))
            else:
                all_pts.append((cx, cy))
    for d in dimensions:
        all_pts.append(d['position'])
    for t in texts:
        all_pts.append(t['position'])
    if all_pts:
        xs = [p[0] for p in all_pts]
        ys = [p[1] for p in all_pts]
        rxmin, rxmax = min(xs), max(xs)
        rymin, rymax = min(ys), max(ys)
        rpad = max(10, (rxmax - rxmin) * 0.05)
        render_bbox = {'xmin': rxmin - rpad, 'ymin': rymin - rpad, 'xmax': rxmax + rpad, 'ymax': rymax + rpad}
    else:
        render_bbox = bbox
    preview_dir = os.path.join(os.path.dirname(filepath) or '.', 'output')
    os.makedirs(preview_dir, exist_ok=True)
    preview_path = os.path.join(preview_dir, 'preview.png')
    parsed_data = {
        'entities': entities,
        'dimensions': dimensions,
        'texts': texts,
    }
    export_preview(doc, preview_path, parsed_data=parsed_data)
    return {
        'filename': os.path.basename(filepath),
        'filepath': filepath,
        'bounding_box': bbox,
        'render_bbox': render_bbox,
        'dimensions': dimensions,
        'entities': entities,
        'texts': texts,
        'preview_image_path': preview_path if os.path.exists(preview_path) else None,
    }
