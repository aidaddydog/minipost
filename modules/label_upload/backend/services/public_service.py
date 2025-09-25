# -*- coding: utf-8 -*-
from sqlalchemy.orm import Session
from sqlalchemy import select, desc, asc
from fastapi import HTTPException
from typing import Dict, Any, List, Tuple

from .models.upload_log import UploadLog, Label, LabelZip

def paginate(q, page:int=1, page_size:int=20) -> Tuple[List, int]:
    total = q.count()
    rows = q.offset((page-1)*page_size).limit(page_size).all()
    return rows, total

def list_labels(db: Session, params: Dict[str, Any]):
    page = max(1, int(params.get("page", 1)))
    page_size = min(200, max(1, int(params.get("page_size", 20))))
    sort_by = params.get("sort_by", "created_at")
    sort_dir = params.get("sort_dir", "desc")
    q = db.query(Label)

    # TODO: 依据 time_field/start_at/end_at/status/transport_mode/q 等过滤（简化示例）
    if params.get("q"):
        kw = f"%{params['q']}%"
        q = q.filter((Label.order_no.ilike(kw)) | (Label.waybill.ilike(kw)) | (Label.transfer_no.ilike(kw)))
    if params.get("transport_mode"):
        q = q.filter(Label.transport_mode == params["transport_mode"])
    if params.get("status"):
        q = q.filter(Label.status == params["status"])

    # 排序
    col = Label.created_at if sort_by == "created_at" else Label.printed_at
    q = q.order_by(asc(col) if sort_dir == "asc" else desc(col))

    rows, total = paginate(q, page, page_size)
    def to_dict(r: Label):
        return {
            "id": r.id, "order_no": r.order_no, "waybill": r.waybill, "transfer_no": r.transfer_no,
            "transport_mode": r.transport_mode, "file_name": r.file_name or "",
            "status": r.status + ("｜已作废" if r.voided else ""),
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "printed_at": r.printed_at.isoformat() if r.printed_at else None,
            "voided": r.voided,
        }
    return {"page": page, "page_size": page_size, "total": total, "items": [to_dict(x) for x in rows]}

def list_logs(db: Session, params: Dict[str, Any]):
    page = max(1, int(params.get("page", 1)))
    page_size = min(200, max(1, int(params.get("page_size", 20))))
    q = db.query(UploadLog).order_by(desc(UploadLog.time))
    rows, total = paginate(q, page, page_size)
    def to_dict(r: UploadLog):
        return {"time": r.time.isoformat(), "file": r.file_name, "type": r.upload_type, "total": r.total, "success": r.success, "fail": r.fail, "operator": r.operator}
    return {"page": page, "page_size": page_size, "total": total, "items": [to_dict(x) for x in rows]}

def list_zips(db: Session, params: Dict[str, Any]):
    page = max(1, int(params.get("page", 1)))
    page_size = min(200, max(1, int(params.get("page_size", 20))))
    q = db.query(LabelZip).order_by(desc(LabelZip.date), desc(LabelZip.version))
    rows, total = paginate(q, page, page_size)
    def to_dict(r: LabelZip):
        return {"date": r.date, "version": r.version, "file_name": r.file_name, "size_bytes": r.size_bytes, "download_url": r.download_url, "checksum": r.checksum, "retention_days": r.retention_days}
    return {"page": page, "page_size": page_size, "total": total, "items": [to_dict(x) for x in rows]}
