# -*- coding: utf-8 -*-
from __future__ import annotations
import os, glob, json, yaml
from typing import Dict, Any, List

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
MOD_DIR  = os.path.join(BASE_DIR, "modules")
CACHE    = os.path.join(MOD_DIR, "nav-shell", "cache", "nav.json")

def _merge_nav(nav_items: List[str]) -> Dict[str, Any]:
    l1: List[Dict[str, Any]] = []
    l2: Dict[str, List[Dict[str, Any]]] = {}
    l3: Dict[str, List[Dict[str, Any]]] = {}

    seen_l1 = set()
    for fp in nav_items:
        with open(fp, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
        for it in data.get("l1", []) or []:
            key = (it.get("key"), it.get("href"))
            if key in seen_l1: continue
            seen_l1.add(key)
            l1.append({k:v for k,v in it.items() if v is not None})
        for k, arr in (data.get("l2") or {}).items():
            bucket = l2.setdefault(k, [])
            for e in arr or []:
                if not any(x.get("href")==e.get("href") for x in bucket):
                    bucket.append({k2:v2 for k2,v2 in e.items() if v2 is not None})
        for k, arr in (data.get("l3") or {}).items():
            bucket = l3.setdefault(k, [])
            for e in arr or []:
                if not any(x.get("href")==e.get("href") for x in bucket):
                    bucket.append({k2:v2 for k2,v2 in e.items() if v2 is not None})

    def sort_list(arr: List[Dict[str, Any]]):
        arr.sort(key=lambda x: (x.get("order", 9999), str(x.get("text",""))))

    sort_list(l1)
    for arr in l2.values(): sort_list(arr)
    for arr in l3.values(): sort_list(arr)

    return {"l1": l1, "l2": l2, "l3": l3}

def build_nav_cache() -> str:
    files = sorted(glob.glob(os.path.join(MOD_DIR, "*", "config", "menu.register.yaml")))
    nav = _merge_nav(files)
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    with open(CACHE, "w", encoding="utf-8") as f:
        json.dump(nav, f, ensure_ascii=False, indent=2)
    return CACHE

def load_nav_cache() -> Dict[str, Any]:
    if not os.path.exists(CACHE):
        build_nav_cache()
    with open(CACHE, "r", encoding="utf-8") as f:
        return json.load(f)

def filter_nav_by_perms(nav: Dict[str, Any], user) -> Dict[str, Any]:
    # require_all/any 与 visible_when_denied：未通过时可灰置或隐藏
    if not user:
        def filt(arr):
            out=[]
            for e in arr:
                if e.get("require_all") or e.get("require_any"):
                    if e.get("visible_when_denied"):
                        ee=dict(e); ee["disabled"]=True; out.append(ee)
                    else:
                        continue
                else:
                    out.append(e)
            return out
        l1 = filt(nav.get("l1",[]))
        l2 = {k: filt(v) for k,v in (nav.get("l2") or {}).items()}
        l3 = {k: filt(v) for k,v in (nav.get("l3") or {}).items()}
        return {"l1":l1,"l2":l2,"l3":l3}

    from app.deps import SessionLocal
    from modules.core.backend.services.rbac_service import get_user_permissions
    db = SessionLocal()
    try:
        perms = get_user_permissions(db, user.id)
    finally:
        db.close()

    def ok(entry):
        all_req = entry.get("require_all") or []
        any_req = entry.get("require_any") or []
        passed = True
        if all_req: passed = all(p in perms or "*" in perms for p in all_req)
        if passed and any_req: passed = any(p in perms or "*" in perms for p in any_req)
        return passed

    def filt(arr):
        out=[]
        for e in arr:
            if ok(e): out.append(e)
            else:
                if e.get("visible_when_denied"):
                    ee=dict(e); ee["disabled"]=True; out.append(ee)
        return out

    l1 = filt(nav.get("l1",[]))
    l2 = {k: filt(v) for k,v in (nav.get("l2") or {}).items()}
    l3 = {k: filt(v) for k,v in (nav.get("l3") or {}).items()}
    return {"l1":l1,"l2":l2,"l3":l3}
