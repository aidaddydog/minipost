import os
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse
from app.core.settings import settings

router = APIRouter(prefix="/api/v1", tags=["v1"])

# —— 简单 Code 校验（如需接入数据库可替换为真实校验）
def verify_code(code: str)->bool:
    allow = os.environ.get("CLIENT_CODE","").strip()
    # 为空则放行；设置后需完全匹配
    return True if not allow else (code.strip()==allow)

def mapping_payload()->dict:
    # 兼容旧客户端结构（占位）
    return {
        "version": "server-20250921",
        "list_version": "list-20250921",
        "items": []  # [{ "origin":"xxx", "tracking":"1Z...", "file":"xxx.pdf" }, ...]
    }

@router.get("/version")
def version(code: str = Query("")):
    if not verify_code(code): raise HTTPException(status_code=403, detail="invalid code")
    return JSONResponse({
        "version": "server-20250921",
        "list_version": "list-20250921",
        "server_version": "server-20250921",
        "client_recommend": "client-20250921",
    })

@router.get("/mapping")
def mapping(code: str = Query("")):
    if not verify_code(code): raise HTTPException(status_code=403, detail="invalid code")
    return JSONResponse(mapping_payload())

@router.get("/file/{tracking_no}")
def file_by_tracking(tracking_no: str, code: str = Query("")):
    if not verify_code(code): raise HTTPException(status_code=403, detail="invalid code")
    # 规范化：直接在 DATA/pdfs 下查找 同名 PDF（大小写不敏感）
    pdf_dir = os.path.join(settings.data_dir, "pdfs")
    def find_any(name: str)->Optional[str]:
        fp = os.path.join(pdf_dir, f"{name}.pdf")
        if os.path.exists(fp): return fp
        want = f"{name}.pdf".lower()
        for n in os.listdir(pdf_dir) if os.path.isdir(pdf_dir) else []:
            if n.lower() == want: return os.path.join(pdf_dir, n)
        return None
    os.makedirs(pdf_dir, exist_ok=True)
    path = find_any(tracking_no)
    if not path: raise HTTPException(status_code=404, detail="file not found")
    return FileResponse(path, media_type="application/pdf", filename=os.path.basename(path))

@router.get("/runtime/sumatra")
def runtime_sumatra(arch: str = "win64", code: str = Query("")):
    if not verify_code(code): raise HTTPException(status_code=403, detail="invalid code")
    fname = "SumatraPDF-3.5.2-64.exe" if arch == "win64" else "SumatraPDF-3.5.2-32.exe"
    path = os.path.join(settings.base_dir, "runtime", fname)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="runtime not found on server")
    return FileResponse(path, media_type="application/octet-stream", filename=fname)
