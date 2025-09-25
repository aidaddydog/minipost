from pathlib import Path
from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import select
from modules.core.backend.models.rbac import User, Role
from app.security import hash_password

def ensure_admin_user(db: Session, username: str, password: str):
    user = db.execute(select(User).where(User.username == username)).scalar_one_or_none()
    if not user:
        user = User(username=username, full_name="超级管理员", email="", hashed_password=hash_password(password))
        db.add(user)
        db.commit()

def seed_roles_from_yaml(db: Session, yaml_path: Path):
    try:
        import yaml
    except Exception:
        yaml = None
    if not yaml or not yaml_path.exists():
        return
    data = yaml.safe_load(yaml_path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        return
    # data: [{role_code, role_name, permission_keys: [k1,k2,...]}]
    for r in data:
        code = r.get("role_code")
        if not code:
            continue
        role = db.execute(select(Role).where(Role.role_code == code)).scalar_one_or_none()
        if not role:
            role = Role(role_code=code, role_name=r.get("role_name") or code, permission_keys=",".join(r.get("permission_keys") or []))
            db.add(role)
    db.commit()
