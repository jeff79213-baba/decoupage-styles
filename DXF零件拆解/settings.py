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
