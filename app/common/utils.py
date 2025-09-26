# -*- coding: utf-8 -*-
import os
import glob
import yaml
import time
import threading
from typing import List, Dict, Any, Tuple

_NAV_CACHE = {"ts": 0.0, "data": []}
_NAV_LOCK = threading.Lock()
REQUIRED_FIELDS = {"title", "path", "order", "visible", "level", "children"}

def _validate_item(
    item: Dict[str, Any],
    path_stack: List[str],
    used_paths: set,
    used_orders: Dict[int, set],
    errors: List[str],
) -> Dict[str, Any] | None:
    # 校验必填字段
    missing = REQUIRED_FIELDS - set(item.keys())
    if missing:
        errors.append(f"缺失字段 {missing} @ {'/'.join(path_stack)}")
        return None
    # 基本类型检查
    if not isinstance(item["title"], str):
        errors.append(f"title 必须为字符串 @ {'/'.join(path_stack)}")
        return None
    if not isinstance(item["path"], str):
        errors.append(f"path 必须为字符串 @ {'/'.join(path_stack)}")
        return None
    if not isinstance(item["order"], int):
        errors.append(f"order 必须为整数 @ {'/'.join(path_stack)}")
        return None
    if not isinstance(item["visible"], bool):
        errors.append(f"visible 必须为布尔型 @ {'/'.join(path_stack)}")
        return None
    if item["level"] not in (1, 2, 3):
        errors.append(f"level 仅允许 1/2/3 @ {'/'.join(path_stack)}")
        return None
    if not isinstance(item["children"], list):
        errors.append(f"children 必须为数组 @ {'/'.join(path_stack)}")
        return None

    # path 唯一性
    if item["path"] in used_paths:
        errors.append(f"重复 path: {item['path']}")
        return None
    used_paths.add(item["path"])

    # order 在同级唯一
    level = item["level"]
    used_orders.setdefault(level, set())
    if item["order"] in used_orders[level]:
        errors.append(f"同级 order 冲突: level={level}, order={item['order']}")
        return None
    used_orders[level].add(item["order"])

    # 子节点递归校验
    new_children = []
    for idx, ch in enumerate(item["children"]):
        ch_path_stack = path_stack + [f"{idx}"]
        validated = _validate_item(ch, ch_path_stack, used_paths, used_orders, errors)
        if validated:
            new_children.append(validated)
    item["children"] = sorted(new_children, key=lambda x: x.get("order", 0))
    return item

def load_nav_from_yaml(modules_root: str = "modules") -> Tuple[List[Dict[str, Any]], List[str]]:
    """扫描 modules/*/config/menu.register.yaml 并聚合，跳过错误条目（记录错误）。"""
    files = glob.glob(os.path.join(modules_root, "*", "config", "menu.register.yaml"))
    items: List[Dict[str, Any]] = []
    errors: List[str] = []
    used_paths: set = set()
    used_orders: Dict[int, set] = {}

    for f in files:
        try:
            with open(f, "r", encoding="utf-8") as rf:
                data = yaml.safe_load(rf) or {}
                # 支持单个 item 或 items 列表
                list_data = data if isinstance(data, list) else [data]
                for i, raw in enumerate(list_data):
                    v = _validate_item(raw, [f], used_paths, used_orders, errors)
                    if v:
                        items.append(v)
        except Exception as e:
            errors.append(f"读取失败 {f}: {e}")

    # 仅返回可见项，按 order 排序
    visible_items = [i for i in items if i.get("visible", True)]
    visible_items = sorted(visible_items, key=lambda x: x.get("order", 0))
    return visible_items, errors

def get_nav_cache() -> Dict[str, Any]:
    with _NAV_LOCK:
        return {"ts": _NAV_CACHE["ts"], "data": _NAV_CACHE["data"]}

def refresh_nav_cache(modules_root: str = "modules") -> Dict[str, Any]:
    data, errors = load_nav_from_yaml(modules_root)
    with _NAV_LOCK:
        _NAV_CACHE["ts"] = time.time()
        _NAV_CACHE["data"] = data
    return {"ok": True, "errors": errors, "count": len(data), "ts": _NAV_CACHE["ts"]}
