# -*- coding: utf-8 -*-
from fastapi import FastAPI, Request, Depends
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.settings import settings
from app.api.health import router as health_router
from app.api.v1.nav import router as nav_router
from app.deps import current_user
from app.common.utils import refresh_nav_cache

# 关键：引入并在启动时调用 setup_templates（修复登录页 500）
from modules.auth_login.backend.routers.auth_login import router as login_router, setup_templates
from modules.core.backend.routers.rbac_admin import router as rbac_router

app = FastAPI(title="minipost", version="0.1.0")

# 静态资源挂载
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/modules_static", StaticFiles(directory="modules"), name="modules_static")

# 全局模板（壳层）
templates = Jinja2Templates(directory=".")

# 路由注册
app.include_router(health_router)
app.include_router(nav_router)
app.include_router(login_router)
app.include_router(rbac_router)

@app.on_event("startup")
def on_start():
    # 初始化登录模板环境（给 auth_login.py 使用）
    setup_templates(app)
    # 启动时聚合导航（若 YAML 不存在也不报错）
    refresh_nav_cache()

@app.get("/", response_class=HTMLResponse)
def index(request: Request, user = Depends(current_user)):
    return templates.TemplateResponse(
        "modules/navauth_shell/frontend/templates/nav_shell.html",
        {
            "request": request,
            "THEME_NAME": settings.THEME_NAME,
            "USE_REAL_NAV": settings.USE_REAL_NAV,
        },
    )
