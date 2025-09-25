#!/usr/bin/env bash
set -e
COMPOSE_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/compose/docker-compose.yml"
echo "[导航聚合] 正在聚合 modules/*/config/*.yaml …"
docker compose -f "$COMPOSE_FILE" exec -T web bash -lc "python -m app.bootstrap reload-nav"
echo "[导航聚合] 完成。可访问 /api/nav"
echo "一行日志命令： docker compose -f $COMPOSE_FILE logs web --tail=200  # 查看 Web 容器日志"
