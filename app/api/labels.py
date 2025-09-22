from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from typing import List, Optional
from datetime import datetime
from app.core.db import get_db, SessionLocal
from sqlalchemy.orm import Session
from app.services.order_service import list_orders, seed_demo_if_empty, toggle_void, delete_orders
from app.services.upload_service import add_upload_log

router = APIRouter()

@router.get("")
def labels_list(
    page: int = 1, size: int = 50,
    time_field: str = "created",
    start: Optional[str] = None, end: Optional[str] = None,
    status: Optional[str] = None, ship: Optional[str] = None, kw: Optional[str] = None,
    sort_key: str = "status", sort_dir: str = "asc",
    db: Session = Depends(get_db)
):
    seed_demo_if_empty(db)
    sdt = datetime.fromisoformat(start) if start else None
    edt = datetime.fromisoformat(end) if end else None
    total, rows = list_orders(db, page=page, size=size, time_field=time_field, start=sdt, end=edt,
                              status=status, ship=ship, kw=kw, sort_key=sort_key, sort_dir=sort_dir)
    def as_dict(o):
        return {
            "id": o.id,
            "orderNo": o.order_no,
            "waybill": o.waybill_no,
            "transNo": o.trans_no,
            "ship": o.ship,
            "file": o.file or "",
            "status": o.status,
            "createdAt": o.created_at.isoformat() if o.created_at else None,
            "printedAt": o.printed_at.isoformat() if o.printed_at else None,
            "voided": bool(o.voided)
        }
    return {"total": total, "items": [as_dict(x) for x in rows]}

@router.post("/upload-label")
async def upload_label(file: UploadFile = File(...), operator: str = Form("系统"), db: Session = Depends(get_db)):
    # 这里只记录日志，实际解析/入库你可按旧逻辑补充
    # 假定成功 100，失败 5
    log = add_upload_log(db, file=file.filename, type_="面单文件", total=105, success=100, fail=5, operator=operator,
                         success_nos=[], fail_nos=[])
    return {"ok": True, "logId": log.id}

@router.post("/upload-map")
async def upload_map(file: UploadFile = File(...), operator: str = Form("系统"), db: Session = Depends(get_db)):
    log = add_upload_log(db, file=file.filename, type_="运单号", total=200, success=180, fail=20, operator=operator,
                         success_nos=[], fail_nos=[])
    return {"ok": True, "logId": log.id}

@router.post("/batch-void")
def batch_void(ids: List[int], db: Session = Depends(get_db)):
    n = toggle_void(db, ids, True)
    return {"ok": True, "count": n}

@router.post("/batch-activate")
def batch_activate(ids: List[int], db: Session = Depends(get_db)):
    n = toggle_void(db, ids, False)
    return {"ok": True, "count": n}

@router.post("/batch-delete")
def batch_delete(ids: List[int], db: Session = Depends(get_db)):
    n = delete_orders(db, ids)
    return {"ok": True, "count": n}
