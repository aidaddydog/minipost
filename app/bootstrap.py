# -*- coding: utf-8 -*-
from __future__ import annotations
import secrets
from sqlalchemy.orm import Session
from sqlalchemy import select
from app import settings
from app.deps import SessionLocal, pwd_ctx
from app.navbuilder import build_nav_cache

def import_models_for_module(module: str):
    if module == "core":
        from modules.core.backend.models import rbac as _  # noqa
    elif module == "auth":
        pass
    else:
        from modules.core.backend.models import rbac as _  # noqa

def init_admin_user(db: Session) -> str | None:
    from modules.core.backend.models.rbac import CoreUser, CoreRole, CoreUserRole, CorePerm, CoreRolePerm
    admin = db.execute(select(CoreUser).where(CoreUser.username==settings.ADMIN_USER)).scalar_one_or_none()
    new_pwd=None
    if not admin:
        pwd = settings.ADMIN_PASS.strip() or secrets.token_urlsafe(12)
        new_pwd = pwd
        admin = CoreUser(username=settings.ADMIN_USER, full_name="管理员", password_hash=pwd_ctx.hash(pwd), is_active=True)
        db.add(admin); db.flush()
    elif settings.ADMIN_PASS.strip():
        admin.password_hash = pwd_ctx.hash(settings.ADMIN_PASS.strip())
    role = db.execute(select(CoreRole).where(CoreRole.role_code=="admin")).scalar_one_or_none()
    if not role:
        role = CoreRole(role_code="admin", role_name="管理员"); db.add(role); db.flush()
    perm = db.execute(select(CorePerm).where(CorePerm.perm_key=="*")).scalar_one_or_none()
    if not perm:
        perm = CorePerm(perm_key="*", perm_name="ALL"); db.add(perm); db.flush()
    has_rel = db.execute(select(CoreUserRole).where(CoreUserRole.user_id==admin.id, CoreUserRole.role_id==role.id)).first()
    if not has_rel: db.execute(CoreUserRole.__table__.insert().values(user_id=admin.id, role_id=role.id))
    has_rp = db.execute(select(CoreRolePerm).where(CoreRolePerm.role_id==role.id, CoreRolePerm.perm_id==perm.id)).first()
    if not has_rp: db.execute(CoreRolePerm.__table__.insert().values(role_id=role.id, perm_id=perm.id))
    return new_pwd

def rebuild_nav(): build_nav_cache()

def main():
    import argparse
    p=argparse.ArgumentParser(); sub=p.add_subparsers(dest="cmd")
    sub.add_parser("rebuild-nav"); sub.add_parser("init-admin")
    a=p.parse_args()
    if a.cmd=="rebuild-nav":
        rebuild_nav(); print("导航缓存已重建")
    elif a.cmd=="init-admin":
        db=SessionLocal()
        try:
            pwd=init_admin_user(db); db.commit()
            if pwd: print(f"已创建管理员 {settings.ADMIN_USER} ，临时密码：{pwd}")
            else: print("管理员已存在或已更新密码")
        finally:
            db.close()
    else:
        p.print_help()

if __name__ == "__main__": main()
