# -*- coding: utf-8 -*-
from sqlalchemy.orm import Session
from modules.core.backend.models.rbac import User, Role, Permission, UserRole, RolePermission

def ensure_role(db: Session, code: str, name: str) -> Role:
    r = db.query(Role).filter(Role.code == code).first()
    if r: return r
    r = Role(code=code, name=name)
    db.add(r); db.flush()
    return r

def ensure_permission(db: Session, key: str, name: str) -> Permission:
    p = db.query(Permission).filter(Permission.key == key).first()
    if p: return p
    p = Permission(key=key, name=name)
    db.add(p); db.flush()
    return p

def grant_permissions_to_role(db: Session, role: Role, perm_keys):
    perms = db.query(Permission).filter(Permission.key.in_(perm_keys)).all()
    existing = {(rp.role_id, rp.permission_id) for rp in db.query(RolePermission).filter(RolePermission.role_id == role.id).all()}
    for p in perms:
        if (role.id, p.id) not in existing:
            db.add(RolePermission(role_id=role.id, permission_id=p.id))

def bind_user_role(db: Session, user: User, role: Role):
    exists = db.query(UserRole).filter(UserRole.user_id == user.id, UserRole.role_id == role.id).first()
    if not exists:
        db.add(UserRole(user_id=user.id, role_id=role.id))
