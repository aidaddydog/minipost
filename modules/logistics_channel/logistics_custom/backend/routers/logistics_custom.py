# -*- coding: utf-8 -*-
"""
FastAPI 路由（/api/logistics/custom）
- 与全局解耦：本模块自行创建 SQLAlchemy Engine（读取 PG_* 环境变量）。
- 所有写操作幂等，软删/软停用遵循规范。
"""
from __future__ import annotations
import os, uuid, json
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import create_engine, select, func, text, update
from sqlalchemy.orm import sessionmaker

from ..models.logistics_custom import Base, LogisticsCustom, LogisticsCustomChannel, STATUS_ENUM, TRANSPORT_MODE_ENUM

# ---------- DB 连接（独立于全局 ORM；读取环境变量） ----------
def _dsn() -> str:
    host = os.getenv("PG_HOST", "postgres")
    port = os.getenv("PG_PORT", "5432")
    db   = os.getenv("PG_DB", "minipost")
    user = os.getenv("PG_USER", "minipost")
    pwd  = os.getenv("PG_PASSWORD", "minipost")
    return f"postgresql+psycopg2://{user}:{pwd}@{host}:{port}/{db}"

engine = create_engine(_dsn(), pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)

# 首次导入时保证表结构存在（幂等）
Base.metadata.create_all(engine, tables=[LogisticsCustom.__table__, LogisticsCustomChannel.__table__])
with engine.begin() as conn:
    # 补充幂等索引（SQLAlchemy create_all 不能创建带 WHERE 的唯一索引）
    conn.exec_driver_sql("""
    CREATE UNIQUE INDEX IF NOT EXISTS uq_logistics_custom_uniq_provider
    ON logistics_custom(tenant_id, provider_name) WHERE deleted_at IS NULL;
    """)
    conn.exec_driver_sql("""
    CREATE UNIQUE INDEX IF NOT EXISTS uq_lcc_channel_name_not_deleted
    ON logistics_custom_channel(custom_id, channel_name) WHERE deleted_at IS NULL;
    """)

# ---------- Pydantic 模型 ----------
class Address(BaseModel):
    country_code: str
    state: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    street1: str
    street2: Optional[str] = None
    address_line3: Optional[str] = None
    address_line4: Optional[str] = None
    house_number: Optional[str] = None
    postcode: str
    company: Optional[str] = None
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    id_card_no: Optional[str] = None
    id_tax_no: Optional[str] = None

class ChannelIn(BaseModel):
    channel_name: str = Field(..., min_length=1)
    transport_mode: str = Field(..., description="见 SSoT enums.transport_mode")
    platform_mapping: Dict[str, Any] = Field(default_factory=dict)
    label_template_code: Optional[str] = None
    id: Optional[uuid.UUID] = None   # 更新时用

    @field_validator('transport_mode')
    @classmethod
    def validate_tm(cls, v):
        allowed = [*TRANSPORT_MODE_ENUM.enums]
        if v not in allowed:
            raise ValueError(f"transport_mode 必须属于 {allowed}")
        return v

class CustomCreate(BaseModel):
    tenant_id: uuid.UUID
    provider_name: str
    ship_from: Optional[Address] = None
    label_template_code: Optional[str] = None
    channels: List[ChannelIn]

class CustomUpdate(BaseModel):
    provider_name: Optional[str] = None
    ship_from: Optional[Address] = None
    label_template_code: Optional[str] = None
    channels: Optional[List[ChannelIn]] = None

router = APIRouter(prefix="/api/logistics/custom", tags=["logistics_custom"])

# ---------- 工具 ----------
def _now(): return datetime.now(timezone.utc)

def gen_service_code(sess) -> str:
    """生成 service_code：LGC{yyyy}{seq%4}（简化实现，可替换为全局 numbering_rule）"""
    y = datetime.now().strftime("%Y")
    q = text("SELECT COALESCE(MAX(RIGHT(service_code,4)),'0000') FROM logistics_custom WHERE service_code LIKE :p")
    cur = sess.execute(q, {"p": f"LGC{y}%"}).scalar()
    try:
        seq = int(cur) + 1
    except Exception:
        seq = 1
    return f"LGC{y}{seq:04d}"

