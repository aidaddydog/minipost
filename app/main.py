from fastapi import FastAPI, Depends, Request, UploadFile, File
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from pathlib import Path
import orjson

from app.settings import settings
from app.db import get_db
from modules.auth_login.backend.routers.auth_login import router as auth_login_router
from modules.core.backend.routers.auth import router as core_auth_router
from modules.label_upload.backend.routers.public import router as label_public_router
from modules.label_upload.backend.routers.outbound import router as label_outbound_router
from modules.label_upload.backend.routers.webhooks import router as label_webhook_router
from modules.logistics_channel.backend.routers.public import router as lg_public_router

app = FastAPI(title="minipost", version="0.1.0")

# CORS
allow_origins = [o.strip() for o in settings.allow_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 静态资源（模块静态目录多路挂载）
BASE_DIR = Path(__file__).resolve().parent.parent
static_mounts = {
    "/static/nav_shell": BASE_DIR / "modules" / "navauth_shell" / "frontend" / "static",
    "/static/label_upload": BASE_DIR / "modules" / "label_upload" / "frontend" / "static",
    "/static/logistics": BASE_DIR / "modules" / "logistics_channel" / "frontend" / "static",
}
for url, p in static_mounts.items():
    app.mount(url, StaticFiles(directory=str(p), html=False), name=url.strip("/").replace("/", "_"))

# 注册 API 路由
app.include_router(auth_login_router, prefix="/api/auth", tags=["auth"])
app.include_router(core_auth_router, prefix="/api/core", tags=["core"])
app.include_router(label_public_router, prefix="/api/label-upload", tags=["label-upload"])
app.include_router(label_outbound_router, prefix="/api/label-upload", tags=["label-upload"])
app.include_router(label_webhook_router, prefix="/api/label-upload", tags=["label-upload"])
app.include_router(lg_public_router, prefix="/api/logistics", tags=["logistics"])

# 管理后台 UI（像素级复刻）
UI_LABEL_PATH = BASE_DIR / "modules" / "label_upload" / "frontend" / "templates" / "label_upload_list.html"
UI_LOGS_PATH = BASE_DIR / "modules" / "label_upload" / "frontend" / "templates" / "label_upload_logs.html"

@app.get("/", response_class=HTMLResponse)
def root():
    return HTMLResponse("<html><body><a href='/admin'>进入后台 /admin</a></body></html>")

@app.get("/admin", response_class=HTMLResponse)
def admin_redirect():
    # 直接进入“面单上传”页面（符合 UI 设计）
    return HTMLResponse(UI_LABEL_PATH.read_text(encoding="utf-8"))

@app.get("/orders/label-upload", response_class=HTMLResponse)
def label_upload_page():
    return HTMLResponse(UI_LABEL_PATH.read_text(encoding="utf-8"))

@app.get("/orders/label-upload/logs", response_class=HTMLResponse)
def label_upload_logs_page():
    return HTMLResponse(UI_LOGS_PATH.read_text(encoding="utf-8"))
