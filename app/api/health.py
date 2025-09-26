# -*- coding: utf-8 -*-
from fastapi import APIRouter
from sqlalchemy import text
from app.db import engine
from app.common.utils import get_nav_cache

router = APIRouter(prefix="", tags=["health"])

@router.get("/healthz")
def healthz():
    return {"ok": True}

@router.get("/readyz")
def readyz():
    # DB ping
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    # nav cache
    nav = get_nav_cache()
    return {"ok": True, "nav_count": len(nav.get('data', []))}
