# -*- coding: utf-8 -*-
from __future__ import annotations
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from app.deps import get_current_user_optional
from app.navbuilder import build_nav_cache, load_nav_cache, filter_nav_by_perms

router = APIRouter(prefix="/api/v1/shell", tags=["nav-shell"])

@router.get("/nav")
def get_nav(user=Depends(get_current_user_optional)):
    data = load_nav_cache()
    data = filter_nav_by_perms(data, user)
    return JSONResponse(data)

@router.post("/nav/rebuild")
def rebuild_nav():
    build_nav_cache()
    data = load_nav_cache()
    return JSONResponse({"ok": True, "items": len(data.get("l1", []))})

@router.get("/profile")
def profile(user=Depends(get_current_user_optional)):
    if not user: return {"authenticated": False}
    return {"authenticated": True, "name": user.full_name or user.username, "avatar": ""}

@router.get("/notice")
def notice(): return {"unread": 0, "recent": []}
