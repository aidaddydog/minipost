from alembic import op
import sqlalchemy as sa

revision = "20250923_0003_add_transport_mode"
down_revision = "20250923_0002_switch_rule_task_audit"
branch_labels = None
depends_on = None

def upgrade():
    transport_enum = sa.Enum(
        "express","postal","air","sea","rail","truck","multimodal","pickup","local_courier",
        name="transportmode"
    )
    transport_enum.create(op.get_bind(), checkfirst=True)
    op.add_column("waybill", sa.Column("transport_mode", transport_enum, nullable=True))

def downgrade():
    op.drop_column("waybill", "transport_mode")
    sa.Enum(name="transportmode").drop(op.get_bind(), checkfirst=True)
