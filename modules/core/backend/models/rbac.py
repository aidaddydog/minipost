# -*- coding: utf-8 -*-
"""RBAC 基础表模型（极简版）。"""
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db import Base

def now():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True, comment="用户名（唯一）")
    full_name: Mapped[str] = mapped_column(String(80), default="", comment="姓名")
    hashed_password: Mapped[str] = mapped_column(String(200), comment="哈希密码")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)

    roles = relationship("UserRole", back_populates="user", cascade="all, delete-orphan")

class Role(Base):
    __tablename__ = "roles"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    role_code: Mapped[str] = mapped_column(String(50), unique=True, index=True, comment="角色编码")
    role_name: Mapped[str] = mapped_column(String(80), comment="角色名称")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

    users = relationship("UserRole", back_populates="role", cascade="all, delete-orphan")
    perms = relationship("RolePermission", back_populates="role", cascade="all, delete-orphan")

class UserRole(Base):
    __tablename__ = "user_roles"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id", ondelete="CASCADE"))

    user = relationship("User", back_populates="roles")
    role = relationship("Role", back_populates="users")

    __table_args__ = (UniqueConstraint("user_id", "role_id", name="uq_user_role"),)

class RolePermission(Base):
    __tablename__ = "role_permissions"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id", ondelete="CASCADE"))
    permission_key: Mapped[str] = mapped_column(String(100), index=True, comment="权限键")

    role = relationship("Role", back_populates="perms")
    __table_args__ = (UniqueConstraint("role_id", "permission_key", name="uq_role_perm"),)
