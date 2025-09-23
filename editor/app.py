# -*- coding: utf-8 -*-
"""
独立前端模版编辑器（FastAPI）——稳定版（含启动容错 + Vue 支持）
- 端口：默认 6006（可用 EDITOR_PORT 覆盖）
- 登录：EDITOR_USER / EDITOR_PASS（默认：daddy / 20240314AaA#）
- 扫描范围：backend/templates、backend/static、frontend/src、frontend/public、editor（可编辑编辑器自身）
- 元数据：中文名（cn）+ 中文释义（desc），可在 UI “信息”按钮在线维护，写入 editor/config/templates_map.yaml
- 保存即生效：保存即写入磁盘；对 Jinja/静态资源通常请求立刻生效（后端建议配合 JINJA_AUTO_RELOAD=1）
"""
import os, io, sys, json, time, shutil, zipfile, hashlib, pathlib, mimetypes
from datetime import datetime
from typing import List, Dict, Optional

from fastapi import FastAPI, Request, Form, Depends, HTTPException, status
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from starlette.templating import Jinja2Templates

try:
    import yaml
except Exception:
    yaml = None

try:
    from jsmin import jsmin
except Exception:
    jsmin = None

try:
    import rcssmin
except Exception:
    rcssmin = None

# ========== 环境变量 ==========
ROOT_DIR = pathlib.Path(os.getenv("ROOT_DIR", "/workspace")).resolve()
EDITOR_PORT = int(os.getenv("EDITOR_PORT", "6006"))
EDITOR_USER = os.getenv("EDITOR_USER", "daddy")
EDITOR_PASS = os.getenv("EDITOR_PASS", "20240314AaA#")

# 允许的后缀（含 .vue/.py：.py 仅编辑不预览；.vue 仅编辑不预览）
ALLOWED_SUFFIX = [".html",".htm",".css",".js",".mjs",".ts",".tsx",".svg",".xml",".vue",".py"]

# 扫描白名单（相对 ROOT_DIR）
SCAN_DIRS = [
    ROOT_DIR / "backend" / "templates",
    ROOT_DIR / "backend" / "static",
    ROOT_DIR / "frontend" / "src",
    ROOT_DIR / "frontend" / "public",
    ROOT_DIR / "editor",  # 允许自我编辑（模板/CSS/py 等）
]

# 备份/导出/配置目录（仓库端）
EDITOR_HOME = ROOT_DIR / "editor"
BACKUPS_DIR = EDITOR_HOME / "backups"
EXPORTS_DIR = EDITOR_HOME / "exports"
CONF_DIR = EDITOR_HOME / "config"
MAP_FILE = CONF_DIR / "templates_map.yaml"

for p in [BACKUPS_DIR, EXPORTS_DIR, CONF_DIR]:
    p.mkdir(parents=True, exist_ok=True)

# 确保“自编辑目录”存在（避免首次未创建导致不可挂载）
for _p in [ROOT_DIR / "editor" / "static", ROOT_DIR / "editor" / "templates"]:
    try:
        _p.mkdir(parents=True, exist_ok=True)
    except Exception:
        pass

# ========== FastAPI 基础 ==========
app = FastAPI(title="Minipost 前端模版编辑器")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.add_middleware(SessionMiddleware, secret_key=os.getenv("SESSION_SECRET", "change-me-editor-secret"), max_age=86400)

# —— 启动容错：静态/模板目录优先使用 /workspace/editor/，缺失则回退到镜像内置 /app/ —— 
WS_STATIC = ROOT_DIR / "editor" / "static"
WS_TEMPLATES = ROOT_DIR / "editor" / "templates"
IMG_STATIC = pathlib.Path("/app/static")
IMG_TEMPLATES = pathlib.Path("/app/templates")
static_dir = WS_STATIC if WS_STATIC.exists() else IMG_STATIC
tpl_dir = WS_TEMPLATES if WS_TEMPLATES.exists() else IMG_TEMPLATES

app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")
templates = Jinja2Templates(directory=str(tpl_dir))
print(f"[editor] using static: {static_dir}")
print(f"[editor] using templates: {tpl_dir}")

