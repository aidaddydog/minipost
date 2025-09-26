# -*- coding: utf-8 -*-
"""
自定义物流主体表（logistics_custom）
- 命名与字段严格遵循 SSoT（status_common/structs.address 等）。
"""
from __future__ import annotations
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, DateTime, Boolean, Integer, ForeignKey, UniqueConstraint,
    Index, text
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, ENUM
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

# 与 SSoT 对齐的枚举（如 DB 已存在同名 ENUM，将自动复用）
STATUS_ENUM = ENUM('draft', 'active', 'inactive', 'archived', name='status_common', create_type=True)
# transport_mode 取自 SSoT：express/postal/air/sea/rail/truck/multimodal/pickup/local_courier
TRANSPORT_MODE_ENUM = ENUM('express','postal','air','sea','rail','truck','multimodal','pickup','local_courier',
                           name='transport_mode', create_type=True)

class LogisticsCustom(Base):
    __tablename__ = 'logistics_custom'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    provider_name = Column(String(100), nullable=False)
    service_code = Column(String(32), nullable=False)  # 由编号规则生成：LGC{yyyy}{seq%4}
    status = Column(STATUS_ENUM, nullable=False, server_default='active')
    ship_from = Column(JSONB, nullable=True)  # structs.address
    label_template_code = Column(String(64), nullable=True)

    # 审计与软删
    version = Column(Integer, nullable=False, server_default=text('1'))
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    created_by = Column(UUID(as_uuid=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    updated_by = Column(UUID(as_uuid=True), nullable=True)
    remark = Column(String(255), nullable=True)

    deleted_at = Column(DateTime(timezone=True), nullable=True)
    deleted_by = Column(UUID(as_uuid=True), nullable=True)

    channels = relationship("LogisticsCustomChannel", back_populates="custom", lazy='selectin')

    __table_args__ = (
        # 仅当 deleted_at IS NULL 时唯一
        Index('uq_logistics_custom_uniq_provider', 'tenant_id', 'provider_name',
              unique=True, postgresql_where=text('deleted_at IS NULL')),
    )


class LogisticsCustomChannel(Base):
    __tablename__ = 'logistics_custom_channel'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    custom_id = Column(UUID(as_uuid=True), ForeignKey('logistics_custom.id', ondelete='RESTRICT'), nullable=False)
    channel_name = Column(String(100), nullable=False)
    transport_mode = Column(TRANSPORT_MODE_ENUM, nullable=False)
    platform_mapping = Column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    is_selectable = Column(Boolean, nullable=False, server_default=text('true'))
    usage_count = Column(Integer, nullable=False, server_default=text('0'))
    status = Column(STATUS_ENUM, nullable=False, server_default='active')

    # 审计与软删
    version = Column(Integer, nullable=False, server_default=text('1'))
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    created_by = Column(UUID(as_uuid=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    updated_by = Column(UUID(as_uuid=True), nullable=True)
    remark = Column(String(255), nullable=True)

    deleted_at = Column(DateTime(timezone=True), nullable=True)
    deleted_by = Column(UUID(as_uuid=True), nullable=True)

    custom = relationship("LogisticsCustom", back_populates="channels")

    __table_args__ = (
        Index('uq_lcc_channel_name_not_deleted', 'custom_id', 'channel_name',
              unique=True, postgresql_where=text('deleted_at IS NULL')),
    )
