# -*- coding: utf-8 -*-
import os, sys, pathlib
from alembic import context
from sqlalchemy import engine_from_config, pool
ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path: sys.path.insert(0, str(ROOT))
from app.db import Base
from modules.core.backend.models import rbac  # noqa
target_metadata = Base.metadata
config = context.config

def run_offline():
    context.configure(url=os.getenv("DATABASE_URL"), target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction(): context.run_migrations()

def run_online():
    cfg = config.get_section(config.config_ini_section)
    url = os.getenv("DATABASE_URL")
    if url: cfg["sqlalchemy.url"] = url
    connectable = engine_from_config(cfg, prefix="sqlalchemy.", poolclass=pool.NullPool)
    with connectable.connect() as cn:
        context.configure(connection=cn, target_metadata=target_metadata)
        with context.begin_transaction(): context.run_migrations()

if context.is_offline_mode(): run_offline()
else: run_online()
