# -*- coding: utf-8 -*-
from __future__ import annotations
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, UniqueConstraint, func

class Base(DeclarativeBase): pass

class CoreUser(Base):
    __tablename__ = "core_user"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    full_name: Mapped[str | None] = mapped_column(String(100))
    email: Mapped[str | None] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255))
    last_login_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class CoreRole(Base):
    __tablename__ = "core_role"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    role_code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    role_name: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class CorePerm(Base):
    __tablename__ = "core_perm"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    perm_key: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    perm_name: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class CoreUserRole(Base):
    __tablename__ = "core_user_role"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("core_user.id", ondelete="CASCADE"), index=True)
    role_id: Mapped[int] = mapped_column(ForeignKey("core_role.id", ondelete="CASCADE"), index=True)
    __table_args__ = (UniqueConstraint("user_id", "role_id", name="uq_user_role"),)

class CoreRolePerm(Base):
    __tablename__ = "core_role_perm"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    role_id: Mapped[int] = mapped_column(ForeignKey("core_role.id", ondelete="CASCADE"), index=True)
    perm_id: Mapped[int] = mapped_column(ForeignKey("core_perm.id", ondelete="CASCADE"), index=True)
    __table_args__ = (UniqueConstraint("role_id", "perm_id", name="uq_role_perm"),)
