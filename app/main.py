# app/main.py
# -*- coding: utf-8 -*-
from fastapi import FastAPI, Request, Depends, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from pathlib import Path
import importlib.util

from app.settings import settings
from app.api.health import router as health_router
from app.api.v1.nav import router as nav_router
from app.deps import current_user
from app.common.utils import refresh_nav_cache
from app.services.nav_loader import rebuild_nav


# ===== React SPA 入口（如存在则优先） =====
def _spa_index_path() -> Path | None:
    p = Path("static/assets/index.html")
    return p if p.exists() else None

# ===== 应用与静态/模板 =====
app = FastAPI(title="minipost", version="0.1.0")

# 推荐：模块静态
app.mount("/modules_static", StaticFiles(directory="modules"), name="modules_static")
# 兼容：历史硬编码的 /modules 路径（不推荐新用，但保留避免 404）
app.mount("/modules", StaticFiles(directory="modules"), name="modules")
# 全局静态
app.mount("/static", StaticFiles(directory="static"), name="static")

# 模板根设为仓库根，便于直接引用 modules/**/frontend/templates/*.html
templates = Jinja2Templates(directory=".")
app.state.templates = templates

# ===== 内建路由 =====
app.include_router(health_router)
app.include_router(nav_router)

# 登录 / RBAC（示例模块，仍保留）
from modules.auth_login.backend.routers.auth_login import router as login_router
from modules.core.backend.routers.rbac_admin import router as rbac_router
app.include_router(login_router)
app.include_router(rbac_router)

# ===== 自动 include 全部模块后端路由（一次性实现，之后新增模块无需改全局） =====
# app/main.py（节选）——替换 _auto_include_module_routers() 的实现
from pathlib import Path
import importlib.util
import traceback
import logging

logger = logging.getLogger("minipost")

def _auto_include_module_routers():
    base = Path("modules")
    if not base.exists(): 
        return
    skip = {
        str(Path("modules/auth_login/backend/routers/auth_login.py")),
        str(Path("modules/core/backend/routers/rbac_admin.py")),
    }
    for fp in sorted(base.rglob("backend/routers/*.py")):
        rel = str(fp)
        if rel in skip:
            continue
        try:
            spec = importlib.util.spec_from_file_location(f"mod_router__{fp.stem}", str(fp))
            assert spec and spec.loader
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            r = getattr(mod, "router", None)
            if r is not None:
                app.include_router(r)
        except Exception:
            # 以 WARNING 级别打印出错模块与栈信息，避免“静默失败”
            logger.warning("Auto-include router failed: %s\n%s", rel, traceback.format_exc())
            continue

_auto_include_module_routers()

# ===== 启动后构建一次聚合缓存（也支持热重载接口） =====
@app.on_event("startup")
def on_start():
    refresh_nav_cache()

# ===== 壳层首页（一级/二级/页签“胶囊”） =====
@app.get("/", response_class=HTMLResponse)
def index(request: Request, user=Depends(current_user)):
    spa = _spa_index_path()
    if spa:
        with open(spa, 'r', encoding='utf-8') as f:
            return HTMLResponse(content=f.read(), status_code=200)
    return templates.TemplateResponse(
        "modules/navauth_shell/frontend/templates/nav_shell.html",
        {"request": request, "THEME_NAME": settings.THEME_NAME, "USE_REAL_NAV": settings.USE_REAL_NAV},
    )
# ===== 通用 L3 页面渲染器（一次性实现，后续只改模块 YAML 即可） =====
def _guess_template_from_href(href: str) -> str | None:
    """
    在未提供 template 字段时的兜底策略（启发式）：
    - 例如：/logistics/channel/custom
      优先尝试：
        modules/logistics_channel/logistics_custom/frontend/templates/logistics_custom.html
        modules/logistics_channel/logistics_custom/frontend/templates/index.html
      然后在 modules/**/frontend/templates/ 下 fuzzy 搜索包含最后一段名的 html。
    """
    parts = [p for p in href.strip("/").split("/") if p]
    if len(parts) >= 3:
        l1, l2, l3 = parts[0], parts[1], parts[2]
        cand = [
            Path(f"modules/{l1}_{l2}/{l1}_{l3}/frontend/templates/{l1}_{l3}.html"),
            Path(f"modules/{l1}_{l2}/{l1}_{l3}/frontend/templates/index.html"),
            Path(f"modules/{l1}_{l2}/{l3}/frontend/templates/{l3}.html"),
            Path(f"modules/{l1}_{l2}/{l3}/frontend/templates/index.html"),
        ]
        for p in cand:
            if p.exists(): return str(p)
        # 模糊兜底
        base = Path("modules")
        for p in base.rglob("frontend/templates/*.html"):
            if f"/{l3}.html" in str(p).replace("\\","/"):
                return str(p)
    return None

@app.get("/{full_path:path}", response_class=HTMLResponse)
def serve_tab_page(full_path: str, request: Request, user=Depends(current_user)):
    # /api 与静态路径交给其他路由处理
    if full_path.startswith(('api/', 'static/', 'modules/', 'modules_static/', 'openapi.json', 'docs', 'healthz')):
        raise HTTPException(status_code=404)
    spa = _spa_index_path()
    if spa:
        with open(spa, 'r', encoding='utf-8') as f:
            return HTMLResponse(content=f.read(), status_code=200)
    # ==== 以下为旧式 Jinja 模板回退（保持兼容）====
    href = "/" + full_path if not full_path.startswith("/") else full_path
    nav = rebuild_nav(write_cache=False)
    tabs = nav.get("tabs") or {}
    template_path = None
    for base, items in tabs.items():
        for it in items:
            if it.get("href") == href:
                template_path = it.get("template")
                if not template_path:
                    template_path = _guess_template_from_href(href)
                break
        if template_path: break
    if not template_path:
        raise HTTPException(status_code=404, detail="page not registered")
    return templates.TemplateResponse(
        template_path,
        {"request": request, "THEME_NAME": settings.THEME_NAME},
    )
