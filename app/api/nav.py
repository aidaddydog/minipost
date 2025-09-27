# app/api/v1/nav.py
# -*- coding: utf-8 -*-
from fastapi import APIRouter, Query
from app.services.nav_loader import rebuild_nav

router = APIRouter(prefix="/api", tags=["nav"])

def _l1_path_from_l2_list(l2_list):
    if not l2_list: return "/"
    href = (l2_list[0].get("href") or "").strip("/")
    segs = [s for s in href.split("/") if s]
    return f"/{segs[0]}" if segs else "/"

@router.get("/nav")
def get_nav():
    nav = rebuild_nav(write_cache=False)
    menu = nav.get("menu") or {}
    tabs = nav.get("tabs") or {}

    items = []
    for l1_title, l2_list in menu.items():
        l2_children = []
        for l2 in (l2_list or []):
            l2_title = (l2.get("text") or "").strip()
            l2_href  = (l2.get("href") or "").strip()
            l2_order = l2.get("order", 100)
            l3list = []
            for t in tabs.get(l2_href, []) or []:
                l3list.append({
                    "level": 3,
                    "title": (t.get("text") or "").strip(),
                    "path":  (t.get("href") or "").strip(),
                    "order": t.get("order", 100),
                    "visible": True,
                    "children": [],
                })
            l2_children.append({
                "level": 2, "title": l2_title, "path": l2_href,
                "order": l2_order, "visible": True, "children": l3list,
            })
        l1_path = _l1_path_from_l2_list(l2_list or [])
        l1_order = min([c.get("order", 100) for c in l2_children] or [100])
        items.append({
            "level": 1, "title": l1_title, "path": l1_path,
            "order": l1_order, "visible": True, "children": l2_children,
        })
    items.sort(key=lambda d: (d.get("order", 100), d.get("title", "")))
    return {"items": items, **nav}

@router.post("/nav/reload")
def reload_nav(force: bool = Query(default=True)):
    # 仍保留旧热重载行为（只刷新聚合缓存；通用页面渲染器每次请求都会读取最新 tabs，所以不需要重绑路由）
    from app.common.utils import refresh_nav_cache
    return refresh_nav_cache()
