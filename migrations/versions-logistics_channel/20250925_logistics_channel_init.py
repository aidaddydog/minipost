"""init logistics_channel"""
from alembic import op
import sqlalchemy as sa

revision = "20250925_logistics_channel_init"
down_revision = "20250925_label_upload_init"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table("lc_carriers",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("carrier_code", sa.String(length=60), nullable=False, unique=True),
        sa.Column("carrier_name", sa.String(length=120), nullable=False),
    )
    op.create_table("lc_channels",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("channel_code", sa.String(length=80), nullable=False, unique=True),
        sa.Column("channel_name", sa.String(length=120), nullable=False),
        sa.Column("carrier_id", sa.Integer, sa.ForeignKey("lc_carriers.id")),
        sa.Column("transport_mode", sa.String(length=40), nullable=False),
        sa.Column("service_level", sa.String(length=40), nullable=False),
        sa.Column("dest_country_codes", sa.String(length=400), nullable=False, server_default=""),
        sa.Column("max_weight_kg", sa.Numeric(10,3), nullable=False, server_default="0"),
        sa.Column("support_battery", sa.Boolean, nullable=False, server_default=sa.text("false")),
    )

def downgrade():
    op.drop_table("lc_channels")
    op.drop_table("lc_carriers")
