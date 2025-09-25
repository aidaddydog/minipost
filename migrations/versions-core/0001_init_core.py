"""init core tables

Revision ID: 0001_init_core
Revises: 
Create Date: 2025-09-25

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0001_init_core'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('username', sa.String(length=64), nullable=False, unique=True),
        sa.Column('full_name', sa.String(length=128), nullable=False, server_default=''),
        sa.Column('email', sa.String(length=128), nullable=False, server_default=''),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_users_username', 'users', ['username'], unique=True)

    op.create_table('roles',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('role_code', sa.String(length=64), nullable=False, unique=True),
        sa.Column('role_name', sa.String(length=128), nullable=False),
        sa.Column('permission_keys', sa.String(length=2000), nullable=False, server_default=''),
    )
    op.create_index('ix_roles_role_code', 'roles', ['role_code'], unique=True)

    op.create_table('user_roles',
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), primary_key=True),
        sa.Column('role_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('roles.id'), primary_key=True),
    )

    op.create_table('label_uploads',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('order_no', sa.String(length=64), nullable=False, server_default=''),
        sa.Column('waybill', sa.String(length=64), nullable=False, server_default=''),
        sa.Column('trans_no', sa.String(length=64), nullable=False, server_default=''),
        sa.Column('ship', sa.String(length=32), nullable=False, server_default=''),
        sa.Column('file', sa.String(length=255), nullable=False, server_default=''),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='已预报'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('printed_at', sa.DateTime(), nullable=True),
        sa.Column('voided', sa.Boolean(), nullable=False, server_default=sa.text('false')),
    )

    op.create_table('upload_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('time', sa.DateTime(), nullable=False),
        sa.Column('file', sa.String(length=255), nullable=False, server_default=''),
        sa.Column('type', sa.String(length=32), nullable=False, server_default='面单文件'),
        sa.Column('total', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('success', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('fail', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('operator', sa.String(length=64), nullable=False, server_default='系统'),
        sa.Column('success_nos', sa.Text(), nullable=False, server_default=''),
        sa.Column('fail_nos', sa.Text(), nullable=False, server_default=''),
    )

    op.create_table('carriers',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('carrier_code', sa.String(length=32), nullable=False, unique=True),
        sa.Column('carrier_name', sa.String(length=128), nullable=False),
        sa.Column('region', sa.String(length=64), nullable=False, server_default=''),
        sa.Column('api_type', sa.String(length=32), nullable=False, server_default='api'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
    )
    op.create_index('ix_carriers_carrier_code', 'carriers', ['carrier_code'], unique=True)

    op.create_table('channels',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('channel_code', sa.String(length=32), nullable=False, unique=True),
        sa.Column('channel_name', sa.String(length=128), nullable=False),
        sa.Column('carrier_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('transport_mode', sa.String(length=32), nullable=False, server_default=''),
        sa.Column('service_level', sa.String(length=32), nullable=False, server_default=''),
        sa.Column('dest_country_codes', sa.String(length=512), nullable=False, server_default=''),
        sa.Column('max_weight_kg', sa.String(length=32), nullable=False, server_default=''),
        sa.Column('support_battery', sa.Boolean(), nullable=False, server_default=sa.text('false')),
    )
    op.create_index('ix_channels_channel_code', 'channels', ['channel_code'], unique=True)

def downgrade():
    op.drop_table('channels')
    op.drop_table('carriers')
    op.drop_table('upload_logs')
    op.drop_table('label_uploads')
    op.drop_table('user_roles')
    op.drop_table('roles')
    op.drop_table('users')
