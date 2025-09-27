# -*- coding: utf-8 -*-
"""
更新执行器（模拟 / 最小化）
- 在“真实模式”下，仅打印将要操作的文件列表，实际覆盖逻辑由部署脚本处理
- 默认：仅更新有变化的文件；不清数据库
"""
from __future__ import annotations
from typing import List, Dict, Any
from .diff_service import gen_diff

def run_execute(branch: str, only_changed: bool=True) -> Dict[str, Any]:
    d = gen_diff(branch)
    files = d.get("changed_files", [])
    if not files and only_changed:
        return {"updated": [], "skipped": [], "log": "no changes"}
    # 这里可以扩展实际覆盖逻辑；当前返回模拟结果
    return {"updated": files, "skipped": []}
