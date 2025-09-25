from __future__ import annotations
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.deps import get_db, require_authenticated
from modules.core.backend.services.rbac_service import get_user_permissions

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

@router.get("/me")
def me(user = Depends(require_authenticated)):
    return {"id": user.id, "username": user.username, "full_name": user.full_name, "email": user.email}

@router.get("/permissions")
def my_permissions(user = Depends(require_authenticated), db: Session = Depends(get_db)):
    perms = get_user_permissions(db, user.id)
    return {"permissions": sorted(perms)}
