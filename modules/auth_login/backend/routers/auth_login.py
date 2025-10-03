# modules/auth_login/backend/routers/auth_login.py
from __future__ import annotations

import os
from typing import Optional, Dict, Any

from fastapi import APIRouter, Request, Depends, HTTPException, status
from fastapi.responses import HTMLResponse, JSONResponse
from sqlalchemy.orm import Session

from app.db import get_db
from app.security import create_access_token, pwd_context
from modules.core.backend.models.rbac import User

router = APIRouter(tags=["auth"], include_in_schema=False)

# ---------- SPA 登录页（保持不变）：GET /login ----------
def _find_spa_index() -> Optional[str]:
    candidates = [
        "/app/static/assets/index.html",
        "/app/static/index.html",
        "static/assets/index.html",
        "static/index.html",
    ]
    for p in candidates:
        if os.path.exists(p):
            return p
    return None

@router.get("/login")
def login_page(request: Request):
    spa = _find_spa_index()
    if spa:
        with open(spa, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read(), status_code=200)
    return HTMLResponse(
        "<!doctype html><meta charset='utf-8'><title>Login</title>"
        "<p>前端构建产物缺失（static/assets/index.html 未找到）。"
        "请先构建前端再访问 /login。</p>",
        status_code=200,
    )

# ---------- 工具：从 Query/Form/JSON 里尽量解析出 username/password ----------
async def _extract_credentials(request: Request) -> Dict[str, Any]:
    q = request.query_params
    username = q.get("username")
    password = q.get("password")

    if not (username and password) and request.method.upper() == "POST":
        ctype = (request.headers.get("content-type") or "").lower()
        # application/x-www-form-urlencoded
        if "application/x-www-form-urlencoded" in ctype:
            form = await request.form()
            username = username or form.get("username")
            password = password or form.get("password")
        else:
            # 尝试 JSON（容错：报错则忽略）
            try:
                data = await request.json()
                if isinstance(data, dict):
                    username = username or data.get("username")
                    password = password or data.get("password")
            except Exception:
                pass

    return {"username": (username or "").strip(), "password": (password or "").strip()}

# ---------- 登录接口：/api/login（GET/POST 均可） ----------
@router.api_route("/api/login", methods=["GET", "POST"])
async def api_login(request: Request, db: Session = Depends(get_db)):
    """
    统一的登录接口（不再依赖旧逻辑）：
    - 接受 Query / x-www-form-urlencoded / JSON 中的 username/password
    - 校验成功：签发 JWT，写入 access_token（HTTPOnly Cookie），返回 {ok: True, user: username}
    - 失败：401 / 400
    """
    creds = await _extract_credentials(request)
    username = creds.get("username")
    password = creds.get("password")

    if not username or not password:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="缺少用户名或密码")

    user: Optional[User] = (
        db.query(User)
        .filter(User.username == username, User.is_active == True)  # noqa: E712
        .first()
    )
    if not user or not pwd_context.verify(password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户名或密码错误")

    # 生成 JWT，写入 HttpOnly Cookie（与 app.deps.current_user 依赖一致）
    token = create_access_token(sub=user.username)

    resp = JSONResponse({"ok": True, "user": user.username})
    # Cookie 属性：HttpOnly，Lax，路径根；开发环境未强制 secure
    resp.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=60 * 60 * 8,  # 与 Settings.JWT_EXPIRES_MINUTES 保持一致（8 小时）
        path="/",
    )
    return resp

# ---------- 登出：清除 Cookie ----------
@router.post("/api/logout")
def api_logout():
    resp = JSONResponse({"ok": True})
    resp.delete_cookie("access_token", path="/")
    return resp
