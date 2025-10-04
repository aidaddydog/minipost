# -*- coding: utf-8 -*-
"""数据库初始化（PostgreSQL）"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.settings import settings

# 仅支持 Postgres
def _dsn() -> str:
    return (
        f"postgresql+psycopg2://{settings.PG_USER}:{settings.PG_PASSWORD}"
        f"@{settings.PG_HOST}:{settings.PG_PORT}/{settings.PG_DB}"
    )

engine = create_engine(_dsn(), pool_pre_ping=True, pool_size=5, max_overflow=5, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)

def get_db():
    from sqlalchemy.exc import SQLAlchemyError
    db = SessionLocal()
    try:
        yield db
    except SQLAlchemyError:
        db.rollback()
        raise
    except Exception:
        # 其它异常也保证回滚，避免悬挂事务
        db.rollback()
        raise
    finally:
        db.close()
