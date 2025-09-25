# -*- coding: utf-8 -*-
from fastapi import APIRouter
from fastapi.responses import HTMLResponse
from pathlib import Path

router = APIRouter()

TEMPLATES = Path(__file__).resolve().parents[2] / "frontend" / "templates"

@router.get("/orders/label-upload/list", response_class=HTMLResponse)
def label_list():
    # 像素级复刻：直接使用你提供的 UI HTML（已内联 CSS/JS）
    html = (TEMPLATES / "label_upload_list.html").read_text(encoding="utf-8")
    return HTMLResponse(html)

@router.get("/orders/label-upload/logs", response_class=HTMLResponse)
def label_logs():
    html = (TEMPLATES / "label_upload_logs.html").read_text(encoding="utf-8")
    return HTMLResponse(html)
