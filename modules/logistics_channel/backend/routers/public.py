# -*- coding: utf-8 -*-
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.db import get_db
from app.security import require_permissions
from .models.carrier import Channel

router = APIRouter()

@router.get("/channels", dependencies=[Depends(require_permissions({"logistics_channel:data:list"}))])
def api_channels(page:int=1, page_size:int=20, transport_mode:str|None=None, db:Session=Depends(get_db)):
    q = db.query(Channel)
    if transport_mode:
        q = q.filter(Channel.transport_mode==transport_mode)
    total = q.count()
    rows = q.offset((page-1)*page_size).limit(page_size).all()
    items = [{
        "channel_code": r.channel_code,
        "channel_name": r.channel_name,
        "transport_mode": r.transport_mode,
        "service_level": r.service_level,
        "dest_country_codes": (r.dest_country_codes or "").split(",") if r.dest_country_codes else [],
        "max_weight_kg": float(r.max_weight_kg or 0),
        "support_battery": r.support_battery
    } for r in rows]
    return {"page":page, "page_size":page_size, "total":total, "items":items}
