# app/services/nav_loader.py
# -*- coding: utf-8 -*-
"""
导航聚合器（新 Schema）

- 扫描：modules/**/config/{menu.register.yaml, tabs.register.yaml}
- 统一 Schema：
    menu: { "<L1>": [{text, href, order?, icon?, default?}, ...], ... }
    tabs: { "/<L2路径>": [{key, text, href, order?, template?, icon?, default?}, ...], ... }
- 返回：
    {
      "menu": {...}, "tabs": {...},
      "generated_at": ISO8601Z,
      "hash": "sha1-16",
      "stats": { "modules": N, "menus": M, "tabs": T }
    }
"""
from __future__ import annotations
from pathlib import Path
from typing import Dict, Any, List
from datetime import datetime, timezone
import hashlib, json

try:
    import yaml  # type: ignore
except Exception as e:  # pragma: no cover
    raise RuntimeError("需要 PyYAML，请先安装：pip install pyyaml") from e

BASE_DIR    = Path(__file__).resolve().parents[2]   # .../minipost-main
MODULES_DIR = BASE_DIR / "modules"

def _read_yaml(p: Path) -> Any:
    if not p.exists(): return None
    text = p.read_text(encoding="utf-8")
    data = yaml.safe_load(text)
    return data if data is not None else {}

def _sorted_inplace(bucket: List[dict], key_name: str) -> None:
    for it in bucket:
        if "order" not in it or not isinstance(it.get("order"), int):
            it["order"] = 100
    bucket.sort(key=lambda d: (d.get("order", 100), str(d.get(key_name, ""))))

def _norm_menu_item(it: dict) -> dict:
    row = {
        "text":  str(it["text"]).strip(),
        "href":  str(it["href"]).strip(),
        "order": int(it.get("order", 100)),
    }
    if isinstance(it.get("icon"), str):    row["icon"]    = it["icon"].strip()
    if "default" in it:                    row["default"] = bool(it.get("default"))
    return row

def _norm_tab_item(it: dict) -> dict:
    row = {
        "key":   str(it["key"]).strip(),
        "text":  str(it["text"]).strip(),
        "href":  str(it["href"]).strip(),
        "order": int(it.get("order", 100)),
    }
    if isinstance(it.get("template"), str): row["template"] = it["template"].strip()
    if isinstance(it.get("icon"), str):     row["icon"]     = it["icon"].strip()
    if "default" in it:                     row["default"]  = bool(it.get("default"))
    return row

def rebuild_nav(write_cache: bool = True) -> Dict[str, Any]:
    menu: Dict[str, List[dict]] = {}
    tabs: Dict[str, List[dict]] = {}
    stats = {"modules": 0, "menus": 0, "tabs": 0}

    for cfg_dir in MODULES_DIR.glob("**/config"):
        mod_root = cfg_dir.parent
        mod_key  = mod_root.relative_to(BASE_DIR).as_posix()

        # ---- menu.register.yaml ----
        mfile = cfg_dir / "menu.register.yaml"
        if mfile.exists():
            data = _read_yaml(mfile)
            if not isinstance(data, dict):
                raise ValueError(f"[{mod_key}] menu.register.yaml 必须为对象：L1 → items[]")
            for l1, items in data.items():
                if not isinstance(l1, str) or not l1.strip():
                    raise ValueError(f"[{mod_key}] menu.register L1（键）必须为非空字符串")
                if not isinstance(items, list):
                    raise ValueError(f"[{mod_key}] menu.register.{l1} 必须为数组")
                bucket = menu.setdefault(l1, [])
                for it in items:
                    if not isinstance(it, dict):
                        raise ValueError(f"[{mod_key}] menu.register.{l1}[] 必须为对象")
                    for k in ("text", "href"):
                        if k not in it or not isinstance(it[k], str) or not it[k].strip():
                            raise ValueError(f"[{mod_key}] menu.register.{l1}[] 缺少/非法字段：{k}")
                    if not str(it["href"]).startswith("/"):
                        raise ValueError(f"[{mod_key}] menu.register.{l1}[] href 必须以 / 开头：{it['href']!r}")
                    bucket.append(_norm_menu_item(it))
                # 去重（按 href）
                dedup, seen = [], set()
                for x in bucket:
                    if x["href"] in seen: continue
                    seen.add(x["href"]); dedup.append(x)
                menu[l1] = dedup
                _sorted_inplace(menu[l1], "text")
                stats["menus"] += len(items)

        # ---- tabs.register.yaml ----
        tfile = cfg_dir / "tabs.register.yaml"
        if tfile.exists():
            data = _read_yaml(tfile)
            if not isinstance(data, dict):
                raise ValueError(f"[{mod_key}] tabs.register.yaml 必须为对象：/base → tabs[]")
            for base, items in data.items():
                if not isinstance(base, str) or not base.startswith("/"):
                    raise ValueError(f"[{mod_key}] tabs.register key 必须以 / 开头：{base!r}")
                if not isinstance(items, list):
                    raise ValueError(f"[{mod_key}] tabs.register.{base} 必须为数组")
                bucket = tabs.setdefault(base, [])
                for it in items:
                    if not isinstance(it, dict):
                        raise ValueError(f"[{mod_key}] tabs.register.{base}[] 必须为对象")
                    for k in ("key", "text", "href"):
                        if k not in it or not isinstance(it[k], str) or not it[k].strip():
                            raise ValueError(f"[{mod_key}] tabs.register.{base}[] 缺少/非法字段：{k}")
                    if not str(it["href"]).startswith("/"):
                        raise ValueError(f"[{mod_key}] tabs.register.{base}[] href 必须以 / 开头：{it['href']!r}")
                    bucket.append(_norm_tab_item(it))
                # 去重（按 key / href）
                dedup, seen_k, seen_h = [], set(), set()
                for x in bucket:
                    if x["key"] in seen_k or x["href"] in seen_h: continue
                    seen_k.add(x["key"]); seen_h.add(x["href"]); dedup.append(x)
                tabs[base] = dedup
                _sorted_inplace(tabs[base], "text")
                stats["tabs"] += len(items)

        stats["modules"] += 1

    now = datetime.now(timezone.utc).isoformat()
    digest_src = json.dumps({"menu": menu, "tabs": tabs}, ensure_ascii=False, sort_keys=True)
    sha = hashlib.sha1(digest_src.encode("utf-8")).hexdigest()[:16]
    return { "menu": menu, "tabs": tabs, "generated_at": now, "hash": sha, "stats": stats }
