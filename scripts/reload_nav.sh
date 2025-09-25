#!/usr/bin/env bash
set -Eeuo pipefail
echo "[nav] 重建导航缓存 ..."
docker compose -f compose/docker-compose.yml exec -T web python - <<'PY'
from modules.nav_shell.backend.services.nav_builder import rebuild_nav_cache
print(rebuild_nav_cache())
PY
echo "[nav] 完成。"
