"""init core

Revision ID: 0001_init_core
Revises:
Create Date: 2025-09-25 00:00:00
"""
from alembic import op
import sqlalchemy as sa
revision = '0001_init_core'
down_revision = None
branch_labels = None
depends_on = None
def upgrade():
    op.create_table('core_user',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('username', sa.String(50), nullable=False, unique=True),
        sa.Column('full_name', sa.String(100), nullable=False, server_default=''),
        sa.Column('email', sa.String(200), nullable=False, server_default=''),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.sql.expression.true()),
        sa.Column('password_hash', sa.String(200), nullable=False, server_default='')
    )
    op.create_table('core_role',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('role_code', sa.String(50), nullable=False, unique=True),
        sa.Column('role_name', sa.String(100), nullable=False),
    )
    op.create_table('core_user_role',
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('core_user.id'), primary_key=True),
        sa.Column('role_id', sa.Integer(), sa.ForeignKey('core_role.id'), primary_key=True),
    )
    op.create_table('core_role_perm',
        sa.Column('role_id', sa.Integer(), sa.ForeignKey('core_role.id'), primary_key=True),
        sa.Column('perm_key', sa.String(100), primary_key=True),
    )
def downgrade():
    op.drop_table('core_role_perm')
    op.drop_table('core_user_role')
    op.drop_table('core_role')
    op.drop_table('core_user')
