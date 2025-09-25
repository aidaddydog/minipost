# -*- coding: utf-8 -*-
"""minipost FastAPI 入口。
- 提供健康检查 /admin 首页跳转
- 挂载模块路由（登录/RBAC、面单上传、物流渠道）
- 会话中间件（为登录态预留）
"""
from fastapi import FastAPI
from fastapi.responses import RedirectResponse, JSONResponse
from starlette.middleware.sessions import SessionMiddleware
from .settings import settings

app = FastAPI(title=settings.APP_NAME)
app.add_middleware(SessionMiddleware, secret_key=settings.SECRET_KEY)

# 路由：健康检查
@app.get("/healthz")
def healthz():
    return {"ok": True}

# 首页 => /admin（UI 中 logo 已指向 /admin）
@app.get("/")
def index():
    return RedirectResponse("/admin", status_code=302)

# -------- 挂载模块路由 --------
from modules.core.backend.routers import auth as core_auth
from modules.label_upload.backend.routers import public as label_public
from modules.logistics_channel.backend.routers import public as logistics_public

app.include_router(core_auth.router, tags=["auth"])
app.include_router(label_public.router, tags=["label_upload"])
app.include_router(logistics_public.router, tags=["logistics"])

# 简易 /admin => 面单上传（像素级 UI 页）
@app.get("/admin")
def admin_home():
    return RedirectResponse("/orders/label-upload/list", status_code=302)
