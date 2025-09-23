from typing import Optional, Iterable, List, Tuple
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_

from app.domain.orders.models import Label, Waybill, Package, SalesOrder
from app.domain.orders.schemas import LabelRow, UploadLogRow

def _status_text(label_file: Optional[str], has_order: bool, transfer_no: Optional[str]) -> str:
    if transfer_no: return "已换单"
    if not has_order: return "待映射订单号"
    if not label_file: return "待导入面单"
    return "已预报"

async def fetch_label_list(db: AsyncSession, tenant_id: str, kw: Optional[str], page: int, page_size: int):
    # 仅演示性查询：Label left join Waybill + Package + SalesOrder
    stmt = (
        select(
            Label.id, Label.tracking_no, Label.label_file, Label.label_printed_at.label('printed_at'),
            Waybill.transport_mode, Waybill.id.label('waybill_id'),
            Package.id.label('package_id'), SalesOrder.order_no
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
            transport_mode=(r.transport_mode.value if hasattr(r.transport_mode, 'value') else r.transport_mode)
        ))
    # 简化分页返回
    return {"items": [x.dict() for x in out], "total": len(out), "page": page, "page_size": page_size}

async def fetch_upload_logs(db: AsyncSession, tenant_id: str, page: int, page_size: int):
    # 演示数据（真实实现请查询日志表）
    now = datetime.now(timezone.utc)
    sample = [
        UploadLogRow(id="1", time=now, file="upload_001.xlsx", type="面单文件", total=120, success=110, fail=10, operator="系统"),
        UploadLogRow(id="2", time=now, file="mapping_2025-09-23.csv", type="运单号", total=200, success=198, fail=2, operator="Jack"),
    ]
    return {"items": [x.dict() for x in sample], "total": len(sample), "page": 1, "page_size": len(sample)}