def _audit(conn, action: str, target: dict, before=None, after=None):
    """尽力写审计；没有审计表则忽略"""
    try:
        conn.exec_driver_sql(
            "INSERT INTO audit_log(action,target,before,after,client_ip,user_agent,trace_id,created_at) "
            "VALUES (:a,:t::jsonb,:b::jsonb,:c::jsonb,'','', '', NOW())",
            {"a": action, "t": json.dumps(target), "b": json.dumps(before) if before else None, "c": json.dumps(after) if after else None}
        )
    except Exception:
        pass

# ---------- 接口 ----------
@router.get("")
def list_custom(kw: str = Query("", description="仅命中 provider_name/channel_name"),
                page: int = 1, page_size: int = 10):
    page = max(1, page); page_size = min(100, max(1, page_size))
    with SessionLocal() as sess:
        base = select(LogisticsCustom).where(LogisticsCustom.deleted_at.is_(None))
        if kw:
            like = f"%{kw}%"
            # provider 命中 or 子表命中
            sub_ids = select(LogisticsCustomChannel.custom_id).where(
                LogisticsCustomChannel.deleted_at.is_(None),
                LogisticsCustomChannel.channel_name.ilike(like)
            ).distinct()
            base = base.where(
                (LogisticsCustom.provider_name.ilike(like)) | (LogisticsCustom.id.in_(sub_ids))
            )
        total = sess.execute(select(func.count()).select_from(base.subquery())).scalar_one()
        rows = sess.execute(base.order_by(LogisticsCustom.created_at.desc())
                            .offset((page-1)*page_size).limit(page_size)).scalars().all()
        data = []
        for r in rows:
            # 拉子表
            chs = sess.execute(select(LogisticsCustomChannel).where(
                LogisticsCustomChannel.custom_id==r.id,
                LogisticsCustomChannel.deleted_at.is_(None)
            ).order_by(LogisticsCustomChannel.created_at.asc())).scalars().all()
            data.append({
                "id": str(r.id), "tenant_id": str(r.tenant_id),
                "provider_name": r.provider_name, "service_code": r.service_code,
                "status": r.status, "ship_from": r.ship_from,
                "label_template_code": r.label_template_code,
                "created_at": r.created_at.isoformat(),
                "channels": [{
                    "id": str(c.id), "channel_name": c.channel_name, "transport_mode": c.transport_mode,
                    "platform_mapping": c.platform_mapping, "is_selectable": c.is_selectable,
                    "usage_count": c.usage_count, "status": c.status
                } for c in chs]
            })
        return {"data": data, "pagination": {"total": total, "page": page, "page_size": page_size}}

@router.post("")
def create_custom(body: CustomCreate):
    with SessionLocal.begin() as sess:
        # 唯一校验（同租户 + 未软删）
        exists = sess.execute(select(LogisticsCustom.id).where(
            LogisticsCustom.tenant_id==body.tenant_id,
            LogisticsCustom.provider_name==body.provider_name,
            LogisticsCustom.deleted_at.is_(None)
        )).first()
        if exists:
            raise HTTPException(status_code=409, detail="provider_name 已存在")

        scode = gen_service_code(sess)
        p = LogisticsCustom(
            tenant_id=body.tenant_id, provider_name=body.provider_name,
            service_code=scode, ship_from=(body.ship_from.dict() if body.ship_from else None),
            label_template_code=body.label_template_code, status='active',
            created_at=_now(), updated_at=_now()
        )
        sess.add(p); sess.flush()
        for ch in body.channels:
            sess.add(LogisticsCustomChannel(
                custom_id=p.id, channel_name=ch.channel_name, transport_mode=ch.transport_mode,
                platform_mapping=ch.platform_mapping or {}, status='active', created_at=_now(), updated_at=_now()
            ))
        _audit(sess.connection(), "create", {"type":"logistics_custom","id":str(p.id)}, after={"provider_name": p.provider_name})
        return {"data": {"id": str(p.id), "service_code": p.service_code}}

