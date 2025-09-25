from __future__ import annotations
import uuid, datetime as dt
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, Boolean, DateTime, ForeignKey

def now_utc():
    return dt.datetime.utcnow()

class Base(DeclarativeBase):
    pass

class CoreUser(Base):
    __tablename__ = "core_user"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(128))
    full_name: Mapped[str] = mapped_column(String(128), default="")
    email: Mapped[str] = mapped_column(String(128), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=now_utc)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime, default=now_utc, onupdate=now_utc)

class CoreRole(Base):
    __tablename__ = "core_role"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    role_code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    role_name: Mapped[str] = mapped_column(String(128))
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=now_utc)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime, default=now_utc, onupdate=now_utc)

class CorePerm(Base):
    __tablename__ = "core_perm"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    perm_key: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    description: Mapped[str] = mapped_column(String(256), default="")
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=now_utc)

class CoreUserRole(Base):
    __tablename__ = "core_user_role"
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("core_user.id", ondelete="CASCADE"), primary_key=True)
    role_id: Mapped[str] = mapped_column(String(36), ForeignKey("core_role.id", ondelete="CASCADE"), primary_key=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=now_utc)

class CoreRolePerm(Base):
    __tablename__ = "core_role_perm"
    role_id: Mapped[str] = mapped_column(String(36), ForeignKey("core_role.id", ondelete="CASCADE"), primary_key=True)
    perm_id: Mapped[str] = mapped_column(String(36), ForeignKey("core_perm.id", ondelete="CASCADE"), primary_key=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=now_utc)
