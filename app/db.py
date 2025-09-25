# -*- coding: utf-8 -*-
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy import create_engine
from app import settings
engine = create_engine(settings.DATABASE_URL, future=True, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
Base = declarative_base()
