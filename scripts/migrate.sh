#!/usr/bin/env bash
set -Eeuo pipefail
COMPOSE_FILE="compose/docker-compose.yml"
docker compose -f "$COMPOSE_FILE" exec -T app bash -lc 'alembic -c migrations/alembic.ini upgrade head'
echo "— 已执行数据库迁移"
echo "查看应用日志（复制执行）：docker compose -f $COMPOSE_FILE logs app --tail=200"
