import math

GROUPING_DISTANCE = 50.0
MATCH_DISTANCE = 300.0

def point_distance(p1, p2):
    return math.sqrt((p1[0] - p2[0])**2 + (p1[1] - p2[1])**2)

def get_entity_points(ent):
    if 'points' in ent:
        return ent['points']
    if ent['type'] == 'CIRCLE':
        cx, cy = ent['center']
        return [(cx - ent['radius'], cy), (cx + ent['radius'], cy),
                (cx, cy - ent['radius']), (cx, cy + ent['radius'])]
    if ent['type'] == 'ARC':
        cx, cy = ent['center']
        return [(cx, cy)]
    if ent['type'] == 'ELLIPSE':
        return [ent['center']]
    return []

def entities_nearby(e1, e2, threshold=GROUPING_DISTANCE):
    pts1 = get_entity_points(e1)
    pts2 = get_entity_points(e2)
    for p1 in pts1:
        for p2 in pts2:
            if point_distance(p1, p2) < threshold:
                return True
    b1 = entity_bounds(e1)
    b2 = entity_bounds(e2)
    if b1 and b2:
        def inside(b, pt):
            return b[0] <= pt[0] <= b[2] and b[1] <= pt[1] <= b[3]
        c1 = e1.get('center') if e1['type'] in ('CIRCLE', 'ARC') else None
        c2 = e2.get('center') if e2['type'] in ('CIRCLE', 'ARC') else None
        if c1 and inside(b2, c1):
            return True
        if c2 and inside(b1, c2):
            return True
    return False

def entity_bounds(ent):
    pts = get_entity_points(ent)
    if not pts:
        return None
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return (min(xs), min(ys), max(xs), max(ys))

def estimate_shape(entities):
    types = [e['type'] for e in entities]
    has_line = any(t in ('LINE', 'LWPOLYLINE', 'POLYLINE') for t in types)
    has_circle = any(t == 'CIRCLE' for t in types)
    has_arc = any(t == 'ARC' for t in types)
    all_points = []
    for e in entities:
        pts = get_entity_points(e)
        all_points.extend(pts)
    if not all_points:
        return "未知形狀"
    xs = [p[0] for p in all_points]
    ys = [p[1] for p in all_points]
    w = max(xs) - min(xs)
    h = max(ys) - min(ys)
    aspect = w / h if h > 0 else 99
    if has_circle and not has_line:
        if len([e for e in entities if e['type'] == 'CIRCLE']) == 1:
            return "圓形"
        return "多個圓形"
    if has_arc and not has_line and not has_circle:
        return "弧形"
    if has_line:
        if aspect > 5:
            return "長條形"
        if w < 1 and h < 1:
            return "點"
        if len(all_points) <= 5:
            if abs(w - h) < max(w, h) * 0.5:
                return "矩形"
            return "長方形"
        if aspect < 1.2:
            return "矩形"
        return "不規則形"
    return "複合形狀"

def extract_thickness_from_text(texts, bounds):
    if not bounds:
        return None
    bx_min, by_min, bx_max, by_max = bounds
    cx = (bx_min + bx_max) / 2
    cy = (by_min + by_max) / 2
    part_diag = math.sqrt((bx_max - bx_min)**2 + (by_max - by_min)**2)
    search_dist = max(GROUPING_DISTANCE * 2, part_diag * 0.5)
    for t in texts:
        px, py = t['position']
        d = point_distance((cx, cy), (px, py))
        if d > search_dist:
            continue
        content = t['content'].strip()
        import re
        m = re.search(r'(?:t|thk|thickness|厚度|厚)[\s:=]*(\d+(?:\.\d+)?)', content, re.IGNORECASE)
        if m:
            return float(m.group(1))
        m = re.search(r'(\d+(?:\.\d+)?)[\s]*[tT](?:hick(?:ness)?|厚)?', content)
        if m:
            return float(m.group(1))
    return None

def extract_part_id(texts, bounds):
    if not bounds:
        return None
    bx_min, by_min, bx_max, by_max = bounds
    cx = (bx_min + bx_max) / 2
    cy = (by_min + by_max) / 2
    best_dist = 99999
    best_id = None
    for t in texts:
        content = t['content'].strip()
        px, py = t['position']
        d = point_distance((cx, cy), (px, py))
        if d < best_dist and d < GROUPING_DISTANCE * 2:
            if any(k in content for k in ('P-', '件號', 'NO.', 'PART', 'P', '#')):
                best_dist = d
                best_id = content
    return best_id