# ========== 工具函数 ==========
def _load_map() -> Dict[str, Dict[str,str]]:
    """
    读取“中文名/中文释义”映射（YAML）。
    兼容两种格式：
      path: "中文名"
      path: {cn: "中文名", desc: "中文释义"}
    始终返回 dict[path] = {"cn": "...", "desc": "..."}
    """
    out: Dict[str, Dict[str,str]] = {}
    if MAP_FILE.exists() and yaml:
        try:
            data = yaml.safe_load(MAP_FILE.read_text(encoding="utf-8")) or {}
            if isinstance(data, dict):
                for k,v in data.items():
                    if isinstance(v, str):
                        out[k] = {"cn": v, "desc": ""}
                    elif isinstance(v, dict):
                        out[k] = {"cn": v.get("cn","") or v.get("name",""), "desc": v.get("desc","")}
        except Exception:
            pass
    return out

def _save_map(mapping: Dict[str, Dict[str,str]]):
    """写回“中文名/中文释义”映射"""
    if not yaml:
        return
    ordered = dict(sorted(mapping.items(), key=lambda x: x[0]))
    MAP_FILE.write_text(yaml.safe_dump(ordered, allow_unicode=True, sort_keys=True), encoding="utf-8")

def _is_allowed(path: pathlib.Path) -> bool:
    """确保访问路径在白名单目录内"""
    try:
        rp = path.resolve()
        for base in SCAN_DIRS:
            if rp.is_relative_to(base.resolve()):
                return True
    except Exception:
        pass
    return False

def _file_kind(p: pathlib.Path) -> str:
    """用于列表显示的类型标签"""
    ext = p.suffix.lower()
    if ext in [".html", ".htm"]: return "HTML"
    if ext in [".css"]: return "CSS"
    if ext in [".js", ".mjs"]: return "JS"
    if ext in [".ts", ".tsx"]: return "TS/TSX"
    if ext in [".vue"]: return "VUE"
    if ext in [".svg",".xml"]: return "SVG/XML"
    if ext in [".py"]: return "PY"
    return ext.upper().lstrip(".") or "文件"

def _scan_files() -> List[Dict]:
    """递归扫描 SCAN_DIRS"""
    mapping = _load_map()
    rows = []
    for base in SCAN_DIRS:
        if not base.exists(): 
            continue
        for p in base.rglob("*"):
            if p.is_file() and p.suffix.lower() in ALLOWED_SUFFIX:
                rel = p.relative_to(ROOT_DIR).as_posix()
                meta = mapping.get(rel, {"cn":"", "desc":""})
                rows.append({
                    "path": rel, 
                    "cn": meta.get("cn",""),
                    "desc": meta.get("desc",""),
                    "kind": _file_kind(p),
                })
    rows.sort(key=lambda x: x["path"])
    return rows

def _now_ts() -> str:
    return datetime.now().strftime("%Y%m%d%H%M%S")

def _backup_path_for(rel: str) -> pathlib.Path:
    """某文件对应的备份目录（避免过长路径，使用 sha1）"""
    safe = hashlib.sha1(rel.encode("utf-8")).hexdigest()[:12]
    d = BACKUPS_DIR / safe
    d.mkdir(parents=True, exist_ok=True)
    return d

def _create_backup(file_path: pathlib.Path):
    """保存前自动备份，最多保留 10 个"""
    if not file_path.exists():
        return
    rel = file_path.relative_to(ROOT_DIR).as_posix()
    d = _backup_path_for(rel)
    ts = _now_ts()
    bk = d / f"{ts}.bak"
    bk.write_bytes(file_path.read_bytes())
    # 只保留最新 10 个
    items = sorted(d.glob("*.bak"), key=lambda p: p.name, reverse=True)
    for old in items[10:]:
        try: old.unlink(missing_ok=True)
        except Exception: pass

def _list_backups(rel: str):
    d = _backup_path_for(rel)
    items = sorted(d.glob("*.bak"), key=lambda p: p.name, reverse=True)[:10]
    out = []
    for p in items:
        t = p.stem
        try: dt = datetime.strptime(t, "%Y%m%d%H%M%S").strftime("%Y-%m-%d %H:%M:%S")
        except Exception: dt = t
        out.append({"ts": t, "time": dt})
    return out

