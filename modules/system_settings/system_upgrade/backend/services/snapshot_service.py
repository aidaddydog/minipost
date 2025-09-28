# -*- coding: utf-8 -*-
"""
快照存储（文件制）
- 存放：data/system_upgrade/history.jsonl
- 设计要点：
  1) 不在模块导入期做任何写操作（避免路由加载被异常中断）
  2) 基准路径优先读环境变量 UPGRADE_DATA_DIR；否则回落到“项目根/data/system_upgrade”
  3) 读不到/写失败一律“软失败”，接口仍可返回空列表，避免前端空白
"""
from __future__ import annotations
import os, json, uuid, time
from pathlib import Path
from typing import Dict, Any, List, Optional

# 计算项目根：本文件位于 modules/system_settings/system_upgrade/backend/services
# 回溯 4 层到仓库根：.../modules -> .../minipost-main
_REPO_ROOT = Path(__file__).resolve().parents[4]

# 数据目录：优先环境变量；否则 <repo>/data/system_upgrade
DATA_DIR = Path(os.getenv("UPGRADE_DATA_DIR") or (_REPO_ROOT / "data" / "system_upgrade"))
HIST = DATA_DIR / "history.jsonl"

def _ensure_dir() -> None:
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
    except Exception:
        # 不能因为目录权限问题而让模块导入或接口调用崩溃
        pass

def _read_all() -> List[Dict[str, Any]]:
    """读取全部历史记录（按 created_at 倒序）；读不到则返回空列表"""
    try:
        if not HIST.exists():
            return []
        rows: List[Dict[str, Any]] = []
        with HIST.open("r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    rows.append(json.loads(line))
                except Exception:
                    # 跳过坏行
                    continue
        rows.sort(key=lambda r: r.get("created_at", 0), reverse=True)
        return rows
    except Exception:
        return []

def list_history(page: int = 1, page_size: int = 20) -> Dict[str, Any]:
    page = max(1, int(page or 1))
    page_size = min(200, max(1, int(page_size or 20)))
    rows = _read_all()
    total = len(rows)
    start = (page - 1) * page_size
    end = start + page_size
    return {"rows": rows[start:end], "total": total, "page": page, "page_size": page_size}

def add_history(branch: str, version: str, files: List[str], log: str) -> Dict[str, Any]:
    _ensure_dir()
    row = {
        "id": uuid.uuid4().hex,
        "branch": branch,
        "version": version,
        "files": list(files or []),
        "log": str(log or ""),
        "created_at": int(time.time()),
    }
    try:
        with HIST.open("a", encoding="utf-8") as f:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
    except Exception:
        # 写失败也不抛，保证接口可返回
        pass
    return row

def get_history(hid: str) -> Optional[Dict[str, Any]]:
    for r in _read_all():
        if r.get("id") == hid:
            return r
    return None

def delete_history(hid: str) -> bool:
    _ensure_dir()
    rows = _read_all()
    new_rows = [r for r in rows if r.get("id") != hid]
    if len(new_rows) == len(rows):
        return False
    try:
        tmp = HIST.with_suffix(".tmp")
        with tmp.open("w", encoding="utf-8") as f:
            for r in new_rows:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
        tmp.replace(HIST)
        return True
    except Exception:
        return False
