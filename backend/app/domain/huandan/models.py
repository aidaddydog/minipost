"""
Database models for the huandan integration.

These models mirror the core data structures used in the original
`huandan.server` project but are adapted to fit within the
minipost ecosystem. Each model inherits from the common base
provided by ``app.common.models_base`` to include tenant and audit
columns. The tables are prefixed with ``huandan_`` to avoid any
collision with existing minipost tables.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, DateTime, Text

from app.common.models_base import Base, CommonBase


class HuandanOrderMapping(Base, CommonBase):
    """Map a customer order number to a tracking/waybill number.

    This table stores the mapping between internal order numbers and
    the carrier tracking numbers (or transfer waybill numbers) that
    will be used by the huandan client.  Each record belongs to a
    tenant and may be updated over time when the mapping changes.
    The ``updated_at`` column is used to derive the mapping
    version exposed via the API.
    """

    __tablename__ = "huandan_order_mapping"

    # 订单号
    order_no: Mapped[str] = mapped_column(
        String(128), index=True, nullable=False, comment="内部订单号"
    )
    # 运单号/转单号
    tracking_no: Mapped[str] = mapped_column(
        String(128), index=True, nullable=False, comment="运单号或转单号"
    )
    # 更新时间
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False, comment="最近更新时间"
    )


class HuandanTrackingFile(Base, CommonBase):
    """Record the storage location of a PDF label file.

    The huandan client requests PDF labels by tracking number.  This
    table stores the absolute path to a PDF file on disk.  Since
    multiple tenants may share the same tracking number in rare
    circumstances, the combination of tenant and tracking number
    uniquely identifies a record.  The primary key is implicitly
    defined by the base ``CommonBase`` class (via the ``id`` field).
    """

    __tablename__ = "huandan_tracking_file"

    # 运单号/转单号
    tracking_no: Mapped[str] = mapped_column(
        String(128), index=True, nullable=False, comment="运单号或转单号"
    )
    # 本地文件路径
    file_path: Mapped[str] = mapped_column(
        Text, nullable=False, comment="PDF 文件绝对路径"
    )
    # 上传时间
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False, comment="上传时间"
    )
