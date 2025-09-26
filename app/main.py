# -*- coding: utf-8 -*-
from fastapi import FastAPI, Request, Depends, Response, status
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from app.settings import settings
from app.api.health import router as health_router
from app.api.v1.nav import router as nav_router
from app.deps import current_user
from app.common.utils import refresh_nav_cache
from modules.auth_login.backend.routers.auth_login import router as login_router
from modules.core.backend.routers.rbac_admin import router as rbac_router

app = FastAPI(title="minipost", version="0.1.0")

# 静态资源：全局 + 模块主题 + 模块前端
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/modules_static", StaticFiles(directory="modules"), name="modules_static")  # 直接暴露模块静态（只读）

templates = Jinja2Templates(directory=".")  # 模块内模板使用绝对/相对路径

# 路由注册
app.include_router(health_router)
app.include_router(nav_router)
app.include_router(login_router)
app.include_router(rbac_router)

@app.on_event("startup")
def on_start():
    # 启动时聚合导航（若 YAML 不存在也不报错）
    refresh_nav_cache()

@app.get("/", response_class=HTMLResponse)
def index(request: Request, user = Depends(current_user)):
    # 渲染壳层模板（像素级一致）
    return templates.TemplateResponse("modules/navauth_shell/frontend/templates/nav_shell.html", {
        "request": request,
        "THEME_NAME": settings.THEME_NAME,
        "USE_REAL_NAV": settings.USE_REAL_NAV,
    })
