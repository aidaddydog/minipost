# -*- coding: utf-8 -*-
from fastapi import APIRouter, Request, Depends, HTTPException, status, Response
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session
from app.db import get_db
from app.security import verify_password, create_access_token
from modules.core.backend.models.rbac import User

router = APIRouter(tags=["auth"])

@router.get("/login", response_class=HTMLResponse)
def login_page(request: Request):
    return request.app.state.templates.TemplateResponse("modules/auth_login/frontend/templates/auth_login.html", {"request": request})

@router.post("/api/login")
def do_login(request: Request, response: Response, username: str, password: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户名或密码错误")
    token = create_access_token(user.username)
    # 写入 HTTPOnly Cookie
    response.set_cookie(key="access_token", value=token, httponly=True, samesite="lax")
    return {"ok": True}

@router.post("/api/logout")
def do_logout(response: Response):
    response.delete_cookie("access_token")
    return {"ok": True}

# Jinja2 模板实例注入（挂载到 app.state，供上方 TemplateResponse 使用）
def setup_templates(app):
    from fastapi.templating import Jinja2Templates
    app.state.templates = Jinja2Templates(directory=".")
