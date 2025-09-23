#!/usr/bin/env bash
set -e
# 首跑建表（PoC友好；后续可切换 Alembic）
python - <<'PY'
import asyncio
from app.core.database import engine
from app.common.models_base import Base
# 导入模型以确保注册到元数据
from app.domain.orders.models import SalesOrder, Package, Waybill, Label
from app.domain.integration.models import IntegrationJob
from app.domain.logistics.switch_models import SwitchRule, SwitchTask, SwitchAudit
async def run():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
asyncio.run(run())
PY
# 启动 API
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
