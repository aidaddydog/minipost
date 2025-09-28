# -*- coding: utf-8 -*-
"""
系统更新（L3）API
前缀：/api/settings/system_settings/system_upgrade
- list branches
- check diff
- execute upgrade (write history)
- history/rollback/delete/log
"""
from __future__ import annotations
from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Dict, Any

from modules.system_settings.system_upgrade.backend.services.git_client import list_branches
from modules.system_settings.system_upgrade.backend.services.diff_service import gen_diff
from modules.system_settings.system_upgrade.backend.services.upgrade_executor import run_execute
from modules.system_settings.system_upgrade.backend.services.snapshot_service import (
    add_history, list_history, get_history, delete_history
)

router = APIRouter(prefix="/api/settings/system_settings/system_upgrade", tags=["system_upgrade"])


class CheckReq(BaseModel):
    branch: str = Field(default="main")


class ExecReq(BaseModel):
    branch: str = Field(default="main")
    options: Dict[str, Any] = Field(default_factory=dict)


@router.get("/branches")
def api_branches():
    gi = list_branches()
    return {"data": {"branches": gi.branches, "current": gi.current}}


@router.post("/check")
def api_check(req: CheckReq):
    d = gen_diff(req.branch)
    now = datetime.utcnow()
    version = now.strftime("%y%m%d%H%M")
    return {"data": {"update_available": d.get("count", 0) > 0, "version": version, **d}}


@router.post("/execute")
def api_execute(req: ExecReq):
    branch = req.branch or "main"
    opts = req.options or {}
    only_changed = bool(opts.get("only_changed", True))
    backup = bool(opts.get("backup", True))

    d = run_execute(branch=branch, only_changed=only_changed)
    version = datetime.utcnow().strftime("%y%m%d%H%M")
    log_lines = [
        f"branch: {branch}",
        f"backup: {backup}",
        f"updated: {len(d.get('updated', []))} files",
        *[f" + {p}" for p in d.get("updated", [])[:200]],  # 限制示例日志长度
    ]
    row = add_history(branch=branch, version=version, files=d.get("updated", []), log="\n".join(log_lines))
    return {"ok": True, "message": "execute done", "data": row}


@router.get("/history")
def api_history(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=200)):
    return {"data": list_history(page=page, page_size=page_size)}


@router.post("/history/{hid}/rollback")
def api_rollback(hid: str):
    item = get_history(hid)
    if not item:
        raise HTTPException(status_code=404, detail="not found")
    # 此处仅记录日志，真实回滚策略由部署脚本/CI 实现
    row = add_history(
        branch=item["branch"],
        version=item["version"],
        files=item.get("files", []),
        log="rollback to " + item["id"],
    )
    return {"ok": True, "data": row}


@router.delete("/history/{hid}")
def api_delete(hid: str):
    ok = delete_history(hid)
    return {"ok": ok}


@router.get("/history/{hid}/log")
def api_log(hid: str):
    item = get_history(hid)
    if not item:
        raise HTTPException(status_code=404, detail="not found")
    return {"data": {"log": item.get("log", "")}}
