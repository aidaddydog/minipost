from fastapi import APIRouter, Depends, HTTPException
from starlette.responses import JSONResponse
from typing import Any, Dict
# 说明：保持你现有的鉴权依赖（如 current_user），这里用一个轻量占位。
try:
  from app.core.security import current_user  # type: ignore
except Exception:
  def current_user():
    return None

# 说明：此导入需要与现有聚合器对齐；你的仓库中通常在 app/services/nav_loader.py
try:
  from app.services.nav_loader import load_nav  # 假设存在该函数，返回包含 menu/tabs 的字典
except Exception:  # 兜底：如果函数名不同，你可以在此替换为正确的导入
  load_nav = None  # type: ignore

router = APIRouter(prefix="/api", tags=["nav"])

@router.get("/nav")
async def get_nav(_: Any = Depends(current_user)) -> JSONResponse:
  if load_nav is None:
    raise HTTPException(status_code=500, detail="nav_loader.load_nav not found; please wire it to return {menu,tabs}.")
  nav: Dict[str, Any] = load_nav()  # 同步/异步均可；若为协程，请 await
  if not isinstance(nav, dict):
    raise HTTPException(status_code=500, detail="Invalid nav schema from loader.")
  menu = nav.get("menu")
  tabs = nav.get("tabs")
  if not isinstance(menu, dict) or not isinstance(tabs, dict):
    # 不再做旧 items/children 兼容 —— 直接报错，强制修正模块 YAML 或 loader
    raise HTTPException(status_code=500, detail="Expect new nav schema {menu: object, tabs: object}.")
  stats = {
    "l1": len(menu.keys()),
    "tabs": sum(len(v) for v in tabs.values() if isinstance(v, list)),
  }
  # 仅输出新框架需要的字段
  payload = {
    "menu": menu,
    "tabs": tabs,
    "stats": stats,
    "ts": nav.get("ts"),  # 可选
  }
  return JSONResponse(payload)
