# -*- coding: utf-8 -*-
from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from app.main import render_template
router = APIRouter()
@router.get("/auth/login", response_class=HTMLResponse)
def page_login(request: Request):
    return render_template("auth_login.html", request, MINIPOST_INIT={"locked_path":"/orders","locked_sub":"/orders/label-upload","locked_tab":"/orders/label-upload/list"})
