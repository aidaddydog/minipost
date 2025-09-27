# -*- coding: utf-8 -*-
"""
快照存储（文件制）
- data/system_upgrade/history.jsonl
"""
from __future__ import annotations
import os, json, uuid, time
from pathlib import Path
from typing import Dict, Any, List, Optional

DATA_DIR = Path(os.getenv("UPGRADE_DATA_DIR", Path(__file__).resolve().parents[5] / "data" / "system_upgrade"))
DATA_DIR.mkdir(parents=True, exist_ok=True)
HIST = DATA_DIR / "history.jsonl"

def _write_row(row: Dict[str, Any]) -> None:
    HIST.parent.mkdir(parents=True, exist_ok=True)
    with HIST.open("a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")

def _read_all() -> List[Dict[str, Any]]:
    if not HIST.exists(): return []
    out: List[Dict[str, Any]] = []
    with HIST.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line: continue
            try:
                out.append(json.loads(line))
            except Exception:
                continue
    # 新的在前
    out.sort(key=lambda d: d.get("created_at", 0), reverse=True)
    return out

def add_history(branch: str, version: str, files: List[str], log: str) -> Dict[str, Any]:
    row = {
        "id": str(uuid.uuid4()),
        "branch": branch,
        "version": version,
        "files": files,
        "log": log,
        "created_at": int(time.time()*1000),
    }
    _write_row(row)
    return row

def list_history(page: int, page_size: int) -> Dict[str, Any]:
    rows = _read_all()
    total = len(rows)
    s = (page-1)*page_size; e = s+page_size
    return {"rows": rows[s:e], "total": total, "page": page, "page_size": page_size}

def get_history(hid: str) -> Optional[Dict[str, Any]]:
    for r in _read_all():
        if r.get("id")==hid: return r
    return None

def delete_history(hid: str) -> bool:
    rows = _read_all()
    new = [r for r in rows if r.get("id")!=hid]
    tmp = HIST.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        for r in new:
            f.write(json.dumps(r, ensure_ascii=False)+"\n")
    tmp.replace(HIST)
    return len(new)!=len(rows)
