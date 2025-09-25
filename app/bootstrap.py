# -*- coding: utf-8 -*-
"""启动/初始化辅助：
- migrate：create_all 建表（首次）
- create_admin <username> <password>：若无则创建管理员
- reload-nav：聚合 modules/*/config/menu.register.yaml
"""
import sys, json, glob, os
from pathlib import Path
from sqlalchemy.orm import Session
from .db import Base, engine, SessionLocal
from .settings import settings

# 导入模型（确保元数据已注册）
from modules.core.backend.models import rbac as rbac_models

def migrate():
    # 使用 SQLAlchemy 元数据建表（首装简化）
    Base.metadata.create_all(bind=engine)
    print("[OK] create_all 完成（若表已存在将跳过）")

def create_admin(username: str, password: str):
    from modules.core.backend.services.rbac_service import ensure_admin
    with SessionLocal() as db:
        uid = ensure_admin(db, username, password)
        print(f"[OK] 管理员就绪：{username} (id={uid})")

def reload_nav():
    import yaml
    root = Path(__file__).resolve().parents[1]
    items = []
    for path in root.glob("modules/*/config/menu.register.yaml" ):
        try:
            data = yaml.safe_load(path.read_text(encoding='utf-8')) or {}
            items.append({"module": path.parent.parent.name, "menu": data})
        except Exception as e:
            print(f"[WARN] 解析失败: {path} => {e}")
    out_dir = root / "modules" / "navauth_shell" / "cache"
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "nav_registry.json").write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"[OK] 导航聚合完成，共 {len(items)} 个模块 => {out_dir/'nav_registry.json'}")

if __name__ == "__main__":
    # 简易 CLI
    if len(sys.argv) < 2:
        print("用法: python -m app.bootstrap [migrate|create-admin <user> <pass>|reload-nav]")
        sys.exit(1)
    cmd = sys.argv[1]
    if cmd == "migrate":
        migrate()
    elif cmd == "create-admin":
        if len(sys.argv) >= 4:
            create_admin(sys.argv[2], sys.argv[3])
        else:
            # 从环境变量读取（部署脚本会注入）
            u = os.getenv("ADMIN_USER", "").strip()
            p = os.getenv("ADMIN_PASS", "").strip()
            if not u or not p:
                print("[ERR] 需要提供管理员账号与密码")
                sys.exit(2)
            create_admin(u, p)
    elif cmd == "reload-nav":
        reload_nav()
    else:
        print("未知命令", cmd); sys.exit(3)
