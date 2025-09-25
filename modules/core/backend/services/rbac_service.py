# -*- coding: utf-8 -*-
"""RBAC 服务：创建管理员 / 登录校验。"""
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.security import hash_password, verify_password
from ..models.rbac import User, Role, UserRole

def ensure_admin(db: Session, username: str, password: str) -> int:
    # 角色
    role = db.scalar(select(Role).where(Role.role_code == "admin"))
    if not role:
        role = Role(role_code="admin", role_name="管理员")
        db.add(role); db.flush()

    # 用户
    user = db.scalar(select(User).where(User.username == username))
    if not user:
        user = User(username=username, full_name=username, hashed_password=hash_password(password))
        db.add(user); db.flush()
        db.add(UserRole(user_id=user.id, role_id=role.id))
    else:
        # 如已存在，则更新密码为新密码（部署阶段更直观）
        user.hashed_password = hash_password(password)

    db.commit()
    return user.id

def authenticate(db: Session, username: str, password: str) -> User | None:
    user = db.scalar(select(User).where(User.username == username))
    if user and verify_password(password, user.hashed_password) and user.is_active:
        return user
    return None
