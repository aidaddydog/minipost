from alembic import op
import sqlalchemy as sa

revision = "20250923_0003"
down_revision = "20250923_0002"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("waybill", sa.Column("transport_mode", sa.String(length=32), nullable=True, comment="运输方式"))
    # 若希望严格枚举，可改为 Enum；此处兼容老库用 String

def downgrade():
    op.drop_column("waybill", "transport_mode")
