# -*- coding: utf-8 -*-
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import Integer, String, Boolean, ForeignKey, Numeric
from app.db import Base

class Carrier(Base):
    __tablename__ = "lc_carriers"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    carrier_code: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    carrier_name: Mapped[str] = mapped_column(String(120))

class Channel(Base):
    __tablename__ = "lc_channels"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    channel_code: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    channel_name: Mapped[str] = mapped_column(String(120))
    carrier_id: Mapped[int] = mapped_column(Integer, ForeignKey("lc_carriers.id"))
    transport_mode: Mapped[str] = mapped_column(String(40))
    service_level: Mapped[str] = mapped_column(String(40))
    dest_country_codes: Mapped[str] = mapped_column(String(400))  # 逗号分隔
    max_weight_kg: Mapped[Numeric] = mapped_column(Numeric(10,3), default=0)
    support_battery: Mapped[bool] = mapped_column(Boolean, default=False)
