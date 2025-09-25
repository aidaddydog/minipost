# -*- coding: utf-8 -*-
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.db import get_db
from modules.core.backend.routers.auth import api_me  # 引用以触发依赖加载
from app.security import require_permissions
from .services.public_service import list_labels, list_logs, list_zips

router = APIRouter()

@router.get("/list", dependencies=[Depends(require_permissions({"label_upload:data:list"}))])
def api_list(
    page: int = 1, page_size: int = 20,
    sort_by: str = "created_at", sort_dir: str = "desc",
    q: str | None = None, status: str | None = None, transport_mode: str | None = None,
    db: Session = Depends(get_db)
):
    return list_labels(db, locals())

@router.get("/logs", dependencies=[Depends(require_permissions({"label_upload:data:list"}))])
def api_logs(page: int = 1, page_size: int = 20, db: Session = Depends(get_db)):
    return list_logs(db, locals())

@router.get("/zips", dependencies=[Depends(require_permissions({"label_upload:data:list"}))])
def api_zips(page: int = 1, page_size: int = 20, db: Session = Depends(get_db)):
    return list_zips(db, locals())