def group_into_parts(parsed):
    entities = parsed.get('entities', [])
    dimensions = parsed.get('dimensions', [])
    texts = parsed.get('texts', [])
    layer_groups = {}
    for ent in entities:
        layer = ent.get('layer', '0')
        if layer not in layer_groups:
            layer_groups[layer] = []
        layer_groups[layer].append(ent)
    parts = []
    part_counter = 0
    for layer, group_ents in layer_groups.items():
        if layer in ('0', 'DEFPOINTS', 'DIM'):
            continue
        used = [False] * len(group_ents)
        for i in range(len(group_ents)):
            if used[i]:
                continue
            cluster = [group_ents[i]]
            used[i] = True
            changed = True
            while changed:
                changed = False
                for j in range(len(group_ents)):
                    if used[j]:
                        continue
                    for ce in cluster:
                        if entities_nearby(ce, group_ents[j]):
                            cluster.append(group_ents[j])
                            used[j] = True
                            changed = True
                            break
            bounds = None
            all_pts = []
            for e in cluster:
                pts = get_entity_points(e)
                all_pts.extend(pts)
            if all_pts:
                xs = [p[0] for p in all_pts]
                ys = [p[1] for p in all_pts]
                bounds = (min(xs), min(ys), max(xs), max(ys))
            part_id = extract_part_id(texts, bounds)
            if not part_id:
                part_counter += 1
                part_id = f"P-{part_counter:02d}"
            shape = estimate_shape(cluster)
            part_info = {
                'part_id': part_id,
                'layer': layer,
                'shape': shape,
                'bounds': bounds,
                'entities': cluster,
                'dimensions': [],
            }
            parts.append(part_info)
    def get_measure_point(dim):
        p2 = dim.get('defpoint2')
        p3 = dim.get('defpoint3')
        if p2 and p3:
            return ((p2[0] + p3[0]) / 2, (p2[1] + p3[1]) / 2)
        return dim['position']

    for dim in dimensions:
        best_part = None
        best_dist = float('inf')
        mx, my = get_measure_point(dim)
        for part in parts:
            if not part['bounds']:
                continue
            b = part['bounds']
            px = max(b[0], min(mx, b[2]))
            py = max(b[1], min(my, b[3]))
            d = point_distance((mx, my), (px, py))
            part_diag = math.sqrt((b[2]-b[0])**2 + (b[3]-b[1])**2)
            threshold = max(MATCH_DISTANCE, part_diag * 0.6)
            if d < threshold and d < best_dist:
                best_dist = d
                best_part = part
        if best_part is not None:
            part_dims = best_part.setdefault('dimensions', [])
            part_dims.append(dict(dim))
    return parts

def analyze_part_dimensions(part):
    dims = part.get('dimensions', [])
    vals = [d['value'] for d in dims]
    result = {'length': None, 'width': None, 'thickness': None}
    if not vals:
        return result
    sorted_vals = sorted(set(vals))
    thickness_candidates = [v for v in sorted_vals if v < 50]
    other_candidates = [v for v in sorted_vals if v >= 50]
    if thickness_candidates:
        result['thickness'] = thickness_candidates[0]
        remaining = [v for v in sorted_vals if v != result['thickness']]
    else:
        remaining = sorted_vals
    if len(remaining) >= 2:
        result['length'] = remaining[-1]
        result['width'] = remaining[-2]
    elif len(remaining) == 1:
        result['length'] = remaining[0]
        result['width'] = None
    return result

def detect_issues(parts, parsed):
    issues = []
    for part in parts:
        dims = part.get('dimensions', [])
        dim_values = [d['value'] for d in dims]
        seen = {}
        for d in dims:
            v = d['value']
            desc = f"零件 {part['part_id']} 有重複標註數值 {v}mm"
            if v in seen and seen[v] != d['position']:
                if not any(i['description'] == desc for i in issues):
                    issues.append({
                        'part_id': part['part_id'],
                        'zone': str(part['bounds']) if part['bounds'] else '',
                        'description': desc,
                        'reason': '重複標註，請確認是否為不同位置'
                    })
            seen[v] = d['position']
        unique_vals = list(set(dim_values))
        has_thickness = part.get('extracted_thickness') is not None
        has_length = part.get('extracted_length') is not None
        has_width = part.get('extracted_width') is not None
        missing = []
        if not has_length:
            missing.append('長度')
        if not has_width:
            missing.append('寬度')
        if not has_thickness:
            missing.append('厚度')
        if missing:
            issues.append({
                'part_id': part['part_id'],
                'zone': str(part['bounds']) if part['bounds'] else '',
                'description': f"零件 {part['part_id']} 缺少{'、'.join(missing)}標註",
                'reason': f"未偵測到{'、'.join(missing)}相關的標註資料"
            })
        shape = part.get('shape', '')
        if '未知' in shape:
            issues.append({
                'part_id': part['part_id'],
                'zone': str(part['bounds']) if part['bounds'] else '',
                'description': f"零件 {part['part_id']} 形狀無法判定",
                'reason': '幾何資料不足以判斷形狀'
            })
    all_dim_values = []
    for part in parts:
        for d in part.get('dimensions', []):
            all_dim_values.append(d['value'])
    if not all_dim_values:
        issues.append({
            'part_id': '全局',
            'zone': '整張圖面',
            'description': '圖面中未偵測到任何尺寸標註',
            'reason': 'DXF 檔案可能缺少 DIMENSION 實體，或標註未被正確解析'
        })
    return issues

def analyze(parsed):
    parts = group_into_parts(parsed)
    texts = parsed.get('texts', [])
    for part in parts:
        dim_result = analyze_part_dimensions(part)
        part['extracted_length'] = dim_result['length']
        part['extracted_width'] = dim_result['width']
        part['extracted_thickness'] = dim_result['thickness']
        thick_text = extract_thickness_from_text(texts, part.get('bounds'))
        if part['extracted_thickness'] is None and thick_text is not None:
            part['extracted_thickness'] = thick_text
            part['thickness_source'] = '文字註記'
        elif part['extracted_thickness'] is not None:
            part['thickness_source'] = '尺寸標註'
        else:
            part['thickness_source'] = '無'
    issues = detect_issues(parts, parsed)
    material_summary = []
    for part in parts:
        note = ''
        if part.get('thickness_source') == '文字註記':
            note = '厚度來自文字註記，建議人工確認'
        material_summary.append({
            'part_id': part['part_id'],
            'layer': part['layer'],
            'shape': part['shape'],
            'length': part['extracted_length'],
            'width': part['extracted_width'],
            'thickness': part['extracted_thickness'],
            'unit': 'mm',
            'dimension_count': len(part['dimensions']),
            'bounds': part.get('bounds'),
            'note': note,
        })
    return {
        'parts': material_summary,
        'issues': issues,
    }
