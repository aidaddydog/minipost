from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import select, func, or_, and_
from datetime import datetime
from modules.label_upload.backend.models.upload_log import LabelUpload, UploadLog

STATUS_ORDER = { '已预报':0, '待换单':1, '待导入面单':2, '待映射订单号':3, '已换单':4 }

def list_labels(
    db: Session,
    time_field: str = "created",
    start: Optional[datetime]=None,
    end: Optional[datetime]=None,
    status: Optional[str]=None,
    ship: Optional[str]=None,
    kw: Optional[str]=None,
    sort_key: str="status",
    sort_dir: str="asc",
    page: int=1, page_size: int=50
) -> Tuple[int, List[LabelUpload]]:
    q = select(LabelUpload)
    if time_field == "printed":
        if start:
            q = q.where(LabelUpload.printed_at.is_not(None), LabelUpload.printed_at >= start)
        if end:
            q = q.where(LabelUpload.printed_at.is_not(None), LabelUpload.printed_at <= end)
    else:
        if start:
            q = q.where(LabelUpload.created_at >= start)
        if end:
            q = q.where(LabelUpload.created_at <= end)

    if status:
        if status == "已作废":
            q = q.where(LabelUpload.voided.is_(True))
        else:
            q = q.where(LabelUpload.status == status)
    if ship:
        q = q.where(LabelUpload.ship == ship)
    if kw:
        like = f"%{kw}%"
        q = q.where(or_(LabelUpload.order_no.ilike(like), LabelUpload.waybill.ilike(like), LabelUpload.trans_no.ilike(like)))

    if sort_key == "time":
        col = LabelUpload.printed_at if time_field == "printed" else LabelUpload.created_at
        if sort_dir == "desc":
            q = q.order_by(col.desc().nullslast())
        else:
            q = q.order_by(col.asc().nullsfirst())
    else:
        # status 排序
        # 使用 CASE WHEN
        case_expr = func.coalesce(func.nullif(LabelUpload.status, ""), "已预报")
        # simple emulate by two-level: status asc then created_at desc
        q = q.order_by(LabelUpload.status.asc())

    total = db.execute(select(func.count()).select_from(q.subquery())).scalar_one()
    rows = db.execute(q.offset((page-1)*page_size).limit(page_size)).scalars().all()
    return total, rows

def list_logs(
    db: Session,
    start: Optional[datetime]=None,
    end: Optional[datetime]=None,
    page: int=1, page_size: int=50
) -> Tuple[int, List[UploadLog]]:
    q = select(UploadLog)
    if start:
        q = q.where(UploadLog.time >= start)
    if end:
        q = q.where(UploadLog.time <= end)
    q = q.order_by(UploadLog.time.desc())
    total = db.execute(select(func.count()).select_from(q.subquery())).scalar_one()
    rows = db.execute(q.offset((page-1)*page_size).limit(page_size)).scalars().all()
    return total, rows
