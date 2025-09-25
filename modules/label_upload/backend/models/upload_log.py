# -*- coding: utf-8 -*-
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import Integer, String, DateTime, Boolean, ForeignKey, Numeric
from sqlalchemy.sql import func
from app.db import Base

class UploadLog(Base):
    __tablename__ = "lu_upload_logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    time: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    file_name: Mapped[str] = mapped_column(String(200), default="")
    upload_type: Mapped[str] = mapped_column(String(40), default="面单文件")  # 面单文件/运单号
    total: Mapped[int] = mapped_column(Integer, default=0)
    success: Mapped[int] = mapped_column(Integer, default=0)
    fail: Mapped[int] = mapped_column(Integer, default=0)
    operator: Mapped[str] = mapped_column(String(80), default="系统")

class Label(Base):
    __tablename__ = "lu_labels"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_no: Mapped[str] = mapped_column(String(60), index=True)
    waybill: Mapped[str] = mapped_column(String(80), index=True)
    transfer_no: Mapped[str] = mapped_column(String(80), default="")
    transport_mode: Mapped[str] = mapped_column(String(40), default="")
    file_name: Mapped[str] = mapped_column(String(200), default="")
    status: Mapped[str] = mapped_column(String(40), default="已预报")
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    printed_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=True)
    voided: Mapped[bool] = mapped_column(Boolean, default=False)

class LabelZip(Base):
    __tablename__ = "lu_label_zips"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    date: Mapped[str] = mapped_column(String(10), index=True)  # YYYY-MM-DD
    version: Mapped[int] = mapped_column(Integer, default=1)
    file_name: Mapped[str] = mapped_column(String(200))
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    download_url: Mapped[str] = mapped_column(String(500), default="")
    checksum: Mapped[str] = mapped_column(String(128), default="")
    retention_days: Mapped[int] = mapped_column(Integer, default=30)
