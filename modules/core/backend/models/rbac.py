from __future__ import annotations
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Table, Column, func, UniqueConstraint
import uuid
from app.db import Base

def gen_uuid() -> str:
    return str(uuid.uuid4())

class CoreUser(Base):
    __tablename__ = "core_user"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(128), default="")
    email: Mapped[str] = mapped_column(String(128), default="")
    hashed_password: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    roles = relationship("CoreRole", secondary="core_user_role", back_populates="users")

class CoreRole(Base):
    __tablename__ = "core_role"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    role_code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    role_name: Mapped[str] = mapped_column(String(128))
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    users = relationship("CoreUser", secondary="core_user_role", back_populates="roles")
    perms = relationship("CorePerm", secondary="core_role_perm", back_populates="roles")

class CorePerm(Base):
    __tablename__ = "core_perm"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    perm_key: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    perm_name: Mapped[str] = mapped_column(String(128), default="")
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    roles = relationship("CoreRole", secondary="core_role_perm", back_populates="perms")

# 关联表
class CoreUserRole(Base):
    __tablename__ = "core_user_role"
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("core_user.id", ondelete="CASCADE"), primary_key=True)
    role_id: Mapped[str] = mapped_column(String(36), ForeignKey("core_role.id", ondelete="CASCADE"), primary_key=True)

class CoreRolePerm(Base):
    __tablename__ = "core_role_perm"
    role_id: Mapped[str] = mapped_column(String(36), ForeignKey("core_role.id", ondelete="CASCADE"), primary_key=True)
    perm_id: Mapped[str] = mapped_column(String(36), ForeignKey("core_perm.id", ondelete="CASCADE"), primary_key=True)
