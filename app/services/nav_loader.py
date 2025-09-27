
# -*- coding: utf-8 -*-
"""
导航聚合器（新 Schema，递归扫描 + 自动 mount 推断）
- 扫描：modules/**/config/{module.meta.yaml, menu.register.yaml, tabs.register.yaml}
- 自动生成：若 tabs.register 未写 mount，按 /l1/l2/l3 推断模块静态路径与挂载函数；前端可直接内嵌渲染
- 结果结构：
  {
    "menu": { "<L1标题>": [{text, href, order?, icon?}, ...], ... },
    "tabs": { "/<l1>/<l2>": [{key, text, href, order?, mount?:{mode,css[],js[],call,container,host}, ...}...] },
    "generated_at": ISO8601Z,
    "hash": "sha1-16",
    "stats": { "modules": N, "menus": M, "tabs": T }
  }
"""
from __future__ import annotations
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone
import json, hashlib, os

try:
    import yaml  # type: ignore
except Exception as e:
    raise RuntimeError("缺少 PyYAML，请安装 python3-yaml") from e

REPO_ROOT = Path(__file__).resolve().parents[2]
MODULES_DIR = REPO_ROOT / "modules"

DEFAULT_CACHE_DIR = REPO_ROOT / "runtime"
CACHE_DIR  = Path(os.getenv("NAV_CACHE_DIR", str(DEFAULT_CACHE_DIR)))
CACHE_FILE = Path(os.getenv("NAV_CACHE_FILE", str(CACHE_DIR / "nav.cache.json")))

def _find_yaml(cfg_dir: Path, stem: str) -> Optional[Path]:
    for ext in (".yaml", ".yml"):
        p = cfg_dir / f"{stem}{ext}"
        if p.exists() and p.is_file():
            return p
    return None

def _load_yaml(fp: Path) -> Any:
    text = fp.read_text(encoding="utf-8", errors="ignore")
    return yaml.safe_load(text)

def _to_bool(v: Any, default=True) -> bool:
    if isinstance(v, bool):
        return v
    if isinstance(v, str):
        return v.strip().lower() in ("1","true","yes","on")
    return default

def _sorted_inplace(bucket: List[dict]) -> None:
    for it in bucket:
        if "order" not in it or not isinstance(it.get("order"), int):
            it["order"] = 100
    bucket.sort(key=lambda d: (d.get("order", 100), d.get("text","") or d.get("title","")))

def _dedupe_by_key(bucket: List[dict], key: str) -> None:
    seen = set()
    out = []
    for it in bucket:
        val = it.get(key)
        if val in seen:
            continue
        seen.add(val); out.append(it)
    bucket[:] = out

def _validate_menu(menu: dict, mod: str) -> int:
    if not isinstance(menu, dict):
        raise ValueError(f"[{mod}] menu.register 需为对象：L1 → items[]")
    cnt = 0
    for l1, items in menu.items():
        if not isinstance(l1, str) or not l1.strip():
            raise ValueError(f"[{mod}] menu.register L1（键）必须为非空字符串")
        if not isinstance(items, list):
            raise ValueError(f"[{mod}] menu.register.{l1} 必须为数组")
        for it in items:
            if not isinstance(it, dict):
                raise ValueError(f"[{mod}] menu.register.{l1}[] 必须为对象")
            for k in ("text","href"):
                if k not in it or not isinstance(it[k], str) or not it[k].strip():
                    raise ValueError(f"[{mod}] menu.register.{l1}[] 缺少/非法字段：{k}")
            if not it["href"].startswith("/"):
                raise ValueError(f"[{mod}] menu.register.{l1}[] href 必须以 / 开头：{it['href']}")
            if "order" in it and not isinstance(it["order"], int):
                raise ValueError(f"[{mod}] menu.register.{l1}[] order 必须为整数")
            cnt += 1
    return cnt

def _validate_tabs(tabs: dict, mod: str) -> int:
    if not isinstance(tabs, dict):
        raise ValueError(f"[{mod}] tabs.register 必须为对象：/base → tabs[]")
    cnt = 0
    for base, items in tabs.items():
        if not isinstance(base, str) or not base.startswith("/"):
            raise ValueError(f"[{mod}] tabs.register key 必须为以 / 开头的路径：{base!r}")
        if not isinstance(items, list):
            raise ValueError(f"[{mod}] tabs.register.{base} 必须为数组")
        for it in items:
            if not isinstance(it, dict):
                raise ValueError(f"[{mod}] tabs.register.{base}[] 必须为对象")
            for k in ("key","text","href"):
                if k not in it or not isinstance(it[k], str) or not it[k].strip():
                    raise ValueError(f"[{mod}] tabs.register.{base}[] 缺少/非法字段：{k}")
            if not it["href"].startswith("/"):
                raise ValueError(f"[{mod}] tabs.register.{base}[] href 必须以 / 开头：{it['href']}")
            if "order" in it and not isinstance(it["order"], int):
                raise ValueError(f"[{mod}] tabs.register.{base}[] order 必须为整数")
            cnt += 1
    return cnt

