#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
模块 YAML 校验（启动前执行）：
- 校验 modules/*/config 下的：
  - module.meta.yaml
  - menu.register.yaml
  - tabs.register.yaml
  - permissions.register.yaml
- 任意一个文件存在但不合规 => 非零退出，阻止启动
- 全部通过时打印 "__SCHEMA_OK__"（供部署脚本 grep 判断）
注意：
- 若某类文件不存在，不视为失败（按你本轮范围，部分文件可以缺省）。
- 仅依赖 python3-yaml（bootstrap_online.sh 已安装 python3-yaml）
"""
import os, sys, glob, yaml

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CONFIG_DIRS = sorted(glob.glob(os.path.join(ROOT, "modules", "*", "config")))
errors = []
mod_count = 0
menu_count = 0
tab_count = 0

def _load_yaml(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    except Exception as e:
        errors.append(f"[read] {path}: {e}")
        return None

def check_meta(path):
    data = _load_yaml(path)
    if data is None:
        return
    need = {"name", "version"}
    miss = need - set(data.keys())
    if miss:
        errors.append(f"[meta] 缺失字段 {sorted(miss)} @ {path}")

def check_menu(path):
    global menu_count
    data = _load_yaml(path)
    if data is None:
        return
    items = data if isinstance(data, list) else [data]
    need = {"title", "path", "order", "visible", "level", "children"}
    for i, it in enumerate(items, 1):
        if not isinstance(it, dict):
            errors.append(f"[menu] 第{i}项不是对象 @ {path}")
            continue
        miss = need - set(it.keys())
        if miss:
            errors.append(f"[menu] 缺失字段 {sorted(miss)} @ {path} 第{i}项")
        if it.get("level") not in (1, 2, 3):
            errors.append(f"[menu] level 仅允许 1/2/3 @ {path} 第{i}项")
        if not isinstance(it.get("children"), list):
            errors.append(f"[menu] children 必须为数组 @ {path} 第{i}项")
        menu_count += 1

def check_tabs(path):
    global tab_count
    data = _load_yaml(path)
    if data is None:
        return
    items = data if isinstance(data, list) else [data]
    need = {"key", "text", "href"}
    for i, it in enumerate(items, 1):
        if not isinstance(it, dict):
            errors.append(f"[tabs] 第{i}项不是对象 @ {path}")
            continue
        miss = need - set(it.keys())
        if miss:
            errors.append(f"[tabs] 缺失字段 {sorted(miss)} @ {path} 第{i}项")
        tab_count += 1

def check_perms(path):
    data = _load_yaml(path)
    if data is None:
        return
    items = data if isinstance(data, list) else [data]
    need = {"key", "name"}
    for i, it in enumerate(items, 1):
        if not isinstance(it, dict):
            errors.append(f"[perms] 第{i}项不是对象 @ {path}")
            continue
        miss = need - set(it.keys())
        if miss:
            errors.append(f"[perms] 缺失字段 {sorted(miss)} @ {path} 第{i}项")

for cfg_dir in CONFIG_DIRS:
    mod_count += 1
    meta = os.path.join(cfg_dir, "module.meta.yaml")
    menu = os.path.join(cfg_dir, "menu.register.yaml")
    tabs = os.path.join(cfg_dir, "tabs.register.yaml")
    perms = os.path.join(cfg_dir, "permissions.register.yaml")
    if os.path.exists(meta):  check_meta(meta)
    if os.path.exists(menu):  check_menu(menu)
    if os.path.exists(tabs):  check_tabs(tabs)
    if os.path.exists(perms): check_perms(perms)

print(f"模块数: {mod_count}  菜单项: {menu_count}  页签数: {tab_count}")
if errors:
    print("校验错误（仅显示最近 20 条）：")
    for e in errors[-20:]:
        print(" -", e)
    sys.exit(1)

print("__SCHEMA_OK__")
