import os, logging, logging.config
from fastapi import FastAPI, Request
from fastapi.responses import RedirectResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.core.settings import settings
from app.api.v1 import router as v1_router

# logging
cfg = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config", "logging.ini")
if os.path.exists(cfg):
    logging.config.fileConfig(cfg, disable_existing_loggers=False)

app = FastAPI(title="Minipost Server", version="2025-09-21")

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
app.mount("/static",  StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")
app.mount("/updates", StaticFiles(directory=os.path.join(BASE_DIR, "updates")), name="updates")
app.mount("/runtime", StaticFiles(directory=os.path.join(BASE_DIR, "runtime")), name="runtime")

templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "app", "templates"))

# routers
app.include_router(v1_router)

@app.get("/", response_class=HTMLResponse)
def index():
    return RedirectResponse("/admin")

@app.get("/admin", response_class=HTMLResponse)
def admin_home(request: Request):
    return templates.TemplateResponse("admin/dashboard.html", {"request": request, "title": "仪表盘"})

@app.get("/admin/label-upload", response_class=HTMLResponse)
def admin_label_upload(request: Request):
    return templates.TemplateResponse("admin/label_upload_list.html", {"request": request, "title": "面单上传"})

@app.get("/admin/login", response_class=HTMLResponse)
def admin_login(request: Request):
    return templates.TemplateResponse("auth/login.html", {"request": request, "title": "登录"})
