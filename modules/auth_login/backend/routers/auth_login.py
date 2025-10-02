# modules/auth_login/backend/routers/auth_login.py
from __future__ import annotations

import os
from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, RedirectResponse

router = APIRouter(tags=["auth"], include_in_schema=False)

def _find_spa_index() -> str | None:
    # 依次尝试常见位置（容器内 /app 为工作目录）
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
    # 构建产物缺失时的兜底：重定向到根，或提示前端未构建
    return HTMLResponse(
        "<!doctype html><meta charset='utf-8'><title>Login</title>"
        "<p>前端构建产物缺失（static/assets/index.html 未找到）。"
        "请先构建前端再访问 /login。</p>",
        status_code=200,
    )

# 注意：
# /api/login 的实际登录接口保持你当前实现，不在此文件里改动路径/语义。
# 前端稍后将改为把 username/password 放到查询字符串中调用该接口。
