from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Integer, DateTime, JSON
from datetime import datetime
from app.common.models_base import Base, CommonBase
class IntegrationJob(CommonBase, Base):
    __tablename__ = "integration_job"
    job_type: Mapped[str] = mapped_column(String(40))                 # e.g. label_upload / order_map_upload
    exec_status: Mapped[str] = mapped_column(String(20), default="success")
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    last_error: Mapped[str | None] = mapped_column(String(500), nullable=True)
    payload: Mapped[dict | None] = mapped_column(JSON, nullable=True) # {file_name,total,success,fail,operator,success_nos,fail_nos}
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
