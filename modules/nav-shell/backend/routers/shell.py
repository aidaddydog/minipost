from __future__ import annotations
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.deps import get_db, get_current_user
from modules.nav_shell.backend.services.nav_builder import load_nav_cache, rebuild_nav_cache, filter_nav  # type: ignore

router = APIRouter(tags=["nav-shell"])

@router.get("/api/v1/shell/nav")
async def get_nav(db: Session = Depends(get_db), user = Depends(get_current_user)):
    nav = load_nav_cache()
    authed = bool(user)
    perms_set = set()
    if user:
        from modules.core.backend.services.rbac_service import get_user_perms
        perms_set = get_user_perms(db, user.id)
    return filter_nav(nav, perms_set, authed)

@router.post("/api/v1/shell/nav/rebuild")
async def rebuild_nav():
    return rebuild_nav_cache()

@router.get("/api/v1/shell/profile")
async def profile(user = Depends(get_current_user)):
    if not user:
        return {"authenticated": False, "name": "", "avatar": ""}
    return {"authenticated": True, "name": user.full_name or user.username, "avatar": ""}

@router.get("/api/v1/shell/notice")
async def notice():
    return {"unread": 0, "recent": []}
