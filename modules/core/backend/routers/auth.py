from __future__ import annotations
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.deps import get_db, get_current_user
from modules.core.backend.services.rbac_service import get_user_perms
from modules.core.backend.models.rbac import CoreUser

router = APIRouter(prefix="/auth", tags=["auth-core"])

@router.get("/me")
async def me(user: CoreUser | None = Depends(get_current_user)):
    if not user:
        return {"authenticated": False}
    return {"authenticated": True, "user": {"id": user.id, "username": user.username, "full_name": user.full_name}}

@router.get("/permissions")
async def permissions(db: Session = Depends(get_db), user: CoreUser | None = Depends(get_current_user)):
    if not user:
        return {"permissions": []}
    perms = sorted(list(get_user_perms(db, user.id)))
    return {"permissions": perms}
