from fastapi import FastAPI, Request, Depends, UploadFile, File, Form
from fastapi.responses import RedirectResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.core.db import Base, engine
from app.api import api_router

app = FastAPI(title="minipost")

# 静态与模板
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="app/templates")

# DB 初始化（首次自动建表）
Base.metadata.create_all(bind=engine)

# API
app.include_router(api_router, prefix="/api")

# 根路径：跳转到后台（避免 / 返回 404）
@app.get("/", include_in_schema=False)
def index():
    return RedirectResponse(url="/admin")

# 后台首页（仪表盘）
@app.get("/admin", response_class=HTMLResponse, include_in_schema=False)
def admin_root(request: Request):
    # 直接进入“订单/面单上传/面单列表”
    return RedirectResponse(url="/orders/label-upload/list")

# 登录页
@app.get("/admin/login", response_class=HTMLResponse, include_in_schema=False)
def admin_login(request: Request):
    return templates.TemplateResponse("auth/login.html", {"request": request})

# —— 管理端所有一级导航入口：映射到同一个壳模板（UI 在前端切换二、三级）——
@app.get("/orders{full:path}", response_class=HTMLResponse, include_in_schema=False)
@app.get("/products{full:path}", response_class=HTMLResponse, include_in_schema=False)
@app.get("/logistics{full:path}", response_class=HTMLResponse, include_in_schema=False)
@app.get("/settings{full:path}", response_class=HTMLResponse, include_in_schema=False)
def admin_shell(request: Request, full: str = ""):
    # Jinja 壳模板中装载你的 UI（胶囊轨道/三级页签/表格/底栏）
    return templates.TemplateResponse("admin/shell.html", {"request": request})
