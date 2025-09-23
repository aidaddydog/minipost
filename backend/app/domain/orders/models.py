# -*- coding: utf-8 -*-
"""
minipost: 订单/包裹/运单/面单 模型
修复点：
- 正确在文件顶部导入 SAEnum 并用于运输方式字段
- 避免重复定义 Waybill
- 外键类型与 id 对齐（通常为 int），避免 str|None 造成迁移与查询问题
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional, List

# ===== SQLAlchemy 2.0 Typed Declarative 导入 =====
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Integer, ForeignKey, DateTime
from sqlalchemy import Enum as SAEnum  # ★ 关键修复：用于枚举列

# ===== 项目内基类 / 枚举 =====
from app.common.models_base import Base, CommonBase
from app.common.enums import ShipmentStatus, TransportMode  # 你的枚举：发货状态 / 运输方式


# =========================
# 销售订单
# =========================
class SalesOrder(CommonBase, Base):
    __tablename__ = "sales_order"

    # 系统订单号
    order_no: Mapped[str] = mapped_column(
        String(40), unique=True, index=True, comment="系统订单号"
    )

    # 关系：一个订单包含多个包裹
    packages: Mapped[List["Package"]] = relationship(
        back_populates="sales_order", cascade="all, delete-orphan"
    )


# =========================
# 包裹
# =========================
class Package(CommonBase, Base):
    __tablename__ = "package"

    # 包裹号
    package_no: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, comment="包裹号"
    )

    # 订单ID（注意：CommonBase 通常将 id 定义为 Integer 主键，因此这里用 Integer 外键）
    sales_order_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("sales_order.id"), nullable=True, comment="订单ID"
    )

    # 关系：包裹 -> 所属订单
    sales_order: Mapped[Optional[SalesOrder]] = relationship(
        back_populates="packages"
    )

    # 关系：包裹 -> 运单（一个包裹通常一个运单，如你需要一对多可自行调整）
    waybills: Mapped[List["Waybill"]] = relationship(
        back_populates="package", cascade="all, delete-orphan"
    )

    # 关系：包裹 -> 面单
    labels: Mapped[List["Label"]] = relationship(
        back_populates="package", cascade="all, delete-orphan"
    )


# =========================
# 运单
# =========================
class Waybill(CommonBase, Base):
    __tablename__ = "waybill"

    # 系统运单号（内部）
    waybill_no: Mapped[str] = mapped_column(
        String(60), unique=True, index=True, comment="系统运单号（内部）"
    )

    # 运单号（服务商 Tracking）
    tracking_no: Mapped[str] = mapped_column(
        String(80), unique=True, index=True, comment="运单号（服务商Tracking）"
    )

    # 包裹 ID（与 CommonBase.id 类型对齐）
    package_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("package.id"), nullable=True
    )

    # 发货状态（你的业务枚举）
    shipment_status: Mapped[ShipmentStatus] = mapped_column(
        SAEnum(ShipmentStatus, name="shipmentstatus"),
        default=ShipmentStatus.pending,
        comment="发货状态"
    )

    # ★ 新增：运输方式（使用 SAEnum 正确落库）
    transport_mode: Mapped[Optional[TransportMode]] = mapped_column(
        SAEnum(TransportMode, name="transportmode"),
        nullable=True,
        comment="运输方式（见字段规范）"
    )

    # 关系：运单 -> 包裹
    package: Mapped[Optional[Package]] = relationship(back_populates="waybills")


# =========================
# 面单
# =========================
class Label(CommonBase, Base):
    __tablename__ = "label"

    # 运单号（服务商 Tracking；是否 unique 视业务而定，这里保留你原设为唯一）
    tracking_no: Mapped[str] = mapped_column(
        String(80), unique=True, index=True, comment="运单号（服务商Tracking）"
    )

    # 包裹 ID（与 CommonBase.id 类型对齐）
    package_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("package.id"), nullable=True
    )

    # 面单文件 Key/URL
    label_file: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True, comment="面单文件Key/URL"
    )

    # 打印时间（UTC，带时区）
    label_printed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="打印时间UTC"
    )

    # 转单号（= transfer_tracking_no）
    transfer_waybill_no: Mapped[Optional[str]] = mapped_column(
        String(80), nullable=True, comment="转单号（=transfer_tracking_no）"
    )

    # 关系：面单 -> 包裹
    package: Mapped[Optional[Package]] = relationship(back_populates="labels")
