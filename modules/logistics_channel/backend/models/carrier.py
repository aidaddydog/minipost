import uuid
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Boolean
from app.db import Base

def gen_uuid():
    return uuid.uuid4()

class Carrier(Base):
    __tablename__ = "carriers"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    carrier_code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    carrier_name: Mapped[str] = mapped_column(String(128))
    region: Mapped[str] = mapped_column(String(64), default="")
    api_type: Mapped[str] = mapped_column(String(32), default="api")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

class Channel(Base):
    __tablename__ = "channels"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    channel_code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    channel_name: Mapped[str] = mapped_column(String(128))
    carrier_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    transport_mode: Mapped[str] = mapped_column(String(32), default="")
    service_level: Mapped[str] = mapped_column(String(32), default="")
    dest_country_codes: Mapped[str] = mapped_column(String(512), default="")  # 逗号分隔
    max_weight_kg: Mapped[str] = mapped_column(String(32), default="")
    support_battery: Mapped[bool] = mapped_column(Boolean, default=False)
