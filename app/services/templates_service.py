import os, shutil
from datetime import datetime
from typing import List, Tuple
from sqlalchemy.orm import Session

TPL_ROOT = os.path.join(os.path.dirname(__file__), "..", "templates")
TPL_ROOT = os.path.abspath(TPL_ROOT)

def safe_path(rel: str) -> str:
    rel = rel.strip().lstrip('/')
    abs_p = os.path.abspath(os.path.join(TPL_ROOT, rel))
    if not abs_p.startswith(TPL_ROOT): raise ValueError("invalid path")
    return abs_p

def list_templates() -> list[tuple[str, str]]:
    out: list[tuple[str,str]] = []
    for root, _, files in os.walk(TPL_ROOT):
        for f in files:
            if not f.endswith('.html'): continue
            abs_p = os.path.join(root, f)
            rel = os.path.relpath(abs_p, TPL_ROOT)
            out.append((rel, abs_p))
    out.sort()
    return out

def read_template(rel: str) -> str:
    abs_p = safe_path(rel)
    with open(abs_p, 'r', encoding='utf-8') as f:
        return f.read()

def save_template(rel: str, content: str) -> str:
    abs_p = safe_path(rel)
    os.makedirs(os.path.dirname(abs_p), exist_ok=True)
    # 备份一份
    backup_dir = os.path.join(os.path.dirname(__file__), "..","..", "updates", "template-backups", datetime.utcnow().strftime("%Y%m%d-%H%M%S"))
    os.makedirs(os.path.join(backup_dir, os.path.dirname(rel)), exist_ok=True)
    if os.path.exists(abs_p):
        shutil.copy2(abs_p, os.path.join(backup_dir, rel))
    with open(abs_p, 'w', encoding='utf-8') as f:
        f.write(content)
    return rel
