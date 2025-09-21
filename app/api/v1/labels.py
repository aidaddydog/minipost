from fastapi import APIRouter, Depends, UploadFile, File, Query, HTTPException, Request
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
from ...core.deps import get_db
from ...models.schemas import Paged
from ...models.tables import OrderMapping, TrackingFile, UploadLog, VoidedItem
from ...services.labels_service import import_label_files, set_voided
from ...services.misc_service import canon_tracking
import math, os

router = APIRouter(prefix="/labels", tags=["labels"])

@router.get("/list", response_model=Paged)
def list_labels(q: Optional[str]=None,
                time_field: str = Query("created"),
                start: Optional[str] = None,
                end: Optional[str] = None,
                status: Optional[str] = None,
                ship: Optional[str] = None,
                page: int = 1, size: int = 50,
                db: Session = Depends(get_db)):
    # 合成列表：以 tracking_file 为主，左联 order_mapping
    # 过滤/排序在服务器端完成，前端直接渲染
    base = db.query(TrackingFile)
    items = []
    q_lc = (q or "").lower().strip()
    # 时间窗口
    def in_time(dt: datetime) -> bool:
        if not dt: return True
        if start:
            st = datetime.fromisoformat(start) if 'T' in start else datetime.fromisoformat(start + 'T00:00:00')
            if dt < st: return False
        if end:
            et = datetime.fromisoformat(end) if 'T' in end else datetime.fromisoformat(end + 'T23:59:59')
            if dt > et: return False
        return True

    for tf in base.all():
        tr = tf.tracking_no
        mp = db.get(OrderMapping, tf.tracking_no)  # 注意：旧表以 order_id 为主键；此处反查时可以遍历或加索引
        order_no = mp.order_id if mp and mp.tracking_no==tr else None
        file_exist = os.path.exists(tf.file_path or '')
        st_txt = "已换单" if file_exist and order_no else ("待导入面单" if order_no and not file_exist else "待映射订单号")
        vd = db.get(VoidedItem, tr)
        items.append({
            "id": hash(tr) % (10**9),
            "orderNo": order_no, "waybill": tr, "transNo": "", "ship":"", 
            "file": os.path.basename(tf.file_path) if file_exist else "",
            "status": st_txt + ("｜已作废" if (vd and vd.voided) else ""),
            "createdAt": tf.uploaded_at, "printedAt": None, "voided": bool(vd.voided) if vd else False
        })
    # 关键字过滤
    if q_lc:
        keys = q_lc.split()
        def hit(x):
            hay = f"{x['orderNo'] or ''} {x['waybill']} {x['transNo']}".lower()
            return any(k in hay for k in keys)
        items = list(filter(hit, items))
    total = len(items)
    # 排序：时间倒序
    items.sort(key=lambda x: (x['createdAt'] or datetime.min), reverse=True)
    # 分页
    start_idx = (page-1)*size; end_idx = start_idx + size
    return {"total": total, "page": page, "size": size, "items": items[start_idx:end_idx]}

@router.post("/import")
async def import_labels(file: UploadFile = File(...), db: Session = Depends(get_db)):
    b = await file.read()
    try:
        res = import_label_files(db, b, file.filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return res

@router.post("/import-mapping")
async def import_mapping(file: UploadFile = File(...),
                         order_col: str = "订单号",
                         tracking_col: str = "运单号",
                         db: Session = Depends(get_db)):
    from ...services.orders_service import import_orders_mapping
    b = await file.read()
    try:
        res = import_orders_mapping(db, b, file.filename, order_col, tracking_col)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return res

@router.post("/bulk-void")
def bulk_void(tracking_nos: List[str], voided: bool = True, db: Session = Depends(get_db)):
    set_voided(db, tracking_nos, voided)
    return {"ok": True, "count": len(tracking_nos)}

@router.get("/logs", response_model=Paged)
def logs(page: int=1, size: int=50, start: str | None = None, end: str | None = None, db: Session = Depends(get_db)):
    q = db.query(UploadLog)
    if start:
        q = q.filter(UploadLog.created_at >= datetime.fromisoformat(start))
    if end:
        q = q.filter(UploadLog.created_at <= datetime.fromisoformat(end))
    q = q.order_by(UploadLog.created_at.desc())
    total = q.count()
    rows = q.offset((page-1)*size).limit(size).all()
    items = []
    for r in rows:
        items.append({
            "id": r.id, "time": r.created_at.strftime("%Y-%m-%d %H:%M"),
            "file": r.file_name, "type": r.upload_type, "total": r.total,
            "success": r.success, "fail": r.fail, "operator": r.operator
        })
    return {"total": total, "page": page, "size": size, "items": items}


@router.get("/logs/{log_id}/detail")
def log_detail(log_id: int, mode: str = "fail", db: Session = Depends(get_db)):
    log = db.get(UploadLog, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="log not found")
    txt = log.success_nos if mode=='success' else log.fail_nos
    return {"id": log_id, "mode": mode, "list": txt or ""}
