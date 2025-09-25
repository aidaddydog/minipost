from __future__ import annotations
import os, json, yaml, glob, pathlib
from typing import Any, Dict, List

BASE_DIR = pathlib.Path(__file__).resolve().parents[4]  # .../minipost
MODULES_DIR = BASE_DIR / 'modules'
CACHE_FILE = BASE_DIR / 'modules/nav-shell/cache/nav.json'

def _read_yaml(path: pathlib.Path) -> dict:
    try:
        with path.open('r', encoding='utf-8') as f:
            return yaml.safe_load(f) or {}
    except FileNotFoundError:
        return {}
    except Exception as e:
        print(f"[nav] 读取 YAML 失败: {path}: {e}")
        return {}

def rebuild_nav_cache() -> dict:
    l1: List[dict] = []
    l2: Dict[str, List[dict]] = {}
    l3: Dict[str, List[dict]] = {}

    # 扫描 modules/*/config/menu.register.yaml
    for module_dir in MODULES_DIR.iterdir():
        cfg = module_dir / 'config/menu.register.yaml'
        if not cfg.exists():
            continue
        doc = _read_yaml(cfg)
        m_l1 = doc.get('l1') or []
        m_l2 = doc.get('l2') or {}
        m_l3 = doc.get('l3') or {}
        # 合并 l1
        for item in m_l1:
            l1.append(item)
        # 合并 l2
        for k, arr in m_l2.items():
            l2.setdefault(k, [])
            l2[k].extend(arr or [])
        # 合并 l3
        for k, arr in m_l3.items():
            l3.setdefault(k, [])
            l3[k].extend(arr or [])

    # 去重（按 key/href）
    def uniq(items: List[dict]) -> List[dict]:
        seen = set()
        out = []
        for it in items:
            key = (it.get('key') or it.get('text') or '', it.get('href') or '')
            if key in seen: 
                continue
            seen.add(key); out.append(it)
        # 排序：order, text
        out.sort(key=lambda x: (x.get('order', 999), str(x.get('text', ''))))
        return out

    l1 = uniq(l1)
    for k, arr in list(l2.items()):
        l2[k] = uniq(arr)
    for k, arr in list(l3.items()):
        l3[k] = uniq(arr)

    nav = { 'l1': l1, 'l2': l2, 'l3': l3 }
    CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    CACHE_FILE.write_text(json.dumps(nav, ensure_ascii=False, indent=2), encoding='utf-8')
    return nav

def load_nav_cache() -> dict:
    if CACHE_FILE.exists():
        try:
            return json.loads(CACHE_FILE.read_text(encoding='utf-8'))
        except Exception:
            pass
    return rebuild_nav_cache()

def filter_nav(nav: dict, user_perms: set[str] | None, authenticated: bool) -> dict:
    perms = user_perms or set()
    # 过滤函数
    def allow(item: dict) -> tuple[bool, dict]:
        # 可选权限字段
        ra = set(item.get('require_all') or [])
        ry = set(item.get('require_any') or [])
        visible_when_denied = bool(item.get('visible_when_denied', False))
        is_ok = True
        if ra and not ra.issubset(perms):
            is_ok = False
        if ry and not (ry & perms):
            is_ok = False
        if is_ok:
            d = dict(item)
            d.pop('require_all', None); d.pop('require_any', None); d.pop('visible_when_denied', None)
            return True, d
        else:
            if visible_when_denied:
                d = dict(item); d['disabled'] = True
                d.pop('require_all', None); d.pop('require_any', None); d.pop('visible_when_denied', None)
                return True, d
            return False, item

    out_l1 = []
    out_l2 = {}
    out_l3 = {}
    for it in nav.get('l1', []):
        ok, d = allow(it)
        if ok: out_l1.append(d)

    for k, arr in (nav.get('l2') or {}).items():
        tmp = []
        for it in arr:
            ok, d = allow(it)
            if ok: tmp.append(d)
        if tmp: out_l2[k] = tmp

    for k, arr in (nav.get('l3') or {}).items():
        tmp = []
        for it in arr:
            ok, d = allow(it)
            if ok: tmp.append(d)
        if tmp: out_l3[k] = tmp

    return { 'l1': out_l1, 'l2': out_l2, 'l3': out_l3 }
