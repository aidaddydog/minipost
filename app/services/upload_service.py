from typing import List, Tuple
from sqlalchemy.orm import Session
from datetime import datetime
from app.models.upload_log import UploadLog

def add_upload_log(db: Session, *, file: str, type_: str, total: int, success: int, fail: int, operator: str, success_nos: List[str], fail_nos: List[str]):
    log = UploadLog(
        time=datetime.utcnow(), file=file, type=type_, total=total, success=success, fail=fail,
        operator=operator, success_nos=success_nos, fail_nos=fail_nos
    )
    db.add(log); db.commit(); db.refresh(log)
    return log

def list_upload_logs(db: Session, start: datetime = None, end: datetime = None) -> List[UploadLog]:
    from sqlalchemy import select, desc
    q = select(UploadLog).order_by(desc(UploadLog.time))
    if start: q = q.where(UploadLog.time >= start)
    if end:   q = q.where(UploadLog.time <= end)
    return db.execute(q).scalars().all()
