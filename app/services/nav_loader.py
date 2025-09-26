# app/services/nav_loader.py
# -*- coding: utf-8 -*-
"""
导航聚合器（后端）：
- 遍历 modules/*/config/{module.meta.yaml, menu.register.yaml, tabs.register.yaml, permissions.register.yaml}
- 过滤 enabled=false 的模块
- 验证基础 Schema（必要字段/类型），聚合 L1→L2（menu）与 L2→L3（tabs）
- href 去重、按 order 排序；返回统计信息，供 scripts/reload_nav.sh 打印
- 仅依赖 PyYAML（bootstrap 已安装 python3-yaml），不额外引入 jsonschema
"""
from __future__ import annotations
from pathlib import Path
from typing import Dict, List, Tuple, Any
import json, hashlib
from datetime import datetime, timezone

try:
    import yaml
except Exception as e:  # pragma: no cover
    raise RuntimeError("缺少 PyYAML，请确保环境已安装 python3-yaml") from e

# 目录定位：.../app/services/nav_loader.py → repo 根 = parents[2]
REPO_ROOT = Path(__file__).resolve().parents[2]
MODULES_DIR = REPO_ROOT / "modules"
CACHE_FILE  = REPO_ROOT / "app" / ".nav-cache.json"  # 可选缓存，方便排障

def _find_yaml(cfg_dir: Path, stem: str) -> Path | None:
    """优先 .yaml，再 .yml"""
    for ext in (".yaml", ".yml"):
        p = cfg_dir / f"{stem}{ext}"
        if p.exists():
            return p
    return None

def _load_yaml(fp: Path) -> Any:
    data = yaml.safe_load(fp.read_text(encoding="utf-8"))
    return data if data is not None else {}

def _validate_meta(meta: dict, mod_dir: Path) -> bool:
    """返回是否 enabled；字段尽量宽松但保底校验"""
    req = ["name", "title", "version", "api_prefix", "enabled"]
    for k in req:
        if k not in meta:
            raise ValueError(f"[{mod_dir.name}] module.meta 缺少必填字段：{k}")
    if not isinstance(meta["enabled"], bool):
        raise ValueError(f"[{mod_dir.name}] module.meta.enabled 必须为 bool")
    return bool(meta["enabled"])

def _validate_menu(menu: dict, mod: str) -> int:
    """menu.register.yaml 基础校验，返回计数"""
    if not isinstance(menu, dict):
        raise ValueError(f"[{mod}] menu.register 需为对象：l1_key -> items[]")
    count = 0
    for l1, items in menu.items():
        if not isinstance(l1, str):
            raise ValueError(f"[{mod}] menu.register l1 必须为字符串")
        if not isinstance(items, list):
            raise ValueError(f"[{mod}] menu.register.{l1} 必须为数组")
        for it in items:
            if not isinstance(it, dict):
                raise ValueError(f"[{mod}] menu.register.{l1}[] 必须为对象")
            for k in ("text", "href"):
                if k not in it or not isinstance(it[k], str) or not it[k].strip():
                    raise ValueError(f"[{mod}] menu.register.{l1}[] 缺少/非法字段：{k}")
            if not it["href"].startswith("/"):
                raise ValueError(f"[{mod}] menu.register.{l1}[] href 必须以 / 开头：{it['href']}")
            if "order" in it and not isinstance(it["order"], int):
                raise ValueError(f"[{mod}] menu.register.{l1}[] order 必须为整数")
            count += 1
    return count

def _validate_tabs(tabs: dict, mod: str) -> int:
    """tabs.register.yaml 基础校验，返回计数"""
    if not isinstance(tabs, dict):
        raise ValueError(f"[{mod}] tabs.register 必须为对象：base_path -> tabs[]")
    count = 0
    for base, items in tabs.items():
        if not isinstance(base, str) or not base.startswith("/"):
            raise ValueError(f"[{mod}] tabs.register key 必须为以 / 开头的路径")
        if not isinstance(items, list):
            raise ValueError(f"[{mod}] tabs.register.{base} 必须为数组")
        for it in items:
            if not isinstance(it, dict):
                raise ValueError(f"[{mod}] tabs.register.{base}[] 必须为对象")
            for k in ("key", "text", "href"):
                if k not in it or not isinstance(it[k], str) or not it[k].strip():
                    raise ValueError(f"[{mod}] tabs.register.{base}[] 缺少/非法字段：{k}")
            if not it["href"].startswith("/"):
                raise ValueError(f"[{mod}] tabs.register.{base}[] href 必须以 / 开头：{it['href']}")
            if "order" in it and not isinstance(it["order"], int):
                raise ValueError(f"[{mod}] tabs.register.{base}[] order 必须为整数")
            count += 1
    return count

