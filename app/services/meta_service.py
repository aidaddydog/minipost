
# -*- coding: utf-8 -*-
from sqlalchemy.orm import Session
from typing import Optional
from app.models.entities import MetaKV

def get_kv(db: Session, key: str, default: Optional[str]=None) -> Optional[str]:
    row = db.query(MetaKV).filter(MetaKV.key==key).first()
    return row.value if row else default

def set_kv(db: Session, key: str, value: str):
    row = db.query(MetaKV).filter(MetaKV.key==key).first()
    if row:
        row.value = value
    else:
        row = MetaKV(key=key, value=value)
        db.add(row)
    return row
