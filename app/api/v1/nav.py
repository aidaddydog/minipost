# -*- coding: utf-8 -*-
from fastapi import APIRouter, Query
from app.common.utils import refresh_nav_cache, get_nav_cache

router = APIRouter(prefix="/api", tags=["nav"])

@router.get("/nav")
def get_nav():
    return get_nav_cache()

@router.post("/nav/reload")
def reload_nav(force: bool = Query(default=True)):
    res = refresh_nav_cache()
    return res
