# -*- coding: utf-8 -*-
from fastapi import APIRouter, Request, Depends, HTTPException, status, Response
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app.db import get_db
from app.security import verify_password, create_access_token
from modules.core.backend.models.rbac import User

router = APIRouter(tags=["auth"])

# 兜底模板（若 app.state 未注入则使用本地实例）
_local_templates = Jinja2Templates(directory=".")

@router.get("/login", response_class=HTMLResponse)
def login_page(request: Request):
    templates = getattr(getattr(request.app, "state", object()), "templates", _local_templates)
    return templates.TemplateResponse("modules/auth_login/frontend/templates/auth_login.html", {"request": request})

@router.post("/api/login")
def do_login(request: Request, response: Response, username: str, password: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户名或密码错误")
    token = create_access_token(user.username)
    response.set_cookie(key="access_token", value=token, httponly=True, samesite="lax")
    return {"ok": True}

@router.post("/api/logout")
def do_logout(response: Response):
    response.delete_cookie("access_token")
    return {"ok": True}

def setup_templates(app):
    """在 app.state 注入 Jinja2 模板实例（供上方 TemplateResponse 使用）"""
    app.state.templates = Jinja2Templates(directory=".")
