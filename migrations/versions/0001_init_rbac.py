"""init rbac tables
Revision ID: 0001_init_rbac
Revises: 
Create Date: 2025-09-26
"""
from alembic import op
import sqlalchemy as sa

revision = '0001_init_rbac'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('user',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('username', sa.String(length=64), nullable=False, unique=True),
        sa.Column('full_name', sa.String(length=128), nullable=False, server_default=''),
        sa.Column('email', sa.String(length=128), nullable=False, server_default=''),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
    )
    op.create_index('ix_username', 'user', ['username'])

    op.create_table('role',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('code', sa.String(length=64), nullable=False, unique=True),
        sa.Column('name', sa.String(length=128), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
    )
    op.create_index('ix_role_code', 'role', ['code'])

    op.create_table('permission',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('key', sa.String(length=128), nullable=False, unique=True),
        sa.Column('name', sa.String(length=128), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
    )
    op.create_index('ix_permission_key', 'permission', ['key'])

    op.create_table('user_role',
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('user.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('role_id', sa.Integer(), sa.ForeignKey('role.id', ondelete='CASCADE'), primary_key=True),
    )

    op.create_table('role_permission',
        sa.Column('role_id', sa.Integer(), sa.ForeignKey('role.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('permission_id', sa.Integer(), sa.ForeignKey('permission.id', ondelete='CASCADE'), primary_key=True),
    )
    op.create_unique_constraint('uq_role_perm', 'role_permission', ['role_id','permission_id'])

def downgrade():
    op.drop_table('role_permission')
    op.drop_table('user_role')
    op.drop_table('permission')
    op.drop_table('role')
    op.drop_table('user')
