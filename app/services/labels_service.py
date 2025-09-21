import os, zipfile, re, io, shutil
from datetime import datetime
from typing import Iterable
from sqlalchemy.orm import Session
from ..models.tables import TrackingFile, OrderMapping, UploadLog, VoidedItem
from .misc_service import canon_tracking

DATA_DIR = os.environ.get('MINIPOST_DATA') or os.environ.get('HUANDAN_DATA') or '/opt/huandan-data'
PDF_DIR = os.path.join(DATA_DIR, 'pdfs')
os.makedirs(PDF_DIR, exist_ok=True)

def _save_pdf(db: Session, tracking_no: str, file_bytes: bytes) -> str:
    t = canon_tracking(tracking_no)
    if not t: raise ValueError("invalid tracking")
    target = os.path.join(PDF_DIR, f"{t}.pdf")
    with open(target, 'wb') as f:
        f.write(file_bytes)
    rec = db.get(TrackingFile, t)
    if not rec:
        rec = TrackingFile(tracking_no=t, file_path=target, uploaded_at=datetime.utcnow()); db.add(rec)
    else:
        rec.file_path = target; rec.uploaded_at = datetime.utcnow()
    db.commit()
    return target

def import_label_files(db: Session, file_bytes: bytes, filename: str) -> dict:
    # 支持 PDF 或 ZIP（ZIP 中包含多个 PDF；文件名即运单号）
    saved = 0; skipped = 0; succ_list = []; fail_list = []
    if filename.lower().endswith('.zip'):
        zf = zipfile.ZipFile(io.BytesIO(file_bytes))
        for nm in zf.namelist():
            if nm.endswith('/'): continue
            base = os.path.basename(nm)
            if not base.lower().endswith('.pdf'): continue
            tr = re.sub(r'\.pdf$','', base, flags=re.I)
            try:
                _save_pdf(db, tr, zf.read(nm)); saved += 1; succ_list.append(tr)
            except Exception:
                skipped += 1; fail_list.append(tr)
    elif filename.lower().endswith('.pdf'):
        tr = re.sub(r'\.pdf$','', os.path.basename(filename), flags=re.I)
        _save_pdf(db, tr, file_bytes); saved = 1; succ_list.append(tr)
    else:
        raise ValueError("仅支持 PDF 或 ZIP")
    # 写日志
    log = UploadLog(file_name=filename, upload_type='面单文件',
                    total=saved+skipped, success=saved, fail=skipped,
                    operator='系统', success_nos='\n'.join(succ_list), fail_nos='\n'.join(fail_list))
    db.add(log); db.commit()
    return {"saved": saved, "skipped": skipped}

def set_voided(db: Session, tracking_nos: Iterable[str], voided: bool):
    for tr in tracking_nos:
        t = canon_tracking(tr)
        if not t: continue
        rec = db.get(VoidedItem, t)
        if not rec:
            rec = VoidedItem(tracking_no=t, voided=voided); db.add(rec)
        else:
            rec.voided = voided
    db.commit()
