# -*- coding: utf-8 -*-
"""
FastAPI 主入口：
- 统一异常包络：{ code, msg, detail?, trace_id? }
- CORS
- 模板渲染（非 SPA 页面）
- 静态资源挂载
"""
from fastapi import FastAPI, Request, Depends, HTTPException, status
from fastapi.responses import JSONResponse, HTMLResponse, RedirectResponse, PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pathlib import Path
from app.settings import settings
from app.bootstrap import aggregate_nav, NAV_CACHE
from loguru import logger

app = FastAPI(title="minipost", version=settings.APP_VERSION)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ALLOW_ORIGINS.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 静态资源与模板（模块内独立挂载，不交叉依赖）
app.mount("/static", StaticFiles(directory="modules"), name="static")
templates = Jinja2Templates(directory="modules")

# 统一异常包络
@app.exception_handler(HTTPException)
async def http_exc_handler(request: Request, exc: HTTPException):
    payload = exc.detail if isinstance(exc.detail, dict) else {"code": f"E-{exc.status_code}", "msg": str(exc.detail)}
    return JSONResponse(status_code=exc.status_code, content=payload)

@app.get("/healthz")
def healthz():
    return {"ok": True, "version": settings.APP_VERSION}

# 导航 API（远程导航）
@app.get("/api/nav")
def get_nav():
    if NAV_CACHE.exists():
        return JSONResponse(content=NAV_CACHE.read_text(encoding="utf-8"))
    nav = aggregate_nav(write_file=True)
    return nav

# ============ 页面路由（非 SPA） ============
from modules.auth_login.backend.routers.auth_login import router as login_router
from modules.core.backend.routers.auth import router as auth_router
from modules.label_upload.backend.routers.public import router as label_public_router
from modules.label_upload.backend.routers.outbound import router as label_outbound_router
from modules.label_upload.backend.routers.webhooks import router as label_wh_router
from modules.logistics_channel.backend.routers.public import router as logi_public_router

app.include_router(login_router, prefix="")
app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])

# label_upload APIs
app.include_router(label_public_router, prefix="/api/v1/label-upload", tags=["label-upload"])
app.include_router(label_outbound_router, prefix="/api/v1/label-upload", tags=["label-upload-outbound"])
app.include_router(label_wh_router, prefix="/api/v1/label-upload", tags=["label-upload-webhooks"])

# logistics_channel APIs
app.include_router(logi_public_router, prefix="/api/v1/logistics", tags=["logistics"])

# ====== 基本页面（路由与模板） ======
from fastapi import responses

@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    # 直接使用导航壳（像素级复刻 UI）
    return templates.TemplateResponse("navauth_shell/frontend/templates/nav_shell.html", {"request": request})

@app.get("/orders/label-upload/list", response_class=HTMLResponse)
def page_label_list(request: Request):
    return templates.TemplateResponse("label_upload/frontend/templates/label_upload_list.html", {"request": request})

@app.get("/orders/label-upload/logs", response_class=HTMLResponse)
def page_label_logs(request: Request):
    return templates.TemplateResponse("label_upload/frontend/templates/label_upload_logs.html", {"request": request})

@app.get("/orders/label-upload/zips", response_class=HTMLResponse)
def page_label_zips(request: Request):
    return templates.TemplateResponse("label_upload/frontend/templates/label_upload_zips.html", {"request": request})

