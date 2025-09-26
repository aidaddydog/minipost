# -*- coding: utf-8 -*-
"""
统一导航聚合（唯一事实源）：使用 app.services.nav_loader.rebuild_nav
原先这里的“树形菜单校验(level/children/...)”已废弃，改为 menu.register.yaml + tabs.register.yaml。
"""
import time, threading
from typing import Dict, Any
from app.services.nav_loader import rebuild_nav

# 进程内缓存
_NAV_CACHE: Dict[str, Any] = {'ts': 0.0, 'data': {}}
_NAV_LOCK = threading.Lock()

def get_nav_cache() -> Dict[str, Any]:
    """返回 nav_loader 的结构（含 ts），前端主要消费 menu/tabs。"""
    with _NAV_LOCK:
        nav = _NAV_CACHE['data'] or {
            "menu": {}, "tabs": {}, "generated_at": None, "hash": "0"*16,
            "stats": {"modules": 0, "menus": 0, "tabs": 0}
        }
        # 兼容：附带 ts，便于排障
        return {"ts": _NAV_CACHE['ts'], **nav}

def refresh_nav_cache() -> Dict[str, Any]:
    """
    重建聚合缓存；保持与脚本预期相容（返回 ok/errors/统计），
    但不再做旧版 level/children 树形校验。
    """
    ok = True
    errors = []
    try:
        nav = rebuild_nav(write_cache=True)  # 统一新版 Schema 校验与聚合
    except Exception as e:
        ok = False
        nav = {
            "menu": {}, "tabs": {}, "generated_at": None, "hash": "0"*16,
            "stats": {"modules": 0, "menus": 0, "tabs": 0}
        }
        errors = [str(e)]

    with _NAV_LOCK:
        _NAV_CACHE['ts'] = time.time()
        _NAV_CACHE['data'] = nav

    # 兼容 bootstrap 的“校验输出窗口”
    return {"ok": ok, "errors": errors, **nav}
