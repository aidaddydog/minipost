from __future__ import annotations

import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool, create_engine

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)


def _compose_sqlalchemy_url() -> str:
    url = (config.get_main_option("sqlalchemy.url") or "").strip()
    if url:
        return url
    env_url = (os.getenv("DATABASE_URL") or "").strip()
    if env_url:
        return env_url
    host = os.getenv("PG_HOST", "postgres")
    port = os.getenv("PG_PORT", "5432")
    db = os.getenv("PG_DB", "minipost")
    user = os.getenv("PG_USER", "minipost")
    password = os.getenv("PG_PASSWORD", "minipost")
    return f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{db}"


def _import_target_metadata():
    # Try common locations used by typical FastAPI projects
    candidates = [
        ("app.db.base", "Base"),
        ("app.database.base", "Base"),
        ("app.database.base_class", "Base"),
        ("app.db", "Base"),
        ("app.models", "Base"),
        ("app.models.base", "Base"),
        ("app.core.database", "Base"),
        ("app.core.db", "Base"),
        ("app", "Base"),
    ]
    for mod, attr in candidates:
        try:
            m = __import__(mod, fromlist=[attr])
            base = getattr(m, attr, None)
            if base is not None:
                md = getattr(base, "metadata", None)
                if md is not None:
                    return md
        except Exception:
            continue
    return None


# target_metadata is used for 'autogenerate' support.
target_metadata = _import_target_metadata()


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = _compose_sqlalchemy_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
        render_as_batch=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    url = _compose_sqlalchemy_url()
    connectable = create_engine(url, poolclass=pool.NullPool)

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            render_as_batch=True,
        )

        with context.begin_transaction():
            context.run_migrations()

        # As a safety net on fresh DBs: if there are no migration scripts
        # that create tables, ensure metadata tables exist (idempotent).
        try:
            if target_metadata is not None:
                target_metadata.create_all(bind=connection)
        except Exception:
            # Don't fail migrations if metadata import is not configured
            pass


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
