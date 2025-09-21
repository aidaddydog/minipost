from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from .config import get_settings

_settings = get_settings()
_engine = create_engine(_settings.DB_URL, connect_args={"check_same_thread": False} if _settings.DB_URL.startswith("sqlite") else {})
SessionLocal = sessionmaker(bind=_engine, autocommit=False, autoflush=False)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_engine():
    return _engine
