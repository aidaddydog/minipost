from logging.config import fileConfig
import sys  # 确保 alembic.ini handlers 的 sys.stderr 可用
from sqlalchemy import engine_from_config, pool
from alembic import context

# 统一走应用侧 DSN（强制 PostgreSQL，避免在 ini 里写死连接串）
from app.db import _dsn
from modules.core.backend.models import rbac as rbac_models

config = context.config
if config.config_file_name:
    fileConfig(config.config_file_name)

target_metadata = rbac_models.Base.metadata

def run_migrations_offline():
    url = _dsn()
    context.configure(
        url=url, target_metadata=target_metadata, literal_binds=True,
        dialect_opts={"paramstyle": "named"}
    )
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    connectable = engine_from_config(
        {"sqlalchemy.url": _dsn()}, prefix="sqlalchemy.", poolclass=pool.NullPool
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
