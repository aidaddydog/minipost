from fastapi import APIRouter, Request, Depends, Form
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session
from ..core.deps import get_db
from ..core.security import verify_admin, require_admin

router = APIRouter()

@router.get("/admin", response_class=HTMLResponse)
def admin_index(request: Request, db: Session = Depends(get_db)):
    require_admin(request, db)
    return request.app.state.templates.TemplateResponse("admin/label_upload_list.html", {"request": request})

@router.get("/admin/login", response_class=HTMLResponse)
def login_page(request: Request):
    return request.app.state.templates.TemplateResponse("auth/login.html", {"request": request})

@router.post("/admin/login")
def login_do(request: Request, username: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    if not verify_admin(username, password, db):
        return request.app.state.templates.TemplateResponse("auth/login.html", {"request": request, "error":"账户或密码错误"})
    request.session["admin_user"] = username
    return RedirectResponse("/admin", status_code=302)

@router.get("/admin/logout")
def logout(request: Request):
    request.session.clear()
    return RedirectResponse("/admin/login", status_code=302)


@router.get("/admin/bootstrap", response_class=HTMLResponse)
def bootstrap_admin(request: Request, db: Session = Depends(get_db)):
    from passlib.hash import bcrypt
    from ..models.tables import AdminUser
    u = db.query(AdminUser).first()
    if u:
        return request.app.state.templates.TemplateResponse("auth/login.html", {"request": request, "error": "已存在管理员，请直接登录"})
    admin = AdminUser(username="admin", password_hash=bcrypt.hash("admin"), is_active=True)
    db.add(admin); db.commit()
    return request.app.state.templates.TemplateResponse("auth/login.html", {"request": request, "error": "已创建默认管理员：admin/admin"})
