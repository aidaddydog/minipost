# -*- coding: utf-8 -*-
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session
from app.db import get_db
from app.security import create_jwt, verify_password, current_user
from modules.core.backend.models.rbac import User

router = APIRouter()

@router.post("/login")
def api_login(username: str, password: str, response: Response, db: Session = Depends(get_db)):
    u = db.query(User).filter(User.username==username).first()
    if not u or not verify_password(password, u.password_hash):
        raise HTTPException(status_code=401, detail={"code":"E-401","msg":"用户名或密码错误。"})
    token = create_jwt(str(u.id), u.username)
    response.set_cookie("MINIPOST_TOKEN", token, httponly=True, secure=False, samesite="lax", max_age=3600*24*7, path="/")
    return {"ok": True, "token": token}

@router.get("/me")
def api_me(user: User = Depends(current_user)):
    return {"id": user.id, "username": user.username, "full_name": user.full_name, "is_active": user.is_active}
