"""init rbac tables (safe bootstrap)

Revision ID: 0001_init_rbac
Revises: 
Create Date: 2025-09-26 00:00:00

"""

from __future__ import annotations
import os
from typing import Optional

from alembic import op  # type: ignore
import sqlalchemy as sa  # type: ignore
from alembic import context

# revision identifiers, used by Alembic.
revision: str = "0001_init_rbac"
down_revision: Optional[str] = None
branch_labels = None
depends_on = None


def _compose_sqlalchemy_url() -> str:
    cfg = context.config
    url = (cfg.get_main_option("sqlalchemy.url") or "").strip()
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


def _try_create_all_from_metadata() -> bool:
    """If the project's SQLAlchemy Base is discoverable, create all tables.

    Returns True if tables were created (or already existed).
    """
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
            md = getattr(base, "metadata", None) if base is not None else None
            if md is not None:
                url = _compose_sqlalchemy_url()
                eng = sa.create_engine(url)
                md.create_all(bind=eng)
                return True
        except Exception:
            continue
    return False


def upgrade() -> None:
    # Prefer creating tables from project's metadata (idempotent).
    if _try_create_all_from_metadata():
        return

    # Fallback: create minimal RBAC tables (PostgreSQL) if metadata not found.
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS rbac_users (
            id BIGSERIAL PRIMARY KEY,
            username VARCHAR(64) UNIQUE NOT NULL,
            email VARCHAR(255),
            password_hash TEXT NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS rbac_roles (
            id BIGSERIAL PRIMARY KEY,
            name VARCHAR(64) UNIQUE NOT NULL,
            description TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS rbac_permissions (
            id BIGSERIAL PRIMARY KEY,
            code VARCHAR(128) UNIQUE NOT NULL,
            description TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS rbac_user_roles (
            user_id BIGINT NOT NULL REFERENCES rbac_users(id) ON DELETE CASCADE,
            role_id BIGINT NOT NULL REFERENCES rbac_roles(id) ON DELETE CASCADE,
            PRIMARY KEY (user_id, role_id)
        );
        CREATE TABLE IF NOT EXISTS rbac_role_permissions (
            role_id BIGINT NOT NULL REFERENCES rbac_roles(id) ON DELETE CASCADE,
            permission_id BIGINT NOT NULL REFERENCES rbac_permissions(id) ON DELETE CASCADE,
            PRIMARY KEY (role_id, permission_id)
        );
        """
    )


def downgrade() -> None:
    # Only drop fallback tables. If metadata created them, respect Alembic history.
    op.execute(
        """
        DROP TABLE IF EXISTS rbac_role_permissions;
        DROP TABLE IF EXISTS rbac_user_roles;
        DROP TABLE IF EXISTS rbac_permissions;
        DROP TABLE IF EXISTS rbac_roles;
        DROP TABLE IF EXISTS rbac_users;
        """
    )
