# app/main.py
# -*- coding: utf-8 -*-
from __future__ import annotations

from fastapi import FastAPI, Request, Depends
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi import APIRouter
from fastapi.middleware.cors import CORSMiddleware

from pathlib import Path
import importlib.util
import os
import logging
from typing import Any, Dict

from app.settings import settings
from app.api.health import router as health_router
from app.api.v1.nav import router as nav_router
from app.deps import current_user  # 统一鉴权
from app.common.utils import get_nav_cache, refresh_nav_cache


logger = logging.getLogger("minipost")
app = FastAPI(title="minipost")

# 开发环境允许本地前端跨域
if settings.ENVIRONMENT.lower() != "production":
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# ---- 静态资源 ----
# Vite 构建产物在 static/assets 下
app.mount("/static", StaticFiles(directory="static"), name="static")

# Jinja 模板根（L3 模板用）
templates = Jinja2Templates(directory=".")
app.state.templates = templates

# ---- 内建路由 ----
app.include_router(health_router)
app.include_router(nav_router)

# 登录 / RBAC（示例模块照常保留）
from modules.auth_login.backend.routers.auth_login import router as login_router
from modules.core.backend.routers.rbac_admin import router as rbac_router
app.include_router(login_router)
app.include_router(rbac_router)

# ---- 动态加载模块后端路由（一次性实现）----
def _auto_include_module_routers() -> None:
    base = Path("modules")
    if not base.exists():
        return
    for py in base.rglob("backend/routers/*.py"):
        name = "modules_" + str(py.with_suffix("")).replace("/", "_").replace("\\", "_")
        try:
            spec = importlib.util.spec_from_file_location(name, py)
            if not spec or not spec.loader:
                continue
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)  # type: ignore
            r = getattr(mod, "router", None)
            if r is not None:
                app.include_router(r)
                logger.info("Included router from %s", py)
        except Exception as e:
            logger.exception("Failed to include router from %s: %s", py, e)

_auto_include_module_routers()

# ---- SPA 入口查找（优先用 Vite 产物）----
def _find_spa_index() -> str | None:
    candidates = [
        "/app/static/assets/index.html",  # Docker 镜像内路径
        "static/assets/index.html",       # 本地运行
        "/app/static/index.html",
        "static/index.html",
        "index.html",                     # 开发兜底
    ]
    for p in candidates:
        try:
            if Path(p).exists():
                return p
        except Exception:
            continue
    return None

# ---- 首页：始终返回 SPA（与是否有模块无关）----
@app.get("/", include_in_schema=False, response_class=HTMLResponse)
def spa_root(_: Request):
    spa = _find_spa_index()
    if not spa:
        # 极限兜底：至少给一个挂载点
        return HTMLResponse("<!doctype html><title>minipost</title><div id='root'></div>", status_code=200)
    return FileResponse(spa)

# ---- L3 模板猜测（当 tabs.register 未填 template 时）----
def _guess_template_from_href(href: str) -> str | None:
    parts = [p for p in href.strip("/").split("/") if p]
    if len(parts) >= 3:
        l1, l2, l3 = parts[:3]
        cands = [
            Path(f"modules/{l1}_{l2}/{l1}_{l3}/frontend/templates/{l1}_{l3}.html"),
            Path(f"modules/{l1}_{l2}/{l1}_{l3}/frontend/templates/index.html"),
            Path(f"modules/{l1}_{l2}/{l3}/frontend/templates/{l3}.html"),
            Path(f"modules/{l1}_{l2}/{l3}/frontend/templates/index.html"),
        ]
        for p in cands:
            if p.exists():
                return str(p)
        # 模糊兜底
        base = Path("modules")
        needle = f"/{l3}.html"
        for p in base.rglob("frontend/templates/*.html"):
            if needle in str(p).replace("\\", "/"):
                return str(p)
    return None


# 模板路径白名单校验：必须位于 modules/**/frontend/templates 下
def _is_safe_template(p: str) -> bool:
    try:
        base = Path("modules").resolve()
        target = Path(p).resolve()
        return target.is_file() and str(target).startswith(str(base)) and ("frontend" + os.sep + "templates") in str(target)
    except Exception:
        return False

# ---- 通用 L3：找得到就渲染模板；找不到一律回落 SPA ----
@app.get("/{full_path:path}", include_in_schema=False, response_class=HTMLResponse)
def serve_tab_page(full_path: str, request: Request, user=Depends(current_user)):
    href = "/" + (full_path or "")
    cache = get_nav_cache()
    data: Dict[str, Any] = cache.get("data") or cache
    tabs: Dict[str, Any] = data.get("tabs") or {}

    template_path: str | None = None
    for _, items in tabs.items():
        for it in (items or []):
            if it.get("href") == href:
                template_path = (it.get("template") or "").strip() or _guess_template_from_href(href)
                break
        if template_path:
            break

    if template_path and _is_safe_template(template_path):
        return templates.TemplateResponse(template_path, {"request": request, "THEME_NAME": settings.THEME_NAME})

    # 关键改动：未注册路径 → 回落到 SPA（壳层始终存在）
    spa = _find_spa_index()
    if not spa:
        return HTMLResponse("<!doctype html><div id='root'></div>", status_code=200)
    return FileResponse(spa)

# ---- 启动预热导航缓存（让 /api/nav 首次更快）----
@app.on_event("startup")
def _warmup():
    try:
        refresh_nav_cache()
        logger.info("导航缓存预热完成")
    except Exception as e:
        logger.warning("导航缓存预热失败：%s", e)
