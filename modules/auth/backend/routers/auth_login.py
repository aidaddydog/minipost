from __future__ import annotations
from fastapi import APIRouter, Request, Depends, Form, status, Response
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from passlib.hash import bcrypt
from app.settings import get_settings
from app.deps import get_db, get_current_user, get_session_store, create_sid, COOKIE_NAME, COOKIE_TTL_SECONDS
from modules.core.backend.models.rbac import CoreUser

router = APIRouter(tags=["auth-login"])
templates = Jinja2Templates(directory=".")

@router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse("modules/auth/frontend/templates/auth/login.html", {"request": request, "error": ""})

@router.post("/login")
async def login_post(response: Response, username: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    user = db.query(CoreUser).filter(CoreUser.username==username).first()
    if not user or not bcrypt.verify(password, user.hashed_password):
        return JSONResponse({"ok": False, "error": "用户名或密码错误"}, status_code=status.HTTP_401_UNAUTHORIZED)
    sid = create_sid()
    store = get_session_store()
    store.set(sid, user.id, COOKIE_TTL_SECONDS)
    settings = get_settings()
    response = JSONResponse({"ok": True})
    response.set_cookie(
        key=COOKIE_NAME, value=sid,
        httponly=True, samesite="lax",
        secure=bool(settings.APP_COOKIE_SECURE),
        max_age=COOKIE_TTL_SECONDS,
    )
    return response

@router.post("/logout")
async def logout(response: Response):
    response = RedirectResponse(url="/login", status_code=status.HTTP_302_FOUND)
    response.delete_cookie(COOKIE_NAME)
    return response

@router.get("/session")
async def session(user = Depends(get_current_user)):
    if not user:
        return {"authenticated": False}
    return {"authenticated": True, "user": {"id": user.id, "username": user.username, "display_name": user.full_name}}
