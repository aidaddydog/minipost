# -*- coding: utf-8 -*-
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_permissions
from modules.core.backend.schemas.rbac import (
    RoleCreate,
    PermissionCreate,
    GrantRolePermissions,
    BindUserRole,
)
from modules.core.backend.models.rbac import User, Role, Permission
from modules.core.backend.services.rbac import (
    ensure_role,
    ensure_permission,
    grant_permissions_to_role,
    bind_user_role,
)

router = APIRouter(prefix="/api/rbac", tags=["rbac"])

@router.post("/roles", dependencies=[Depends(require_permissions(["rbac:manage"]))])
def create_role(payload: RoleCreate, db: Session = Depends(get_db)):
    r = ensure_role(db, payload.code, payload.name)
    db.commit()
    return {"ok": True, "role": {"code": r.code, "name": r.name}}

@router.post("/perms", dependencies=[Depends(require_permissions(["rbac:manage"]))])
def create_perm(payload: PermissionCreate, db: Session = Depends(get_db)):
    p = ensure_permission(db, payload.key, payload.name)
    db.commit()
    return {"ok": True, "permission": {"key": p.key, "name": p.name}}

@router.post("/grant", dependencies=[Depends(require_permissions(["rbac:manage"]))])
def grant(payload: GrantRolePermissions, db: Session = Depends(get_db)):
    role = db.query(Role).filter(Role.code == payload.role_code).first()
    if not role:
        raise HTTPException(status_code=404, detail="角色不存在")
    grant_permissions_to_role(db, role, payload.permission_keys)
    db.commit()
    return {"ok": True}

@router.post("/bind", dependencies=[Depends(require_permissions(["rbac:manage"]))])
def bind(payload: BindUserRole, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == payload.username).first()
    role = db.query(Role).filter(Role.code == payload.role_code).first()
    if not user or not role:
        raise HTTPException(status_code=404, detail="用户或角色不存在")
    bind_user_role(db, user, role)
    db.commit()
    return {"ok": True}
