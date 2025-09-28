# -*- coding: utf-8 -*-
"""
Git 客户端（最佳努力）
- 优先真实执行：调用 git CLI
- 失败时回落到“模拟模式”（返回固定分支/空变化）
"""
from __future__ import annotations
import subprocess, os, shlex
from dataclasses import dataclass
from pathlib import Path
from typing import List, Tuple

@dataclass
class GitInfo:
    branches: List[str]
    current: str

# 仓库根：优先环境变量 GIT_REPO_DIR；否则回溯到项目根（parents[5]）
_REPO_ROOT = Path(__file__).resolve().parents[5]
REPO_DIR = Path(os.getenv("GIT_REPO_DIR") or _REPO_ROOT)

def _run(cmd: str, cwd: Path) -> Tuple[int, str, str]:
    try:
        p = subprocess.run(
            shlex.split(cmd), cwd=str(cwd), capture_output=True, text=True, check=False
        )
        return p.returncode, p.stdout or "", p.stderr or ""
    except Exception as e:
        return 1, "", str(e)

def list_branches() -> GitInfo:
    # 模拟模式：没有 .git 就返回固定数据
    if not (REPO_DIR / ".git").exists():
        return GitInfo(branches=["main", "stable"], current="main")

    code, out, err = _run("git branch --all --format=%(refname:short)", REPO_DIR)
    if code != 0:
        return GitInfo(branches=["main"], current="main")
    brs = [s.strip().replace("remotes/origin/", "") for s in out.splitlines() if s.strip()]
    brs = sorted({b for b in brs if "/" not in b}) or ["main"]
    code, out, err = _run("git rev-parse --abbrev-ref HEAD", REPO_DIR)
    current = out.strip() or "main"
    return GitInfo(branches=brs, current=current)

def diff_from_remote(branch: str) -> List[str]:
    # 没有 .git -> 模拟，无变化
    if not (REPO_DIR / ".git").exists():
        return []
    _run(f"git fetch origin {branch}", REPO_DIR)
    code, out, err = _run(f"git diff --name-only HEAD..origin/{branch}", REPO_DIR)
    if code != 0:
        return []
    files = [s.strip() for s in out.splitlines() if s.strip()]
    # 仅关注受控路径
    allow_prefix = ("app/", "modules/", "static/", "scripts/")
    return [f for f in files if f.startswith(allow_prefix)]
