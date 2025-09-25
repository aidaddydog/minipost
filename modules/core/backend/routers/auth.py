from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db import get_db
from app.security import decode_token
from fastapi import Header
from modules.core.backend.models.rbac import User, Role

router = APIRouter()

def current_user(db: Session = Depends(get_db), authorization: str = Header(default="")):
    token = ""
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="未认证")
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="令牌无效或过期")
    sub = payload.get("sub")
    u = db.execute(select(User).where(User.username == sub)).scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=401, detail="用户不存在")
    return u

@router.get("/me")
def me(u: User = Depends(current_user)):
    return {
        "username": u.username,
        "full_name": u.full_name,
        "email": u.email,
        "is_active": u.is_active,
        "roles": [r.role_code for r in u.roles],
    }

@router.get("/roles")
def roles(db: Session = Depends(get_db)):
    rows = db.execute(select(Role)).scalars().all()
    return [{"role_code": r.role_code, "role_name": r.role_name, "permission_keys": (r.permission_keys or "").split(",")} for r in rows]
