#!/usr/bin/env bash
# scripts/reload_nav.sh
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# 提示改为递归
echo -e "\033[1;36m[reload_nav]\033[0m 聚合 modules/**/config/*.yaml → /api/nav"

compose_yml="$ROOT/deploy/docker-compose.yml"

run_python(){
python3 - <<'PY'
from app.common.utils import refresh_nav_cache
nav = refresh_nav_cache()
s = nav.get("stats", {})
print(f"[reload_nav] 已聚合：模块 {s.get('modules',0)} / 菜单 {s.get('menus',0)} / 页签 {s.get('tabs',0)}")
PY
}

if command -v docker >/dev/null 2>&1 && command -v docker compose >/dev/null 2>&1; then
  if docker compose -f "$compose_yml" ps --services 2>/dev/null | grep -q '^web$'; then
    docker compose -f "$compose_yml" exec -T web python - <<'PY' || run_python
from app.common.utils import refresh_nav_cache
nav = refresh_nav_cache()
s = nav.get("stats", {})
print(f"[reload_nav] 已聚合：模块 {s.get('modules',0)} / 菜单 {s.get('menus',0)} / 页签 {s.get('tabs',0)}")
PY
  else
    run_python
  fi
else
  run_python
fi

# 兼容 docker-compose / docker compose 两种用法
has_docker_compose_subcmd() { docker compose version >/dev/null 2>&1; }
has_docker_compose_bin()    { command -v docker-compose >/dev/null 2>&1; }

if command -v docker >/dev/null 2>&1 && has_docker_compose_subcmd; then
  if docker compose -f "$compose_yml" ps --services 2>/dev/null | grep -q '^web$'; then
    docker compose -f "$compose_yml" exec -T web python - <<'PY' || run_python
from app.common.utils import refresh_nav_cache
nav = refresh_nav_cache()
s = nav.get("stats", {})
print(f"[reload_nav] 已聚合：模块 {s.get('modules',0)} / 菜单 {s.get('menus',0)} / 页签 {s.get('tabs',0)}")
PY
  else
    run_python
  fi
elif has_docker_compose_bin; then
  if docker-compose -f "$compose_yml" ps --services 2>/dev/null | grep -q '^web$'; then
    docker-compose -f "$compose_yml" exec -T web python - <<'PY' || run_python
from app.common.utils import refresh_nav_cache
nav = refresh_nav_cache()
s = nav.get("stats", {})
print(f"[reload_nav] 已聚合：模块 {s.get('modules',0)} / 菜单 {s.get('menus',0)} / 页签 {s.get('tabs',0)}")
PY
  else
    run_python
  fi
else
  run_python
fi
