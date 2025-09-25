from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from pydantic import BaseModel
from app.db import get_db
from app.security import verify_password, create_access_token
from modules.core.backend.models.rbac import User

router = APIRouter()

class LoginReq(BaseModel):
    username: str
    password: str

@router.post("/login")
def login(req: LoginReq, db: Session = Depends(get_db)):
    u = db.execute(select(User).where(User.username == req.username)).scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=400, detail="用户名或密码错误")
    if not verify_password(req.password, u.hashed_password):
        raise HTTPException(status_code=400, detail="用户名或密码错误")
    token = create_access_token(sub=u.username)
    return {"access_token": token, "token_type": "bearer"}
