import uuid
import datetime as dt
from sqlalchemy import Column, String, DateTime, Boolean, Table, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, Mapped, mapped_column
from app.db import Base

def gen_uuid():
    return uuid.uuid4()

user_roles = Table(
    "user_roles",
    Base.metadata,
    mapped_column("user_id", UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True),
    mapped_column("role_id", UUID(as_uuid=True), ForeignKey("roles.id"), primary_key=True),
)

class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(128), default="")
    email: Mapped[str] = mapped_column(String(128), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=False), default=dt.datetime.utcnow)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=False), default=dt.datetime.utcnow, onupdate=dt.datetime.utcnow)

    roles = relationship("Role", secondary=user_roles, back_populates="users")

class Role(Base):
    __tablename__ = "roles"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    role_code: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    role_name: Mapped[str] = mapped_column(String(128), nullable=False)
    permission_keys: Mapped[str] = mapped_column(String(2000), default="")  # 逗号分隔

    users = relationship("User", secondary=user_roles, back_populates="roles")
