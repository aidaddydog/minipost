
# -*- coding: utf-8 -*-
from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.services.meta_service import get_kv
from app.services.orders_service import build_mapping_payload

router = APIRouter()

@router.get("/admin", response_class=HTMLResponse)
def admin_dashboard(request: Request, db: Session = Depends(get_db)):
    return templates.TemplateResponse("admin/dashboard.html", {"request": request})

@router.get("/admin/orders/label-upload", response_class=HTMLResponse)
def admin_label_upload_list(request: Request):
    # 默认进入“面单列表”三级页签
    return templates.TemplateResponse("admin/label_upload_list.html", {"request": request})

@router.get("/admin/orders/label-upload/logs", response_class=HTMLResponse)
def admin_label_upload_logs(request: Request):
    return templates.TemplateResponse("admin/label_upload_logs.html", {"request": request})

@router.get("/admin/update", response_class=HTMLResponse)
def admin_update(request: Request):
    return templates.TemplateResponse("admin/update.html", {"request": request})

@router.get("/admin/settings/system", response_class=HTMLResponse)
def admin_settings_system(request: Request):
    return templates.TemplateResponse("admin/settings_system.html", {"request": request})

