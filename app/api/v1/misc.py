from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
from ...core.deps import get_db
from ...models.tables import MetaKV, TrackingFile, OrderMapping, ClientAuth
from ...services.misc_service import canon_tracking
import os
from datetime import datetime

router = APIRouter(prefix="", tags=["misc"])

@router.get("/version")
def version(code: str = Query("")):
    # 简化：仅返回版本号字符串（无需校验 code 亦可）
    return {"server": "server-20250921", "client_recommend": "client-20250916b"}

@router.get("/mapping")
def mapping():
    # 并集：OrderMapping ∪ TrackingFile（保持与旧版思路一致）
    from ...models.tables import OrderMapping, TrackingFile, MetaKV
    from sqlalchemy.orm import Session
    from ...core.deps import get_db
    from fastapi import Depends
    from ...services.misc_service import canon_tracking
    from datetime import datetime
    def to_iso(dt):
        if not dt: return None
        try: return (dt if isinstance(dt, datetime) else datetime.fromisoformat(str(dt))).isoformat(timespec='seconds')
        except Exception: return None
    db_dep = get_db
    def _impl(db: Session):
        map_rows = db.query(OrderMapping).all()
        file_rows = db.query(TrackingFile).all()
        tf_by_tn = {f.tracking_no: f for f in file_rows}
        payload, seen = [], set()
        for r in map_rows:
            tn_norm = canon_tracking(r.tracking_no or '')
            tf = tf_by_tn.get(tn_norm) or tf_by_tn.get(r.tracking_no or '')
            u = r.updated_at
            if tf and tf.uploaded_at:
                u = max([x for x in (u, tf.uploaded_at) if x is not None])
            payload.append({"order_id": r.order_id, "tracking_no": tn_norm, "updated_at": to_iso(u)})
            seen.add(tn_norm)
        for f in file_rows:
            tn_norm = canon_tracking(f.tracking_no or '')
            if tn_norm in seen: continue
            payload.append({"order_id": "", "tracking_no": tn_norm, "updated_at": to_iso(f.uploaded_at)})
        # 版本
        ver = db.get(MetaKV, 'mapping_version').value if db.get(MetaKV, 'mapping_version') else None
        return {"version": ver or to_iso(datetime.utcnow()), "mappings": payload}
    # 无法在装饰器外直接使用 Depends，这里手动获取 db
    from ...core.deps import SessionLocal
    db = SessionLocal()
    try:
        return _impl(db)
    finally:
        db.close()

@router.get("/file/{tracking_no}")
def file_by_tracking(tracking_no: str):
    # 流式返回 PDF
    from fastapi.responses import FileResponse
    from ...services.labels_service import PDF_DIR
    t = canon_tracking(tracking_no)
    fp = os.path.join(PDF_DIR, f"{t}.pdf")
    if not os.path.exists(fp):
        raise HTTPException(status_code=404, detail="file not found")
    return FileResponse(fp, media_type="application/pdf", filename=os.path.basename(fp))

@router.get("/runtime/sumatra")
def runtime_sumatra(arch: str = "win64"):
    # 预留：可将 Sumatra 安装包放入 runtime/ 并开放下载
    from fastapi.responses import FileResponse
    RUNTIME_DIR = os.path.join(os.path.dirname(__file__), '..','..','..','runtime')
    fname = "SumatraPDF-3.5.2-64.exe" if arch=="win64" else "SumatraPDF-3.5.2-32.exe"
    fp = os.path.join(RUNTIME_DIR, fname)
    if not os.path.exists(fp):
        raise HTTPException(status_code=404, detail="runtime not found on server")
    return FileResponse(fp, media_type="application/octet-stream", filename=fname)
