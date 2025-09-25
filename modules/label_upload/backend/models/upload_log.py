import uuid
import datetime as dt
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy import String, DateTime, Boolean, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base

def gen_uuid():
    return uuid.uuid4()

class LabelUpload(Base):
    __tablename__ = "label_uploads"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    order_no: Mapped[str] = mapped_column(String(64), default="")
    waybill: Mapped[str] = mapped_column(String(64), default="")
    trans_no: Mapped[str] = mapped_column(String(64), default="")
    ship: Mapped[str] = mapped_column(String(32), default="")
    file: Mapped[str] = mapped_column(String(255), default="")
    status: Mapped[str] = mapped_column(String(32), default="已预报")
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=False), default=dt.datetime.utcnow)
    printed_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=False), nullable=True)
    voided: Mapped[bool] = mapped_column(Boolean, default=False)

class UploadLog(Base):
    __tablename__ = "upload_logs"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    time: Mapped[dt.datetime] = mapped_column(DateTime(timezone=False), default=dt.datetime.utcnow)
    file: Mapped[str] = mapped_column(String(255), default="")
    type: Mapped[str] = mapped_column(String(32), default="面单文件")  # 面单文件 / 运单号 / 映射
    total: Mapped[int] = mapped_column(Integer, default=0)
    success: Mapped[int] = mapped_column(Integer, default=0)
    fail: Mapped[int] = mapped_column(Integer, default=0)
    operator: Mapped[str] = mapped_column(String(64), default="系统")
    success_nos: Mapped[str] = mapped_column(Text, default="")  # 换行分隔，简化处理
    fail_nos: Mapped[str] = mapped_column(Text, default="")
