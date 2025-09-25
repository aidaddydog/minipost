from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db import get_db
from modules.logistics_channel.backend.models.carrier import Carrier, Channel

router = APIRouter()

@router.get("/carriers")
def carriers(db: Session = Depends(get_db)):
    rows = db.execute(select(Carrier)).scalars().all()
    return [{"id": str(r.id), "carrier_code": r.carrier_code, "carrier_name": r.carrier_name, "region": r.region, "api_type": r.api_type, "is_active": r.is_active} for r in rows]

@router.get("/channels")
def channels(db: Session = Depends(get_db)):
    rows = db.execute(select(Channel)).scalars().all()
    return [{"id": str(r.id), "channel_code": r.channel_code, "channel_name": r.channel_name, "carrier_id": str(r.carrier_id), "transport_mode": r.transport_mode, "service_level": r.service_level, "dest_country_codes": (r.dest_country_codes or "").split(","), "support_battery": r.support_battery} for r in rows]
