# app/main.py
import os
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.templating import Jinja2Templates

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMPLATES_DIR = os.path.join(BASE_DIR, "app", "templates")
STATIC_DIR = os.path.join(BASE_DIR, "static")

app = FastAPI(title="minipost")

# 静态资源
if os.path.isdir(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

templates = Jinja2Templates(directory=TEMPLATES_DIR)

# 健康检查：安装脚本使用该接口，避免 404
@app.get("/healthz", include_in_schema=False)
def healthz():
    return JSONResponse({"ok": True})

# 入口跳转
@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/admin", status_code=302)

# 仪表盘
@app.get("/admin", response_class=HTMLResponse)
def admin_dashboard(request: Request):
    return templates.TemplateResponse("admin/dashboard.html", {"request": request})

# 登录页
@app.get("/admin/login", response_class=HTMLResponse)
def admin_login(request: Request):
    return templates.TemplateResponse("auth/login.html", {"request": request})

# 面单上传（你的 UI）
@app.get("/orders/label-upload/list", response_class=HTMLResponse)
def label_upload_list(request: Request):
    return templates.TemplateResponse("admin/label_upload_list.html", {"request": request})

# 上传记录（同一 UI 页面内有页签切换）
@app.get("/orders/label-upload/logs", response_class=HTMLResponse)
def label_upload_logs(request: Request):
    return templates.TemplateResponse("admin/label_upload_list.html", {"request": request})