def _bundle(kind: str) -> pathlib.Path:
    """简单合并并尽量压缩 JS 或 CSS（跳过 editor 自身目录）"""
    files = _scan_files()
    targets = []
    if kind == "js":
        for f in files:
            if f["path"].endswith((".js",".mjs")) and not f["path"].startswith("editor/"):
                targets.append(ROOT_DIR / f["path"])
    elif kind == "css":
        for f in files:
            if f["path"].endswith(".css") and not f["path"].startswith("editor/"):
                targets.append(ROOT_DIR / f["path"])
    else:
        raise ValueError("bad kind")
    ts = _now_ts()
    out = EXPORTS_DIR / (f"{kind}-bundle-{ts}.min.{kind}")
    buf = []
    for p in targets:
        try:
            text = p.read_text(encoding="utf-8", errors="ignore")
            if kind == "js" and jsmin:
                text = jsmin(text)
            elif kind == "css" and rcssmin:
                text = rcssmin.cssmin(text)
            buf.append(text)
        except Exception:
            pass
    out.write_text("\n\n".join(buf), encoding="utf-8")
    return out

def _zip_all() -> pathlib.Path:
    """导出所有前端代码为 ZIP（目录结构与仓库一致，可覆盖）"""
    ts = _now_ts()
    zip_path = EXPORTS_DIR / f"frontend-all-{ts}.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        def add_dir(rel_dir: str):
            p = ROOT_DIR / rel_dir
            if not p.exists(): return
            for file in p.rglob("*"):
                if file.is_file():
                    arc = file.relative_to(ROOT_DIR).as_posix()
                    z.write(file, arcname=arc)
        for rel in ["frontend", "backend/templates", "backend/static", "editor/exports"]:
            add_dir(rel)
    return zip_path

def ensure_login(request: Request):
    """依赖：确保已登录"""
    if not request.session.get("authed"):
        raise HTTPException(status_code=status.HTTP_302_FOUND, detail="redirect", headers={"Location": "/login"})
    return True

# ========== 登录 / 首页 ==========
@app.get("/login", response_class=HTMLResponse)
def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request, "err": ""})

@app.post("/login")
def login_submit(request: Request, username: str = Form(...), password: str = Form(...)):
    if username == EDITOR_USER and password == EDITOR_PASS:
        request.session["authed"] = True
        return RedirectResponse("/", status_code=302)
    return templates.TemplateResponse("login.html", {"request": request, "err": "账号或密码错误"}, status_code=400)

@app.get("/logout")
def logout(request: Request):
    request.session.clear()
    return RedirectResponse("/login", status_code=302)

@app.get("/", response_class=HTMLResponse)
def home(request: Request, ok: bool = Depends(ensure_login)):
    return templates.TemplateResponse("editor.html", {"request": request})

# ========== 文件列表 / 读写 / 备份 / 预览 ==========
@app.get("/api/list")
def api_list(ok: bool = Depends(ensure_login)):
    return JSONResponse(_scan_files())

@app.get("/api/file")
def api_file(path: str, ok: bool = Depends(ensure_login)):
    fp = (ROOT_DIR / path).resolve()
    if not _is_allowed(fp):
        raise HTTPException(403, "path not allowed")
    if not fp.exists():
        return JSONResponse({"content": ""})
    data = fp.read_text(encoding="utf-8", errors="ignore")
    return JSONResponse({"content": data})

@app.post("/api/save")
def api_save(payload: dict, ok: bool = Depends(ensure_login)):
    path = payload.get("path","")
    content = payload.get("content","")
    if not path:
        return JSONResponse({"ok": False, "err": "missing path"})
    fp = (ROOT_DIR / path).resolve()
    if not _is_allowed(fp):
        raise HTTPException(403, "path not allowed")
    fp.parent.mkdir(parents=True, exist_ok=True)
    # 保存前自动备份
    if fp.exists():
        _create_backup(fp)
    fp.write_text(content, encoding="utf-8")
    # 保存成功即返回；对模板/静态资源通常刷新即生效
    return JSONResponse({"ok": True})

@app.get("/api/backups")
def api_backups(path: str, ok: bool = Depends(ensure_login)):
    return JSONResponse(_list_backups(path))

@app.post("/api/restore")
def api_restore(payload: dict, ok: bool = Depends(ensure_login)):
    path = payload.get("path","")
    ts = payload.get("ts","")
    if not path or not ts:
        return JSONResponse({"ok": False, "err": "missing"})
    d = _backup_path_for(path)
    bk = d / f"{ts}.bak"
    if not bk.exists():
        return JSONResponse({"ok": False, "err": "not found"})
    fp = (ROOT_DIR / path).resolve()
    if not _is_allowed(fp):
        raise HTTPException(403, "path not allowed")
    fp.write_bytes(bk.read_bytes())
    return JSONResponse({"ok": True, "content": fp.read_text(encoding="utf-8", errors="ignore")})

