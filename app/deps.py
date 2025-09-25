# -*- coding: utf-8 -*-
from __future__ import annotations
from typing import Generator, Optional
from fastapi import Depends, Request, HTTPException, status
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from passlib.context import CryptContext
from app import settings
import jinja2, pathlib

# DB
engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try: yield db
    finally: db.close()

# Jinja 模板（聚合多目录）
TEMPLATE_DIRS=[
    str(pathlib.Path(__file__).parent.parent / "modules/auth/frontend/templates"),
    str(pathlib.Path(__file__).parent.parent / "modules/nav-shell/frontend/templates"),
]
_env = jinja2.Environment(loader=jinja2.FileSystemLoader(TEMPLATE_DIRS), autoescape=True)
class Renderer:
    def render(self, name: str, ctx: dict): return _env.get_template(name).render(**ctx)
def get_template_renderer(): return Renderer()

# Auth helpers
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
COOKIE_NAME="minipost_sid"; COOKIE_MAX_AGE=60*60*8

from itsdangerous import TimestampSigner, BadSignature, SignatureExpired
def _signer(): return TimestampSigner(settings.SESSION_SECRET)

from modules.core.backend.models.rbac import CoreUser

def get_current_user_optional(request: Request, db: Session = Depends(get_db)) -> Optional[CoreUser]:
    sid = request.cookies.get(COOKIE_NAME)
    if not sid: return None
    try:
        raw = _signer().unsign(sid, max_age=COOKIE_MAX_AGE).decode()
        user_id = int(raw.split(":")[0]) if ":" in raw else int(raw)
        return db.get(CoreUser, user_id)
    except (BadSignature, SignatureExpired):
        return None

def require_perms(*, all_: list[str] | None = None, any_: list[str] | None = None):
    def _dep(user: CoreUser | None = Depends(get_current_user_optional), db: Session = Depends(get_db)):
        if not user: raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未登录")
        from modules.core.backend.services.rbac_service import get_user_permissions
        perms = get_user_permissions(db, user.id)
        if all_ and not all(p in perms or "*" in perms for p in all_): raise HTTPException(status_code=403, detail="权限不足")
        if any_ and not any(p in perms or "*" in perms for p in any_): raise HTTPException(status_code=403, detail="权限不足")
        return user
    return _dep
