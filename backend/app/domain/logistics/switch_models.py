from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Integer, DateTime, JSON, ForeignKey, text
from datetime import datetime
from app.common.models_base import Base, CommonBase

class SwitchRule(CommonBase, Base):
    __tablename__="switch_rule"
    name: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(16), default="enabled")
    priority: Mapped[int] = mapped_column(Integer, default=100)
    condition: Mapped[dict] = mapped_column(JSON)  # [{field,op,value}]
    action: Mapped[dict] = mapped_column(JSON)     # {set_prefix: 'RW', ...}
    effective_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    effective_to:   Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

class SwitchTask(CommonBase, Base):
    __tablename__="switch_task"
    rule_id: Mapped[str | None] = mapped_column(ForeignKey("switch_rule.id"))
    label_id: Mapped[str] = mapped_column(ForeignKey("label.id"))
    original_tracking_no: Mapped[str] = mapped_column(String(80))
    generated_transfer_no: Mapped[str | None] = mapped_column(String(80), nullable=True)
    action_snapshot: Mapped[dict] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(16), default="pending")
    error_message: Mapped[str | None] = mapped_column(String(500), nullable=True)
    executed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

class SwitchAudit(CommonBase, Base):
    __tablename__="switch_audit"
    task_id: Mapped[str] = mapped_column(ForeignKey("switch_task.id"))
    event:   Mapped[str] = mapped_column(String(16), default="created")
    detail:  Mapped[dict | None] = mapped_column(JSON, nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
