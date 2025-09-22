from fastapi import APIRouter, Depends
from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.services.order_service import seed_demo_if_empty
from app.services.upload_service import list_upload_logs

router = APIRouter()

@router.get("")
def logs_list(start: Optional[str] = None, end: Optional[str] = None, db: Session = Depends(get_db)):
    seed_demo_if_empty(db)  # 保证有数据可看
    sdt = datetime.fromisoformat(start) if start else None
    edt = datetime.fromisoformat(end) if end else None
    rows = list_upload_logs(db, sdt, edt)
    def as_dict(r):
        return {
            "id": r.id,
            "time": r.time.isoformat(timespec="minutes"),
            "file": r.file,
            "type": r.type,
            "total": r.total,
            "success": r.success,
            "fail": r.fail,
            "operator": r.operator,
            "successNos": r.success_nos or [],
            "failNos": r.fail_nos or []
        }
    return {"items": [as_dict(x) for x in rows]}
