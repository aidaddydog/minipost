from __future__ import annotations
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.templating import Jinja2Templates

from app.settings import settings

app = FastAPI(title="minipost", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="modules"), name="static")
templates = Jinja2Templates(directory="modules")

@app.get("/healthz")
def healthz():
    return JSONResponse({"ok": True})

from modules.nav_shell.backend.routers.nav_shell import router as nav_router
from modules.auth.backend.routers.auth_login import router as auth_router
from modules.core.backend.routers.auth import router as core_auth_router

app.include_router(nav_router, prefix="")
app.include_router(auth_router, prefix="")
app.include_router(core_auth_router, prefix="")

@app.on_event("startup")
async def _on_startup():
    app.state.sessions = {}

@app.get("/")
def index(request: Request):
    return templates.TemplateResponse("nav-shell/frontend/templates/nav-shell/nav-shell.html", {"request": request})
