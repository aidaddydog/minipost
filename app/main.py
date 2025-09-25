# -*- coding: utf-8 -*-
import os, pathlib, json
from fastapi import FastAPI, Request, UploadFile, File
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from jinja2 import Environment, FileSystemLoader, select_autoescape

BASE_DIR = pathlib.Path(__file__).resolve().parent.parent

TEMPLATE_DIRS = [
    BASE_DIR / 'modules' / 'navauth_shell' / 'frontend' / 'templates',
    BASE_DIR / 'modules' / 'label_upload' / 'frontend' / 'templates',
    BASE_DIR / 'modules' / 'logistics_channel' / 'frontend' / 'templates',
    BASE_DIR / 'modules' / 'auth_login' / 'frontend' / 'templates',
]
env = Environment(loader=FileSystemLoader([str(p) for p in TEMPLATE_DIRS]), autoescape=select_autoescape(['html', 'xml']))

def render_template(template_name: str, request: Request, **ctx):
    init = ctx.get('MINIPOST_INIT', {}) or {}
    ctx['MINIPOST_INIT_JSON'] = json.dumps(init, ensure_ascii=False)
    tpl = env.get_template(template_name)
    return HTMLResponse(tpl.render(request=request, **ctx))

app = FastAPI(title="minipost")

app.mount("/static/nav", StaticFiles(directory=str(BASE_DIR / "modules/navauth_shell/frontend/static")), name="static_nav")
app.mount("/static/label", StaticFiles(directory=str(BASE_DIR / "modules/label_upload/frontend/static")), name="static_label")
app.mount("/static/logistics", StaticFiles(directory=str(BASE_DIR / "modules/logistics_channel/frontend/static")), name="static_logistics")
app.mount("/static/auth", StaticFiles(directory=str(BASE_DIR / "modules/auth_login/frontend/static")), name="static_auth")

@app.get("/health")
def health():
    return {"ok": True}

@app.get("/")
def index():
    return RedirectResponse("/admin")

@app.get("/admin", response_class=HTMLResponse)
def admin(request: Request):
    return render_template("nav_shell.html", request, MINIPOST_INIT={"locked_path": "/orders", "locked_sub": "/orders/label-upload", "locked_tab": "/orders/label-upload/list"})

@app.get("/orders/label-upload/list", response_class=HTMLResponse)
def page_label_list(request: Request):
    return render_template("label_upload_list.html", request, MINIPOST_INIT={"locked_path": "/orders", "locked_sub": "/orders/label-upload", "locked_tab": "/orders/label-upload/list"})

@app.get("/orders/label-upload/logs", response_class=HTMLResponse)
def page_label_logs(request: Request):
    return render_template("label_upload_logs.html", request, MINIPOST_INIT={"locked_path": "/orders", "locked_sub": "/orders/label-upload", "locked_tab": "/orders/label-upload/logs"})

@app.get("/logistics/channels/platform", response_class=HTMLResponse)
def page_logistics_platform(request: Request):
    return render_template("logistics_platform.html", request, MINIPOST_INIT={"locked_path": "/logistics", "locked_sub": "/logistics/channels", "locked_tab": "/logistics/channels/platform"})

@app.get("/logistics/channels/self", response_class=HTMLResponse)
def page_logistics_self(request: Request):
    return render_template("logistics_self.html", request, MINIPOST_INIT={"locked_path": "/logistics", "locked_sub": "/logistics/channels", "locked_tab": "/logistics/channels/self"})

@app.get("/logistics/channels/overseas", response_class=HTMLResponse)
def page_logistics_overseas(request: Request):
    return render_template("logistics_overseas.html", request, MINIPOST_INIT={"locked_path": "/logistics", "locked_sub": "/logistics/channels", "locked_tab": "/logistics/channels/overseas"})

@app.get("/logistics/channels/custom", response_class=HTMLResponse)
def page_logistics_custom(request: Request):
    return render_template("logistics_custom.html", request, MINIPOST_INIT={"locked_path": "/logistics", "locked_sub": "/logistics/channels", "locked_tab": "/logistics/channels/custom"})

# Demo APIs (前端已内置演示逻辑，此处留空或返回简单数据)
@app.get("/api/label-upload/list")
def api_label_list():
    return {"items": []}

@app.get("/api/label-upload/logs")
def api_label_logs():
    return {"items": []}

@app.post("/api/label-upload/upload")
async def api_label_upload(file: UploadFile = File(...)):
    return {"ok": True, "filename": file.filename}
