# 初始 RBAC 表结构
from __future__ import annotations
from alembic import op
import sqlalchemy as sa

revision = '0001_init_core'
down_revision = None
branch_labels = ('core',)
depends_on = None

def upgrade() -> None:
    op.create_table(
        'core_user',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('username', sa.String(length=64), nullable=False, unique=True, index=True),
        sa.Column('password_hash', sa.String(length=128), nullable=False),
        sa.Column('full_name', sa.String(length=128), nullable=False, server_default=''),
        sa.Column('email', sa.String(length=128), nullable=False, server_default=''),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )
    op.create_table(
        'core_role',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('role_code', sa.String(length=64), nullable=False, unique=True, index=True),
        sa.Column('role_name', sa.String(length=128), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )
    op.create_table(
        'core_perm',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('perm_key', sa.String(length=128), nullable=False, unique=True, index=True),
        sa.Column('description', sa.String(length=256), nullable=False, server_default=''),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_table(
        'core_user_role',
        sa.Column('user_id', sa.String(length=36), sa.ForeignKey('core_user.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('role_id', sa.String(length=36), sa.ForeignKey('core_role.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_table(
        'core_role_perm',
        sa.Column('role_id', sa.String(length=36), sa.ForeignKey('core_role.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('perm_id', sa.String(length=36), sa.ForeignKey('core_perm.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )

def downgrade() -> None:
    op.drop_table('core_role_perm')
    op.drop_table('core_user_role')
    op.drop_table('core_perm')
    op.drop_table('core_role')
    op.drop_table('core_user')
