# -*- coding: utf-8 -*-
from __future__ import annotations
import os
from fastapi import APIRouter, Depends, Request, Response, Form, status
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from itsdangerous import TimestampSigner, BadSignature, SignatureExpired
from app.deps import get_db, get_template_renderer
from modules.core.backend.models.rbac import CoreUser
from modules.core.backend.services.rbac_service import get_user_by_username

router = APIRouter(tags=["auth-login"])
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
COOKIE_NAME="minipost_sid"; COOKIE_MAX_AGE=60*60*8; SECURE=True
def _signer(): return TimestampSigner(os.environ.get("SESSION_SECRET") or "CHANGE_ME_SECRET")
def _set_cookie(resp: Response, value: str):
    resp.set_cookie(COOKIE_NAME, value, max_age=COOKIE_MAX_AGE, httponly=True, secure=SECURE, samesite="lax", path="/")
def _clear_cookie(resp: Response): resp.delete_cookie(COOKIE_NAME, path="/")

@router.get("/login", response_class=HTMLResponse)
def login_page(request: Request):
    html = get_template_renderer().render("auth/login.html", {"request": request, "err": ""})
    return HTMLResponse(html)

@router.post("/login")
def login_do(request: Request, response: Response, username: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    user = get_user_by_username(db, username=username)
    if not user or not pwd_ctx.verify(password, user.password_hash) or not user.is_active:
        html = get_template_renderer().render("auth/login.html", {"request": request, "err": "用户名或密码错误"})
        return HTMLResponse(html, status_code=status.HTTP_401_UNAUTHORIZED)
    token = _signer().sign(f"{user.id}".encode()).decode()
    resp = RedirectResponse(url="/", status_code=status.HTTP_302_FOUND)
    _set_cookie(resp, token)
    return resp

@router.post("/logout")
def logout_do():
    resp = RedirectResponse(url="/login", status_code=status.HTTP_302_FOUND)
    _clear_cookie(resp)
    return resp

@router.get("/session")
def session_info(request: Request, db: Session = Depends(get_db)):
    sid = request.cookies.get(COOKIE_NAME)
    if not sid: return {"authenticated": False}
    try:
        raw = _signer().unsign(sid, max_age=COOKIE_MAX_AGE).decode()
        user_id = int(raw.split(":")[0]) if ":" in raw else int(raw)
        user = db.get(CoreUser, user_id)
        if not user: return {"authenticated": False}
        return {"authenticated": True, "user": {"id": user.id, "username": user.username, "full_name": user.full_name}}
    except (BadSignature, SignatureExpired):
        return {"authenticated": False}
