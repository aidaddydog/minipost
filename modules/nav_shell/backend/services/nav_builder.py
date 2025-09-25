# 动态桥接：将 import 路径 modules.nav_shell.backend.services.nav_builder
# 转发到真实文件 modules/nav-shell/backend/services/nav_builder.py
from __future__ import annotations
import importlib.util, pathlib, types

_BASE = pathlib.Path(__file__).resolve().parents[4]
_REAL = _BASE / 'modules' / 'nav-shell' / 'backend' / 'services' / 'nav_builder.py'

spec = importlib.util.spec_from_file_location('navshell_real.nav_builder', _REAL)
if spec is None or spec.loader is None:
    raise ImportError(f'未找到真实 nav_builder.py: {_REAL}')
_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(_mod)  # type: ignore

# 透出公共符号
rebuild_nav_cache = _mod.rebuild_nav_cache
load_nav_cache    = _mod.load_nav_cache
filter_nav        = _mod.filter_nav
