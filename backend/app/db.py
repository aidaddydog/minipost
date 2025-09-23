# -*- coding: utf-8 -*-
import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import text

# 从环境获取异步驱动 URL（运行期使用 asyncpg）
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://minipost:minipost@db:5432/minipost")

# 惰性引擎：不要在导入阶段就去连库
engine = create_async_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)

SessionLocal = async_sessionmaker(engine, expire_on_commit=False)

async def ping_db():
    """轻量 ping，一旦失败不让进程退出（避免容器重启）"""
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
