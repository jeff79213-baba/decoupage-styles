import math

SNAP_ENDPOINT = 'endpoint'
SNAP_MIDPOINT = 'midpoint'
SNAP_CENTER = 'center'
SNAP_QUADRANT = 'quadrant'
SNAP_INTERSECTION = 'intersection'


def _left_normal(p1, p2):
    dx = p2[0] - p1[0]
    dy = p2[1] - p1[1]
    L = math.hypot(dx, dy)
    if L < 1e-12:
        return (0.0, 0.0)
    return (-dy / L, dx / L)


def _arc_from_bulge(p1, p2, bulge):
    """Return (center, radius) for a bulged polyline segment, or None."""
    x1, y1 = p1
    x2, y2 = p2
    dx = x2 - x1
    dy = y2 - y1
    L = math.hypot(dx, dy)
    if L < 1e-12 or abs(bulge) < 1e-6:
        return None
    nx, ny = _left_normal(p1, p2)
    h = L * (bulge * bulge - 1.0) / (4.0 * bulge)
    radius = abs(L * (1.0 + bulge * bulge) / (4.0 * bulge))
    return ((x1 + x2) / 2.0 + nx * h, (y1 + y2) / 2.0 + ny * h), radius


def _angle_deg(px, py, cx, cy):
    return math.degrees(math.atan2(py - cy, px - cx)) % 360.0


def _on_arc(pt, center, radius, a_deg, b_deg, ccw):
    """Check whether pt (on the circle) lies within the arc from a to b."""
    px, py = pt
    cx, cy = center
    if abs(math.hypot(px - cx, py - cy) - radius) > 1e-3:
        return False
    theta = _angle_deg(px, py, cx, cy)
    if ccw:
        sweep = (b_deg - a_deg) % 360.0
    else:
        sweep = (a_deg - b_deg) % 360.0
    d = (theta - a_deg) % 360.0
    return d <= sweep + 1e-3


def _seg_seg_intersection(p1, p2, p3, p4):
    x1, y1 = p1
    x2, y2 = p2
    x3, y3 = p3
    x4, y4 = p4
    den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    if abs(den) < 1e-12:
        return None
    t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den
    u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den
    if -1e-9 <= t <= 1.0 + 1e-9 and -1e-9 <= u <= 1.0 + 1e-9:
        return (x1 + t * (x2 - x1), y1 + t * (y2 - y1))
    return None


def _line_circle(p1, p2, center, radius):
    cx, cy = center
    x1, y1 = p1
    x2, y2 = p2
    dx = x2 - x1
    dy = y2 - y1
    fx = x1 - cx
    fy = y1 - cy
    a = dx * dx + dy * dy
    if a < 1e-12:
        return []
    b = 2.0 * (fx * dx + fy * dy)
    c = fx * fx + fy * fy - radius * radius
    disc = b * b - 4.0 * a * c
    if disc < -1e-9:
        return []
    disc = max(disc, 0.0)
    sq = math.sqrt(disc)
    out = []
    for t in ((-b + sq) / (2.0 * a), (-b - sq) / (2.0 * a)):
        if -1e-9 <= t <= 1.0 + 1e-9:
            out.append((x1 + t * dx, y1 + t * dy))
    return out


def _circle_circle(c1, r1, c2, r2):
    x1, y1 = c1
    x2, y2 = c2
    d = math.hypot(x2 - x1, y2 - y1)
    if d < 1e-12:
        return []
    if d > r1 + r2 + 1e-9 or d < abs(r1 - r2) - 1e-9:
        return []
    a = (r1 * r1 - r2 * r2 + d * d) / (2.0 * d)
    h2 = r1 * r1 - a * a
    if h2 < 0.0:
        if h2 < -1e-6:
            return []
        h2 = 0.0
    h = math.sqrt(h2)
    xm = x1 + a * (x2 - x1) / d
    ym = y1 + a * (y2 - y1) / d
    if h < 1e-9:
        return [(xm, ym)]
    dx = -h * (y2 - y1) / d
    dy = h * (x2 - x1) / d
    return [(xm + dx, ym + dy), (xm - dx, ym - dy)]


