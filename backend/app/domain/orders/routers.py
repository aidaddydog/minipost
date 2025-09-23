from fastapi import APIRouter, Depends, Request, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal
from app.domain.orders.services import (
    fetch_label_list, fetch_upload_logs, fetch_switch_tasks, fetch_switch_audits,
    preview_switch, commit_switch
)

router = APIRouter(prefix="/orders", tags=["orders"])
async def get_db():
    async with AsyncSessionLocal() as s: yield s

@router.get("/label-upload/list")
async def label_upload_list(request: Request, db: AsyncSession = Depends(get_db),
                            kw: str | None = Query(default=None), page: int = 1, page_size: int = 50):
    return await fetch_label_list(db, request.state.tenant_id, kw, page, page_size)

@router.get("/label-upload/logs")
async def label_upload_logs(request: Request, db: AsyncSession = Depends(get_db),
                            page: int = 1, page_size: int = 50):
    return await fetch_upload_logs(db, request.state.tenant_id, page, page_size)

@router.get("/label-upload/tasks")
async def label_upload_tasks(request: Request, db: AsyncSession = Depends(get_db),
                             kw: str | None = Query(default=None), page: int = 1, page_size: int = 50):
    return await fetch_switch_tasks(db, request.state.tenant_id, kw, page, page_size)

@router.get("/label-upload/audit")
async def label_upload_audit(request: Request, db: AsyncSession = Depends(get_db),
                             task_id: str | None = Query(default=None),
                             kw: str | None = Query(default=None),
                             page: int = 1, page_size: int = 50):
    return await fetch_switch_audits(db, request.state.tenant_id, task_id, kw, page, page_size)

@router.post("/label-upload/switch/preview")
async def switch_preview_api(request: Request, db: AsyncSession = Depends(get_db),
                             kw: str | None = Body(default=None, embed=True)):
    return await preview_switch(db, request.state.tenant_id, kw)

@router.post("/label-upload/switch/commit")
async def switch_commit_api(request: Request, db: AsyncSession = Depends(get_db),
                            kw: str | None = Body(default=None, embed=True),
                            operator_id: str | None = Body(default=None, embed=True)):
    return await commit_switch(db, request.state.tenant_id, operator_id, kw)
