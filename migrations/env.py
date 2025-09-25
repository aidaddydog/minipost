# -*- coding: utf-8 -*-
import os, sys
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.bootstrap import import_models_for_module

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = None

def run_migrations_offline():
    url = os.environ.get("DATABASE_URL")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    section = config.get_section(config.config_ini_section)
    url = os.environ.get("DATABASE_URL")
    section["sqlalchemy.url"] = url
    connectable = engine_from_config(section, prefix="sqlalchemy.", poolclass=pool.NullPool)
    module = context.get_x_argument(as_dictionary=True).get("module")
    if module: import_models_for_module(module)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode(): run_migrations_offline()
else: run_migrations_online()
