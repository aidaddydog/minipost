# -*- coding: utf-8 -*-
"""
Git 客户端（最佳努力）
- 优先真实执行：调用 git CLI
- 失败时回落到“模拟模式”（返回固定分支/空变化）
"""
from __future__ import annotations
import subprocess, os, shlex, json
from dataclasses import dataclass
from pathlib import Path
from typing import List, Tuple

@dataclass
class GitInfo:
    branches: List[str]
    current: str

REPO_DIR = Path(os.getenv("GIT_REPO_DIR", Path(__file__).resolve().parents[5]))  # 仓库根

def _run(cmd: str, cwd: Path) -> Tuple[int, str, str]:
    try:
        p = subprocess.run(shlex.split(cmd), cwd=str(cwd), stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False, text=True)
        return p.returncode, p.stdout.strip(), p.stderr.strip()
    except Exception as e:
        return 1, "", str(e)

def list_branches() -> GitInfo:
    if not (REPO_DIR / ".git").exists():
        # 模拟
        return GitInfo(branches=["main"], current="main")
    _run("git fetch --all --prune", REPO_DIR)
    code, out, err = _run("git branch -r", REPO_DIR)
    if code != 0:
        return GitInfo(branches=["main"], current="main")
    brs = []
    for line in out.splitlines():
        line = line.strip()
        if "->" in line:  # 跳过 HEAD -> origin/main
            continue
        if line.startswith("origin/"):
            brs.append(line.split("/",1)[1])
    brs = sorted(set(brs)) or ["main"]
    code2, cur, _ = _run("git rev-parse --abbrev-ref HEAD", REPO_DIR)
    current = cur.strip() if code2==0 else "main"
    return GitInfo(branches=brs, current=current)

def diff_from_remote(branch: str) -> List[str]:
    if not (REPO_DIR / ".git").exists():
        return []  # 模拟
    _run("git fetch origin "+branch, REPO_DIR)
    code, out, err = _run(f"git diff --name-only HEAD..origin/{branch}", REPO_DIR)
    if code != 0:
        return []
    files = [s.strip() for s in out.splitlines() if s.strip()]
    # 仅关注 modules/ 与 app/、static/、scripts/ 等受控路径
    allow_prefix = ("app/", "modules/", "static/", "scripts/")
    files = [f for f in files if f.startswith(allow_prefix)]
    return files
