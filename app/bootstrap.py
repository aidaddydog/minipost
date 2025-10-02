# -*- coding: utf-8 -*-
"""引导脚本（容器内执行）
- 初始化管理员账号（由宿主机 bootstrap 脚本以环境变量传入）
用法：
  python -m app.bootstrap init-admin --username xxx --password yyy
"""
import argparse, sys
from sqlalchemy.orm import Session
from app.db import SessionLocal, engine
from modules.core.backend.models.rbac import Base as RBACBase, User, Role, Permission, UserRole, RolePermission
from app.security import hash_password
from app.common.utils import refresh_nav_cache

def init_admin(username: str, password: str):
    # 保证表存在（通常由 Alembic 迁移创建，这里兜底）
    RBACBase.metadata.create_all(bind=engine)

    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.username == username).first()
        if not user:
            user = User(username=username, full_name="Administrator", is_active=True, password_hash=hash_password(password))
            db.add(user)
            db.flush()
        # RBAC 基础：角色 + 权限
        p_manage = db.query(Permission).filter(Permission.key == "rbac:manage").first()
        if not p_manage:
            p_manage = Permission(key="rbac:manage", name="RBAC管理")
            db.add(p_manage)
            db.flush()

        p_view = db.query(Permission).filter(Permission.key == "nav:shell:view").first()
        if not p_view:
            p_view = Permission(key="nav:shell:view", name="查看壳层")
            db.add(p_view)
            db.flush()

        role_admin = db.query(Role).filter(Role.code == "admin").first()
        if not role_admin:
            role_admin = Role(code="admin", name="管理员")
            db.add(role_admin); db.flush()

        # 角色绑定权限
        for perm in (p_manage, p_view):
            exists = db.query(RolePermission).filter(RolePermission.role_id==role_admin.id, RolePermission.permission_id==perm.id).first()
            if not exists:
                db.add(RolePermission(role_id=role_admin.id, permission_id=perm.id))

        # 用户绑定角色
        ru = db.query(UserRole).filter(UserRole.user_id==user.id, UserRole.role_id==role_admin.id).first()
        if not ru:
            db.add(UserRole(user_id=user.id, role_id=role_admin.id))

        db.commit()
        return {"ok": True, "user": username}
    finally:
        db.close()

def refresh_nav():
    return refresh_nav_cache()

def main(argv=None):
    parser = argparse.ArgumentParser(description="minipost bootstrap tool")
    sub = parser.add_subparsers(dest="cmd")

    p1 = sub.add_parser("init-admin")
    p1.add_argument("--username", required=True)
    p1.add_argument("--password", required=True)

    p2 = sub.add_parser("refresh-nav")

    args = parser.parse_args(argv)
    if args.cmd == "init-admin":
        print(init_admin(args.username, args.password))
        return 0
    elif args.cmd == "refresh-nav":
        print(refresh_nav())
        return 0
    else:
        parser.print_help()
        return 1

if __name__ == "__main__":
    sys.exit(main())
