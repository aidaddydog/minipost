
# -*- coding: utf-8 -*-
import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware

from app.core.config import get_settings
from app.core.db import engine
from app.models.entities import Base

# 初始化 DB
Base.metadata.create_all(bind=engine)

settings = get_settings()
app = FastAPI(title="minipost 管理端")
app.add_middleware(SessionMiddleware, secret_key=settings.SECRET_KEY)

# 静态资源
static_dir = os.path.join(settings.BASE_DIR, "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# 模板
templates = Jinja2Templates(directory=settings.TEMPLATES_DIR)
try:
    templates.env.auto_reload = True
except Exception:
    pass

# 依赖注入给子模块
from app.api import public as public_api
from app.api import admin_ui as admin_ui
from app.api.admin_extras import router as admin_extras_router

# 将 templates 暴露给子模块
public_api.templates = templates
admin_ui.templates = templates

# 路由挂载
app.include_router(public_api.router)
app.include_router(admin_ui.router)
app.include_router(admin_extras_router)

# 登陆页（壳）
from fastapi.responses import HTMLResponse
@app.get("/auth/login", response_class=HTMLResponse)
def login_shell():
    return templates.TemplateResponse("auth/login.html", {"request": {}})

