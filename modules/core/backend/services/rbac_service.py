from __future__ import annotations
from typing import Set
from sqlalchemy.orm import Session
from sqlalchemy import select
from modules.core.backend.models.rbac import CoreUser, CoreRole, CorePerm, CoreUserRole, CoreRolePerm
from app.settings import settings
import bcrypt, yaml, os

def get_user_by_username(db: Session, username: str) -> CoreUser | None:
    return db.scalar(select(CoreUser).where(CoreUser.username == username))

def get_user_by_id(db: Session, user_id: str) -> CoreUser | None:
    return db.get(CoreUser, user_id)

def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except Exception:
        return False

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def get_user_permissions(db: Session, user_id: str) -> Set[str]:
    stmt = (
        select(CorePerm.perm_key)
        .join(CoreRolePerm, CoreRolePerm.perm_id == CorePerm.id)
        .join(CoreUserRole, CoreUserRole.role_id == CoreRolePerm.role_id)
        .where(CoreUserRole.user_id == user_id)
    )
    perms = {r[0] for r in db.execute(stmt).all()}
    if "superuser" in perms:
        all_perms = {x[0] for x in db.execute(select(CorePerm.perm_key)).all()}
        return set(all_perms) | {"superuser"}
    return perms

def ensure_seed_roles_and_admin(db: Session) -> None:
    seed_fp = "modules/core/config/roles.seed.yaml"
    if os.path.exists(seed_fp):
        with open(seed_fp, "r", encoding="utf-8") as f:
            seed = yaml.safe_load(f) or {}
    else:
        seed = {}

    roles = seed.get("roles", [])
    all_perm_keys: Set[str] = set()
    for r in roles:
        for k in (r.get("permission_keys") or []):
            all_perm_keys.add(k)
    for k in sorted(all_perm_keys):
        if not db.scalar(select(CorePerm).where(CorePerm.perm_key == k)):
            db.add(CorePerm(perm_key=k, description=""))
    db.commit()

    for r in roles:
        code = r["role_code"]
        role = db.scalar(select(CoreRole).where(CoreRole.role_code == code))
        if not role:
            role = CoreRole(role_code=code, role_name=r.get("role_name") or code)
            db.add(role); db.commit()
        perm_keys = set(r.get("permission_keys") or [])
        if perm_keys:
            perm_map = {x.perm_key: x for x in db.scalars(select(CorePerm)).all()}
            for k in perm_keys:
                p = perm_map.get(k)
                if not p: 
                    continue
                exist = db.scalar(
                    select(CoreRolePerm).where(CoreRolePerm.role_id==role.id, CoreRolePerm.perm_id==p.id)
                )
                if not exist:
                    db.add(CoreRolePerm(role_id=role.id, perm_id=p.id))
            db.commit()

    admin = db.scalar(select(CoreUser).where(CoreUser.username==settings.admin_username))
    if not admin:
        admin = CoreUser(
            username=settings.admin_username,
            password_hash=hash_password(settings.admin_password),
            full_name=settings.admin_full_name,
            email=settings.admin_email,
            is_active=True,
        )
        db.add(admin); db.commit()
    admin_role = db.scalar(select(CoreRole).where(CoreRole.role_code=="admin"))
    if admin_role:
        exist = db.scalar(select(CoreUserRole).where(CoreUserRole.user_id==admin.id, CoreUserRole.role_id==admin_role.id))
        if not exist:
            db.add(CoreUserRole(user_id=admin.id, role_id=admin_role.id)); db.commit()