@router.put("/{custom_id}")
def update_custom(custom_id: uuid.UUID, body: CustomUpdate):
    with SessionLocal.begin() as sess:
        p = sess.get(LogisticsCustom, custom_id)
        if not p or p.deleted_at is not None:
            raise HTTPException(status_code=404, detail="not found")
        before = {"provider_name": p.provider_name, "ship_from": p.ship_from, "label_template_code": p.label_template_code}

        if body.provider_name and body.provider_name != p.provider_name:
            # 唯一校验
            dup = sess.execute(select(LogisticsCustom.id).where(
                LogisticsCustom.tenant_id==p.tenant_id, LogisticsCustom.provider_name==body.provider_name,
                LogisticsCustom.deleted_at.is_(None), LogisticsCustom.id != p.id
            )).first()
            if dup:
                raise HTTPException(status_code=409, detail="provider_name 冲突")
            p.provider_name = body.provider_name
        if body.ship_from is not None:
            p.ship_from = body.ship_from.dict() if body.ship_from else None
        if body.label_template_code is not None:
            p.label_template_code = body.label_template_code
        p.updated_at = _now()
        sess.add(p)

        # 处理 channels（按是否带 id 决定新增/更新；未出现的不处理；显式删除请调用 DELETE）
        if body.channels is not None:
            for ch in body.channels:
                if ch.id:
                    c = sess.get(LogisticsCustomChannel, ch.id)
                    if not c or c.deleted_at is not None:
                        raise HTTPException(status_code=404, detail=f"channel {ch.id} not found")
                    c.channel_name = ch.channel_name
                    c.transport_mode = ch.transport_mode
                    c.platform_mapping = ch.platform_mapping or {}
                    c.updated_at = _now()
                    sess.add(c)
                else:
                    sess.add(LogisticsCustomChannel(
                        custom_id=p.id, channel_name=ch.channel_name, transport_mode=ch.transport_mode,
                        platform_mapping=ch.platform_mapping or {}, status='active', created_at=_now(), updated_at=_now()
                    ))
        _audit(sess.connection(), "update", {"type":"logistics_custom","id":str(p.id)}, before=before, after={"provider_name": p.provider_name})
        return {"data": {"id": str(p.id)}}

@router.put("/channels/{channel_id}/status")
def toggle_channel_status(channel_id: uuid.UUID, status: str = Body(..., embed=True)):
    if status not in ['active', 'inactive']:
        raise HTTPException(status_code=400, detail="status 仅支持 active/inactive")
    with SessionLocal.begin() as sess:
        c = sess.get(LogisticsCustomChannel, channel_id)
        if not c or c.deleted_at is not None:
            raise HTTPException(status_code=404, detail="not found")
        if status == 'inactive':
            c.status = 'inactive'
            c.is_selectable = False
        else:
            c.status = 'active'
            c.is_selectable = True
        c.updated_at = _now()
        sess.add(c)
        _audit(sess.connection(), "update", {"type":"logistics_custom_channel","id":str(c.id)}, after={"status": c.status})
        return {"data": {"id": str(c.id), "status": c.status, "is_selectable": c.is_selectable}}

@router.delete("/channels/{channel_id}")
def soft_delete_channel(channel_id: uuid.UUID):
    with SessionLocal.begin() as sess:
        c = sess.get(LogisticsCustomChannel, channel_id)
        if not c or c.deleted_at is not None:
            raise HTTPException(status_code=404, detail="not found")
        c.deleted_at = _now(); sess.add(c)
        _audit(sess.connection(), "delete", {"type":"logistics_custom_channel","id":str(c.id)})
        return {"data": {"id": str(c.id), "deleted_at": c.deleted_at.isoformat()}}

@router.get("/addresses")
def list_addresses():
    """下拉源占位：返回发货/仓库地址（结构遵循 structs.address）。
    真实实现建议查询租户地址簿或仓库表。
    """
    return {"data": []}

@router.get("/label-templates")
def list_label_templates():
    """标签模板下拉源占位：建议接入 settings 或 file_object """
    return {"data": []}
