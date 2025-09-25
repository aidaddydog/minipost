from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional, List
from app.db import get_db
from modules.label_upload.backend.services.public_service import list_labels, list_logs
from modules.label_upload.backend.models.upload_log import LabelUpload, UploadLog
from sqlalchemy import select
from pathlib import Path

router = APIRouter()

def parse_dt(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        # 允许 "YYYY-MM-DDTHH:MM" 或 ISO8601
        return datetime.fromisoformat(s.replace("Z","").replace("z",""))
    except Exception:
        return None

@router.get("/list")
def api_label_list(
    time_field: str = Query("created", pattern="^(created|printed)$"),
    start: Optional[str] = None,
    end: Optional[str] = None,
    status: Optional[str] = None,
    ship: Optional[str] = None,
    kw: Optional[str] = None,
    sort_key: str = Query("status", pattern="^(status|time)$"),
    sort_dir: str = Query("asc", pattern="^(asc|desc)$"),
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db)
):
    total, rows = list_labels(
        db,
        time_field=time_field,
        start=parse_dt(start), end=parse_dt(end),
        status=status, ship=ship, kw=kw,
        sort_key=sort_key, sort_dir=sort_dir,
        page=page, page_size=page_size
    )
    items = []
    for r in rows:
        items.append({
            "id": str(r.id), "orderNo": r.order_no, "waybill": r.waybill, "transNo": r.trans_no,
            "ship": r.ship, "file": r.file, "status": r.status,
            "createdAt": r.created_at.isoformat(sep=" ", timespec="seconds") if r.created_at else None,
            "printedAt": r.printed_at.isoformat(sep=" ", timespec="seconds") if r.printed_at else None,
            "voided": r.voided
        })
    return {"total": total, "items": items}

@router.get("/logs")
def api_logs(
    start: Optional[str] = None,
    end: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db)
):
    total, rows = list_logs(db, start=parse_dt(start), end=parse_dt(end), page=page, page_size=page_size)
    items = []
    for r in rows:
        items.append({
            "id": str(r.id),
            "time": r.time.isoformat(sep=" ", timespec="minutes"),
            "file": r.file, "type": r.type,
            "total": r.total, "success": r.success, "fail": r.fail,
            "operator": r.operator,
        })
    return {"total": total, "items": items}

@router.get("/logs/{log_id}")
def api_log_detail(log_id: str, db: Session = Depends(get_db), mode: str = Query("fail", pattern="^(fail|success)$")):
    from uuid import UUID
    try:
        u = UUID(log_id)
    except Exception:
        raise HTTPException(status_code=400, detail="log_id 错误")
    row = db.execute(select(UploadLog).where(UploadLog.id == u)).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="日志不存在")
    txt = row.fail_nos if mode=="fail" else row.success_nos
    return {"items": [s for s in (txt or "").splitlines() if s.strip()]}

@router.get("/file/{label_id}")
def api_label_file(label_id: str, db: Session = Depends(get_db)):
    from uuid import UUID
    from sqlalchemy import select
    from fastapi import Response
    r = db.execute(select(LabelUpload).where(LabelUpload.id == UUID(label_id))).scalar_one_or_none()
    if not r or not r.file:
        raise HTTPException(status_code=404, detail="文件不存在")
    p = Path(r.file)
    if not p.exists():
        raise HTTPException(status_code=404, detail="文件缺失")
    # 直接下载
    return Response(p.read_bytes(), media_type="application/octet-stream", headers={"Content-Disposition": f'inline; filename="{p.name}"'})


@router.get("/zips")
def api_label_zips():
    import os
    from pathlib import Path
    base = Path(__file__).resolve().parents[3] / "uploads"
    items = []
    if base.exists():
        for p in sorted(base.glob("*.zip")):
            items.append({"name": p.name, "size": p.stat().st_size, "mtime": p.stat().st_mtime})
    return {"items": items}
