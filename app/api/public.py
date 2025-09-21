
# -*- coding: utf-8 -*-
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse, FileResponse
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.services.auth_service import verify_code
from app.services.meta_service import get_kv
from app.services.orders_service import mapping_version, build_mapping_payload, find_file_path

router = APIRouter()

@router.get("/api/v1/version")
def api_version(code: str = Query(""), db: Session = Depends(get_db)):
    c = verify_code(db, code)
    if not c: 
        raise HTTPException(status_code=403, detail="invalid code")
    return JSONResponse({
        "version": mapping_version(db),
        "list_version": mapping_version(db),
        "server_version": get_kv(db, "server_version", "server-20250916b"),
        "client_recommend": get_kv(db, "client_recommend", "client-20250916b"),
    })

@router.get("/api/v1/mapping")
def api_mapping(code: str = Query(""), db: Session = Depends(get_db)):
    c = verify_code(db, code)
    if not c:
        raise HTTPException(status_code=403, detail="invalid code")
    return build_mapping_payload(db)

@router.get("/api/v1/file/{tracking_no}")
def api_file(tracking_no: str, code: str = Query(""), db: Session = Depends(get_db)):
    c = verify_code(db, code)
    if not c:
        raise HTTPException(status_code=403, detail="invalid code")
    fp = find_file_path(db, tracking_no)
    if not fp or not os.path.exists(fp):
        raise HTTPException(status_code=404, detail="file not found")
    return FileResponse(fp, media_type="application/pdf", filename=os.path.basename(fp))

import os
@router.get("/api/v1/runtime/sumatra")
def api_runtime_sumatra(arch: str = "win64", code: str = Query(""), db: Session = Depends(get_db)):
    c = verify_code(db, code)
    if not c:
        raise HTTPException(status_code=403, detail="invalid code")
    fname = "SumatraPDF-3.5.2-64.exe" if arch == "win64" else "SumatraPDF-3.5.2-32.exe"
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    fp = os.path.join(base_dir, "runtime", fname)
    if not os.path.exists(fp):
        raise HTTPException(status_code=404, detail="runtime not found on server")
    return FileResponse(fp, media_type="application/octet-stream", filename=fname)
