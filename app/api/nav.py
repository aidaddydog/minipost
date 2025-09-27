# app/api/nav.py
# -*- coding: utf-8 -*-
from fastapi import APIRouter
from app.services.nav_loader import rebuild_nav

router = APIRouter()

def _l1_path_from_l2_list(l2_list):
    """
    从 L2 的 href 推导 L1 的 path：取第一个 L2 的首段，例如 /logistics/channel → /logistics
    若不可推导，则返回 "/"
    """
    if not l2_list:
        return "/"
    href = (l2_list[0].get("href") or "").strip("/")
    segs = [s for s in href.split("/") if s]
    return f"/{segs[0]}" if segs else "/"

@router.get("/api/nav", summary="聚合导航（兼容老前端）")
def api_nav():
    """
    返回结构（兼容老前端 + 暴露新结构）：
    {
      "items": [  # 老前端期望的数组结构（level/title/path/children/visible/order）
        {
          "level": 1, "title": "<L1名>", "path": "/<L1基路径>", "order": 10, "visible": true,
          "children": [
            {
              "level": 2, "title": "<L2名>", "path": "/xxx/yyy", "order": 1, "visible": true,
              "children": [
                { "level": 3, "title": "<L3名>", "path": "/xxx/yyy/zzz", "order": 60, "visible": true, "children": [] }
              ]
            }
          ]
        }
      ],
      # 同时保留“新 Schema”字段，供新版前端使用
      "menu": {...}, "tabs": {...}, "generated_at": "...", "hash": "...", "stats": {...}
    }
    """
    nav = rebuild_nav(write_cache=False)  # 新 Schema：menu/tabs
    menu = nav.get("menu") or {}
    tabs = nav.get("tabs") or {}

    items = []
    for l1_title, l2_list in menu.items():
        # L2
        l2_children = []
        for l2 in (l2_list or []):
            l2_title = (l2.get("text") or "").strip()
            l2_href  = (l2.get("href") or "").strip()
            l2_order = l2.get("order", 100)
            # L3：tabs 的 key = L2 的 href（以 / 开头）
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
                "level": 2,
                "title": l2_title,
                "path":  l2_href,
                "order": l2_order,
                "visible": True,
                "children": l3list,
            })

        # L1：从 L2 的 href 推导基路径，并用最小 L2 order 作为排序权重
        l1_path = _l1_path_from_l2_list(l2_list or [])
        l1_order = min([c.get("order", 100) for c in l2_children] or [100])
        items.append({
            "level": 1,
            "title": l1_title,
            "path":  l1_path,
            "order": l1_order,
            "visible": True,
            "children": l2_children,
        })

    # L1 排序
    items.sort(key=lambda d: (d.get("order", 100), d.get("title", "")))

    # 兼容老前端：优先读取 items（数组）；同时保留新结构
    return {
        "items": items,
        **nav
    }

