from fastapi import APIRouter, Depends, HTTPException
from starlette.responses import JSONResponse
from typing import Any, Dict

# 当前用户依赖（保持与你现有的一致）
try:
    from app.deps import current_user, require_permissions  # 优先使用已有依赖
except Exception:
    try:
        from app.core.security import current_user  # 兼容旧路径
    except Exception:
        def current_user():
            return None

# 统一通过 utils 的缓存来拿导航（底层由 nav_loader 聚合）
from app.common.utils import get_nav_cache, refresh_nav_cache

router = APIRouter(prefix="/api", tags=["nav"])

def _shape_nav(nav: Dict[str, Any]) -> Dict[str, Any]:
    menu = nav.get("menu") or {}
    tabs = nav.get("tabs") or {}
    if not isinstance(menu, dict) or not isinstance(tabs, dict):
        raise HTTPException(status_code=500, detail="Expect new nav schema {menu: object, tabs: object}.")
    stats = {"l1": len(menu), "tabs": sum(len(v) for v in tabs.values() if isinstance(v, list))}
    return {"menu": menu, "tabs": tabs, "stats": stats}

@router.get("/nav")
def get_nav(_: Any = Depends(current_user)) -> JSONResponse:
    cache = get_nav_cache()
    nav = cache.get("data") or cache  # 兼容 utils 的返回结构
    shaped = _shape_nav(nav)
    shaped["ts"] = cache.get("ts") or nav.get("ts")
    return JSONResponse(shaped)

@router.post("/nav/reload", dependencies=[Depends(require_permissions(["rbac:manage"]))])
def reload_nav(_: Any = Depends(current_user)) -> JSONResponse:
    r = refresh_nav_cache()
    nav = r.get("data") or r
    shaped = _shape_nav(nav)
    shaped["ok"] = r.get("ok", True)
    shaped["ts"] = r.get("ts") or nav.get("ts")
    shaped["errors"] = r.get("errors") or []
    return JSONResponse(shaped)
