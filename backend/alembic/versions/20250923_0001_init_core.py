from alembic import op
import sqlalchemy as sa

revision = "20250923_0001"
down_revision = None
branch_labels = None
depends_on = None

def common_cols():
    return [
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("tenant_id", sa.String(), nullable=False),
        sa.Column("org_id", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="active"),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
    ]

def upgrade():
    op.create_table(
        "sales_order",
        *common_cols(),
        sa.Column("order_no", sa.String(40), nullable=False, unique=True),
    )
    op.create_index("ix_sales_order_order_no", "sales_order", ["order_no"], unique=True)

    op.create_table(
        "package",
        *common_cols(),
        sa.Column("package_no", sa.String(50), nullable=False, unique=True),
        sa.Column("sales_order_id", sa.String(), sa.ForeignKey("sales_order.id")),
    )
    op.create_index("ix_package_package_no", "package", ["package_no"], unique=True)

    op.create_table(
        "waybill",
        *common_cols(),
        sa.Column("waybill_no", sa.String(60), nullable=False, unique=True),
        sa.Column("tracking_no", sa.String(80), nullable=False, unique=True),
        sa.Column("package_id", sa.String(), sa.ForeignKey("package.id")),
        sa.Column("shipment_status", sa.String(), nullable=False, server_default="pending"),
    )
    op.create_index("ix_waybill_waybill_no", "waybill", ["waybill_no"], unique=True)
    op.create_index("ix_waybill_tracking_no", "waybill", ["tracking_no"], unique=True)

    op.create_table(
        "label",
        *common_cols(),
        sa.Column("tracking_no", sa.String(80), nullable=False, unique=True),
        sa.Column("package_id", sa.String(), sa.ForeignKey("package.id")),
        sa.Column("label_file", sa.String(255), nullable=True),
        sa.Column("label_printed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("transfer_waybill_no", sa.String(80), nullable=True),
    )
    op.create_index("ix_label_tracking_no", "label", ["tracking_no"], unique=True)

    op.create_table(
        "integration_job",
        *common_cols(),
        sa.Column("job_type", sa.String(40), nullable=False),
        sa.Column("exec_status", sa.String(20), nullable=False, server_default="success"),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_error", sa.String(500), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
    )

def downgrade():
    op.drop_table("integration_job")
    op.drop_index("ix_label_tracking_no", table_name="label")
    op.drop_table("label")
    op.drop_index("ix_waybill_tracking_no", table_name="waybill")
    op.drop_index("ix_waybill_waybill_no", table_name="waybill")
    op.drop_table("waybill")
    op.drop_index("ix_package_package_no", table_name="package")
    op.drop_table("package")
    op.drop_index("ix_sales_order_order_no", table_name="sales_order")
    op.drop_table("sales_order")
