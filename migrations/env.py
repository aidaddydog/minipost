from __future__ import annotations
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
import os, pathlib, importlib.util, glob

BASE_DIR = pathlib.Path(__file__).resolve().parent.parent

# this is the Alembic Config object, which provides access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Add SQLAlchemy URL dynamically from env
from app.settings import get_settings
settings = get_settings()
if settings.SQLALCHEMY_DATABASE_URI:
    config.set_main_option("sqlalchemy.url", settings.SQLALCHEMY_DATABASE_URI)

# Import models (only core here; modules will register via dynamic loader)
from app.db import Base  # metadata container
from modules.core.backend.models import rbac as _rbac  # ensure models imported

target_metadata = Base.metadata

def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_schemas=False,
    )
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_schemas=False,
        )
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
