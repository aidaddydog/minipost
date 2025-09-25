# -*- coding: utf-8 -*-
from __future__ import annotations
from alembic import op
import sqlalchemy as sa
revision='20250924_auth_init'
down_revision=None
branch_labels=('versions-auth',)
depends_on=None
def upgrade():
    op.create_table('auth_login_audit',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('username', sa.String(50), nullable=False),
        sa.Column('ok', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('client_ip', sa.String(64)),
        sa.Column('ua', sa.Text()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'))
    )
def downgrade(): op.drop_table('auth_login_audit')
