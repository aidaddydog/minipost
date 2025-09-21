
# -*- coding: utf-8 -*-
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.entities import OrderMapping, TrackingFile

def mapping_version(db: Session) -> int:
    # 用 meta 中的 mapping_version 作为版本号，不存在则根据记录数生成
    from app.services.meta_service import get_kv, set_kv
    v = get_kv(db, "mapping_version", None)
    if v is None:
        cnt = db.query(func.count(OrderMapping.tracking_no)).scalar() or 0
        v = str(cnt)
        set_kv(db, "mapping_version", v)
    return int(v) if str(v).isdigit() else 0

def build_mapping_payload(db: Session) -> Dict[str, Any]:
    # 将 OrderMapping + TrackingFile 打包为客户端可用的映射 JSON
    items = (
        db.query(OrderMapping.tracking_no, OrderMapping.order_no, TrackingFile.file_path)
          .outerjoin(TrackingFile, TrackingFile.tracking_no==OrderMapping.tracking_no)
          .all()
    )
    mapping = { t: {"order_no": o or "", "file": f or ""} for (t, o, f) in items }
    return {"version": mapping_version(db), "count": len(mapping), "mapping": mapping}

def find_file_path(db: Session, tracking_no: str) -> Optional[str]:
    row = db.query(TrackingFile).filter(TrackingFile.tracking_no==tracking_no).first()
    return row.file_path if row else None
