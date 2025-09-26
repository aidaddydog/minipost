# -*- coding: utf-8 -*-
from fastapi import Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import Optional, List
from app.db import get_db
from app.security import decode_access_token
from modules.core.backend.models.rbac import User, Role, Permission, UserRole, RolePermission

def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get("access_token") or request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未登录")
    sub = decode_access_token(token)
    user = db.query(User).filter(User.username == sub, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户不可用")
    return user

def require_permissions(perms: List[str]):
    def _inner(user: User = Depends(current_user), db: Session = Depends(get_db)) -> User:
        # 汇总用户所有权限
        q = db.query(Permission.key).join(RolePermission, RolePermission.permission_id == Permission.id) \             .join(UserRole, UserRole.role_id == RolePermission.role_id) \             .filter(UserRole.user_id == user.id)
        user_perm_keys = set([r[0] for r in q.all()])
        missing = [p for p in perms if p not in user_perm_keys]
        if missing:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"缺少权限: {missing}")
        return user
    return _inner
