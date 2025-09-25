from __future__ import annotations
import json, os, glob, yaml
from typing import Dict, Any, List, Tuple

NAV_CACHE = "modules/nav-shell/cache/nav.json"

def _k(item: dict) -> tuple[int, str]:
    return (int(item.get("order", 9999)), str(item.get("text", "")))

def rebuild_nav_cache() -> dict:
    files = glob.glob("modules/*/config/menu.register.yaml")
    l1_map: Dict[tuple[str, str], dict] = {}
    l2_map: Dict[str, Dict[tuple[str, str], dict]] = {}
    l3_map: Dict[str, List[dict]] = {}

    for fp in files:
        with open(fp, "r", encoding="utf-8") as f:
            y = yaml.safe_load(f) or {}
        for it in y.get("l1", []) or []:
            key = (it.get("key"), it.get("href"))
            if key not in l1_map:
                l1_map[key] = it
        for parent, arr in (y.get("l2") or {}).items():
            l2_map.setdefault(parent, {})
            for it in arr or []:
                key = (it.get("key"), it.get("href"))
                if key not in l2_map[parent]:
                    l2_map[parent][key] = it
        for parent, arr in (y.get("l3") or {}).items():
            exists = l3_map.setdefault(parent, [])
            exists.extend(arr or [])

    nav = {
        "l1": sorted(l1_map.values(), key=_k),
        "l2": { parent: sorted(d.values(), key=_k) for parent, d in l2_map.items() },
        "l3": { parent: sorted(lst, key=_k) for parent, lst in l3_map.items() },
    }
    os.makedirs(os.path.dirname(NAV_CACHE), exist_ok=True)
    with open(NAV_CACHE, "w", encoding="utf-8") as f:
        json.dump(nav, f, ensure_ascii=False, indent=2)
    return nav
