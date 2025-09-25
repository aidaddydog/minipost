from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, delete, update
from pathlib import Path
from typing import List, Optional
import datetime as dt
import io, csv

from app.db import get_db
from modules.label_upload.backend.models.upload_log import LabelUpload, UploadLog

BASE_UPLOAD = Path(__file__).resolve().parents[3] / "uploads"

router = APIRouter()

def save_upload(file: UploadFile, dest_dir: Path) -> Path:
    dest_dir.mkdir(parents=True, exist_ok=True)
    name = file.filename or "upload.bin"
    # 防止重复
    stamp = dt.datetime.utcnow().strftime("%Y%m%d%H%M%S")
    path = dest_dir / f"{stamp}_{name}"
    with path.open("wb") as f:
        f.write(file.file.read())
    return path

@router.post("/import-label")
async def import_label(files: List[UploadFile] = File(...), operator: str = Form("系统"), db: Session = Depends(get_db)):
    if not files:
        raise HTTPException(status_code=400, detail="未选择文件")

    ok, fail = [], []
    for f in files:
        try:
            p = save_upload(f, BASE_UPLOAD)
            # 简化：按文件名推断 waybill（去后缀）
            waybill = Path(f.filename).stem
            row = LabelUpload(waybill=waybill, status="待映射订单号", file=str(p))
            db.add(row)
            ok.append(waybill)
        except Exception as e:
            fail.append(f.filename or "unknown")

    db.flush()
    log = UploadLog(file=f"批量{len(files)}文件", type="面单文件", total=len(files), success=len(ok), fail=len(fail), operator=operator,
                    success_nos="\n".join(ok), fail_nos="\n".join(fail))
    db.add(log)
    db.commit()
    return {"ok": True, "success": len(ok), "fail": len(fail), "log_id": str(log.id)}

@router.post("/import-map")
async def import_map(file: UploadFile = File(...), operator: str = Form("系统"), db: Session = Depends(get_db)):
    content = file.file.read()
    txt = None
    try:
        txt = content.decode("utf-8")
    except Exception:
        try:
            txt = content.decode("gbk")
        except Exception:
            txt = content.decode("latin1", errors="ignore")

    ok, fail = [], []
    reader = csv.reader(io.StringIO(txt))
    for row in reader:
        if not row:
            continue
        # 兼容：waybill,order_no,trans_no 可 2~3 列
        waybill = (row[0] or "").strip()
        order_no = (row[1] or "").strip() if len(row) >= 2 else ""
        trans_no = (row[2] or "").strip() if len(row) >= 3 else ""
        if not waybill:
            continue
        q = db.execute(select(LabelUpload).where(LabelUpload.waybill == waybill)).scalar_one_or_none()
        if not q:
            fail.append(waybill); continue
        q.order_no = order_no
        if trans_no:
            q.trans_no = trans_no
        q.status = "待导入面单" if not q.file else "已预报"
        ok.append(waybill)
    db.flush()
    log = UploadLog(file=file.filename or "映射导入", type="映射", total=len(ok)+len(fail), success=len(ok), fail=len(fail), operator=operator,
                    success_nos="\n".join(ok), fail_nos="\n".join(fail))
    db.add(log)
    db.commit()
    return {"ok": True, "success": len(ok), "fail": len(fail), "log_id": str(log.id)}

@router.post("/batch-void")
def batch_void(ids: List[str], voided: bool = True, db: Session = Depends(get_db)):
    from uuid import UUID
    changed = 0
    for sid in ids:
        try:
            u = UUID(sid)
        except Exception:
            continue
        q = db.execute(select(LabelUpload).where(LabelUpload.id == u)).scalar_one_or_none()
        if q:
            q.voided = voided
            changed += 1
    db.commit()
    return {"ok": True, "changed": changed}

@router.post("/batch-delete")
def batch_delete(ids: List[str], db: Session = Depends(get_db)):
    from uuid import UUID
    removed = 0
    for sid in ids:
        try:
            u = UUID(sid)
        except Exception:
            continue
        q = db.execute(select(LabelUpload).where(LabelUpload.id == u)).scalar_one_or_none()
        if q:
            db.delete(q)
            removed += 1
    db.commit()
    return {"ok": True, "removed": removed}
