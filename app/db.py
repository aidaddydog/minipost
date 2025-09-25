# -*- coding: utf-8 -*-
"""数据库引擎与会话管理。
- 默认 PostgreSQL（Docker Compose 内网地址：postgres）
- 首次安装由 app.bootstrap:migrate() 自动建表（create_all）
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from .settings import settings

class Base(DeclarativeBase):
    pass

engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

def get_db():
    from sqlalchemy.orm import Session
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
