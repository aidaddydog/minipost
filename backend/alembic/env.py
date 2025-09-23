# -*- coding: utf-8 -*-
import os
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

# 读取 alembic.ini
config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 运行迁移不需要导入模型，避免导入期访问数据库
target_metadata = None

def get_sqlalchemy_url() -> str:
    url = os.getenv("DATABASE_URL", "").strip()
    if not url:
        # 兼容：如有人写在 alembic.ini，也允许
        url = (config.get_main_option("sqlalchemy.url") or "").strip()
    # 迁移用同步驱动：把 +asyncpg 替换成 +psycopg2
    return url.replace("+asyncpg", "+psycopg2")

def run_migrations_offline():
    url = get_sqlalchemy_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        compare_type=True,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    url = get_sqlalchemy_url()
    connectable = engine_from_config(
        {"sqlalchemy.url": url},
        prefix="",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
