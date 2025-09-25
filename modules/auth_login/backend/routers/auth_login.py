# -*- coding: utf-8 -*-
from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

templates = Jinja2Templates(directory="modules")
router = APIRouter()

@router.get("/login", response_class=HTMLResponse)
def page_login(request: Request):
    return templates.TemplateResponse("auth_login/frontend/templates/login.html", {"request": request})
