# -*- coding: utf-8 -*-
from sqlalchemy import Column, String, Boolean, Table, ForeignKey, Integer
from sqlalchemy.orm import relationship, Mapped, mapped_column
from app.db import Base

user_role = Table(
    "core_user_role", Base.metadata,
    Column("user_id", ForeignKey("core_user.id"), primary_key=True),
    Column("role_id", ForeignKey("core_role.id"), primary_key=True),
)

role_perm = Table(
    "core_role_perm", Base.metadata,
    Column("role_id", ForeignKey("core_role.id"), primary_key=True),
    Column("perm_key", String(100), primary_key=True),
)

class User(Base):
    __tablename__ = "core_user"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(100), default="")
    email: Mapped[str] = mapped_column(String(200), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    password_hash: Mapped[str] = mapped_column(String(200), default="")
    roles = relationship("Role", secondary=user_role, back_populates="users")

class Role(Base):
    __tablename__ = "core_role"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    role_code: Mapped[str] = mapped_column(String(50), unique=True)
    role_name: Mapped[str] = mapped_column(String(100))
    users = relationship("User", secondary=user_role, back_populates="roles")
