# 预留：登录审计表示例（最小系统不强依赖）
from __future__ import annotations
from alembic import op
import sqlalchemy as sa

revision = '0001_init_auth'
down_revision = None
branch_labels = ('auth',)
depends_on = None

def upgrade() -> None:
    op.create_table(
        'auth_login_audit',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('username', sa.String(length=128), nullable=False),
        sa.Column('result', sa.String(length=32), nullable=False),
        sa.Column('client_ip', sa.String(length=64), nullable=False, server_default=''),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.text('CURRENT_TIMESTAMP'))
    )

def downgrade() -> None:
    op.drop_table('auth_login_audit')
