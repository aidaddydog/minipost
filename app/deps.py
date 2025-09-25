from __future__ import annotations
from typing import Generator, Optional, Set
from fastapi import Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
import time, secrets, hashlib
from app.db import SessionLocal
from app.settings import get_settings
from modules.core.backend.models.rbac import CoreUser  # type: ignore

settings = get_settings()

# ----- DB session -----
def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ----- Session Store (memory, optional redis) -----
class BaseSessionStore:
    def get(self, sid: str) -> Optional[str]: ...
    def set(self, sid: str, user_id: str, ttl_seconds: int) -> None: ...
    def delete(self, sid: str) -> None: ...

class MemorySessionStore(BaseSessionStore):
    def __init__(self):
        self._store: dict[str, tuple[str, float]] = {}

    def get(self, sid: str) -> Optional[str]:
        item = self._store.get(sid)
        if not item:
            return None
        uid, exp = item
        if exp < time.time():
            self._store.pop(sid, None)
            return None
        return uid

    def set(self, sid: str, user_id: str, ttl_seconds: int) -> None:
        self._store[sid] = (user_id, time.time() + ttl_seconds)

    def delete(self, sid: str) -> None:
        self._store.pop(sid, None)

_session_store: BaseSessionStore | None = None

def get_session_store() -> BaseSessionStore:
    global _session_store
    if _session_store is not None:
        return _session_store
    if settings.REDIS_URL:
        try:
            import redis  # type: ignore
            r = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
            class RedisSessionStore(BaseSessionStore):
                def get(self, sid: str) -> Optional[str]:
                    return r.get(f"sid:{sid}")
                def set(self, sid: str, user_id: str, ttl_seconds: int) -> None:
                    r.setex(f"sid:{sid}", ttl_seconds, user_id)
                def delete(self, sid: str) -> None:
                    r.delete(f"sid:{sid}")
            _session_store = RedisSessionStore()
            return _session_store
        except Exception:
            pass
    _session_store = MemorySessionStore()
    return _session_store

# ----- Auth helpers -----
COOKIE_NAME = "sid"
COOKIE_TTL_SECONDS = 7 * 24 * 3600

def create_sid() -> str:
    return secrets.token_urlsafe(32)

async def get_current_user(request: Request, db: Session = Depends(get_db)) -> Optional[CoreUser]:
    sid = request.cookies.get(COOKIE_NAME)
    if not sid:
        return None
    store = get_session_store()
    uid = store.get(sid)
    if not uid:
        return None
    user = db.get(CoreUser, uid)
    return user
