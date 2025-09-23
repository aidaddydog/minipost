# -*- coding: utf-8 -*-
from fastapi import FastAPI
from fastapi.responses import JSONResponse
import logging

log = logging.getLogger("uvicorn.error")
app = FastAPI(title="minipost API")

@app.get("/healthz", include_in_schema=False)
async def healthz():
    return {"ok": True}

@app.on_event("startup")
async def on_startup():
    # 懒加载路由：导入失败只告警，不让进程退出（避免 ImportError 导致容器重启）
    try:
        from app.api.v1 import api_router
        app.include_router(api_router, prefix="/api")
        log.info("api_router mounted at /api")
    except Exception as e:
        log.warning("load api_router failed on startup: %s", e)