def get_snap_points(entity_list):
    """Collect endpoint/midpoint/center/quadrant snap candidates.

    entity_list: list of dicts from build_entity_list()
    returns:     list of dicts {"point":(x,y), "type":SNAP_*, "entity_id":id}
    """
    snap_points = []
    for ent in entity_list:
        etype = ent.get('type')
        eid = ent.get('id')
        if etype in ('LINE', 'XLINE', 'RAY', 'SPLINE'):
            pts = ent.get('points') or []
            if len(pts) < 2:
                continue
            snap_points.append({'point': pts[0], 'type': SNAP_ENDPOINT, 'entity_id': eid})
            snap_points.append({'point': pts[-1], 'type': SNAP_ENDPOINT, 'entity_id': eid})
            for i in range(len(pts) - 1):
                p1, p2 = pts[i], pts[i + 1]
                snap_points.append({
                    'point': ((p1[0] + p2[0]) / 2.0, (p1[1] + p2[1]) / 2.0),
                    'type': SNAP_MIDPOINT, 'entity_id': eid})
        elif etype in ('LWPOLYLINE', 'POLYLINE'):
            pts = ent.get('points') or []
            bulges = ent.get('bulges') or [0.0] * len(pts)
            if len(pts) < 2:
                continue
            snap_points.append({'point': pts[0], 'type': SNAP_ENDPOINT, 'entity_id': eid})
            snap_points.append({'point': pts[-1], 'type': SNAP_ENDPOINT, 'entity_id': eid})
            for i in range(len(pts) - 1):
                p1, p2 = pts[i], pts[i + 1]
                bulge = bulges[i] if i < len(bulges) else 0.0
                if abs(bulge) > 1e-6:
                    nx, ny = _left_normal(p1, p2)
                    s = math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * bulge / 2.0
                    snap_points.append({
                        'point': ((p1[0] + p2[0]) / 2.0 + nx * s, (p1[1] + p2[1]) / 2.0 + ny * s),
                        'type': SNAP_MIDPOINT, 'entity_id': eid})
                else:
                    snap_points.append({
                        'point': ((p1[0] + p2[0]) / 2.0, (p1[1] + p2[1]) / 2.0),
                        'type': SNAP_MIDPOINT, 'entity_id': eid})
            if ent.get('closed') and len(pts) > 2:
                p1, p2 = pts[-1], pts[0]
                bulge = bulges[-1] if bulges else 0.0
                if abs(bulge) > 1e-6:
                    nx, ny = _left_normal(p1, p2)
                    s = math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * bulge / 2.0
                    snap_points.append({
                        'point': ((p1[0] + p2[0]) / 2.0 + nx * s, (p1[1] + p2[1]) / 2.0 + ny * s),
                        'type': SNAP_MIDPOINT, 'entity_id': eid})
                else:
                    snap_points.append({
                        'point': ((p1[0] + p2[0]) / 2.0, (p1[1] + p2[1]) / 2.0),
                        'type': SNAP_MIDPOINT, 'entity_id': eid})
        elif etype == 'CIRCLE':
            cx, cy = ent.get('center') or (0, 0)
            r = ent.get('radius') or 0
            snap_points.append({'point': (cx, cy), 'type': SNAP_CENTER, 'entity_id': eid})
            snap_points.append({'point': (cx + r, cy), 'type': SNAP_QUADRANT, 'entity_id': eid})
            snap_points.append({'point': (cx - r, cy), 'type': SNAP_QUADRANT, 'entity_id': eid})
            snap_points.append({'point': (cx, cy + r), 'type': SNAP_QUADRANT, 'entity_id': eid})
            snap_points.append({'point': (cx, cy - r), 'type': SNAP_QUADRANT, 'entity_id': eid})
        elif etype == 'ARC':
            cx, cy = ent.get('center') or (0, 0)
            r = ent.get('radius') or 0
            sa = math.radians(ent.get('start_angle') or 0)
            ea = math.radians(ent.get('end_angle') or 0)
            snap_points.append({'point': (cx, cy), 'type': SNAP_CENTER, 'entity_id': eid})
            snap_points.append({
                'point': (cx + r * math.cos(sa), cy + r * math.sin(sa)),
                'type': SNAP_ENDPOINT, 'entity_id': eid})
            snap_points.append({
                'point': (cx + r * math.cos(ea), cy + r * math.sin(ea)),
                'type': SNAP_ENDPOINT, 'entity_id': eid})
            for deg in (0, 90, 180, 270):
                rad = math.radians(deg)
                snap_points.append({
                    'point': (cx + r * math.cos(rad), cy + r * math.sin(rad)),
                    'type': SNAP_QUADRANT, 'entity_id': eid})
        elif etype == 'ELLIPSE':
            cx, cy = ent.get('center') or (0, 0)
            mx, my = ent.get('major_axis') or (0, 0)
            ratio = ent.get('ratio') or 1.0
            r_major = math.hypot(mx, my)
            angle = math.atan2(my, mx)
            minor = r_major * ratio
            snap_points.append({'point': (cx, cy), 'type': SNAP_CENTER, 'entity_id': eid})
            cos_a = math.cos(angle)
            sin_a = math.sin(angle)
            for k in (1, -1):
                snap_points.append({
                    'point': (cx + r_major * cos_a * k, cy + r_major * sin_a * k),
                    'type': SNAP_QUADRANT, 'entity_id': eid})
                snap_points.append({
                    'point': (cx - minor * sin_a * k, cy + minor * cos_a * k),
                    'type': SNAP_QUADRANT, 'entity_id': eid})
        elif etype in ('TEXT', 'MTEXT', 'DIMENSION'):
            pts = ent.get('points') or ent.get('position')
            if pts:
                if isinstance(pts, tuple):
                    pts = [pts]
                for p in pts:
                    snap_points.append({'point': p, 'type': SNAP_ENDPOINT, 'entity_id': eid})
    return snap_points


