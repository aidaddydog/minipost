# app/services/nav_loader.py
# -*- coding: utf-8 -*-
"""
导航聚合器（新 Schema，递归扫描）

- 扫描：modules/**/config/{module.meta.yaml, menu.register.yaml, tabs.register.yaml}
- 仅依赖 PyYAML
- 结果结构：
    {
      "menu": { "<L1>": [{text, href, order?, icon?}, ...], ... },
      "tabs": { "/<L2路径>": [{key, text, href, order?, template?}, ...], ... },
      "generated_at": ISO8601Z,
      "hash": "sha1-16",
      "stats": { "modules": N, "menus": M, "tabs": T }
    }
"""
from __future__ import annotations
from pathlib import Path
from typing import Dict, List, Any
from datetime import datetime, timezone
import json, hashlib, os

try:
    import yaml  # type: ignore
except Exception as e:  # pragma: no cover
    raise RuntimeError("缺少 PyYAML，请确保环境已安装 python3-yaml") from e

REPO_ROOT = Path(__file__).resolve().parents[2]
MODULES_DIR = REPO_ROOT / "modules"

# 可写缓存位置（失败时静默降级）
DEFAULT_CACHE_DIR = REPO_ROOT / "runtime"
CACHE_DIR  = Path(os.getenv("NAV_CACHE_DIR", str(DEFAULT_CACHE_DIR)))
CACHE_FILE = Path(os.getenv("NAV_CACHE_FILE", str(CACHE_DIR / "nav.cache.json")))

def _find_yaml(cfg_dir: Path, stem: str) -> Path | None:
    for ext in (".yaml", ".yml"):
        p = cfg_dir / f"{stem}{ext}"
        if p.exists() and p.is_file():
            return p
    return None

def _load_yaml(fp: Path) -> Any:
    text = fp.read_text(encoding="utf-8", errors="ignore")
    return yaml.safe_load(text)

def _to_bool(val: Any, default: bool=True) -> bool:
    if isinstance(val, bool): return val
    if isinstance(val, str): return val.strip().lower() in ("1","true","yes","on")
    return default

def _sorted_inplace(bucket: List[dict]) -> None:
    for it in bucket:
        if "order" not in it or not isinstance(it.get("order"), int):
            it["order"] = 100
    bucket.sort(key=lambda d: (d.get("order", 100), d.get("text","")))

def _dedupe_by_key(bucket: List[dict], key: str) -> None:
    seen = set()
    i = 0
    while i < len(bucket):
        v = bucket[i].get(key)
        if v in seen:
            bucket.pop(i); continue
        seen.add(v); i += 1

def _validate_menu(menu: dict, mod: str) -> int:
    if not isinstance(menu, dict):
        raise ValueError(f"[{mod}] menu.register 需为对象：L1 → items[]")
    count = 0
    for l1, items in menu.items():
        if not isinstance(l1, str) or not l1.strip():
            raise ValueError(f"[{mod}] menu.register L1（键）必须为非空字符串")
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
    if not isinstance(tabs, dict):
        raise ValueError(f"[{mod}] tabs.register 必须为对象：/base → tabs[]")
    count = 0
    for base, items in tabs.items():
        if not isinstance(base, str) or not base.startswith("/"):
            raise ValueError(f"[{mod}] tabs.register key 必须为以 / 开头的路径：{base!r}")
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
            # 允许额外字段：template/icon 等
            count += 1
    return count

def _write_cache_safe(nav: Dict[str, Any]) -> None:
    try:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        CACHE_FILE.write_text(json.dumps(nav, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception:
        pass

def rebuild_nav(write_cache: bool = True) -> Dict[str, Any]:
    menu: Dict[str, List[dict]] = {}
    tabs: Dict[str, List[dict]] = {}
    stats = {"modules": 0, "menus": 0, "tabs": 0}

    if not MODULES_DIR.exists():
        now = datetime.now(timezone.utc).isoformat()
        nav = {"menu": {}, "tabs": {}, "generated_at": now, "hash": "0"*16, "stats": stats}
        if write_cache: _write_cache_safe(nav)
        return nav

    cfg_dirs = sorted({p for p in MODULES_DIR.rglob("config") if p.is_dir()})
    for cfg_dir in cfg_dirs:
        mod_dir = cfg_dir.parent
        mod_name = mod_dir.name

        meta_fp = _find_yaml(cfg_dir, "module.meta")
        if meta_fp:
            meta = _load_yaml(meta_fp) or {}
            if not _to_bool(meta.get("enabled", True), True):
                continue

        menu_fp = _find_yaml(cfg_dir, "menu.register")
        if menu_fp:
            raw = _load_yaml(menu_fp) or {}
            stats["menus"] += _validate_menu(raw, mod_name)
            for l1, items in (raw or {}).items():
                bucket = menu.setdefault(l1, [])
                for it in items:
                    row = {
                        "text": it["text"].strip(),
                        "href": it["href"].strip(),
                        "order": it.get("order", 100),
                    }
                    if "icon" in it and isinstance(it["icon"], str):
                        row["icon"] = it["icon"]
                    bucket.append(row)
                _dedupe_by_key(bucket, "href"); _sorted_inplace(bucket)

        tabs_fp = _find_yaml(cfg_dir, "tabs.register")
        if tabs_fp:
            raw = _load_yaml(tabs_fp) or {}
            stats["tabs"] += _validate_tabs(raw, mod_name)
            for base, items in (raw or {}).items():
                bucket = tabs.setdefault(base, [])
                for it in items:
                    row = {
                        "key": it["key"].strip(),
                        "text": it["text"].strip(),
                        "href": it["href"].strip(),
                        "order": it.get("order", 100),
                    }
                    # 透传 template/icon 等可选字段（为通用页面渲染与样式服务）
                    if isinstance(it.get("template"), str):
                        row["template"] = it["template"].strip()
                    if isinstance(it.get("icon"), str):
                        row["icon"] = it["icon"].strip()
                    bucket.append(row)
                _dedupe_by_key(bucket, "key"); _dedupe_by_key(bucket, "href"); _sorted_inplace(bucket)

        stats["modules"] += 1

    now = datetime.now(timezone.utc).isoformat()
    digest_src = json.dumps({"menu": menu, "tabs": tabs}, ensure_ascii=False, sort_keys=True)
    sha = hashlib.sha1(digest_src.encode("utf-8")).hexdigest()[:16]
    nav = {"menu": menu, "tabs": tabs, "generated_at": now, "hash": sha, "stats": stats}
    if write_cache: _write_cache_safe(nav)
    return nav
