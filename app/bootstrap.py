# -*- coding: utf-8 -*-
import argparse, sys, json, pathlib, yaml
ROOT = pathlib.Path(__file__).resolve().parent.parent
CFG_GLOB = ROOT.glob("modules/*/config/menu.register.yaml")
CACHE_JSON = ROOT / "modules" / "navauth_shell" / "cache" / "menu.json"

def rebuild_nav():
    menus = []
    for p in CFG_GLOB:
        try:
            data = yaml.safe_load(p.read_text(encoding="utf-8"))
            if isinstance(data, dict) and data.get("menus"):
                menus.extend(data["menus"])
        except Exception as e:
            print(f"[WARN] 解析失败: {p}: {e}", file=sys.stderr)
    CACHE_JSON.parent.mkdir(parents=True, exist_ok=True)
    CACHE_JSON.write_text(json.dumps({"menus": menus}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[OK] 导航聚合完成 -> {CACHE_JSON}")

def init_admin():
    from app.db import SessionLocal
    from modules.core.backend.models.rbac import User
    from app.security import hash_password
    db = SessionLocal()
    try:
        username = input("请输入管理员用户名: ").strip()
        while not username: username = input("用户名不可为空，请重新输入: ").strip()
        pwd = input("请输入管理员密码: ").strip()
        while not pwd: pwd = input("密码不可为空，请重新输入: ").strip()
        u = db.query(User).filter(User.username==username).first()
        if u: u.password_hash = hash_password(pwd)
        else:
            u = User(username=username, full_name="管理员", is_active=True, password_hash=hash_password(pwd))
            db.add(u)
        db.commit()
        print("[OK] 管理员账户已初始化/更新。")
    finally:
        db.close()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--init-admin", action="store_true")
    ap.add_argument("--rebuild-nav", action="store_true")
    args = ap.parse_args()
    if args.rebuild-nav: rebuild_nav()
    if args.init_admin: init_admin()
    if not (args.rebuild_nav or args.init_admin): ap.print_help()

if __name__ == "__main__":
    main()
