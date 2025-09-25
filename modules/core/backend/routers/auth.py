# -*- coding: utf-8 -*-
from __future__ import annotations
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.deps import get_db, get_current_user_optional

router = APIRouter(prefix="/api/v1/auth", tags=["auth-core"])

@router.get("/me")
def me(user=Depends(get_current_user_optional)):
    if not user: return {"authenticated": False}
    return {"authenticated": True, "user": {"id": user.id, "username": user.username, "full_name": user.full_name}}

@router.get("/permissions")
def permissions(db: Session = Depends(get_db), user=Depends(get_current_user_optional)):
    if not user: return {"permissions": []}
    from modules.core.backend.services.rbac_service import get_user_permissions
    perms = sorted(list(get_user_permissions(db, user.id)))
    return {"permissions": perms}
