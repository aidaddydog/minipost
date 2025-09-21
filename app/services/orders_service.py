import os, io, re
import pandas as pd
from sqlalchemy.orm import Session
from datetime import datetime
from ..models.tables import OrderMapping, UploadLog

def import_orders_mapping(db: Session, file_bytes: bytes, filename: str, order_col: str, tracking_col: str) -> dict:
    # 解析 CSV/XLSX
    buf = io.BytesIO(file_bytes)
    if filename.lower().endswith('.csv'):
        df = pd.read_csv(buf, dtype=str)
    else:
        df = pd.read_excel(buf, dtype=str)
    df = df.fillna('')
    total = 0; succ=0; fail=0
    success_nos = []; fail_nos = []
    for _, row in df.iterrows():
        order = str(row.get(order_col,'' )).strip()
        tracking = re.sub(r'[^A-Za-z0-9]+','', str(row.get(tracking_col,'')).strip())
        if not order or not tracking:
            fail += 1; continue
        rec = db.get(OrderMapping, order)
        if not rec:
            rec = OrderMapping(order_id=order, tracking_no=tracking, updated_at=datetime.utcnow()); db.add(rec)
        else:
            rec.tracking_no = tracking; rec.updated_at = datetime.utcnow()
        succ += 1; total += 1
        success_nos.append(tracking)
    db.commit()
    # 记录上传日志
    log = UploadLog(file_name=filename, upload_type='运单号',
                    total=len(df), success=succ, fail=(len(df)-succ),
                    operator='系统', success_nos='\n'.join(success_nos), fail_nos='\n'.join(fail_nos))
    db.add(log); db.commit()
    return {"total": len(df), "success": succ, "fail": (len(df)-succ)}
