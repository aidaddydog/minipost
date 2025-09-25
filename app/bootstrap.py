from __future__ import annotations
from sqlalchemy.orm import Session
from app.settings import get_settings
from modules.core.backend.models.rbac import CoreUser
from passlib.hash import bcrypt
import secrets
from modules.nav_shell.backend.services.nav_builder import rebuild_nav_cache  # type: ignore

def on_startup(db: Session):
    # 重建导航缓存
    try:
        rebuild_nav_cache()
    except Exception as e:
        print(f"[bootstrap] rebuild_nav_cache failed: {e}")
    # 初始化管理员
    settings = get_settings()
    admin = db.query(CoreUser).filter(CoreUser.username==settings.INIT_ADMIN_USER).first()
    if not admin:
        pwd = settings.INIT_ADMIN_PASS or secrets.token_urlsafe(10)
        admin = CoreUser(username=settings.INIT_ADMIN_USER, full_name="管理员", email=settings.INIT_ADMIN_EMAIL, hashed_password=bcrypt.hash(pwd), is_active=True)
        db.add(admin); db.commit()
        print(f"[bootstrap] 已创建管理员：{settings.INIT_ADMIN_USER}，临时密码：{pwd}")
