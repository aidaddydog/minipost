import os, re, json, shutil
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from ..models.tables import MetaKV, TrackingFile

def get_kv(db: Session, key: str, default: str = '') -> str:
    rec = db.get(MetaKV, key)
    return rec.value if rec else default

def set_kv(db: Session, key: str, value: str):
    rec = db.get(MetaKV, key)
    if not rec:
        rec = MetaKV(key=key, value=str(value)); db.add(rec)
    else:
        rec.value = str(value)
    db.commit()

def canon_tracking(tr: str) -> str:
    # 与旧版保持一致的“清洗”策略（只保留字母/数字）
    return re.sub(r'[^A-Za-z0-9]+','', tr or '').strip()

def find_pdf_by_tracking(root: str, tracking_no: str) -> str | None:
    cand = [tracking_no, canon_tracking(tracking_no)]
    for t in cand:
        fp = os.path.join(root, f"{t}.pdf")
        if os.path.exists(fp): return fp
    return None