def get_intersection_points(entity_list):
    """Compute line/line, line/circle, circle/circle intersections as snap points."""
    segs = []
    for ent in entity_list:
        etype = ent['type']
        if etype in ('LINE', 'XLINE', 'RAY'):
            pts = ent.get('points')
            if pts and len(pts) >= 2:
                segs.append((pts[0], pts[1]))
        elif etype in ('LWPOLYLINE', 'POLYLINE'):
            pts = ent.get('points') or []
            bulges = ent.get('bulges') or [0.0] * len(pts)
            if len(pts) >= 2:
                for i in range(len(pts) - 1):
                    if i >= len(bulges) or abs(bulges[i]) < 1e-6:
                        segs.append((pts[i], pts[i + 1]))
                if ent.get('closed') and len(pts) > 2:
                    last = len(pts) - 1
                    if len(bulges) <= last or abs(bulges[last]) < 1e-6:
                        segs.append((pts[last], pts[0]))

    circles = [(ent['center'], ent['radius'])
               for ent in entity_list if ent['type'] == 'CIRCLE']

    arcs = []
    for ent in entity_list:
        if ent['type'] == 'ARC':
            arcs.append((ent['center'], ent['radius'],
                         ent.get('start_angle') or 0, ent.get('end_angle') or 0, True))
    for ent in entity_list:
        if ent['type'] not in ('LWPOLYLINE', 'POLYLINE'):
            continue
        pts = ent.get('points') or []
        bulges = ent.get('bulges') or [0.0] * len(pts)
        if len(pts) < 2:
            continue
        for i in range(len(pts) - 1):
            if i < len(bulges) and abs(bulges[i]) > 1e-6:
                geo = _arc_from_bulge(pts[i], pts[i + 1], bulges[i])
                if geo:
                    center, radius = geo
                    arcs.append((center, radius,
                                 _angle_deg(pts[i][0], pts[i][1], center[0], center[1]),
                                 _angle_deg(pts[i + 1][0], pts[i + 1][1], center[0], center[1]),
                                 bulges[i] > 0))
        if ent.get('closed') and len(pts) > 2:
            last = len(pts) - 1
            if len(bulges) > last and abs(bulges[last]) > 1e-6:
                geo = _arc_from_bulge(pts[last], pts[0], bulges[last])
                if geo:
                    center, radius = geo
                    arcs.append((center, radius,
                                 _angle_deg(pts[last][0], pts[last][1], center[0], center[1]),
                                 _angle_deg(pts[0][0], pts[0][1], center[0], center[1]),
                                 bulges[last] > 0))

    results = []
    seen = set()

    def add(points):
        for p in points:
            if p is None:
                continue
            k = (round(p[0], 3), round(p[1], 3))
            if k not in seen:
                seen.add(k)
                results.append({'point': k, 'type': SNAP_INTERSECTION, 'entity_id': None})

    n = len(segs)
    for i in range(n):
        for j in range(i + 1, n):
            add([_seg_seg_intersection(segs[i][0], segs[i][1], segs[j][0], segs[j][1])])

    for p1, p2 in segs:
        for center, radius in circles:
            add(_line_circle(p1, p2, center, radius))

    m = len(circles)
    for i in range(m):
        for j in range(i + 1, m):
            add(_circle_circle(circles[i][0], circles[i][1], circles[j][0], circles[j][1]))

    for p1, p2 in segs:
        for center, radius, a_deg, b_deg, ccw in arcs:
            for pt in _line_circle(p1, p2, center, radius):
                if _on_arc(pt, center, radius, a_deg, b_deg, ccw):
                    add([pt])

    for center1, radius1 in circles:
        for center2, radius2, a_deg, b_deg, ccw in arcs:
            for pt in _circle_circle(center1, radius1, center2, radius2):
                if _on_arc(pt, center2, radius2, a_deg, b_deg, ccw):
                    add([pt])

    return results


def find_nearest_snap(mouse_world_pos, snap_points, tolerance_world):
    """Return the closest snap candidate within tolerance.

    mouse_world_pos: (x, y) in world units
    snap_points:     list from get_snap_points()/get_intersection_points()
    tolerance_world: snap radius in world units
    returns:         {"point":(x,y), "type":..., "entity_id":...} or None
    """
    best = None
    best_dist = tolerance_world
    mx, my = mouse_world_pos
    for sp in snap_points:
        px, py = sp['point']
        dx = px - mx
        dy = py - my
        d = dx * dx + dy * dy
        if d < best_dist * best_dist:
            best_dist = math.sqrt(d)
            best = sp
    if best is not None:
        return {
            'point': best['point'],
            'type': best['type'],
            'entity_id': best['entity_id'],
        }
    return None
