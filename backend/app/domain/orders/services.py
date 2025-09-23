from typing import Optional, List, Dict
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, insert
from app.domain.orders.models import Label, Waybill, Package, SalesOrder
from app.domain.orders.schemas import LabelRow, UploadLogRow

# —— 已有的列表/日志（保持你原来的风格） ——
def _status_text(label_file: Optional[str], has_order: bool, transfer_no: Optional[str]) -> str:
    if transfer_no: return "已换单"
    if not has_order: return "待映射订单号"
    if not label_file: return "待导入面单"
    return "已预报"

async def fetch_label_list(db: AsyncSession, tenant_id: str, kw: Optional[str], page: int, page_size: int):
    stmt = (
        select(
            Label.id, Label.tracking_no, Label.label_file, Label.label_printed_at.label("printed_at"),
            Waybill.transport_mode, Waybill.id.label("waybill_id"),
            Package.id.label("package_id"), SalesOrder.order_no
        )
        .select_from(Label)
        .join(Waybill, Waybill.tracking_no == Label.tracking_no, isouter=True)
        .join(Package, Package.id == Label.package_id, isouter=True)
        .join(SalesOrder, SalesOrder.id == Package.sales_order_id, isouter=True)
        .limit(page_size).offset((page-1)*page_size)
    )
    rows = (await db.execute(stmt)).all()
    out: List[LabelRow] = []
    for r in rows:
        status = _status_text(r.label_file, bool(r.order_no), None)
        out.append(LabelRow(
            id=str(r.id), order_no=r.order_no, tracking_no=r.tracking_no,
            transfer_waybill_no=None, label_file=r.label_file,
            status_text=status, created_at=None, printed_at=r.printed_at,
            transport_mode=(r.transport_mode.value if hasattr(r.transport_mode, "value") else r.transport_mode)
        ))
    return {"items": [x.dict() for x in out], "total": len(out), "page": page, "page_size": page_size}

async def fetch_upload_logs(db: AsyncSession, tenant_id: str, page: int, page_size: int):
    # 演示数据（真实实现请查询日志表）
    now = datetime.now(timezone.utc)
    sample = [
        UploadLogRow(id="1", time=now, file="upload_001.xlsx", type="面单文件", total=120, success=110, fail=10, operator="系统"),
        UploadLogRow(id="2", time=now, file="mapping_2025-09-23.csv", type="运单号", total=200, success=198, fail=2, operator="Jack"),
    ]
    return {"items": [x.dict() for x in sample], "total": len(sample), "page": 1, "page_size": len(sample)}

# —— 新增的“换单任务/审核/预览/提交”最小实现，避免导入期崩溃 ——
# 说明：用 integration_job 作为任务表（你在迁移 0001 里已建）。:contentReference[oaicite:15]{index=15}
from app.domain.orders.models import IntegrationJob  # 若模型名不同，请按你的 models 修正

async def fetch_switch_tasks(db: AsyncSession, tenant_id: str, kw: Optional[str], page: int, page_size: int) -> Dict:
    q = select(IntegrationJob).where(IntegrationJob.tenant_id == tenant_id).order_by(IntegrationJob.created_at.desc())
    rows = (await db.execute(q.limit(page_size).offset((page-1)*page_size))).scalars().all()
    items = []
    for r in rows:
        items.append({
            "id": r.id, "job_type": r.job_type, "exec_status": r.exec_status,
            "retry_count": r.retry_count, "last_error": r.last_error,
            "finished_at": r.finished_at.isoformat() if r.finished_at else None,
            "created_at": getattr(r, "created_at", None).isoformat() if getattr(r, "created_at", None) else None,
        })
    return {"items": items, "total": len(items), "page": page, "page_size": page_size}

async def fetch_switch_audits(db: AsyncSession, tenant_id: str, task_id: Optional[str], kw: Optional[str], page: int, page_size: int) -> Dict:
    # 这里先返回演示数据；后续可落到真实审核表
    now = datetime.now(timezone.utc)
    data = [{
        "id": f"audit-{i}", "task_id": task_id or "demo-task",
        "time": now.isoformat(), "operator": "system", "action": "预览/提交", "result": "success"
    } for i in range(1, 6)]
    return {"items": data, "total": len(data), "page": 1, "page_size": len(data)}

async def preview_switch(db: AsyncSession, tenant_id: str, kw: Optional[str]) -> Dict:
    # 返回一个最小预览摘要（真实逻辑：根据规则计算将要变更的条目）
    count = await db.scalar(select(func.count(Label.id))) or 0
    return {"will_preview": min(50, count), "hint": "这是演示预览，真实逻辑请后续补充。"}

async def commit_switch(db: AsyncSession, tenant_id: str, operator_id: Optional[str], kw: Optional[str]) -> Dict:
    # 最小提交：写一条 integration_job，标记 success
    values = dict(
        id=f"job-{int(datetime.now().timestamp())}",
        tenant_id=tenant_id, job_type="switch", exec_status="success",
        retry_count=0, last_error=None, payload={"kw": kw, "operator": operator_id}, finished_at=datetime.now(timezone.utc)
    )
    await db.execute(insert(IntegrationJob).values(**values))
    await db.commit()
    return {"ok": True, "job_id": values["id"]}
