from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.services.template_service import get_template, upsert_template

router = APIRouter()

@router.get("/{name}")
def get_tpl(name: str, db: Session = Depends(get_db)):
    t = get_template(db, name)
    return {"name": name, "content": (t.content if t else "")}

@router.put("/{name}")
def put_tpl(name: str, content: str, db: Session = Depends(get_db)):
    t = upsert_template(db, name, content)
    return {"ok": True, "name": name}
