# -*- coding: utf-8 -*-
"""
启动/迁移/导航聚合 CLI：用于部署脚本内调用。
- migrate：执行 Alembic 升级（幂等）。
- init-admin：初始化管理员用户与基本角色。
- reload-nav：扫描 modules/*/config/*.yaml 聚合 /api/nav 数据并校验 Schema。
"""
import argparse, sys, json
from pathlib import Path
from typing import Dict, List, Any
import yaml
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import engine, SessionLocal
from app.settings import settings
from modules.core.backend.models.rbac import Base as CoreBase, User, Role, Permission, UserRole, RolePermission
from loguru import logger

NAV_CACHE = Path("modules/navauth_shell/cache/nav.json")
PERM_CACHE = Path("modules/core/config/permissions.cache.json")

def migrate():
    """执行 Alembic 迁移（幂等）"""
    import subprocess, shlex
    cmd = "alembic upgrade head"
    logger.info("执行数据库迁移：{}", cmd)
    res = subprocess.run(shlex.split(cmd), capture_output=True, text=True)
    sys.stdout.write(res.stdout)
    sys.stderr.write(res.stderr)
    if res.returncode != 0:
        raise SystemExit(res.returncode)
    logger.info("数据库迁移完成。")

def init_admin(username: str, password: str):
    """初始化管理员账号与默认角色"""
    from app.security import hash_password
    with SessionLocal() as db:
        # 创建 admin 角色（全权）
        role_admin = db.query(Role).filter(Role.role_code == "admin").first()
        if not role_admin:
            role_admin = Role(role_code="admin", role_name="管理员")
            db.add(role_admin)
            db.flush()
        # operator/auditor
        role_operator = db.query(Role).filter(Role.role_code == "operator").first()
        if not role_operator:
            role_operator = Role(role_code="operator", role_name="操作员")
            db.add(role_operator); db.flush()
        role_auditor = db.query(Role).filter(Role.role_code == "auditor").first()
        if not role_auditor:
            role_auditor = Role(role_code="auditor", role_name="审计员")
            db.add(role_auditor); db.flush()

        # 全权限（把所有 permissions.register.yaml 聚合写入）
        all_perms = aggregate_permissions(write_cache=True)
        # 确保 Permission 表
        keys = set(p["key"] for p in all_perms)
        exists = {p.permission_key for p in db.query(Permission).all()}
        for k in sorted(keys - exists):
            db.add(Permission(permission_key=k, permission_name="自动导入"))

        db.flush()
        # 赋予 admin 全权限
        for p in db.query(Permission).all():
            if not db.query(RolePermission).filter(RolePermission.role_id==role_admin.id, RolePermission.permission_id==p.id).first():
                db.add(RolePermission(role_id=role_admin.id, permission_id=p.id))

        # 创建/更新管理员用户
        u = db.query(User).filter(User.username==username).first()
        if not u:
            u = User(username=username, full_name="管理员", password_hash=hash_password(password), is_active=True)
            db.add(u); db.flush()
        else:
            u.password_hash = hash_password(password)
            u.is_active = True
        # 绑定 admin 角色
        if not db.query(UserRole).filter(UserRole.user_id==u.id, UserRole.role_id==role_admin.id).first():
            db.add(UserRole(user_id=u.id, role_id=role_admin.id))

        db.commit()
        logger.info("管理员初始化完成：{}", username)

def validate_nav_schema(data: Dict[str, Any]) -> Dict[str, Any]:
    """极简 Schema 校验：字段/类型/重复 href 去重"""
    assert isinstance(data, dict) and "l1" in data and "l2" in data and "l3" in data, "导航聚合结构不合法。"
    # 去重
    def unique(items, key):
        seen=set(); out=[]
        for it in items:
            k=it.get(key)
            if not k or k in seen: continue
            seen.add(k); out.append(it)
        return out
    data["l1"] = unique(data["l1"], "href")
    data["l2"] = unique(data["l2"], "href")
    data["l3"] = unique(data["l3"], "href")
    return data

