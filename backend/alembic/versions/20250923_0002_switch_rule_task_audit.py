"""placeholder: switch_rule_task_audit (chain fix)

Revision ID: 20250923_0002_switch_rule_task_audit
Revises: 20250923_0001
Create Date: 2025-09-23 00:00:00
"""
from alembic import op
import sqlalchemy as sa

revision = "20250923_0002_switch_rule_task_audit"
down_revision = "20250923_0001"
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 占位：不做任何 schema 变更
    pass

def downgrade() -> None:
    pass
