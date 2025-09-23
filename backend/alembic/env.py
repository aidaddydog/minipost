from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
from app.common.models_base import Base as ModelBase
from app.core.config import settings

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = ModelBase.metadata

def run_migrations_offline():
    url = settings.database_url.replace("+asyncpg", "+psycopg2")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    connectable = engine_from_config(
        {"sqlalchemy.url": settings.database_url.replace("+asyncpg", "+psycopg2")},
        prefix="sqlalchemy.",
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
