# minipost · 依赖与全局资源（DB 会话/Redis/当前用户）
from __future__ import annotations
from typing import Generator, Optional
from fastapi import Depends, HTTPException, status, Request
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.settings import settings
import redis

engine = create_engine(settings.database_url, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)

redis_client: Optional[redis.Redis] = None
if settings.redis_url:
    try:
        redis_client = redis.from_url(settings.redis_url, decode_responses=True)
    except Exception:
        redis_client = None

def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

from modules.core.backend.services.rbac_service import get_user_by_id

async def get_current_user(request: Request, db: Session = Depends(get_db)):
    sid = request.cookies.get("sid")
    if not sid:
        return None
    user_id = None
    if redis_client:
        user_id = redis_client.get(f"sid:{sid}")
    else:
        user_id = request.app.state.sessions.get(sid) if hasattr(request.app.state, "sessions") else None
    if not user_id:
        return None
    user = get_user_by_id(db, user_id)
    return user

def require_authenticated(user = Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未登录")
    return user