@app.get("/api/preview", response_class=HTMLResponse)
def api_preview(path: str, ok: bool = Depends(ensure_login)):
    """临时预览：HTML 直返；CSS/JS/SVG 包装壳；.vue/.py 不支持预览"""
    fp = (ROOT_DIR / path).resolve()
    if not _is_allowed(fp): 
        raise HTTPException(403, "path not allowed")
    if not fp.exists(): 
        return HTMLResponse("<!doctype html><body>空白</body>")
    text = fp.read_text(encoding="utf-8", errors="ignore")
    ext = fp.suffix.lower()
    if ext in [".html", ".htm"]:
        return HTMLResponse(text)
    elif ext in [".css"]:
        html = f"<!doctype html><meta charset='utf-8'><style>{text}</style><body><div>这是 CSS 预览（示例 DIV）。</div></body>"
        return HTMLResponse(html)
    elif ext in [".js", ".mjs"]:
        html = f"<!doctype html><meta charset='utf-8'><body><div id='app'>JS 预览：控制台查看输出</div><script>{text}</script></body>"
        return HTMLResponse(html)
    elif ext in [".svg",".xml"]:
        html = f"<!doctype html><meta charset='utf-8'><body>{text}</body>"
        return HTMLResponse(html)
    else:
        return HTMLResponse("<!doctype html><body>当前类型暂不支持预览。</body>")

# ========== 打包 / 导出 ==========
@app.post("/api/bundle")
def api_bundle(kind: str, ok: bool = Depends(ensure_login)):
    try:
        p = _bundle(kind)
        return JSONResponse({"ok": True, "filename": p.name})
    except Exception as e:
        return JSONResponse({"ok": False, "err": str(e)})

@app.get("/api/export/zip")
def api_export_zip(ok: bool = Depends(ensure_login)):
    p = _zip_all()
    return FileResponse(path=str(p), filename=p.name, media_type="application/zip")

@app.get("/api/export/one")
def api_export_one(path: str, ok: bool = Depends(ensure_login)):
    fp = (ROOT_DIR / path).resolve()
    if not _is_allowed(fp) or not fp.exists():
        raise HTTPException(404, "not found")
    mt = mimetypes.guess_type(fp.name)[0] or "application/octet-stream"
    return FileResponse(path=str(fp), filename=fp.name, media_type=mt)

# ========== 新建文件/目录 ==========
@app.post("/api/new")
def api_new(payload: dict, ok: bool = Depends(ensure_login)):
    rel = (payload.get("path") or "").strip().lstrip("/")
    content = payload.get("content","")
    if not rel: return JSONResponse({"ok": False, "err": "缺少 path"})
    fp = (ROOT_DIR / rel).resolve()
    if not _is_allowed(fp): raise HTTPException(403, "path not allowed")
    fp.parent.mkdir(parents=True, exist_ok=True)
    if fp.exists(): return JSONResponse({"ok": False, "err": "文件已存在"})
    fp.write_text(content, encoding="utf-8")
    return JSONResponse({"ok": True})

@app.post("/api/mkdir")
def api_mkdir(payload: dict, ok: bool = Depends(ensure_login)):
    rel = (payload.get("path") or "").strip().lstrip("/")
    if not rel: return JSONResponse({"ok": False, "err": "缺少 path"})
    dp = (ROOT_DIR / rel).resolve()
    if not _is_allowed(dp): raise HTTPException(403, "path not allowed")
    dp.mkdir(parents=True, exist_ok=True)
    return JSONResponse({"ok": True})

# ========== 中文名/释义 映射 ==========
@app.get("/api/map")
def api_map_get(ok: bool = Depends(ensure_login)):
    return JSONResponse(_load_map())

@app.post("/api/map/set")
def api_map_set(payload: dict, ok: bool = Depends(ensure_login)):
    path = (payload.get("path") or "").strip().lstrip("/")
    cn = (payload.get("cn") or "").strip()
    desc = (payload.get("desc") or "").strip()
    if not path: return JSONResponse({"ok": False, "err": "缺少 path"})
    m = _load_map()
    m[path] = {"cn": cn, "desc": desc}
    _save_map(m)
    return JSONResponse({"ok": True})