def _dedupe_append(bucket: List[dict], row: dict, key: str) -> bool:
    """按 key（通常是 href）去重追加；返回是否追加成功"""
    if any(x.get(key) == row.get(key) for x in bucket):
        return False
    bucket.append(row)
    return True

def _sorted_inplace(bucket: List[dict]) -> None:
    bucket.sort(key=lambda x: (x.get("order", 1000), x.get("text", "")))

def rebuild_nav(write_cache: bool = False) -> dict:
    """
    聚合核心：扫描 modules/*/config，合成：
    {
      "menu": { "<l1>": [{text,href,order?,icon?}, ...], ... },
      "tabs": { "<l2_base>": [{key,text,href,order?}, ...], ... },
      "generated_at": ISO8601Z,
      "hash": "sha1-16",
      "stats": { "modules":N, "menus":M, "tabs":T }
    }
    """
    if not MODULES_DIR.exists():
        # 空目录也要返回结构，避免前端空指针
        now = datetime.now(timezone.utc).isoformat()
        nav = {"menu": {}, "tabs": {}, "generated_at": now, "hash": "0"*16,
               "stats": {"modules": 0, "menus": 0, "tabs": 0}}
        if write_cache:
            CACHE_FILE.write_text(json.dumps(nav, ensure_ascii=False, indent=2), encoding="utf-8")
        return nav

    stats = {"modules": 0, "menus": 0, "tabs": 0}
    menu: Dict[str, List[dict]] = {}
    tabs: Dict[str, List[dict]] = {}

    for mod_dir in sorted([p for p in MODULES_DIR.iterdir() if p.is_dir() and not p.name.startswith((".", "_"))]):
        cfg_dir = mod_dir / "config"
        if not cfg_dir.exists():
            continue

        meta_fp = _find_yaml(cfg_dir, "module.meta")
        enabled = True
        if meta_fp:
            meta = _load_yaml(meta_fp) or {}
            enabled = _validate_meta(meta, mod_dir)
        if not enabled:
            continue

        # menu.register
        menu_fp = _find_yaml(cfg_dir, "menu.register")
        if menu_fp:
            m = _load_yaml(menu_fp) or {}
            stats["menus"] += _validate_menu(m, mod_dir.name)
            for l1, items in m.items():
                bucket = menu.setdefault(l1, [])
                for it in items:
                    row = {
                        "text": it["text"].strip(),
                        "href": it["href"].strip(),
                        "order": it.get("order", 100),
                    }
                    if "icon" in it:
                        row["icon"] = it["icon"]
                    _dedupe_append(bucket, row, "href")
                _sorted_inplace(bucket)

        # tabs.register
        tabs_fp = _find_yaml(cfg_dir, "tabs.register")
        if tabs_fp:
            t = _load_yaml(tabs_fp) or {}
            stats["tabs"] += _validate_tabs(t, mod_dir.name)
            for base, items in t.items():
                bucket = tabs.setdefault(base, [])
                for it in items:
                    row = {
                        "key": it["key"].strip(),
                        "text": it["text"].strip(),
                        "href": it["href"].strip(),
                        "order": it.get("order", 100),
                    }
                    _dedupe_append(bucket, row, "href")
                _sorted_inplace(bucket)

        stats["modules"] += 1

    # 生成摘要
    now = datetime.now(timezone.utc).isoformat()
    digest_src = json.dumps({"menu": menu, "tabs": tabs}, ensure_ascii=False, sort_keys=True)
    sha = hashlib.sha1(digest_src.encode("utf-8")).hexdigest()[:16]
    nav = {"menu": menu, "tabs": tabs, "generated_at": now, "hash": sha, "stats": stats}

    if write_cache:
        CACHE_FILE.write_text(json.dumps(nav, ensure_ascii=False, indent=2), encoding="utf-8")

    return nav
