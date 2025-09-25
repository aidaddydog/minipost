# -*- coding: utf-8 -*-
from fastapi import APIRouter, Request, Depends, Form
from fastapi.responses import RedirectResponse, HTMLResponse
from sqlalchemy.orm import Session
from pathlib import Path
from app.db import get_db
from ..services.rbac_service import authenticate

router = APIRouter()

# 模块内模板目录
TEMPLATES = Path(__file__).resolve().parents[2] / "frontend" / "templates"

@router.get("/login", response_class=HTMLResponse)
def login_page(request: Request):
    html = (TEMPLATES / "auth_login.html").read_text(encoding="utf-8")
    return HTMLResponse(html)

@router.post("/login")
def do_login(username: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    user = authenticate(db, username, password)
    if not user:
        # 失败回显（极简）
        return RedirectResponse("/login?err=1", status_code=302)
    resp = RedirectResponse("/admin", status_code=302)
    # 简易登录态（仅作演示；生产建议 JWT/Sessions）
    resp.set_cookie("user", user.username, httponly=True, samesite="lax")
    return resp

@router.get("/logout")
def logout():
    resp = RedirectResponse("/login", status_code=302)
    resp.delete_cookie("user")
    return resp
