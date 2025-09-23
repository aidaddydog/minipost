from alembic import op
import sqlalchemy as sa

revision = "20250923_0002"
down_revision = "20250923_0001"
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
        "switch_rule",
        *common_cols(),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="enabled"),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("condition", sa.JSON(), nullable=False),
        sa.Column("action", sa.JSON(), nullable=False),
        sa.Column("effective_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("effective_to", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_switch_rule_tenant_priority", "switch_rule", ["tenant_id","priority"])

    op.create_table(
        "switch_task",
        *common_cols(),
        sa.Column("rule_id", sa.String(), sa.ForeignKey("switch_rule.id")),
        sa.Column("label_id", sa.String(), sa.ForeignKey("label.id"), nullable=False),
        sa.Column("original_tracking_no", sa.String(80), nullable=False),
        sa.Column("generated_transfer_no", sa.String(80), nullable=True),
        sa.Column("action_snapshot", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("error_message", sa.String(500), nullable=True),
        sa.Column("executed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_switch_task_tenant_label", "switch_task", ["tenant_id","label_id"])

    op.create_table(
        "switch_audit",
        *common_cols(),
        sa.Column("task_id", sa.String(), sa.ForeignKey("switch_task.id"), nullable=False),
        sa.Column("event", sa.String(16), nullable=False, server_default="created"),
        sa.Column("detail", sa.JSON(), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_switch_audit_tenant_task", "switch_audit", ["tenant_id","task_id"])

def downgrade():
    op.drop_index("ix_switch_audit_tenant_task", table_name="switch_audit")
    op.drop_table("switch_audit")
    op.drop_index("ix_switch_task_tenant_label", table_name="switch_task")
    op.drop_table("switch_task")
    op.drop_index("ix_switch_rule_tenant_priority", table_name="switch_rule")
    op.drop_table("switch_rule")
