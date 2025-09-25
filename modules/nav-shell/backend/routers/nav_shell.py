from __future__ import annotations
from fastapi import APIRouter, Request, Depends
from fastapi.responses import JSONResponse
import json, os
from typing import Set, Dict, Any
from modules.nav_shell.backend.services.nav_merge import rebuild_nav_cache, NAV_CACHE
from modules.core.backend.services.rbac_service import get_user_permissions, get_user_by_id
from app.deps import get_db, require_authenticated
from sqlalchemy.orm import Session

router = APIRouter()

def _filter_by_perms(nav: dict, user_perms: Set[str], authenticated: bool) -> dict:
    def allowed(item: Dict[str, Any]) -> tuple[bool, bool]:
        req_all = set(item.get("require_all") or [])
        req_any = set(item.get("require_any") or [])
        visible_when_denied = bool(item.get("visible_when_denied", False))
        if not authenticated and (req_all or req_any):
            return (False, visible_when_denied)
        if req_all and not req_all.issubset(user_perms):
            return (False, visible_when_denied)
        if req_any and not (req_any & user_perms):
            return (False, visible_when_denied)
        return (True, False)

    out = {"l1": [], "l2": {}, "l3": {}}
    for it in nav.get("l1", []):
        ok, gray = allowed(it)
        if ok:
            out["l1"].append(it)
        elif gray:
            out["l1"].append({**it, "disabled": True})

    for parent, arr in (nav.get("l2") or {}).items():
        kept = []
        for it in arr or []:
            ok, gray = allowed(it)
            kept.append(it if ok else ({**it, "disabled": True} if gray else None))
        kept = [x for x in kept if x]
        if kept:
            out["l2"][parent] = kept

    for parent, arr in (nav.get("l3") or {}).items():
        kept = []
        for it in arr or []:
            ok, gray = allowed(it)
            kept.append(it if ok else ({**it, "disabled": True} if gray else None))
        kept = [x for x in kept if x]
        if kept:
            out["l3"][parent] = kept
    return out

@router.get("/api/v1/shell/nav")
def get_nav(request: Request, db: Session = Depends(get_db)):
    if not os.path.exists(NAV_CACHE):
        rebuild_nav_cache()
    with open(NAV_CACHE, "r", encoding="utf-8") as f:
        nav = json.load(f)

    sid = request.cookies.get("sid")
    authenticated = False
    perms = set()
    if sid:
        from app.deps import redis_client
        user_id = None
        if redis_client:
            user_id = redis_client.get(f"sid:{sid}")
        else:
            user_id = request.app.state.sessions.get(sid) if hasattr(request.app.state, "sessions") else None
        if user_id:
            authenticated = True
            perms = get_user_permissions(db, user_id)

    filtered = _filter_by_perms(nav, perms, authenticated)
    return JSONResponse(filtered)

@router.post("/api/v1/shell/nav/rebuild")
def rebuild_nav(user = Depends(require_authenticated)):
    nav = rebuild_nav_cache()
    return JSONResponse({"ok": True, "nav": nav})

@router.get("/api/v1/shell/profile")
def shell_profile(request: Request, db: Session = Depends(get_db)):
    sid = request.cookies.get("sid")
    authenticated = False
    name = "访客"
    avatar = ""
    if sid:
        from app.deps import redis_client
        user_id = None
        if redis_client:
            user_id = redis_client.get(f"sid:{sid}")
        else:
            user_id = request.app.state.sessions.get(sid) if hasattr(request.app.state, "sessions") else None
        if user_id:
            user = get_user_by_id(db, user_id)
            if user:
                authenticated = True
                name = user.full_name or user.username
    return JSONResponse({"authenticated": authenticated, "name": name, "avatar": avatar})
