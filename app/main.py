# app/main.py
# -*- coding: utf-8 -*-
from fastapi import FastAPI, Request, Depends, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
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
def _auto_include_module_routers():
    base = Path("modules")
    if not base.exists(): return
    # 排除已手动 include 的
    skip = {
        str(Path("modules/auth_login/backend/routers/auth_login.py")),
        str(Path("modules/core/backend/routers/rbac_admin.py")),
    }
    for fp in sorted(base.rglob("backend/routers/*.py")):
        rel = str(fp)
        if rel in skip: 
            continue
        # 动态加载该 .py 文件并 include 其中的 `router`
        try:
            spec = importlib.util.spec_from_file_location(f"mod_router__{fp.stem}", str(fp))
            mod = importlib.util.module_from_spec(spec)
            assert spec and spec.loader
            spec.loader.exec_module(mod)
            r = getattr(mod, "router", None)
            if r is not None:
                app.include_router(r)
        except Exception:
            # 出错忽略，不阻塞主流程；模块自行修复其路由文件即可
            continue

_auto_include_module_routers()

# ===== 启动后构建一次聚合缓存（也支持热重载接口） =====
@app.on_event("startup")
def on_start():
    refresh_nav_cache()

# ===== 壳层首页（一级/二级/页签“胶囊”） =====
@app.get("/", response_class=HTMLResponse)
def index(request: Request, user=Depends(current_user)):
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
    # 保留 API / 静态路径给其它路由
    if full_path.startswith("api/"): 
        raise HTTPException(status_code=404)
    href = "/" + full_path if not full_path.startswith("/") else full_path

    nav = rebuild_nav(write_cache=False)
    tabs = nav.get("tabs") or {}

    # 查找是否为任何 L2 的页签 href
    template_path = None
    for base, items in tabs.items():
        for it in items:
            if it.get("href") == href:
                template_path = it.get("template")
                if not template_path:
                    template_path = _guess_template_from_href(href)
                break
        if template_path:
            break

    if not template_path:
        # 不是注册的页面，交给 404
        raise HTTPException(status_code=404, detail="page not registered")

    return templates.TemplateResponse(
        template_path,
        {"request": request, "THEME_NAME": settings.THEME_NAME},
    )
