
# -*- coding: utf-8 -*-
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session
from sqlalchemy.pool import StaticPool
from contextlib import contextmanager
import os

from .config import get_settings

settings = get_settings()

# SQLite: check_same_thread=False for FastAPI multi-threads
engine = create_engine(
    settings.SQLALCHEMY_URL,
    connect_args={"check_same_thread": False} if settings.SQLALCHEMY_URL.startswith("sqlite") else {},
    poolclass=StaticPool if settings.SQLALCHEMY_URL.startswith("sqlite") else None,
)

SessionLocal = scoped_session(sessionmaker(autocommit=False, autoflush=False, bind=engine))

@contextmanager
def session_scope():
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except:
        db.rollback()
        raise
    finally:
        db.close()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
