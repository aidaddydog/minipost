# app/api/nav.py
# -*- coding: utf-8 -*-
from fastapi import APIRouter
from app.services.nav_loader import rebuild_nav

router = APIRouter()

@router.get("/api/nav", summary="聚合导航（L1→L2；L2→L3）")
def api_nav():
    """
    返回结构：
    {
      "menu": { "<l1>": [{text,href,order?,icon?}, ...], ... },
      "tabs": { "<l2_base>": [{key,text,href,order?}, ...], ... },
      "generated_at": ISO8601Z,
      "hash": "sha1-16",
      "stats": { "modules":N, "menus":M, "tabs":T }
    }
    """
    # 每次按需聚合（配置是 YAML，即改即生效；性能足够）
    # 如需更强缓存，可在 rebuild_nav(write_cache=True) 并配合 If-None-Match/Etag
    return rebuild_nav(write_cache=False)
