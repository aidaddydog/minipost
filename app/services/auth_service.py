
# -*- coding: utf-8 -*-
from sqlalchemy.orm import Session
from typing import Optional
from app.models.entities import ClientAuth

def verify_code(db: Session, code: str) -> Optional[ClientAuth]:
    if not code:
        return None
    return db.query(ClientAuth).filter(ClientAuth.code==code, ClientAuth.is_active==True).first()
