# 文件路径：migrations/env.py
# -*- coding: utf-8 -*-
"""
说明：
- 你的 alembic.ini 中 [handler_console] 使用了 sys.stderr，
  这里显式 import sys，避免在某些受限/打包环境下触发 NameError。
"""
import sys  # ← 新增：为 logging config 中的 sys.stderr 提供命名空间

from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

# 应用侧设置与模型（保持原有导入）
from app.settings import settings
from app.db import Base
from modules.core.backend.models import rbac  # noqa
from modules.label_upload.backend.models import upload_log  # noqa
from modules.logistics_channel.backend.models import carrier  # noqa

# Alembic 配置对象
config = context.config
# 从应用配置注入数据库 URL
config.set_main_option("sqlalchemy.url", settings.SQLALCHEMY_DATABASE_URI)

# 解释 logging 配置（与 alembic.ini 配合）
fileConfig(config.config_file_name)

# 目标元数据
target_metadata = Base.metadata

def run_migrations_offline():
    """离线模式：直接使用 URL 生成 SQL。"""
    context.configure(
        url=settings.SQLALCHEMY_DATABASE_URI,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    """在线模式：使用连接运行迁移。"""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
