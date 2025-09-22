from sqlalchemy import Column, Integer, String, DateTime, Boolean, Index
from datetime import datetime
from app.core.db import Base

class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String(64), unique=True, index=True, nullable=False)
    waybill_no = Column(String(64), index=True, default="")
    trans_no = Column(String(64), index=True, default="")
    ship = Column(String(32), default="")
    file = Column(String(255), default="")
    status = Column(String(32), default="已预报")  # 与 UI 状态枚举一致
    created_at = Column(DateTime, default=datetime.utcnow)
    printed_at = Column(DateTime, nullable=True)
    voided = Column(Boolean, default=False)

Index("idx_orders_composite", Order.order_no, Order.waybill_no, Order.trans_no)
