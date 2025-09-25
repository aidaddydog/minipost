# -*- coding: utf-8 -*-
from __future__ import annotations
import pathlib
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, PlainTextResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from app.deps import get_template_renderer
from modules.auth.backend.routers import auth_login
from modules.core.backend.routers import auth as core_auth
from modules.nav-shell.backend.routers import shell as nav_shell
from app.bootstrap import rebuild_nav

app = FastAPI(title="minipost")

base_dir = pathlib.Path(__file__).parent.parent
app.mount("/static/auth", StaticFiles(directory=str(base_dir / "modules/auth/frontend/static/auth")), name="static-auth")
app.mount("/static/nav-shell", StaticFiles(directory=str(base_dir / "modules/nav-shell/frontend/static/nav-shell")), name="static-nav")

app.include_router(auth_login.router)
app.include_router(core_auth.router)
app.include_router(nav_shell.router)

@app.get("/healthz")
def healthz(): return PlainTextResponse("ok")

@app.get("/")
def home(request: Request):
    html = get_template_renderer().render("nav-shell/nav-shell.html", {"request": request})
    return HTMLResponse(html)

@app.on_event("startup")
def on_startup():
    try: rebuild_nav()
    except Exception as e: print("重建导航失败：", e)

# 占位路由，点击“设置/账号与权限”仍回到首页（后续接业务页）
@app.get("/settings")
def settings_home(): return RedirectResponse(url="/")
@app.get("/settings/rbac")
def settings_rbac(): return RedirectResponse(url="/")
