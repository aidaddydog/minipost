#!/usr/bin/env bash
# scripts/reload_nav.sh
# 说明：热加载聚合导航。优先在容器内执行；若容器未启动，则在宿主机执行。
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo -e "\033[1;36m[reload_nav]\033[0m 聚合 modules/*/config/*.yaml → /api/nav"

compose_yml="$ROOT/deploy/docker-compose.yml"
run_python(){
python3 - <<'PY'
from app.services.nav_loader import rebuild_nav
nav = rebuild_nav(write_cache=True)
s = nav.get("stats", {})
print(f"[reload_nav] 已聚合：模块 {s.get('modules',0)} / 菜单 {s.get('menus',0)} / 页签 {s.get('tabs',0)}")
PY
}

if command -v docker >/dev/null 2>&1 && [ -f "$compose_yml" ]; then
  # 尝试容器内执行（服务名按现有编排为 web）
  if docker compose -f "$compose_yml" ps --services 2>/dev/null | grep -q '^web$'; then
    docker compose -f "$compose_yml" exec -T web python - <<'PY' || run_python
from app.services.nav_loader import rebuild_nav
nav = rebuild_nav(write_cache=True)
s = nav.get("stats", {})
print(f"[reload_nav] 已聚合：模块 {s.get('modules',0)} / 菜单 {s.get('menus',0)} / 页签 {s.get('tabs',0)}")
PY
  else
    run_python
  fi
else
  run_python
fi
