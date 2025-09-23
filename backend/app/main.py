# -*- coding: utf-8 -*-
from fastapi import FastAPI
from fastapi.responses import JSONResponse
import logging

from .db import ping_db

log = logging.getLogger("uvicorn.error")

app = FastAPI(title="minipost API")

@app.get("/healthz", include_in_schema=False)
async def healthz():
    try:
        await ping_db()
        return {"ok": True}
    except Exception as e:
        # 健康检查非致命：返回 500 也不让进程崩
        return JSONResponse({"ok": False, "err": str(e)}, status_code=500)

@app.on_event("startup")
async def on_startup():
    # 启动阶段做一次非致命 ping，失败仅日志告警
    try:
        await ping_db()
        log.info("DB ping ok")
    except Exception as e:
        log.warning("DB ping failed on startup: %s", e)
