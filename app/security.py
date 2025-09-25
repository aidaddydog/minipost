# -*- coding: utf-8 -*-
"""
安全与鉴权：密码哈希、JWT、权限校验。
"""
import datetime as dt
from typing import Optional, List, Set
from jose import jwt
from passlib.hash import bcrypt
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.settings import settings
from app.db import get_db
from modules.core.backend.models.rbac import User, Role, Permission, UserRole, RolePermission

ALGO = "HS256"
bearer = HTTPBearer(auto_error=False)

def hash_password(raw: str) -> str:
    return bcrypt.hash(raw)

def verify_password(raw: str, hashed: str) -> bool:
    try:
        return bcrypt.verify(raw, hashed)
    except Exception:
        return False

def create_jwt(user_id: str, username: str) -> str:
    now = dt.datetime.utcnow()
    payload = {
        "sub": str(user_id),
        "username": username,
        "iat": int(now.timestamp()),
        "exp": int((now + dt.timedelta(minutes=settings.JWT_EXPIRE_MINUTES)).timestamp())
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGO)

def decode_jwt(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGO])
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"code":"E-401","msg":"登录已过期或无效。"})

def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    # 优先从 Cookie，回退到 Authorization Bearer
    token = request.cookies.get("MINIPOST_TOKEN")
    if not token:
        cred: Optional[HTTPAuthorizationCredentials] = bearer(request) if bearer else None
        token = cred.credentials if cred and cred.scheme.lower() == "bearer" else None
    if not token:
        raise HTTPException(status_code=401, detail={"code":"E-401","msg":"请先登录。"})
    payload = decode_jwt(token)
    uid = payload.get("sub")
    u = db.get(User, uid)
    if not u or not u.is_active:
        raise HTTPException(status_code=401, detail={"code":"E-401","msg":"用户不存在或已停用。"})
    return u

def require_permissions(perms: List[str] | Set[str]):
    perms = set(perms)
    def _dep(user: User = Depends(current_user), db: Session = Depends(get_db)):
        # 聚合用户权限
        q = db.query(Permission.permission_key).join(RolePermission, RolePermission.permission_id==Permission.id)\
            .join(Role, Role.id==RolePermission.role_id)\
            .join(UserRole, UserRole.role_id==Role.id)\
            .filter(UserRole.user_id==user.id).distinct()
        user_perms = set(x[0] for x in q.all())
        if not perms.issubset(user_perms):
            raise HTTPException(status_code=403, detail={"code":"E-403","msg":"权限不足。"})
        return True
    return _dep
