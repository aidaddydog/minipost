#!/usr/bin/env bash
set -Eeuo pipefail
COMPOSE_FILE="compose/docker-compose.yml"
TS=$(date +%Y%m%d_%H%M%S)
OUT="backup_${TS}.sql"
docker compose -f "$COMPOSE_FILE" exec -T db pg_dump -U ${POSTGRES_USER:-minipost} ${POSTGRES_DB:-minipost} > "$OUT"
echo "— 备份完成：$OUT"
echo "查看数据库日志（复制执行）：docker compose -f $COMPOSE_FILE logs db --tail=200"
