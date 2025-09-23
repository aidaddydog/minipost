"""placeholder: switch_rule_task_audit (chain fix)

Revision ID: 20250923_0002_switch_rule_task_audit
Revises: None
Create Date: 2025-09-23 00:00:00
"""
from alembic import op
import sqlalchemy as sa

# 注意：这是占位迁移，仅用于修复 0003 的 down_revision 依赖
revision = "20250923_0002_switch_rule_task_audit"
down_revision = None         # 如你有更早一版，请将其改为实际上一版的 revision id
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 占位：不做任何 schema 变更
    pass

def downgrade() -> None:
    pass
