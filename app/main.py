from __future__ import annotations
from fastapi import FastAPI, Request, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, PlainTextResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from app.settings import get_settings
from app.deps import get_db
from sqlalchemy.orm import Session
from app.bootstrap import on_startup
import pathlib, importlib.util, glob, os, json

settings = get_settings()
BASE_DIR = pathlib.Path(__file__).resolve().parent.parent

app = FastAPI(title=settings.APP_NAME)

# 静态与模板（模块化：nav-shell、auth 等）
# 为每个模块挂载其 static 目录（如存在）
def mount_static(app: FastAPI):
    static_roots = [
        ("/static/nav-shell", BASE_DIR / "modules/nav-shell/frontend/static/nav-shell"),
        ("/static/auth", BASE_DIR / "modules/auth/frontend/static/auth"),
    ]
    for url, path in static_roots:
        if path.exists():
            app.mount(url, StaticFiles(directory=path), name=url.strip("/"))

mount_static(app)
templates = Jinja2Templates(directory=str(BASE_DIR))

@app.get("/healthz")
async def healthz():
    return PlainTextResponse("ok")

# 动态加载并注册 routers（支持模块目录名含短横线）
def include_module_routers(app: FastAPI):
    # auth login
    p_auth = BASE_DIR / "modules/auth/backend/routers/auth_login.py"
    if p_auth.exists():
        spec = importlib.util.spec_from_file_location("modules.auth.backend.routers.auth_login", p_auth)
        mod = importlib.util.module_from_spec(spec)  # type: ignore
        assert spec and spec.loader
        spec.loader.exec_module(mod)  # type: ignore
        app.include_router(mod.router, prefix="")  # type: ignore
    # core auth api
    p_core = BASE_DIR / "modules/core/backend/routers/auth.py"
    if p_core.exists():
        spec = importlib.util.spec_from_file_location("modules.core.backend.routers.auth", p_core)
        mod = importlib.util.module_from_spec(spec)  # type: ignore
        assert spec and spec.loader
        spec.loader.exec_module(mod)  # type: ignore
        app.include_router(mod.router, prefix="/api/v1")
    # nav shell
    p_shell = BASE_DIR / "modules/nav-shell/backend/routers/shell.py"
    if p_shell.exists():
        spec = importlib.util.spec_from_file_location("modules.nav_shell.backend.routers.shell", p_shell)
        mod = importlib.util.module_from_spec(spec)  # type: ignore
        assert spec and spec.loader
        spec.loader.exec_module(mod)  # type: ignore
        app.include_router(mod.router, prefix="")

include_module_routers(app)

@app.on_event("startup")
async def _startup():
    from app.db import SessionLocal
    db = SessionLocal()
    try:
        on_startup(db)
    finally:
        db.close()

# Demo 首页：渲染 nav-shell（空业务）
@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("modules/nav-shell/frontend/templates/nav-shell/nav-shell.html", {
        "request": request,
        "content_html": "<div class='shell'><div class='content'><h2>欢迎</h2><p>这是空白占位页面。</p></div></div>",
    })
