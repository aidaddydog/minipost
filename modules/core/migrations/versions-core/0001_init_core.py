from __future__ import annotations
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0001_init_core'
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table('core_user',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('username', sa.String(length=64), nullable=False, unique=True),
        sa.Column('full_name', sa.String(length=128), nullable=False, server_default=''),
        sa.Column('email', sa.String(length=128), nullable=False, server_default=''),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'))
    )
    op.create_index('ix_core_user_username', 'core_user', ['username'])

    op.create_table('core_role',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('role_code', sa.String(length=64), nullable=False, unique=True),
        sa.Column('role_name', sa.String(length=128), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'))
    )
    op.create_index('ix_core_role_role_code', 'core_role', ['role_code'])

    op.create_table('core_perm',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('perm_key', sa.String(length=128), nullable=False, unique=True),
        sa.Column('perm_name', sa.String(length=128), nullable=False, server_default=''),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'))
    )
    op.create_index('ix_core_perm_perm_key', 'core_perm', ['perm_key'])

    op.create_table('core_user_role',
        sa.Column('user_id', sa.String(length=36), sa.ForeignKey('core_user.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('role_id', sa.String(length=36), sa.ForeignKey('core_role.id', ondelete='CASCADE'), primary_key=True)
    )

    op.create_table('core_role_perm',
        sa.Column('role_id', sa.String(length=36), sa.ForeignKey('core_role.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('perm_id', sa.String(length=36), sa.ForeignKey('core_perm.id', ondelete='CASCADE'), primary_key=True)
    )

def downgrade() -> None:
    op.drop_table('core_role_perm')
    op.drop_table('core_user_role')
    op.drop_index('ix_core_perm_perm_key', table_name='core_perm')
    op.drop_table('core_perm')
    op.drop_index('ix_core_role_role_code', table_name='core_role')
    op.drop_table('core_role')
    op.drop_index('ix_core_user_username', table_name='core_user')
    op.drop_table('core_user')
