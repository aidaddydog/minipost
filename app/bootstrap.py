# minipost · 启动钩子 / 导航合并 / 管理员初始化
from __future__ import annotations
from app.deps import SessionLocal
from modules.nav_shell.backend.services.nav_merge import rebuild_nav_cache
from modules.core.backend.services.rbac_service import ensure_seed_roles_and_admin

def run_startup_tasks() -> None:
    rebuild_nav_cache()
    with SessionLocal() as db:
        ensure_seed_roles_and_admin(db)
