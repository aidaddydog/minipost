from pathlib import Path
from fastapi import FastAPI, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

BASE_DIR = Path(__file__).resolve().parent.parent          # 仓库根目录
APP_DIR = Path(__file__).resolve().parent                  # app/
TEMPLATES_DIR = APP_DIR / "templates"                      # app/templates
STATIC_DIR = BASE_DIR / "static"                           # static/

app = FastAPI(title="minipost", docs_url="/docs", redoc_url=None)

# 静态资源（如有）
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

templates = Jinja2Templates(directory=str(TEMPLATES_DIR))


@app.get("/", include_in_schema=False)
def root():
    # 直接跳到后台
    return RedirectResponse(url="/admin", status_code=status.HTTP_302_FOUND)


def _pick_admin_template() -> str:
    """
    优先使用你提供的新 UI 页面：
    - admin/label_upload_list.html
    - admin/dashboard.html
    - admin/index.html
    任意一个存在即可渲染；否则回退到内置占位页。
    """
    candidates = [
        "admin/label_upload_list.html",
        "admin/dashboard.html",
        "admin/index.html",
    ]
    for name in candidates:
        if (TEMPLATES_DIR / name).exists():
            return name
    return ""


@app.get("/admin", response_class=HTMLResponse, include_in_schema=False)
def admin_page(request: Request):
    name = _pick_admin_template()
    if name:
        return templates.TemplateResponse(name, {"request": request})
    # 回退占位：提示放置 UI 文件（不会改变你的 UI）
    html = """<!doctype html><meta charset="utf-8">
    <title>minipost 管理后台</title>
    <div style="font:14px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,Microsoft YaHei,sans-serif;padding:24px">
      <h2>管理后台已运行</h2>
      <p>请将你的 UI 模板保存为 <code>app/templates/admin/label_upload_list.html</code> 后刷新本页。</p>
    </div>"""
    return HTMLResponse(html)


@app.get("/admin/login", response_class=HTMLResponse, include_in_schema=False)
def admin_login(request: Request):
    name = "auth/login.html"
    if (TEMPLATES_DIR / name).exists():
        return templates.TemplateResponse(name, {"request": request})
    html = """<!doctype html><meta charset="utf-8">
    <title>登录</title>
    <div style="font:14px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,Microsoft YaHei,sans-serif;padding:24px">
      <h2>登录</h2>
      <p>请提供登录模板：<code>app/templates/auth/login.html</code></p>
    </div>"""
    return HTMLResponse(html)


@app.get("/healthz", include_in_schema=False)
def healthz():
    return {"ok": True}


# 可选：自动挂载已有 API 路由（若不存在则跳过，不会报错）
try:
    from .api import router as api_router  # type: ignore
    app.include_router(api_router, prefix="/api")
except Exception:
    pass
