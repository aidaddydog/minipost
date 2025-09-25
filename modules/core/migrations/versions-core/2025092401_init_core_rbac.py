# -*- coding: utf-8 -*-
from __future__ import annotations
from alembic import op
import sqlalchemy as sa
revision='20250924_core_init'
down_revision=None
branch_labels=('versions-core',)
depends_on=None
def upgrade():
    op.create_table('core_user',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('username', sa.String(50), nullable=False, unique=True),
        sa.Column('full_name', sa.String(100)),
        sa.Column('email', sa.String(100)),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('last_login_at', sa.DateTime(timezone=True)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_core_user_username','core_user',['username'])
    op.create_table('core_role',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('role_code', sa.String(50), nullable=False, unique=True),
        sa.Column('role_name', sa.String(100), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_core_role_role_code','core_role',['role_code'])
    op.create_table('core_perm',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('perm_key', sa.String(120), nullable=False, unique=True),
        sa.Column('perm_name', sa.String(200)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_core_perm_perm_key','core_perm',['perm_key'])
    op.create_table('core_user_role',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('core_user.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role_id', sa.Integer(), sa.ForeignKey('core_role.id', ondelete='CASCADE'), nullable=False),
        sa.UniqueConstraint('user_id','role_id', name='uq_user_role')
    )
    op.create_table('core_role_perm',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('role_id', sa.Integer(), sa.ForeignKey('core_role.id', ondelete='CASCADE'), nullable=False),
        sa.Column('perm_id', sa.Integer(), sa.ForeignKey('core_perm.id', ondelete='CASCADE'), nullable=False),
        sa.UniqueConstraint('role_id','perm_id', name='uq_role_perm')
    )
def downgrade():
    op.drop_table('core_role_perm')
    op.drop_table('core_user_role')
    op.drop_index('ix_core_perm_perm_key', table_name='core_perm')
    op.drop_table('core_perm')
    op.drop_index('ix_core_role_role_code', table_name='core_role')
    op.drop_table('core_role')
    op.drop_index('ix_core_user_username', table_name='core_user')
    op.drop_table('core_user')
