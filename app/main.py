# app/main.py
import os
import pathlib
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

APP_TITLE = "minipost"
BASE_DIR = pathlib.Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent
TEMPLATES_DIR = BASE_DIR / "templates"
STATIC_DIR = ROOT_DIR / "static"

app = FastAPI(title=APP_TITLE)

# 可选挂载静态资源（目录存在才挂）
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


# ---- 健康检查：修复部署时 curl 404 ----
@app.get("/api/healthz", tags=["sys"])
def healthz():
    return {"ok": True, "service": APP_TITLE}


# ---- /admin ：优先渲染你的 UI 模板（不存在则用占位页） ----
def _load_admin_dashboard_html() -> str:
    """
    优先读取你提供的 UI 模板文件：
      app/templates/admin/dashboard.html

    若文件还没落盘，返回一个轻量占位页（HTTP 200），
    保证部署脚本探活/人工访问都不再 404。
    """
    html_path = TEMPLATES_DIR / "admin" / "dashboard.html"
    try:
        return html_path.read_text(encoding="utf-8")
    except Exception:
        # 占位提示页（保持 200）
        return """<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Admin 控制台 - 占位</title>
<style>
  body{font-family:system-ui,-apple-system,PingFang SC,Segoe UI,Microsoft YaHei,sans-serif;margin:0;padding:24px;background:#fff;color:#0f172a}
  .card{max-width:920px;margin:6vh auto;padding:24px;border:1px solid #e5e7eb;border-radius:16px;background:#f9fafb}
  .tip{color:#334155;margin-top:8px}
  a{color:#111827}
  code{background:#f1f5f9;padding:.2em .4em;border-radius:6px}
</style>
</head>
<body>
  <div class="card">
    <h2 style="margin:0 0 12px;">管理后台已在线</h2>
    <p class="tip">为了显示你的完整 UI，请把你提供的 HTML 原样保存为：</p>
    <pre><code>app/templates/admin/dashboard.html</code></pre>
    <p class="tip">保存后无需改代码，刷新本页即可呈现你的 UI。</p>
    <p class="tip">健康检查：<code>/api/healthz</code> 返回 200。</p>
  </div>
</body>
</html>"""


@app.get("/admin", response_class=HTMLResponse, include_in_schema=False)
async def admin_index(_: Request):
    html = _load_admin_dashboard_html()
    return HTMLResponse(content=html)


# ---- /admin/login ：简单占位（可后续接你现有鉴权）----
@app.get("/admin/login", response_class=HTMLResponse, include_in_schema=False)
async def admin_login(_: Request):
    return HTMLResponse("""
<!doctype html><html lang="zh-CN"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>登录</title>
<style>
  body{display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f6f6f6;font-family:system-ui,-apple-system,PingFang SC,Segoe UI,Microsoft YaHei,sans-serif}
  .box{width:min(420px,92vw);background:#fff;border:1px solid #e5e7eb;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.06);padding:20px}
  h1{margin:0 0 16px;font-size:18px}
  label{display:block;margin:10px 0 6px;color:#334155;font-size:12px}
  input{width:100%;height:36px;border:1px solid #d1d5db;border-radius:999px;padding:0 12px;font-size:14px}
  button{width:100%;height:38px;margin-top:14px;border:0;border-radius:999px;background:#0a0a0a;color:#fff;font-size:14px;cursor:pointer}
  .link{display:block;text-align:center;margin-top:10px;text-decoration:none;color:#111827}
</style></head><body>
  <div class="box">
    <h1>管理后台登录</h1>
    <form action="/admin" method="get">
      <label>账号</label><input name="u" autocomplete="username"/>
      <label>密码</label><input name="p" type="password" autocomplete="current-password"/>
      <button type="submit">进入后台</button>
    </form>
    <a class="link" href="/admin">先进入（占位）</a>
  </div>
</body></html>
    """)
