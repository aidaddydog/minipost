from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text, JSON, Index
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from .base import Base

class MetaKV(Base):
    __tablename__ = "meta"
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(Text)

class AdminUser(Base):
    __tablename__ = "admin_users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(64), unique=True)
    password_hash: Mapped[str] = mapped_column(String(256))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

class ClientAuth(Base):
    __tablename__ = "client_auth"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code_hash: Mapped[str] = mapped_column(String(256))
    code_plain: Mapped[str] = mapped_column(String(16))
    last_seen: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class OrderMapping(Base):
    __tablename__ = "order_mapping"
    order_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    tracking_no: Mapped[str] = mapped_column(String(128), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class TrackingFile(Base):
    __tablename__ = "tracking_file"
    tracking_no: Mapped[str] = mapped_column(String(128), primary_key=True)
    file_path: Mapped[str] = mapped_column(Text)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

# 新增：上传记录（成功/失败号段持久化，便于“上传记录”页展示/复制）
class UploadLog(Base):
    __tablename__ = "upload_logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    file_name: Mapped[str] = mapped_column(String(256))
    upload_type: Mapped[str] = mapped_column(String(32))  # '面单文件' | '运单号'
    total: Mapped[int] = mapped_column(Integer, default=0)
    success: Mapped[int] = mapped_column(Integer, default=0)
    fail: Mapped[int] = mapped_column(Integer, default=0)
    operator: Mapped[str] = mapped_column(String(64), default='系统')
    success_nos: Mapped[str] = mapped_column(Text, default='')  # 以换行分隔，避免部分 sqlite 缺省 JSON 支持
    fail_nos: Mapped[str] = mapped_column(Text, default='')

# 新增：作废/激活状态（按 tracking_no 控制）
class VoidedItem(Base):
    __tablename__ = "voided_items"
    tracking_no: Mapped[str] = mapped_column(String(128), primary_key=True)
    voided: Mapped[bool] = mapped_column(Boolean, default=False)

# 索引优化
Index('idx_tracking_file_uploaded', TrackingFile.uploaded_at)
Index('idx_upload_log_created', UploadLog.created_at)
