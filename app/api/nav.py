# app/api/v1/nav.py
# -*- coding: utf-8 -*-
from fastapi import APIRouter, Query
from typing import Dict, Any, List

# 优先使用进程内缓存
try:
    from app.common.utils import get_nav_cache, refresh_nav_cache  # type: ignore
except Exception:  # 兜底：直接重建（不建议生产使用）
    from app.services.nav_loader import rebuild_nav  # type: ignore
    def get_nav_cache() -> Dict[str, Any]:
        nav = rebuild_nav(write_cache=False)  # type: ignore
        return {"ts": 0.0, "data": nav}
    def refresh_nav_cache() -> Dict[str, Any]:
        nav = rebuild_nav(write_cache=True)  # type: ignore
        return {"ok": True, "data": nav}

router = APIRouter(prefix="/api", tags=["nav"])

def _l1_path_from_l2_list(l2_list: List[dict]) -> str:
    if not l2_list:
        return "/"
    href = (l2_list[0].get("href") or "").strip("/")
    segs = [s for s in href.split("/") if s]
    return f"/{segs[0]}" if segs else "/"

@router.get("/nav")
def get_nav() -> Dict[str, Any]:
    """
    输出两部分：
    - items：前端“壳层”直接渲染所需的树形结构（带 level/children/default/visible）
    - 原始 nav：menu/tabs/hash/stats 等，便于调试与诊断
    """
    cache = get_nav_cache()
    nav = cache.get("data", cache) or {}
    menu = nav.get("menu", {}) or {}
    tabs = nav.get("tabs", {}) or {}

    items: List[Dict[str, Any]] = []
    for l1_title, l2_list in menu.items():
        l1_path  = _l1_path_from_l2_list(l2_list)
        l1_order = min((x.get("order", 100) for x in l2_list), default=100)

        l2_children: List[Dict[str, Any]] = []
        for l2 in (l2_list or []):
            l2_href = (l2.get("href") or "").strip()
            l3list: List[Dict[str, Any]] = []
            for t in (tabs.get(l2_href) or []):
                l3list.append({
                    "level": 3,
                    "title": (t.get("text") or "").strip(),
                    "path":  (t.get("href") or "").strip(),
                    "order": t.get("order", 100),
                    "visible": True,
                    "default": bool(t.get("default", False)),
                })
            l3list.sort(key=lambda d: (d.get("order", 100), d.get("title","")))

            l2_children.append({
                "level": 2,
                "title": (l2.get("text") or "").strip(),
                "path":  l2_href,
                "order": l2.get("order", 100),
                "visible": True,
                "default": bool(l2.get("default", False)),
                "children": l3list,
            })

        items.append({
            "level": 1,
            "title": l1_title,
            "path":  l1_path,
            "order": l1_order,
            "visible": True,
            "children": l2_children,
        })

    items.sort(key=lambda d: (d.get("order", 100), d.get("title", "")))
    return { "items": items, **nav }

@router.post("/nav/reload")
def reload_nav(force: bool = Query(default=True)) -> Dict[str, Any]:
    return refresh_nav_cache()