def aggregate_permissions(write_cache: bool=False) -> List[Dict[str, str]]:
    """聚合各模块 permissions.register.yaml"""
    perms: List[Dict[str, str]] = []
    for p in Path("modules").glob("*/config/permissions.register.yaml"):
        try:
            obj = yaml.safe_load(p.read_text(encoding="utf-8")) or {}
            for k,v in obj.items():
                perms.append({"key": k, "name": str(v)})
        except Exception as e:
            logger.error("权限文件解析失败：{} -> {}", p, e)
            raise
    if write_cache:
        PERM_CACHE.parent.mkdir(parents=True, exist_ok=True)
        PERM_CACHE.write_text(json.dumps(perms, ensure_ascii=False, indent=2), encoding="utf-8")
    return perms

def aggregate_nav(write_file: bool=True) -> Dict[str, Any]:
    """遍历 modules/*/config/*.yaml 聚合导航"""
    l1, l2, l3 = [], [], []
    for mod_dir in Path("modules").glob("*"):
        cfg = mod_dir / "config"
        meta = cfg / "module.meta.yaml"
        if not cfg.exists() or not meta.exists():
            continue
        meta_obj = yaml.safe_load(meta.read_text(encoding="utf-8")) or {}
        if meta_obj.get("enabled", True) is False:
            continue
        # L2 菜单
        menu_file = cfg / "menu.register.yaml"
        if menu_file.exists():
            menu_obj = yaml.safe_load(menu_file.read_text(encoding="utf-8")) or {}
            for l1_key, items in (menu_obj or {}).items():
                for it in (items or []):
                    l2.append({"l1": l1_key, "text": it.get("text",""), "href": it.get("href",""), "order": it.get("order", 100), "icon": it.get("icon","")})
        # L3 tabs
        tabs_file = cfg / "tabs.register.yaml"
        if tabs_file.exists():
            tabs_obj = yaml.safe_load(tabs_file.read_text(encoding="utf-8")) or {}
            for base, items in (tabs_obj or {}).items():
                for it in (items or []):
                    l3.append({"base": base, "key": it.get("key",""), "text": it.get("text",""), "href": it.get("href",""), "order": it.get("order", 100)})
        # 权限在 aggregate_permissions 里统一处理

    # L1 静态（从各模块推断）——示例：orders/products/logistics/settings
    l1 = [
        {"text":"订单", "href":"/orders", "order":10},
        {"text":"商品", "href":"/products", "order":20},
        {"text":"物流", "href":"/logistics", "order":30},
        {"text":"设置", "href":"/settings", "order":40},
    ]
    nav = {"l1": l1, "l2": sorted(l2, key=lambda x: x["order"]), "l3": sorted(l3, key=lambda x: x["order"])}
    nav = validate_nav_schema(nav)
    if write_file:
        NAV_CACHE.parent.mkdir(parents=True, exist_ok=True)
        NAV_CACHE.write_text(json.dumps(nav, ensure_ascii=False, indent=2), encoding="utf-8")
    return nav

def main():
    parser = argparse.ArgumentParser(description="minipost 启动与运维工具")
    sub = parser.add_subparsers(dest="cmd")

    sub.add_parser("migrate")
    p_admin = sub.add_parser("init-admin")
    p_admin.add_argument("--user", required=True)
    p_admin.add_argument("--password", required=True)

    sub.add_parser("reload-nav")

    args = parser.parse_args()
    if args.cmd == "migrate":
        migrate()
    elif args.cmd == "init-admin":
        init_admin(args.user, args.password)
    elif args.cmd == "reload-nav":
        nav = aggregate_nav(write_file=True)
        perms = aggregate_permissions(write_cache=True)
        print(f"聚合完成：L1={len(nav['l1'])} L2={len(nav['l2'])} L3={len(nav['l3'])}；权限={len(perms)}")
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
