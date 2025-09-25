"""init core rbac"""
from alembic import op
import sqlalchemy as sa

revision = "0001_init_core"
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.create_table("users",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("username", sa.String(length=80), nullable=False, unique=True, index=True),
        sa.Column("full_name", sa.String(length=120), nullable=False, server_default=""),
        sa.Column("password_hash", sa.String(length=200), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_table("roles",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("role_code", sa.String(length=80), nullable=False, unique=True, index=True),
        sa.Column("role_name", sa.String(length=120), nullable=False, server_default=""),
    )
    op.create_table("permissions",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("permission_key", sa.String(length=120), nullable=False, unique=True, index=True),
        sa.Column("permission_name", sa.String(length=200), nullable=False, server_default=""),
    )
    op.create_table("user_roles",
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("role_id", sa.Integer, sa.ForeignKey("roles.id"), primary_key=True),
    )
    op.create_table("role_permissions",
        sa.Column("role_id", sa.Integer, sa.ForeignKey("roles.id"), primary_key=True),
        sa.Column("permission_id", sa.Integer, sa.ForeignKey("permissions.id"), primary_key=True),
    )

def downgrade():
    op.drop_table("role_permissions")
    op.drop_table("user_roles")
    op.drop_table("permissions")
    op.drop_table("roles")
    op.drop_table("users")
