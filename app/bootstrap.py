import os
from pathlib import Path
from sqlalchemy.orm import Session
from app.db import Base, engine, SessionLocal
from app.settings import settings
from modules.core.backend.models.rbac import User, Role
from modules.core.backend.services.rbac_service import ensure_admin_user, seed_roles_from_yaml

BASE_DIR = Path(__file__).resolve().parent.parent

def first_bootstrap():
    # 建立必要目录
    for p in [
        BASE_DIR / "modules" / "label_upload" / "uploads",
        BASE_DIR / "modules" / "label_upload" / "cache",
        BASE_DIR / "modules" / "navauth_shell" / "cache",
        BASE_DIR / "modules" / "logistics_channel" / "cache",
    ]:
        p.mkdir(parents=True, exist_ok=True)

    # 创建表（由 Alembic 迁移负责；此处为兜底，防止用户遗漏迁移）
    Base.metadata.create_all(bind=engine)

    # 初始化角色与管理员
    db: Session = SessionLocal()
    try:
        roles_yaml = BASE_DIR / "modules" / "core" / "config" / "roles.seed.yaml"
        if roles_yaml.exists():
            seed_roles_from_yaml(db, roles_yaml)
        ensure_admin_user(db, username=settings.first_superuser, password=settings.first_superuser_password)
    finally:
        db.close()

if __name__ == "__main__":
    first_bootstrap()
