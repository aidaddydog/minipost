from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, ForeignKey, Enum, DateTime
from datetime import datetime
from app.common.models_base import Base, CommonBase
from app.common.enums import ShipmentStatus, TransportMode

class SalesOrder(CommonBase, Base):
    __tablename__ = "sales_order"
    order_no: Mapped[str] = mapped_column(String(40), unique=True, index=True, comment="系统订单号")

class Package(CommonBase, Base):
    __tablename__ = "package"
    package_no: Mapped[str] = mapped_column(String(50), unique=True, index=True, comment="包裹号")
    sales_order_id: Mapped[str | None] = mapped_column(ForeignKey("sales_order.id"), comment="订单ID")

class Waybill(CommonBase, Base):
    __tablename__ = "waybill"
    waybill_no: Mapped[str] = mapped_column(String(60), unique=True, index=True, comment="系统运单号（内部）")
    tracking_no: Mapped[str] = mapped_column(String(80), unique=True, index=True, comment="运单号（服务商Tracking）")
    package_id: Mapped[str | None] = mapped_column(ForeignKey("package.id"))
    shipment_status: Mapped[ShipmentStatus] = mapped_column(Enum(ShipmentStatus), default=ShipmentStatus.pending)
    # 新增：运输方式（真实字段）
    transport_mode: Mapped[TransportMode | None] = mapped_column(Enum(TransportMode), nullable=True, comment="运输方式（见字段规范）")

class Label(CommonBase, Base):
    __tablename__ = "label"
    tracking_no: Mapped[str] = mapped_column(String(80), unique=True, index=True, comment="运单号（服务商Tracking）")
    package_id: Mapped[str | None] = mapped_column(ForeignKey("package.id"))
    label_file: Mapped[str | None] = mapped_column(String(255), nullable=True, comment="面单文件Key/URL")
    label_printed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, comment="打印时间UTC")
    transfer_waybill_no: Mapped[str | None] = mapped_column(String(80), nullable=True, comment="转单号（=transfer_tracking_no）")
