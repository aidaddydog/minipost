# -*- coding: utf-8 -*-
from fastapi import APIRouter
from fastapi.responses import HTMLResponse
from pathlib import Path

router = APIRouter()
TEMPLATES = Path(__file__).resolve().parents[2] / "frontend" / "templates"

@router.get("/logistics/channels", response_class=HTMLResponse)
def channels():
    # 占位页面（保持结构完整；后续可替换为对应模板）
    html = (TEMPLATES / "logistics_platform.html").read_text(encoding="utf-8")
    return HTMLResponse(html)
