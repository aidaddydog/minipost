from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from ...core.deps import get_db
from ...services import templates_service as svc

router = APIRouter(prefix="/templates", tags=["templates"])

@router.get("")
def list_all():
    return [{"path": rel} for rel, _ in svc.list_templates()]

@router.get("/content")
def get_content(path: str = Query(...)):
    try:
        return {"path": path, "content": svc.read_template(path)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/save")
def save(path: str, content: str):
    try:
        p = svc.save_template(path, content)
        return {"path": p, "ok": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
