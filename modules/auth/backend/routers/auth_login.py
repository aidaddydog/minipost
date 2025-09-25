from __future__ import annotations
from fastapi import APIRouter, Request, Depends, Form, Response, status
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from sqlalchemy.orm import Session
from starlette.templating import Jinja2Templates
from app.deps import get_db, redis_client
from app.settings import settings
from modules.core.backend.services.rbac_service import get_user_by_username, verify_password

import uuid

router = APIRouter(tags=["login"])
templates = Jinja2Templates(directory="modules")

@router.get("/login", response_class=HTMLResponse)
def login_page(request: Request):
    return templates.TemplateResponse("auth/frontend/templates/auth/login.html", {"request": request, "error": ""})

@router.post("/login")
def do_login(
    request: Request,
    response: Response,
    username: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
):
    user = get_user_by_username(db, username)
    if not user or not user.is_active or not verify_password(password, user.password_hash):
        return templates.TemplateResponse("auth/frontend/templates/auth/login.html", {"request": request, "error": "账号或密码错误"}, status_code=400)

    sid = str(uuid.uuid4())
    expire = settings.session_expire_seconds
    if redis_client:
        redis_client.setex(f"sid:{sid}", expire, user.id)
    else:
        if not hasattr(request.app.state, "sessions"):
            request.app.state.sessions = {}
        request.app.state.sessions[sid] = user.id

    resp = RedirectResponse(url="/", status_code=status.HTTP_302_FOUND)
    resp.set_cookie("sid", sid, max_age=expire, httponly=True, samesite="lax")
    return resp

@router.post("/logout")
def logout(request: Request, response: Response):
    sid = request.cookies.get("sid")
    if sid:
        if redis_client:
            redis_client.delete(f"sid:{sid}")
        else:
            if hasattr(request.app.state, "sessions"):
                request.app.state.sessions.pop(sid, None)
    resp = RedirectResponse(url="/login", status_code=status.HTTP_302_FOUND)
    resp.delete_cookie("sid")
    return resp

@router.get("/session")
def session_info(request: Request):
    sid = request.cookies.get("sid")
    ok = False
    user = None
    if sid:
        if redis_client:
            user = redis_client.get(f"sid:{sid}")
        else:
            user = request.app.state.sessions.get(sid) if hasattr(request.app.state, "sessions") else None
        ok = bool(user)
    return JSONResponse({"authenticated": ok})