def _write_cache_safe(nav: Dict[str, Any]) -> None:
    try:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        CACHE_FILE.write_text(json.dumps(nav, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception:
        pass

def _href_to_candidates(href: str) -> Dict[str, Any]:
    # /l1/l2/l3 -> 常见模块路径与命名候选
    parts = [p for p in href.split("/") if p]
    if len(parts) < 3:
        return {}
    l1,l2,l3 = parts[:3]
    base = f"{l1}_{l2}"
    name = f"{l1}_{l3}"
    static_dirs = [
        MODULES_DIR / base / name / "frontend" / "static",
        MODULES_DIR / base / l3   / "frontend" / "static",
    ]
    js_names = [f"{name}.js", f"{l3}.js", "index.js", "main.js", "app.js", "page.js", "bundle.js"]
    css_names= [f"{name}.css", f"{name}..css", f"{l3}.css", f"{l3}..css", "index.css", "main.css", "app.css", "page.css"]
    func_names=[f"__minipost_mount_{name}", f"__minipost_mount_{l3}", f"MinipostMount_{name}", f"MinipostMount_{l3}", "init"]
    return {"l1": l1, "l3": l3, "static_dirs": static_dirs, "js_names": js_names, "css_names": css_names, "func_names": func_names}

def _infer_mount_for_href(href: str) -> Optional[dict]:
    cand = _href_to_candidates(href)
    if not cand:
        return None
    js_list: List[str] = []
    css_list: List[str] = []
    for d in cand["static_dirs"]:
        if not d.exists():
            continue
        # 绝对路径 -> URL 路径
        for name in cand["css_names"]:
            fp = d / name
            if fp.exists():
                rel = fp.relative_to(REPO_ROOT)
                css_list.append("/" + str(rel).replace("\\","/"))
        for name in cand["js_names"]:
            fp = d / name
            if fp.exists():
                rel = fp.relative_to(REPO_ROOT)
                js_list.append("/" + str(rel).replace("\\","/"))
        # 找到至少一个 js 即可
        if js_list:
            break
    if not js_list and not css_list:
        # 没找到静态资源，不强塞 inline；让前端按 iframe 兜底
        return {"mode": "iframe"}
    call = cand["func_names"][0]
    container = f'<div id="{cand["l1"]}-{cand["l3"]}-app"></div>'
    return {
        "mode": "inline",
        "js": js_list,
        "css": css_list,
        "call": call,
        "container": container,
        "host": "#tabPanel"
    }

def rebuild_nav(write_cache: bool=True) -> Dict[str, Any]:
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

        # module.meta 支持两种写法：enabled: true | module: { enabled: true }
        meta_fp = _find_yaml(cfg_dir, "module.meta")
        if meta_fp:
            meta = _load_yaml(meta_fp) or {}
            enabled = True
            if isinstance(meta, dict):
                if "enabled" in meta:
                    enabled = _to_bool(meta.get("enabled"), True)
                elif isinstance(meta.get("module"), dict) and "enabled" in meta["module"]:
                    enabled = _to_bool(meta["module"].get("enabled"), True)
            if not enabled:
                continue

        # 菜单
        menu_fp = _find_yaml(cfg_dir, "menu.register")
        if menu_fp:
            raw = _load_yaml(menu_fp) or {}
            try:
                stats["menus"] += _validate_menu(raw, mod_name)
            except Exception:
                raw = {}
            for l1, items in (raw or {}).items():
                bucket = menu.setdefault(l1, [])
                for it in items:
                    row = {
                        "text": it["text"].strip(),
                        "href": it["href"].strip(),
                        "order": it.get("order", 100),
                    }
                    if isinstance(it.get("icon"), str):
                        row["icon"] = it["icon"].strip()
                    bucket.append(row)
                _dedupe_by_key(bucket, "href"); _sorted_inplace(bucket)

        # 页签
        tabs_fp = _find_yaml(cfg_dir, "tabs.register")
        if tabs_fp:
            raw = _load_yaml(tabs_fp) or {}
            try:
                stats["tabs"] += _validate_tabs(raw, mod_name)
            except Exception:
                raw = {}
            for base, items in (raw or {}).items():
                bucket = tabs.setdefault(base, [])
                for it in items:
                    row = {
                        "key": it["key"].strip(),
                        "text": it["text"].strip(),
                        "href": it["href"].strip(),
                        "order": it.get("order", 100),
                    }
                    # 透传其它字段
                    for k, v in it.items():
                        if k in ("key","text","href","order"):
                            continue
                        row[k] = v
                    # 自动 mount：只有当 YAML 未提供 mount 且 href 能够推断时才生成
                    if "mount" not in row:
                        m = _infer_mount_for_href(row["href"])
                        if m:
                            row["mount"] = m
                    bucket.append(row)
                _dedupe_by_key(bucket, "key"); _dedupe_by_key(bucket, "href"); _sorted_inplace(bucket)

        stats["modules"] += 1

    now = datetime.now(timezone.utc).isoformat()
    digest_src = json.dumps({"menu": menu, "tabs": tabs}, ensure_ascii=False, sort_keys=True)
    sha = hashlib.sha1(digest_src.encode("utf-8")).hexdigest()[:16]
    nav = {"menu": menu, "tabs": tabs, "generated_at": now, "hash": sha, "stats": stats}
    if write_cache: _write_cache_safe(nav)
    return nav
