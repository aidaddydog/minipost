# -*- coding: utf-8 -*-
"""
数据库初始化：SQLAlchemy 2.0 风格；提供 Session 依赖。
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.settings import settings

engine = create_engine(settings.SQLALCHEMY_DATABASE_URI, echo=settings.DB_ECHO, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
