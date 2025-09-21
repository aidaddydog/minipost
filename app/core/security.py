from fastapi import Request, HTTPException, Depends
from sqlalchemy.orm import Session
from passlib.hash import bcrypt
from ..models.tables import AdminUser
from .deps import get_db

def require_admin(request: Request, db: Session = Depends(get_db)):
    if not request.session.get("admin_user"):
        raise HTTPException(status_code=401, detail="unauthorized")
    # 可进一步校验用户是否存在/有效
    return True

def verify_admin(username: str, password: str, db: Session) -> bool:
    u = db.query(AdminUser).filter(AdminUser.username==username, AdminUser.is_active==True).one_or_none()
    if not u: return False
    try:
        return bcrypt.verify(password, u.password_hash)
    except Exception:
        return False
