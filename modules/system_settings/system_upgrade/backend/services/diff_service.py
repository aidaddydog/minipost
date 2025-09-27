# -*- coding: utf-8 -*-
from __future__ import annotations
from typing import List, Dict, Any
from .git_client import diff_from_remote

def gen_diff(branch: str) -> Dict[str, Any]:
    files = diff_from_remote(branch)
    return {"changed_files": files, "count": len(files)}
