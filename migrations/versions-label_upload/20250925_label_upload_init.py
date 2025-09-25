"""init label_upload"""
from alembic import op
import sqlalchemy as sa

revision = "20250925_label_upload_init"
down_revision = "0001_init_core"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table("lu_upload_logs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("time", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("file_name", sa.String(length=200), nullable=False, server_default=""),
        sa.Column("upload_type", sa.String(length=40), nullable=False, server_default="面单文件"),
        sa.Column("total", sa.Integer, nullable=False, server_default="0"),
        sa.Column("success", sa.Integer, nullable=False, server_default="0"),
        sa.Column("fail", sa.Integer, nullable=False, server_default="0"),
        sa.Column("operator", sa.String(length=80), nullable=False, server_default="系统"),
    )
    op.create_table("lu_labels",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("order_no", sa.String(length=60), nullable=False),
        sa.Column("waybill", sa.String(length=80), nullable=False),
        sa.Column("transfer_no", sa.String(length=80), nullable=False, server_default=""),
        sa.Column("transport_mode", sa.String(length=40), nullable=False, server_default=""),
        sa.Column("file_name", sa.String(length=200), nullable=False, server_default=""),
        sa.Column("status", sa.String(length=40), nullable=False, server_default="已预报"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("printed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("voided", sa.Boolean, nullable=False, server_default=sa.text("false")),
    )
    op.create_table("lu_label_zips",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("date", sa.String(length=10), nullable=False),
        sa.Column("version", sa.Integer, nullable=False, server_default="1"),
        sa.Column("file_name", sa.String(length=200), nullable=False),
        sa.Column("size_bytes", sa.Integer, nullable=False, server_default="0"),
        sa.Column("download_url", sa.String(length=500), nullable=False, server_default=""),
        sa.Column("checksum", sa.String(length=128), nullable=False, server_default=""),
        sa.Column("retention_days", sa.Integer, nullable=False, server_default="30"),
    )

def downgrade():
    op.drop_table("lu_label_zips")
    op.drop_table("lu_labels")
    op.drop_table("lu_upload_logs")
