#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
统一校验器（新 Schema）：
- 不再逐项检查旧式 level/children 格式
- 直接委托 app.services.nav_loader.rebuild_nav 做 Schema 校验与聚合
- 成功时输出 "__SCHEMA_OK__"（兼容部署脚本 grep）
"""
import os, sys, json, time, traceback

# 将仓库根目录加入 sys.path（本文件位于 repo/scripts/validate_modules.py）
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

def main() -> int:
    ok = True
    errors = []
    nav = {"menu": {}, "tabs": {}, "generated_at": None, "hash": "0"*16, "stats": {"modules": 0, "menus": 0, "tabs": 0}}
    try:
        from app.services.nav_loader import rebuild_nav
        nav = rebuild_nav(write_cache=True)
    except Exception as e:
        ok = False
        errors.append(str(e))
        errors.append(traceback.format_exc())

    out = {"ok": ok, "errors": errors, **nav, "ts": time.time()}
    print(json.dumps(out, ensure_ascii=False, indent=2))
    if ok:
        print("__SCHEMA_OK__")
    return 0 if ok else 1

if __name__ == "__main__":
    raise SystemExit(main())
